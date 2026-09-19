import { describe, expect, it } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { consonantsOf, lemmasOfAnalyses, rankLemmaSheets } from '../lemmaPages';

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
