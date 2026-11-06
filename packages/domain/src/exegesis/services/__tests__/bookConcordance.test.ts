import { describe, expect, it } from 'vitest';
import type { PassageReference } from '../../../bible/canon/passage-reference';
import type { GreekPos, GreekVerseTokens } from '../../../greek-analyzer/morphGntToken';
import { buildBookConcordance, MAX_APARICIONES_EN_EL_LIBRO } from '../bookConcordance';

const ref = (chapterStart: number, verseStart: number | null, chapterEnd = chapterStart, verseEnd: number | null = verseStart): PassageReference =>
    ({ bookId: 'JAS', chapterStart, chapterEnd, verseStart, verseEnd }) as PassageReference;

/** Un versículo con sus palabras: «lema/clase». */
function verso(chapter: number, verse: number, palabras: string[]): GreekVerseTokens {
    return {
        reference: { chapter, verse },
        text: `texto ${chapter}:${verse}`,
        tokens: palabras.map(p => {
            const [lemma, pos] = p.split('/') as [string, GreekPos];
            return { text: lemma, lemma, pos, tag: {} as never, transliteration: '' };
        }),
    };
}

// Santiago 5:1–6 como pasaje; θησαυρίζω (5:3) reaparece fuera y καταδικάζω (5:6) se retoma en 2:6.
const LIBRO = [
    verso(2, 6, ['καταδυναστεύω/V', 'πλούσιος/A', 'ὁ/RA']),
    verso(4, 1, ['πόλεμος/N', 'ὁ/RA']),
    verso(5, 1, ['πλούσιος/A', 'κλαίω/V', 'ὁ/RA']),
    verso(5, 3, ['θησαυρίζω/V', 'ἔσχατος/A', 'ὁ/RA']),
    verso(5, 4, ['μισθός/N']),
    verso(5, 6, ['καταδικάζω/V', 'φονεύω/V', 'δίκαιος/A']),
    verso(5, 7, ['μακροθυμέω/V', 'θησαυρίζω/V']),
];

describe('buildBookConcordance', () => {
    it('trae el lema del versículo con sus apariciones FUERA del pasaje, con el texto', () => {
        const c = buildBookConcordance({ book: LIBRO, verseRef: ref(5, 3), paperPassage: ref(5, 1, 5, 6) });
        const tes = c.find(e => e.lemma === 'θησαυρίζω');
        expect(tes).toEqual({ lemma: 'θησαυρίζω', inVerse: true, occurrences: [{ chapter: 5, verse: 7, text: 'texto 5:7' }] });
    });

    it('deja fuera lo que el entorno ya muestra', () => {
        const c = buildBookConcordance({ book: LIBRO, verseRef: ref(5, 3), paperPassage: ref(5, 1, 5, 6) });
        expect(c.map(e => e.lemma)).not.toContain('ἔσχατος');
        expect(c.map(e => e.lemma)).not.toContain('μισθός');
    });

    it('incluye los lemas del resto del entorno, marcados como tales', () => {
        const c = buildBookConcordance({ book: LIBRO, verseRef: ref(5, 5), paperPassage: ref(5, 1, 5, 6) });
        const rico = c.find(e => e.lemma === 'πλούσιος');
        expect(rico?.inVerse).toBe(false);
        expect(rico?.occurrences.map(o => `${o.chapter}:${o.verse}`)).toEqual(['2:6']);
    });

    it('pone primero los lemas del versículo', () => {
        const libro = [...LIBRO, verso(1, 10, ['καταδικάζω/V'])];
        const c = buildBookConcordance({ book: libro, verseRef: ref(5, 6), paperPassage: ref(5, 1, 5, 6) });
        expect(c[0]?.inVerse).toBe(true);
        expect(c.findIndex(e => !e.inVerse)).toBeGreaterThan(c.findIndex(e => e.inVerse));
    });

    it('ignora artículos y demás palabras sin contenido', () => {
        const c = buildBookConcordance({ book: LIBRO, verseRef: ref(5, 1), paperPassage: ref(5, 1, 5, 6) });
        expect(c.map(e => e.lemma)).not.toContain('ὁ');
    });

    it(`deja fuera el lema que aparece en más de ${MAX_APARICIONES_EN_EL_LIBRO} versículos`, () => {
        const comunes = Array.from({ length: MAX_APARICIONES_EN_EL_LIBRO }, (_, i) => verso(3, i + 1, ['θησαυρίζω/V']));
        const c = buildBookConcordance({ book: [...LIBRO, ...comunes], verseRef: ref(5, 3), paperPassage: ref(5, 1, 5, 6) });
        expect(c.map(e => e.lemma)).not.toContain('θησαυρίζω');
    });

    it('cuenta versículos, no palabras: un lema repetido en un versículo es una aparición', () => {
        const c = buildBookConcordance({ book: [...LIBRO, verso(1, 1, ['θησαυρίζω/V', 'θησαυρίζω/V'])], verseRef: ref(5, 3), paperPassage: ref(5, 1, 5, 6) });
        expect(c.find(e => e.lemma === 'θησαυρίζω')?.occurrences).toHaveLength(2);
    });

    it('REGRESIÓN (revisión del PR 1): lo del pasaje que el entorno NO muestra sí entra', () => {
        // Pasaje 4:13–5:20: el entorno de 5:3 es 5:1–7; 5:12 y el capítulo 4 no se ven.
        const libro = [...LIBRO, verso(5, 12, ['θησαυρίζω/V'])];
        const c = buildBookConcordance({ book: libro, verseRef: ref(5, 3), paperPassage: ref(4, 13, 5, 20) });
        expect(c.find(e => e.lemma === 'θησαυρίζω')?.occurrences.map(o => `${o.chapter}:${o.verse}`)).toEqual(['5:12']);
    });

    it('el versículo analizado no cuenta como aparición externa aunque caiga fuera del pasaje', () => {
        const c = buildBookConcordance({ book: LIBRO, verseRef: ref(5, 7), paperPassage: ref(5, 1, 5, 6) });
        expect(c.find(e => e.lemma === 'μακροθυμέω')).toBeUndefined();
        expect(c.find(e => e.lemma === 'θησαυρίζω')).toBeUndefined();
    });
});
