import { describe, it, expect } from 'vitest';
import { getPreachingNotes, getSourceRecommendations } from '../index';
import { SOURCE_TYPE_CATALOG, type SourceType } from '../../entities/SourceType';
import { catalogCandidates } from '../../services/bibliographyCandidates';
import { getBooksByTestament, type BibleBookId } from '../../../bible/canon/BibleCanon';
import { EZRA_RECOMMENDATIONS } from '../ot/ezra';
import {
    EZRA_NEHEMIAH_BACKGROUND,
    EZRA_NEHEMIAH_CRITICAL,
    EZRA_NEHEMIAH_EXPOSITORY,
    EZRA_NEHEMIAH_MONOGRAPHS,
    EZRA_NEHEMIAH_PRIMARY,
} from '../ot/ezraNehemiah';

/**
 * Fase «Encuadre de la serie»: Esdras tenía cero comentarios (medido el
 * 2026-10-24) aunque trece obras de Nehemías comentan Esdras-Nehemías, y
 * recibía obras que no le correspondían (Noth, Sanders, Filón).
 * docs/FASE_ENCUADRE_SERIE_2026-10.md, §5 «Catálogo».
 */
const TIPOS = Object.keys(SOURCE_TYPE_CATALOG) as SourceType[];
const todo = (book: BibleBookId) => TIPOS.flatMap(t => getSourceRecommendations(book, t, 'es'));
const tiene = (book: BibleBookId, pred: (r: { author: string; title: string }) => boolean) => todo(book).some(pred);

describe('Esdras tiene catálogo propio', () => {
    it('al menos 9 obras verificadas y 6 comentarios, con enfoques críticos y no críticos', () => {
        const xs = Object.values(EZRA_RECOMMENDATIONS.bySourceType).flat();
        expect(xs.filter(r => r.verified).length).toBeGreaterThanOrEqual(9);
        const comentarios = [...EZRA_RECOMMENDATIONS.bySourceType['commentary-critical'] ?? [], ...EZRA_RECOMMENDATIONS.bySourceType['commentary-expository'] ?? []];
        expect(comentarios.length).toBeGreaterThanOrEqual(6);
        expect(xs.some(r => r.approach === 'historical-critical')).toBe(true);
        expect(xs.some(r => r.approach === 'historical-grammatical' || r.approach === 'canonical-theological')).toBe(true);
        expect(comentarios.some(r => r.languages.includes('es'))).toBe(true);
    });

    it('«Buscar candidatas» ya no da cero comentarios para Esdras', () => {
        const cands = catalogCandidates(['EZR'], [], 'es');
        const comentarios = cands.filter(c => c.sourceType === 'commentary-critical' || c.sourceType === 'commentary-expository');
        expect(comentarios.length).toBeGreaterThanOrEqual(6);
        // Un comentario en español entre los primeros: la lista pone primero el idioma del pastor.
        expect(comentarios.slice(0, 3).some(c => /Esdras/.test(c.title))).toBe(true);
    });

    it('las obras de Esdras-Nehemías salen en los dos libros, cada una en su tipo', () => {
        const grupos: Array<[SourceType, ReadonlyArray<{ title: string }>]> = [
            ['commentary-critical', EZRA_NEHEMIAH_CRITICAL], ['commentary-expository', EZRA_NEHEMIAH_EXPOSITORY],
            ['theological-monograph', EZRA_NEHEMIAH_MONOGRAPHS], ['historical-background', EZRA_NEHEMIAH_BACKGROUND],
            ['primary-source-ancient', EZRA_NEHEMIAH_PRIMARY],
        ];
        for (const [tipo, obras] of grupos) {
            expect(obras.length, tipo).toBeGreaterThan(0);
            for (const book of ['EZR', 'NEH'] as const) {
                const titulos = getSourceRecommendations(book, tipo, 'es').map(r => r.title);
                for (const o of obras) expect(titulos, `${book} · ${o.title}`).toContain(o.title);
            }
        }
    });

    it('las fichas dicen lo que es cada obra: Fried recomendada y propia, Burt sin superlativo, Steinmann y Levering con su lectura', () => {
        const xs = [...Object.values(EZRA_RECOMMENDATIONS.bySourceType).flat()];
        const de = (autor: string) => xs.find(r => r.author.startsWith(autor))!;
        expect(de('Fried').tier).toBe('recommended');
        expect(de('Fried').rationale).toMatch(/muy propia de la autora/);
        expect(de('Burt').rationale).toBe('Comentario de Esdras escrito en español, pensado para la predicación.');
        expect(de('Steinmann').rationale).toMatch(/técnico.*confesional luterana.*No es el contrapunto crítico/);
        expect(de('Levering').rationale).toMatch(/no una exposición versículo a versículo/);
    });

    it('las de solo Nehemías no salen en Esdras, y las de solo Esdras no salen en Nehemías', () => {
        for (const t of ["The Message of Nehemiah: God's Servant in a Time of Change", 'Nehemías: siervo de Dios en tiempos de cambio', 'Rebuilding Identity: The Nehemiah-Memoir and Its Earliest Readers']) {
            expect(tiene('NEH', r => r.title === t), t).toBe(true);
            expect(tiene('EZR', r => r.title === t), t).toBe(false);
        }
        for (const t of ['Ezra: A Commentary', 'The Message of Ezra and Haggai: Building for God', 'Teaching Ezra: From Text to Message']) {
            expect(tiene('EZR', r => r.title === t), t).toBe(true);
            expect(tiene('NEH', r => r.title === t), t).toBe(false);
        }
    });
});

describe('`covers` en el invariante y en el grupo: cada obra en los libros que trata', () => {
    const noth = (r: { author: string }) => r.author.startsWith('Noth');
    const sanders = (r: { title: string }) => r.title.startsWith('Judaism: Practice and Belief');
    const filon = (r: { author: string }) => r.author.startsWith('Philo');
    const arameo = (r: { title: string }) => /Aramaic|arameo/.test(r.title) && !/Hebrew and Aramaic Lexicon/.test(r.title);

    it('Noth sale en Josué–Reyes, no en Esdras ni en Nehemías', () => {
        expect(tiene('JOS', noth)).toBe(true);
        expect(tiene('2KI', noth)).toBe(true);
        expect(tiene('EZR', noth)).toBe(false);
        expect(tiene('NEH', noth)).toBe(false);
        expect(tiene('RUT', noth)).toBe(false);
    });

    it('Sanders (63 a. C.–66 d. C.) no sale en ningún libro del AT, y sí en el NT', () => {
        const conSanders = getBooksByTestament('OT').filter(b => tiene(b.id, sanders)).map(b => b.id);
        expect(conSanders).toEqual([]);
        expect(tiene('MAT', sanders)).toBe(true);
    });

    it('Filón sale en Génesis y en el NT, no en Esdras', () => {
        expect(tiene('GEN', filon)).toBe(true);
        expect(tiene('DEU', filon)).toBe(true);
        expect(tiene('LUK', filon)).toBe(true);
        expect(tiene('EZR', filon)).toBe(false);
        expect(tiene('NEH', filon)).toBe(false);
    });

    it('las herramientas de arameo salen en Esdras y Daniel, no en Génesis ni en el NT', () => {
        const de = (b: BibleBookId) => todo(b).filter(arameo).map(r => r.author.split(',')[0]);
        expect(de('EZR')).toEqual(expect.arrayContaining(['Rosenthal', 'Vogt', 'Greenspahn', 'Van Pelt', 'Ribera Florit']));
        expect(de('DAN')).toEqual(expect.arrayContaining(['Rosenthal', 'Vogt', 'Greenspahn', 'Van Pelt', 'Ribera Florit']));
        expect(de('GEN')).toEqual([]);
        expect(de('ROM')).toEqual([]);
        // HALOT, que también cubre el arameo, sigue en todo el AT.
        expect(tiene('GEN', r => r.title.startsWith('The Hebrew and Aramaic Lexicon'))).toBe(true);
    });
});

describe('notas para predicar Esdras-Nehemías', () => {
    it('las nueve en Esdras y en Nehemías, ninguna en Génesis', () => {
        expect(getPreachingNotes('EZR')).toHaveLength(9);
        expect(getPreachingNotes('NEH').map(n => n.id)).toEqual(getPreachingNotes('EZR').map(n => n.id));
        expect(getPreachingNotes('GEN')).toEqual([]);
    });

    it('cada nota trae sus fuentes, y las de un pasaje lo nombran', () => {
        const notas = getPreachingNotes('EZR');
        for (const n of notas) {
            expect(n.sources.length, n.id).toBeGreaterThan(0);
            expect(new Set(notas.map(x => x.id)).size).toBe(notas.length);
            // Sin exponer el asistente y con «tú» (memoria del proyecto).
            expect(`${n.title} ${n.body}`, n.id).not.toMatch(/\b(IA|AI|modelo|vos)\b/);
        }
        const conPasaje = Object.fromEntries(notas.filter(n => n.passage).map(n => [n.id, n.passage]));
        expect(conPasaje['ezr-4-orden-tematico']).toEqual({ bookId: 'EZR', chapterStart: 4, verseStart: 6, chapterEnd: 4, verseEnd: 23 });
        expect(conPasaje['ezr-9-10-matrimonios']).toEqual({ bookId: 'EZR', chapterStart: 9, verseStart: 1, chapterEnd: 10, verseEnd: 44 });
        // La de Esdras 9–10 nombra el texto que impide leerlo como mandato de divorcio.
        expect(notas.find(n => n.id === 'ezr-9-10-matrimonios')!.sources).toContain('1 Co 7:12-16');
    });

    // Ronda de arreglos F1: lo que la revisión encontró mal dicho en las notas.
    const nota = (id: string) => {
        const n = getPreachingNotes('EZR').find(x => x.id === id);
        expect(n, id).toBeDefined();
        return n!;
    };

    it('Esdras 9–10: recibe a los que se apartan (6:21), Malaquías no se cita solo a favor, y ni Esdras 10 ni Nehemías 13 cierran bien', () => {
        const n = nota('ezr-9-10-matrimonios');
        expect(n.sources).toEqual(expect.arrayContaining(['Esd 6:21', '1 Co 7:39', '1 Co 7:12-16', 'Jer 31:31-34', 'Ez 36:26-27']));
        expect(n.body).toContain('(6:21)');
        expect(n.body).toContain('"linaje santo" (9:2)');
        expect(n.body).toMatch(/divorcio desleal \(2:14-16\)/);
        expect(n.body).toMatch(/Dt 7:1-4; 23:3-6; Lv 18:24-30/);
        // Ya no afirma tajante que el asunto «no es la etnia».
        expect(n.body).not.toMatch(/no la etnia/);
    });

    it('Esdras 4: el paréntesis y el orden de Esdras y Nehemías van en notas separadas, sin decir que el texto no da cronología', () => {
        const parentesis = nota('ezr-4-orden-tematico');
        expect(parentesis.body).toMatch(/4:24 retoma el hilo de 4:5/);
        expect(parentesis.body).not.toMatch(/cronología que el texto no da|Van Hoonacker/);
        const orden = nota('ezr-neh-orden');
        expect(orden.body).toMatch(/458 a\. C\..*445 a\. C\./);
        expect(orden.body).toContain('Van Hoonacker');
        expect(orden.sources).toEqual(expect.arrayContaining(['Esd 7:7-8', 'Neh 2:1']));
    });

    it('el arameo: también narra, y 1:1; 6:22; 7:27 se nombran como pasajes en hebreo', () => {
        const n = nota('ezr-arameo');
        expect(n.body).toContain('4:24–5:5; 6:13-18');
        expect(n.body).toContain('1:1; 6:22; 7:27, pasajes en hebreo');
    });

    it('las listas: la de 10:18-44 son los culpables, no el pueblo que regresa, y no resalta Esdras 9–10', () => {
        const n = nota('ezr-neh-listas');
        expect(n.body).toMatch(/10:18-44 es otra cosa: nombra a los culpables/);
        expect(n.passage).toBeUndefined();
    });

    it('las notas nuevas: el protagonista es Dios, la restauración queda abierta y Esdras sigue a Crónicas', () => {
        expect(nota('ezr-7-8-no-manual').sources).toEqual(expect.arrayContaining(['Esd 7:6, 9-10, 28', 'Esd 8:18, 22, 31']));
        expect(nota('ezr-3-restauracion-incompleta').sources).toEqual(expect.arrayContaining(['Esd 3:12-13', 'Hag 2:3-9', 'Neh 9:36-37', 'Jn 2:19-21']));
        expect(nota('ezr-1-continuidad').sources).toEqual(expect.arrayContaining(['2 Cr 36:22-23', 'Esd 5:1; 6:14']));
    });

    it('con el alcance en 9–10 solo toca una nota: la de los matrimonios', () => {
        const toca = (p: NonNullable<ReturnType<typeof getPreachingNotes>[number]['passage']>) =>
            p.chapterEnd >= 9 && p.chapterStart <= 10;
        const tocan = getPreachingNotes('EZR').filter(n => n.passage && toca(n.passage)).map(n => n.id);
        expect(tocan).toEqual(['ezr-9-10-matrimonios']);
    });
});
