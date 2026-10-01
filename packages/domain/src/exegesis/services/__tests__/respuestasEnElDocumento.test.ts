import { describe, it, expect } from 'vitest';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import {
    assembleMarkdown,
    assemblyContents,
    documentSections,
    inclusionAtBirth,
    sectionHeadings,
} from '../assemblyContents';
import { parseBriefQuestions } from '../briefQuestions';
import { canonicalizeQuestionHeadings, replaceSectionsByHeadings, replaceVerseSectionExact } from '../composedVerseSections';
import { sectionBudgets, verseWordBudget } from '../paperLength';

/**
 * Cuando el encuadre trae preguntas numeradas, el documento son las
 * RESPUESTAS.
 *
 * TP #5, Santiago 2:14-26 (2026-09-30): cuatro preguntas, trece versículos.
 * El presupuesto de 2 páginas se repartió entre los trece y cada respuesta
 * recibió 50 palabras; 2:21 respondía dos preguntas con la parte de una; los
 * títulos del Word decían «Santiago 2:14» y el autor los cambió a mano por
 * las preguntas.
 */
const ENCUADRE = [
    'Responda con base en el texto griego:',
    '1. ¿Cómo funciona la partícula μή (Stg. 2:14)?',
    '2. ¿Qué tipo de condicional hay en Stg. 2:17?',
    '3. ¿Qué voz tiene ἐδικαιώθη (Stg. 2:21)?',
    '4. ¿Cómo se relaciona ἐξ ἔργων con el verbo en 2:21?',
].join('\n');
const PREGUNTAS = parseBriefQuestions(ENCUADRE);

const versiculo = (v: number) => ({
    kind: 'verse' as const,
    verseRef: { bookId: 'JAS' as const, chapterStart: 2, chapterEnd: 2, verseStart: v, verseEnd: v },
});

/** Los pasos tal como nacen: `inclusionAtBirth` decide la marca. */
function pasosAlNacer(cuerpos: Record<number, string> = {}) {
    const pasos = [];
    for (let v = 14; v <= 26; v++) {
        const base = { id: `v${v}`, order: v, ...versiculo(v) };
        pasos.push({
            ...base,
            includeInDocument: inclusionAtBirth(base, PREGUNTAS),
            accepted: cuerpos[v] !== undefined ? { markdown: cuerpos[v] } : null,
        });
    }
    for (const kind of ['conclusion', 'introduction'] as const) {
        const base = { id: kind, order: 90, kind, verseRef: null };
        pasos.push({ ...base, includeInDocument: inclusionAtBirth(base, PREGUNTAS), accepted: null });
    }
    return pasos;
}

const paper = (steps: unknown[]): ExegeticalPaper => ({
    title: 'Trabajo práctico #5',
    passage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 26 },
    displayLanguage: 'es',
    assignmentBrief: ENCUADRE,
    steps,
} as unknown as ExegeticalPaper);

describe('inclusionAtBirth — lo que no responde ninguna pregunta nace fuera', () => {
    it('sólo los versículos con pregunta nacen dentro', () => {
        const dentro = pasosAlNacer().filter(p => p.includeInDocument).map(p => p.id);
        expect(dentro).toEqual(['v14', 'v17', 'v21']);
    });

    it('la introducción y la conclusión nacen fuera', () => {
        expect(inclusionAtBirth({ kind: 'introduction', verseRef: null }, PREGUNTAS)).toBe(false);
        expect(inclusionAtBirth({ kind: 'conclusion', verseRef: null }, PREGUNTAS)).toBe(false);
    });

    it('sin preguntas no decide nada: un encargo en prosa se comporta como siempre', () => {
        expect(inclusionAtBirth(versiculo(15), [])).toBeUndefined();
        expect(inclusionAtBirth({ kind: 'introduction', verseRef: null }, [])).toBeUndefined();
    });

    it('el ensamble no decide su propia pertenencia', () => {
        expect(inclusionAtBirth({ kind: 'assembly', verseRef: null }, PREGUNTAS)).toBeUndefined();
    });
});

describe('el presupuesto, por pregunta respondida', () => {
    it('tres versículos dentro, cuatro partes: 2:21 recibe el doble', () => {
        const secciones = documentSections(pasosAlNacer() as never, PREGUNTAS);
        expect(secciones).toEqual({ verses: 3, shares: 4, introduction: false, conclusion: false });

        const { perShare } = sectionBudgets({ unit: 'words', min: 1200, max: 1200 }, secciones);
        expect(perShare).toBe(300);
        expect(verseWordBudget(perShare, 1)).toBe(300);
        expect(verseWordBudget(perShare, 2)).toBe(600);
    });

    it('un versículo sin pregunta cuenta una parte, no cero', () => {
        expect(verseWordBudget(300, 0)).toBe(300);
    });

    it('sin presupuesto no se inventa uno', () => {
        expect(verseWordBudget(null, 2)).toBeNull();
    });
});

describe('la lista del ensamble', () => {
    it('muestra los trece versículos, generados o no, para poder marcarlos', () => {
        const c = assemblyContents(pasosAlNacer() as never, 'es');
        expect(c.pending.map(p => p.label)).toEqual(['Santiago 2:14', 'Santiago 2:17', 'Santiago 2:21']);
        // Diez versículos y el marco, fuera pero visibles.
        expect(c.excluded).toHaveLength(12);
    });
});

describe('los títulos del documento son las preguntas', () => {
    const cuerpos = {
        14: 'La partícula μή espera respuesta negativa.',
        17: 'Condicional de tercera clase.',
        21: canonicalizeQuestionHeadings(
            '## La voz de ἐδικαιώθη\n\nPasiva.\n\n## ἐξ ἔργων\n\nInstrumental.',
            sectionHeadings(versiculo(21), PREGUNTAS, 'Santiago 2:21'),
        ),
    };
    const md = assembleMarkdown(paper(pasosAlNacer(cuerpos)), 'es');

    it('cada sección se titula con su pregunta, no con la referencia', () => {
        expect(md).toContain('## ¿Cómo funciona la partícula μή (Stg. 2:14)?');
        expect(md).toContain('## ¿Qué tipo de condicional hay en Stg. 2:17?');
        expect(md).not.toContain('## Santiago 2:14');
    });

    it('un versículo que responde dos preguntas lleva dos subsecciones, sin título repetido', () => {
        expect(md.match(/## ¿Qué voz tiene ἐδικαιώθη \(Stg\. 2:21\)\?/g)).toHaveLength(1);
        expect(md).toContain('## ¿Cómo se relaciona ἐξ ἔργων con el verbo en 2:21?');
        expect(md.indexOf('Pasiva.')).toBeLessThan(md.indexOf('## ¿Cómo se relaciona'));
    });

    it('sin preguntas, el título sigue siendo la referencia', () => {
        expect(sectionHeadings(versiculo(15), [], 'Santiago 2:15')).toEqual(['Santiago 2:15']);
    });

    it('recomponer 2:21 cambia sus dos respuestas y nada más', () => {
        const titulos = sectionHeadings(versiculo(21), PREGUNTAS, 'Santiago 2:21');
        const prosa = canonicalizeQuestionHeadings('## 3\n\nPasiva divina.\n\n## 4\n\nMedio, no causa.', titulos);
        const out = replaceSectionsByHeadings(md, titulos, prosa)!;
        expect(out).toContain('Pasiva divina.');
        expect(out).toContain('Medio, no causa.');
        expect(out).not.toContain('Instrumental.');
        expect(out).toContain('La partícula μή espera respuesta negativa.');
        expect(out.match(/## ¿Qué voz tiene/g)).toHaveLength(1);
        // Recomponer con el mismo texto no toca nada.
        expect(replaceSectionsByHeadings(out, titulos, prosa)).toBe(out);
    });

    it('si falta uno de los títulos no reemplaza a ciegas', () => {
        const titulos = sectionHeadings(versiculo(21), PREGUNTAS, 'Santiago 2:21');
        const roto = md.replace('## ¿Cómo se relaciona ἐξ ἔργων con el verbo en 2:21?', '## Otra cosa');
        expect(replaceSectionsByHeadings(roto, titulos, '## a\n\nb')).toBeNull();
    });
});

describe('canonicalizeQuestionHeadings', () => {
    const DOS = ['¿Primera?', '¿Segunda?'];

    it('reescribe los títulos parafraseados con el texto exacto', () => {
        expect(canonicalizeQuestionHeadings('### La primera\n\nA.\n\n### La segunda\n\nB.', DOS))
            .toBe('## ¿Primera?\n\nA.\n\n## ¿Segunda?\n\nB.');
    });

    it('lo que viene antes del primer título queda en la primera respuesta', () => {
        expect(canonicalizeQuestionHeadings('Preámbulo.\n\n## x\n\nA.\n\n## y\n\nB.', DOS))
            .toBe('## ¿Primera?\n\nPreámbulo.\n\nA.\n\n## ¿Segunda?\n\nB.');
    });

    it('con otra cantidad de títulos no adivina: un solo título y ningún texto perdido', () => {
        const out = canonicalizeQuestionHeadings('A.\n\n## x\n\nB.\n\nC.', DOS);
        expect(out).toBe('## ¿Primera?\n\nA.\n\nB.\n\nC.');
    });

    it('con una sola pregunta la prosa queda igual: el título lo pone el ensamblador', () => {
        expect(canonicalizeQuestionHeadings('Prosa.', ['¿Una?'])).toBe('Prosa.');
    });
});

/**
 * Revisión adversarial: cualquier línea numerada es «pregunta» para
 * `parseBriefQuestions`, aunque no nombre versículos.
 */
describe('inclusionAtBirth — preguntas sin versículo', () => {
    it('si ninguna nombra versículo, no decide nada', () => {
        const sinVersiculos = parseBriefQuestions('1. Traduzca el pasaje.\n2. Mínimo tres fuentes.');
        expect(inclusionAtBirth(versiculo(14), sinVersiculos)).toBeUndefined();
        expect(inclusionAtBirth({ kind: 'introduction', verseRef: null }, sinVersiculos)).toBeUndefined();
    });

    it('si alguna no tiene versículo, el marco se queda para responderla', () => {
        const mixtas = parseBriefQuestions('1. ¿Cómo funciona μή (Stg. 2:14)?\n2. Resuma el argumento del pasaje.');
        expect(inclusionAtBirth({ kind: 'conclusion', verseRef: null }, mixtas)).toBeUndefined();
        expect(inclusionAtBirth(versiculo(14), mixtas)).toBe(true);
        expect(inclusionAtBirth(versiculo(15), mixtas)).toBe(false);
    });
});

describe('recomponer un versículo sin pregunta no pisa la pregunta que lo nombra', () => {
    const doc = [
        '# TP', '', '---', '',
        '## ¿Qué relación hay entre Santiago 2:17 y Santiago 2:26?', '', 'Respuesta 2.', '', '---', '',
        '## Santiago 2:26', '', 'Prosa vieja de 2:26.', '',
    ].join('\n');

    it('busca el título EXACTO, no uno que contenga la referencia', () => {
        const out = replaceVerseSectionExact(doc, 'Santiago 2:26', 'Prosa nueva.')!;
        expect(out).toContain('Respuesta 2.');
        expect(out).toContain('Prosa nueva.');
        expect(out).not.toContain('Prosa vieja');
    });

    it('sin sección propia, no reemplaza nada', () => {
        const sinSeccion = doc.replace('## Santiago 2:26', '## Otra cosa');
        expect(replaceVerseSectionExact(sinSeccion, 'Santiago 2:26', 'x')).toBeNull();
    });

    it('prosa con títulos sobre un ensamble viejo: no queda el título viejo vacío', () => {
        const viejo = '# TP\n\n---\n\n## Santiago 2:21\n\nVieja.\n';
        const out = replaceVerseSectionExact(viejo, 'Santiago 2:21', '## ¿Q3?\n\nA.\n\n## ¿Q4?\n\nB.')!;
        expect(out).not.toContain('## Santiago 2:21');
        expect(out).toContain('## ¿Q3?');
        expect(out).not.toContain('Vieja.');
    });
});

describe('canonicalizeQuestionHeadings — títulos de otro nivel dentro de una respuesta', () => {
    const DOS = ['¿Primera?', '¿Segunda?'];

    it('un ### dentro de la primera respuesta es cuerpo, no otra pregunta', () => {
        const out = canonicalizeQuestionHeadings('## x\n\n### detalle\n\nA.\n\n## y\n\nB.', DOS);
        expect(out).toBe('## ¿Primera?\n\n### detalle\n\nA.\n\n## ¿Segunda?\n\nB.');
    });

    it('si el modelo usó ### para las dos, se toman ésas', () => {
        expect(canonicalizeQuestionHeadings('### x\n\nA.\n\n### y\n\nB.', DOS))
            .toBe('## ¿Primera?\n\nA.\n\n## ¿Segunda?\n\nB.');
    });
});
