import { describe, expect, it } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { consonantsOf, lemmaKey, lemmasOfAnalyses, mergeLemmas, passageLemmas, rankLemmaSheets } from '../lemmaPages';

const analisis = (term: string, lemma: string): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 3, verseEnd: 3 }),
    lexicalAnalyses: [{ term, lemma, gloss: '', generalSemanticRange: { glosses: [], sources: [] }, verseSpecificLoading: '', loadingSources: [] }],
} as unknown as CanonicalVerseAnalysis);

describe('rankLemmaSheets', () => {
    it('manda el número de apariciones: la entrada nombra su lema muchas veces', () => {
        // Medido en el léxico real para «רָעָה»: la hoja 677 lo escribe 13 veces.
        const r = rankLemmaSheets([{ sheet: 675, count: 3 }, { sheet: 677, count: 13 }, { sheet: 676, count: 7 }]);
        expect(r.map(h => h.sheet)).toEqual([677, 676, 675]);
    });

    it('a igual cantidad gana la hoja anterior: la entrada empieza antes', () => {
        expect(rankLemmaSheets([{ sheet: 458, count: 2 }, { sheet: 457, count: 2 }]).map(h => h.sheet))
            .toEqual([457, 458]);
    });

    it('propone tres como mucho: más allá es ruido', () => {
        const muchas = Array.from({ length: 8 }, (_, i) => ({ sheet: i + 1, count: 8 - i }));
        expect(rankLemmaSheets(muchas)).toHaveLength(3);
    });

    it('sin apariciones no propone nada', () => {
        expect(rankLemmaSheets([])).toEqual([]);
    });
});

describe('lemmasOfAnalyses', () => {
    it('toma el lema del análisis, no la forma conjugada del verso', () => {
        expect(lemmasOfAnalyses([analisis('יְשׁוֹבֵב', 'שׁוּב')])).toEqual([{ lemma: 'שׁוּב', term: 'יְשׁוֹבֵב' }]);
    });

    it('el mismo lema en dos versos es una sola entrada del léxico', () => {
        const dos = lemmasOfAnalyses([analisis('נַפְשִׁי', 'נֶפֶשׁ'), analisis('נֶפֶשׁ', 'נפש')]);
        expect(dos).toHaveLength(1);
    });

    it('un análisis sin lema usa el término del verso, que es mejor que nada', () => {
        expect(lemmasOfAnalyses([analisis('רֹעִי', '')])[0]).toEqual({ lemma: 'רֹעִי', term: 'רֹעִי' });
    });

    it('sin análisis no hay lemas', () => {
        expect(lemmasOfAnalyses([])).toEqual([]);
    });
});

describe('consonantsOf', () => {
    it('dos grafías del mismo lema se reconocen por sus consonantes', () => {
        expect(consonantsOf('שׁוּב')).toBe(consonantsOf('שוב'));
        expect(consonantsOf('נֶפֶשׁ')).toBe('נפש');
    });

    it('un texto sin hebreo no aporta consonantes', () => {
        expect(consonantsOf('Ross, p. 561')).toBe('');
    });
});

/**
 * Los lemas salían de los versículos YA analizados: con 4:5-4:7 analizados,
 * el léxico no proponía nada de 4:8-11. Ahora salen de la morfología del
 * pasaje entero. Tokens reales de morphhb, Jonás 4:6.
 */
describe('passageLemmas — los lemas de la morfología del pasaje', () => {
    const tok = (text: string, lemma: string, oshbMorphCode: string) => ({ text, lemma, oshbMorphCode });
    const JONAS_4_6 = { chapter: 4, verse: 6, morphology: { tokens: [
        tok('וַ/יְמַ֣ן', 'c/4487', 'HC/Vpw3ms'),
        tok('יְהוָֽה', '3068', 'HNp'),
        tok('קִיקָי֞וֹן', '7021', 'HNcmsa'),
        tok('וַ/יַּ֣עַל', 'c/5927', 'HC/Vqw3ms'),
        tok('מֵ/עַ֣ל', 'm/5921 a', 'HR/R'),
        tok('לְ/יוֹנָ֗ה', 'l/3124', 'HR/Np'),
        tok('צֵל֙', '6738', 'HNcmsa'),
        tok('רֹאשׁ֔/וֹ', '7218 a', 'HNcmsc/Sp3ms'),
        tok('ל֖/וֹ', 'l', 'HR/Sp3ms'),
        tok('הַ/קִּֽיקָי֖וֹן', 'd/7021', 'HTd/Ncmsa'),
        tok('גְדוֹלָֽה', '1419 a', 'HAafsa'),
    ] } };
    const STRONG: Record<number, string> = { 4487: 'מָנָה', 7021: 'קִיקָיוֹן', 5927: 'עָלָה', 6738: 'צֵל', 7218: 'רֹאשׁ', 1419: 'גָּדוֹל' };

    it('quedan verbos, sustantivos comunes y adjetivos, con su lema de Strong', () => {
        const lemas = passageLemmas([JONAS_4_6], n => STRONG[n]);
        expect(lemas.map(l => l.lemma)).toEqual(['מָנָה', 'קִיקָיוֹן', 'עָלָה', 'צֵל', 'רֹאשׁ', 'גָּדוֹל']);
    });

    it('fuera nombres propios, preposiciones y sufijos sueltos', () => {
        const claves = passageLemmas([JONAS_4_6], n => STRONG[n]).map(l => lemmaKey(l.lemma));
        expect(claves).not.toContain(lemmaKey('יְהוָה'));
        expect(claves).not.toContain(lemmaKey('יוֹנָה'));
        expect(claves).not.toContain(lemmaKey('עַל'));
    });

    it('cuenta las repeticiones y recuerda dónde apareció primero', () => {
        const qiqayon = passageLemmas([JONAS_4_6], n => STRONG[n]).find(l => l.lemma === 'קִיקָיוֹן')!;
        expect(qiqayon.occurrences).toBe(2);
        expect(qiqayon.firstVerse).toBe('4:6');
    });

    it('sin tabla de Strong usa la palabra tal como aparece', () => {
        expect(passageLemmas([JONAS_4_6])[0]!.lemma).toBe('וַיְמַ֣ן');
    });

    it('griego: el lema de MorphGNT, sólo de sustantivos, verbos y adjetivos', () => {
        const g = (text: string, lemma: string, pos: string) => ({ text, lemma, pos, tag: {}, transliteration: '' });
        const verso = { chapter: 2, verse: 14, morphology: { reference: { chapter: 2, verse: 14 }, text: '', tokens: [
            g('Τί', 'τίς', 'RI'), g('τὸ', 'ὁ', 'RA'), g('ὄφελος', 'ὄφελος', 'N'), g('πίστιν', 'πίστις', 'N'), g('ἔχειν', 'ἔχω', 'V'),
        ] } };
        expect(passageLemmas([verso as never]).map(l => l.lemma)).toEqual(['ὄφελος', 'πίστις', 'ἔχω']);
    });
});

describe('lemmaKey — hebreo por consonantes, griego plegado', () => {
    it('hebreo: las vocales no cuentan', () => {
        expect(lemmaKey('שׁוּב')).toBe(lemmaKey('שוב'));
    });
    it('griego: un lema ya no queda en cadena vacía', () => {
        expect(lemmaKey('ἐλέγχω')).toBe('ελεγχω');
        expect(lemmaKey('Λόγος')).toBe(lemmaKey('λογος'));
        expect(lemmaKey('κόσμος')).toBe('κοσμοσ');
    });
});

describe('mergeLemmas', () => {
    it('primero los del análisis, después los del pasaje, sin repetir por clave', () => {
        const r = mergeLemmas(
            [{ lemma: 'קִיקָיוֹן', term: 'הַקִּיקָיוֹן' }],
            [{ lemma: 'מָנָה', term: 'וַיְמַן' }, { lemma: 'קיקיון', term: 'קִיקָיוֹן' }],
        );
        expect(r.map(l => l.lemma)).toEqual(['קִיקָיוֹן', 'מָנָה']);
    });
});
