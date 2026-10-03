import { describe, it, expect } from 'vitest';
import { suggestGrammarSelection, suggestLexiconSelection } from '../lexiconSuggestion';

/**
 * Jonás 4:5-11 con el léxico de Ortiz: el fundador no sabía qué hojas elegir.
 * Frecuencias reales del AT (morphhb): אָמַר 5.318, קִיקָיוֹן 5, חוּס 24,
 * חֲרִישִׁי 1, מָנָה 28.
 */
const L = (lemma: string, occurrences: number, strong: number) => ({ lemma, term: lemma, occurrences, firstVerse: '4:5', strong });
const LEMAS = [L('אָמַר', 4, 559), L('קִיקָיוֹן', 5, 7021), L('חוּס', 2, 2347), L('חֲרִישִׁי', 1, 2759), L('מָנָה', 3, 4487)];
const FREQ: Record<number, number> = { 559: 5318, 7021: 5, 2347: 24, 2759: 1, 4487: 28 };
const HOJAS: Record<string, Array<{ sheet: number; count: number }>> = {
    'אָמַר': [{ sheet: 30, count: 9 }], 'קִיקָיוֹן': [{ sheet: 440, count: 4 }, { sheet: 12, count: 1 }],
    'חוּס': [{ sheet: 120, count: 3 }], 'חֲרִישִׁי': [{ sheet: 160, count: 2 }], 'מָנָה': [{ sheet: 300, count: 5 }],
};
const base = {
    lemmas: LEMAS,
    sheetsOf: (l: string) => HOJAS[l] ?? [],
    bibleCount: (l: { strong?: number }) => (l.strong ? FREQ[l.strong] : undefined),
    commonFrom: 1000,
    sheetChars: () => 4_000,
    budgetChars: 100_000,
};

describe('suggestLexiconSelection', () => {
    it('una hoja por lema, la de entrada, y los raros primero', () => {
        const r = suggestLexiconSelection(base);
        expect(r.picked.map(p => p.sheet)).toEqual([160, 440, 120, 300, 30]);
    });

    it('los verbos de todos los días van al final y lo dicen', () => {
        const r = suggestLexiconSelection(base);
        const amar = r.picked.at(-1)!;
        expect(amar.lemmas).toEqual(['אָמַר']);
        expect(amar.reasons).toContainEqual({ kind: 'common', bibleCount: 5318 });
    });

    it('cada hoja dice por qué entra', () => {
        const qiqayon = suggestLexiconSelection(base).picked.find(p => p.sheet === 440)!;
        expect(qiqayon.reasons).toEqual([{ kind: 'rare', bibleCount: 5 }, { kind: 'repeated', passageCount: 5 }]);
    });

    it('recorta al presupuesto, empezando por lo menos útil', () => {
        const r = suggestLexiconSelection({ ...base, budgetChars: 12_000 });
        expect(r.picked.map(p => p.sheet)).toEqual([160, 440, 120]);
        expect(r.leftOut).toEqual(['מָנָה', 'אָמַר']);
    });

    it('un lema sin hojas en este libro se informa aparte', () => {
        const r = suggestLexiconSelection({ ...base, lemmas: [...LEMAS, L('עָמַל', 1, 5998)] });
        expect(r.notFound).toEqual(['עָמַל']);
    });

    it('dos lemas con la entrada en la misma hoja comparten la hoja', () => {
        const r = suggestLexiconSelection({ ...base, sheetsOf: (l: string) => (l === 'חוּס' ? [{ sheet: 440, count: 1 }] : HOJAS[l] ?? []) });
        expect(r.picked.find(p => p.sheet === 440)!.lemmas).toEqual(['קִיקָיוֹן', 'חוּס']);
    });
});

describe('suggestGrammarSelection', () => {
    it('una hoja por sección, en el orden propuesto, hasta el presupuesto', () => {
        const secciones = [
            { sheet: 210, section: 'Wayyiqtol', matched: ['wayyiqtol'], corroborated: false },
            { sheet: 210, section: 'Consecutive', matched: ['consecutiv'], corroborated: false },
            { sheet: 300, section: 'Infinitive Construct', matched: ['infinitiv'], corroborated: false },
            { sheet: 400, section: 'Hiphil', matched: ['hiphil'], corroborated: false },
        ];
        const r = suggestGrammarSelection({ sections: secciones, sheetChars: () => 5_000, budgetChars: 10_000 });
        expect(r.picked.map(p => p.sheet)).toEqual([210, 300]);
        expect(r.picked[0]!.reasons).toHaveLength(2);
        expect(r.leftOut).toEqual(['Hiphil']);
    });
});
