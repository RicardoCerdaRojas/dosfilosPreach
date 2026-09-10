import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { PassageReference } from '../../../bible/canon/passage-reference';
import { buildVerseCoverageContract, findUncoveredItems, verseSectionKey } from '../verseAnalysisCoverage';
import { renderVerseAnalysisProse } from '../renderVerseAnalysisProse';
import { locateVerseSections, replaceVerseSectionBodies } from '../composedVerseSections';
import { enforceAnalysisCoverage } from '../enforceAnalysisCoverage';

const REF: PassageReference = {
    bookId: 'JAS',
    chapterStart: 1,
    chapterEnd: 1,
    verseStart: 2,
    verseEnd: 2,
};

function buildAnalysis(): CanonicalVerseAnalysis {
    const base = buildEmptyCanonicalVerseAnalysis(REF);
    return {
        ...base,
        originalText: 'Πᾶσαν χαρὰν ἡγήσασθε, ἀδελφοί μου',
        initialTranslation: 'Tened por sumo gozo, hermanos míos',
        finalTranslation: 'Considerad como motivo de gozo pleno, hermanos míos',
        argumentativeRole: 'Abre la sección estableciendo la tesis sobre la prueba de la fe como ocasión de gozo.',
        textualCriticism: {
            note: 'El aparato NA28 no registra variantes significativas para este versículo en los testigos alejandrinos.',
            variants: [],
        },
        syntacticAnalysis: {
            mainVerb: {
                text: 'ἡγήσασθε',
                morphology: 'imperativo aoristo medio, segunda persona plural',
                syntacticFunction: 'verbo principal de la oración',
                interpretiveSignificance: 'El aoristo imperativo pide una valoración deliberada y puntual, no un estado emocional sostenido.',
            },
            keyConstructions: [],
            discourseParticles: [
                {
                    particle: 'δέ',
                    function: 'marcador de desarrollo',
                    note: 'Señala avance del argumento sin contraste adversativo, según las categorías de Runge.',
                },
            ],
        },
        lexicalAnalyses: [
            {
                term: 'Πᾶσαν',
                lemma: 'πᾶς',
                gloss: 'todo',
                generalSemanticRange: { glosses: ['todo', 'entero', 'sumo'], sources: [{ sourceKey: 'BDAG', page: 782 }] },
                verseSpecificLoading: 'La construcción anartra carga el adjetivo con fuerza cualitativa: gozo de la mejor clase, no cantidad de gozo.',
                loadingSources: [{ sourceKey: 'Adamson', page: 53 }],
            },
        ],
        historicalContext: [
            {
                aspect: 'la diáspora judía como marco de la carta',
                relevance: 'Las comunidades dispersas enfrentaban presión económica y social que da concreción a la palabra prueba.',
                sources: [{ sourceKey: 'Mayor', page: 314 }],
            },
        ],
        commentatorEngagement: [
            {
                sourceKey: 'Adamson',
                page: 53,
                role: 'anchor',
                position: 'Sostiene que el imperativo demanda una decisión de la voluntad frente a la adversidad, no un sentimiento espontáneo.',
            },
        ],
        translationCruxes: [
            {
                phrase: 'Πᾶσαν χαρὰν',
                description: 'La ausencia de artículo permite leer el sintagma como cantidad total de gozo o como gozo de la clase más alta.',
                options: [
                    { translation: 'sumo gozo', characterization: 'lectura cualitativa' },
                    { translation: 'todo gozo', characterization: 'lectura cuantitativa' },
                ],
                commentatorPositions: [],
                commitment: {
                    chosen: 'motivo de gozo pleno',
                    rationale: 'La construcción anartra y el paralelo con el verso siguiente favorecen la lectura cualitativa.',
                },
            },
        ],
        verseThesis: 'La prueba de la fe se recibe como ocasión de gozo porque su resultado es la constancia madura.',
    };
}

describe('buildVerseCoverageContract', () => {
    it('lista un ítem por hallazgo estructurado del análisis', () => {
        const items = buildVerseCoverageContract(buildAnalysis(), 'es');
        const kinds = items.map(i => i.kind);
        expect(kinds).toContain('textual-criticism');
        expect(kinds).toContain('syntax');
        expect(kinds).toContain('particle');
        expect(kinds).toContain('lexeme');
        expect(kinds).toContain('historical');
        expect(kinds).toContain('commentator');
        expect(kinds).toContain('crux');
        expect(kinds).toContain('thesis');
    });

    it('omite los campos vacíos en vez de exigir prosa sobre la nada', () => {
        const items = buildVerseCoverageContract(buildEmptyCanonicalVerseAnalysis(REF), 'es');
        expect(items.every(i => i.phrase.trim().length > 0)).toBe(true);
        expect(items.some(i => i.kind === 'crux')).toBe(false);
    });
});

describe('findUncoveredItems', () => {
    it('da por publicado el render determinista del propio análisis', () => {
        const analysis = buildAnalysis();
        const items = buildVerseCoverageContract(analysis, 'es');
        const prose = renderVerseAnalysisProse(analysis, 'es', { includeHeading: false });
        expect(findUncoveredItems(prose, items)).toEqual([]);
    });

    it('marca lo que la prosa no dice', () => {
        const analysis = buildAnalysis();
        const items = buildVerseCoverageContract(analysis, 'es');
        const parcial = 'El versículo abre la perícopa y su tesis es que la prueba de la fe se recibe como ocasión de gozo porque su resultado es la constancia madura.';
        const faltantes = findUncoveredItems(parcial, items).map(i => i.kind);
        expect(faltantes).toContain('textual-criticism');
        expect(faltantes).toContain('particle');
        expect(faltantes).toContain('historical');
    });

    it('tolera la paráfrasis: no exige literalidad', () => {
        const items = buildVerseCoverageContract(buildAnalysis(), 'es');
        const particula = items.find(i => i.kind === 'particle')!;
        const parafraseado = 'La partícula señala un avance del argumento, un marcador de desarrollo sin contraste adversativo, siguiendo las categorías de Runge.';
        expect(findUncoveredItems(parafraseado, [particula])).toEqual([]);
    });
});

describe('locateVerseSections', () => {
    const key = verseSectionKey(buildAnalysis(), 'es');

    it('encuentra la sección aunque el encabezado lleve subtítulo', () => {
        const md = `# Trabajo\n\n## Cuerpo\n\n### ${key} — la prueba de la fe\n\nProsa del verso.\n\n## Conclusión\n\nCierre.`;
        const located = locateVerseSections(md, [key]);
        expect(located).not.toBeNull();
        const bounds = located!.get(key)!;
        expect(md.slice(bounds.bodyStart, bounds.end)).toContain('Prosa del verso.');
        expect(md.slice(bounds.bodyStart, bounds.end)).not.toContain('Cierre.');
    });

    it('devuelve null cuando falta el encabezado del contrato', () => {
        expect(locateVerseSections('# Trabajo\n\nTodo junto sin encabezados de verso.', [key])).toBeNull();
    });
});

describe('replaceVerseSectionBodies', () => {
    it('reemplaza sólo el cuerpo pedido y deja el resto intacto', () => {
        const md = '## A\n\ncuerpo a\n\n## B\n\ncuerpo b\n';
        const out = replaceVerseSectionBodies(md, ['A', 'B'], key => (key === 'A' ? 'nuevo a' : null));
        expect(out).toContain('nuevo a');
        expect(out).not.toContain('cuerpo a');
        expect(out).toContain('cuerpo b');
        expect(out).toContain('## B');
    });
});

describe('enforceAnalysisCoverage', () => {
    const analysis = buildAnalysis();
    const key = verseSectionKey(analysis, 'es');

    it('deja la prosa del modelo cuando publicó todo el análisis', () => {
        const cuerpo = renderVerseAnalysisProse(analysis, 'es', { includeHeading: false });
        const md = `# Trabajo\n\n## Análisis\n\n### ${key}\n\n${cuerpo}\n\n## Conclusión\n\nCierre.`;
        const { markdown, coverage } = enforceAnalysisCoverage({
            markdown: md,
            verseAnalyses: [analysis],
            language: 'es',
        });
        expect(coverage.renderedVerses).toEqual([]);
        expect(coverage.composedItems).toBe(coverage.totalItems);
        expect(markdown).toBe(md);
    });

    it('publica el render determinista del verso que salió incompleto', () => {
        const md = `# Trabajo\n\n## Análisis\n\n### ${key}\n\nUn párrafo suelto sobre el gozo.\n\n## Conclusión\n\nCierre.`;
        const { markdown, coverage } = enforceAnalysisCoverage({
            markdown: md,
            verseAnalyses: [analysis],
            language: 'es',
        });
        expect(coverage.renderedVerses).toEqual([key]);
        expect(coverage.composedItems).toBeLessThan(coverage.totalItems);
        expect(coverage.recoveredItemLabels.length).toBeGreaterThan(0);
        expect(markdown).toContain('NA28');
        expect(markdown).toContain('marcador de desarrollo');
        expect(markdown).not.toContain('Un párrafo suelto sobre el gozo.');
        // El resto del documento no se toca.
        expect(markdown).toContain('## Conclusión');
        expect(markdown).toContain('Cierre.');
    });

    it('sin encabezados de verso agrega el análisis al final y lo declara', () => {
        const md = '# Trabajo\n\nProsa continua sin rotular versos.';
        const { markdown, coverage } = enforceAnalysisCoverage({
            markdown: md,
            verseAnalyses: [analysis],
            language: 'es',
        });
        expect(coverage.sectioningFailed).toBe(true);
        expect(markdown).toContain('Análisis no incorporado a la prosa compuesta');
        expect(markdown).toContain('Prosa continua sin rotular versos.');
    });

    it('rotula las páginas con el rótulo del compositor', () => {
        const md = `# Trabajo\n\n### ${key}\n\nUn párrafo suelto.`;
        const { markdown } = enforceAnalysisCoverage({
            markdown: md,
            verseAnalyses: [analysis],
            language: 'es',
            pageLabel: (key, sheet) => (key === 'Adamson' ? `p. ${sheet - 4}` : `hoja ${sheet}`),
            citableKeys: ['Adamson', 'Mayor', 'BDAG'],
        });
        expect(markdown).toContain('Adamson, p. 49');
        expect(markdown).toContain('Mayor, hoja 314');
    });
});

describe('locateVerseSections — versos que se contienen', () => {
    it('«Santiago 1:2» no se lleva la sección de «Santiago 1:20»', () => {
        const md = '# Trabajo\n\n### Santiago 1:20\n\ncuerpo del 20\n\n### Santiago 1:2\n\ncuerpo del 2\n';
        const located = locateVerseSections(md, ['Santiago 1:2', 'Santiago 1:20'])!;
        expect(located).not.toBeNull();
        const dos = located.get('Santiago 1:2')!;
        expect(md.slice(dos.bodyStart, dos.end)).toContain('cuerpo del 2');
        expect(md.slice(dos.bodyStart, dos.end)).not.toContain('cuerpo del 20');
    });

    it('sin el encabezado propio devuelve null en vez de robar el del vecino', () => {
        const md = '# Trabajo\n\n### Santiago 1:20\n\ncuerpo del 20\n';
        expect(locateVerseSections(md, ['Santiago 1:2'])).toBeNull();
    });
});
