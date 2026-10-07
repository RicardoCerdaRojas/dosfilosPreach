import { describe, it, expect } from 'vitest';
import { applyOshbMorphology, markOathFormula, OATH_FORMULA_VALUE } from '../oshb-contrast';
import { Binyan, GrammaticalCategory, VerbForm } from '../../value-objects/grammar';

/** Bitácora del módulo de hebreo #5 (Rut 1:17). */
const verbo = (hebrewText: string, binyan: Binyan) => ({
    hebrewText, category: GrammaticalCategory.VERB, morphemes: [],
    verbMorphology: { binyan, verbForm: VerbForm.IMPERFECT, verbType: 'STRONG', person: 3, gender: 'M', number: 'S', temporalValue: 'futuro', recognitionClues: [] },
}) as never;
const otra = (hebrewText: string) => ({ hebrewText, category: GrammaticalCategory.ADVERB, morphemes: [] }) as never;

// Rut 1:17, tokens y lemas de OSHB.
const tokens = [
    { text: 'כֹּה', lemma: '3541', oshbMorphCode: 'HD' },
    { text: 'יַעֲשֶׂה', lemma: '6213 a', oshbMorphCode: 'HVqi3ms' },
    { text: 'יְהוָה', lemma: '3068', oshbMorphCode: 'HNp' },
    { text: 'לִי', lemma: 'l', oshbMorphCode: 'HR/Sp1cs' },
    { text: 'וְכֹה', lemma: 'c/3541', oshbMorphCode: 'HC/D' },
    { text: 'יֹסִיף', lemma: '3254', oshbMorphCode: 'HVhi3ms' },
];
const analisis = {
    words: [otra('כֹּה'), verbo('יַעֲשֶׂה', Binyan.QAL), otra('יְהוָה'), otra('לִי'), otra('וְכֹה'), verbo('יֹסִיף', Binyan.HIFIL)],
    verbTable: [{ hebrewForm: 'יַעֲשֶׂה', verbForm: 'IMPERFECT', temporalValue: 'futuro' }],
} as never;

describe('la fórmula de juramento', () => {
    it('REGRESIÓN (Rut 1:17): los dos verbos quedan yusivos de valor volitivo, con el motivo dicho', () => {
        const r = markOathFormula(applyOshbMorphology(analisis, tokens), tokens);
        for (const i of [1, 5]) {
            expect(r.words[i]!.verbMorphology).toMatchObject({ verbForm: VerbForm.JUSSIVE, temporalValue: OATH_FORMULA_VALUE });
            expect(r.words[i]!.oshbReference?.corrections).toEqual([{ field: 'verbForm', analysis: 'IMPERFECT', oshb: 'JUSSIVE', reason: 'oath-formula' }]);
        }
        expect(r.verbTable[0]).toMatchObject({ verbForm: VerbForm.JUSSIVE, temporalValue: OATH_FORMULA_VALUE });
    });

    it('«כֹּה יֵעָשֶׂה» sin «וְכֹה יֹסִיף» no es la fórmula (1 S 11:7)', () => {
        const sinYasaf = tokens.slice(0, 4);
        const r = markOathFormula(analisis, sinYasaf);
        expect(r).toBe(analisis);
    });

    it('hacen falta las cuatro piezas: sin כֹּה antes de עשׂה, o sin וְכֹה antes de יסף, no es la fórmula', () => {
        const sinKoh = tokens.map((t, i) => (i === 0 ? { ...t, lemma: '853' } : t));
        expect(markOathFormula(analisis, sinKoh)).toBe(analisis);
        const sinWekoh = tokens.map((t, i) => (i === 4 ? { ...t, lemma: 'c/1571' } : t));
        expect(markOathFormula(analisis, sinWekoh)).toBe(analisis);
    });

    it('si ya era yusivo (como en 1 S 3:17), sólo fija el valor, sin corrección', () => {
        const yusivos = tokens.map(t => ({ ...t, oshbMorphCode: t.oshbMorphCode.replace('qi3', 'qj3').replace('hi3', 'hj3') }));
        const r = markOathFormula(applyOshbMorphology(analisis, yusivos), yusivos);
        expect(r.words[1]!.verbMorphology?.temporalValue).toBe(OATH_FORMULA_VALUE);
        expect(r.words[1]!.oshbReference?.corrections).toEqual([]);
    });
});
