import { describe, it, expect } from 'vitest';
import { applyOshbMorphology, parseOshbVerb } from '../oshb-contrast';
import { Binyan, Gender, GrammaticalCategory, GrammaticalNumber, Person, VerbForm } from '../../value-objects/grammar';

/** Bitácora del módulo de hebreo (Rut 1, 2026-10-07), hallazgos #1 y #3. */
describe('el verbo de un código OSHB', () => {
    it('forma finita, con prefijo de conjunción y participio', () => {
        expect(parseOshbVerb('HVNi2fp')).toEqual({ binyan: Binyan.NIFAL, verbForm: VerbForm.IMPERFECT, person: Person.SECOND, gender: Gender.FEMININE, number: GrammaticalNumber.PLURAL });
        expect(parseOshbVerb('HVqj2fs')?.verbForm).toBe(VerbForm.JUSSIVE);
        expect(parseOshbVerb('HC/Vqw3ms')).toMatchObject({ verbForm: VerbForm.WAYYIQTOL, person: Person.THIRD });
        expect(parseOshbVerb('HC/Vqq3ms')?.verbForm).toBe(VerbForm.WEQATAL);
        expect(parseOshbVerb('HVqrmsa')).toEqual({ binyan: Binyan.QAL, verbForm: VerbForm.PARTICIPLE_ACTIVE, person: null, gender: Gender.MASCULINE, number: GrammaticalNumber.SINGULAR });
        expect(parseOshbVerb('HVqc')).toMatchObject({ verbForm: VerbForm.INF_CONSTRUCT, person: null, gender: null });
        expect(parseOshbVerb('HVhi3ms')?.binyan).toBe(Binyan.HIFIL);
    });

    it('sin verbo, o tallo que no se nombra con seguridad', () => {
        expect(parseOshbVerb('HTn')).toBeNull();
        expect(parseOshbVerb('HC/D')).toBeNull();
        expect(parseOshbVerb('')).toBeNull();
        expect(parseOshbVerb('HVoi3ms')?.binyan).toBeNull();
        // REGRESIÓN (revisión): el arameo tiene otros tallos; P es ithpaal, no pual.
        expect(parseOshbVerb('AVPp3ms')).toMatchObject({ binyan: null, verbForm: VerbForm.PERFECT, person: Person.THIRD });
    });
});

const verbo = (hebrewText: string, vm: Record<string, unknown>) => ({
    hebrewText, category: GrammaticalCategory.VERB, morphemes: [],
    verbMorphology: { binyan: Binyan.QAL, verbForm: VerbForm.IMPERFECT, verbType: 'STRONG', temporalValue: '', recognitionClues: [], ...vm },
}) as never;

describe('el análisis con la morfología de OSHB', () => {
    it('REGRESIÓN (Rut 1:13): 3FP → 2FP; queda dicho qué se corrigió; la tabla de verbos también', () => {
        const analysis = {
            words: [
                { hebrewText: 'הֲלָהֵן', category: GrammaticalCategory.PARTICLE, morphemes: [] },
                verbo('תֵּעָגֵנָה', { binyan: Binyan.NIFAL, person: 3, gender: 'F', number: 'P' }),
            ],
            verbTable: [{ hebrewForm: 'תֵּֽעָגֵ֔נָה', binyan: 'NIFAL', verbForm: 'IMPERFECT', pgn: '3fp' }],
        } as never;
        const r = applyOshbMorphology(analysis, [
            { text: 'הֲלָהֵן', oshbMorphCode: 'HTi/Rd/Pp3fp' },
            { text: 'תֵּֽעָגֵ֔נָה', oshbMorphCode: 'HVNi2fp', lemma: '5702' },
        ]);
        const w = r.words[1]!;
        expect(w.verbMorphology?.person).toBe(Person.SECOND);
        expect(w.oshbReference).toMatchObject({ morphCode: 'HVNi2fp', agreesWithAnalysis: false });
        expect(w.oshbReference?.corrections).toEqual([{ field: 'person', analysis: '3', oshb: '2' }]);
        expect(r.verbTable[0]!.pgn).toBe('2fp');
        // REGRESIÓN (revisión): un no-verbo no lleva insignia de OSHB: no se comparó nada.
        expect(r.words[0]!.oshbReference).toBeUndefined();
    });

    it('REGRESIÓN (Rut 1:16): אַל + prefijo — imperfecto → yusivo', () => {
        const analysis = { words: [{ hebrewText: 'אַל', category: GrammaticalCategory.PARTICLE, morphemes: [] }, verbo('תִּפְגְּעִי', { person: 2, gender: 'F', number: 'S' })], verbTable: [] } as never;
        const r = applyOshbMorphology(analysis, [{ text: 'אַל', oshbMorphCode: 'HTn' }, { text: 'תִּפְגְּעִי', oshbMorphCode: 'HVqj2fs' }]);
        expect(r.words[1]!.verbMorphology?.verbForm).toBe(VerbForm.JUSSIVE);
        expect(r.words[1]!.oshbReference?.corrections).toEqual([{ field: 'verbForm', analysis: 'IMPERFECT', oshb: 'JUSSIVE' }]);
    });

    it('si coincide no cambia nada; sin tokens, el análisis queda igual', () => {
        const analysis = { words: [verbo('יַעֲשֶׂה', { person: 3, gender: 'M', number: 'S' })], verbTable: [] } as never;
        const r = applyOshbMorphology(analysis, [{ text: 'יַעֲשֶׂה', oshbMorphCode: 'HVqi3ms' }]);
        expect(r.words[0]!.oshbReference).toMatchObject({ agreesWithAnalysis: true, corrections: [] });
        expect(applyOshbMorphology(analysis, [])).toBe(analysis);
    });

    it('palabra unida por maqaf que toma dos tokens: usa el del verbo', () => {
        const analysis = { words: [verbo('אַל־תִּפְגְּעִי', { person: 2, gender: 'F', number: 'S' })], verbTable: [] } as never;
        const r = applyOshbMorphology(analysis, [{ text: 'אַל', oshbMorphCode: 'HTn' }, { text: 'תִּפְגְּעִי', oshbMorphCode: 'HVqj2fs' }, { text: 'בִי', oshbMorphCode: 'HR/Sp1cs' }]);
        expect(r.words[0]!.verbMorphology?.verbForm).toBe(VerbForm.JUSSIVE);
    });

    it('REGRESIÓN (revisión, 1 S 3:17): dos verbos con las mismas consonantes y distinto análisis — cada fila con el suyo', () => {
        const analysis = {
            words: [verbo('תְכַחֵד', { person: 2, gender: 'M', number: 'S' }), verbo('תְכַחֵד', { person: 2, gender: 'M', number: 'S' })],
            verbTable: [{ hebrewForm: 'תְכַחֵד', verbForm: 'IMPERFECT', pgn: '2ms' }, { hebrewForm: 'תְכַחֵד', verbForm: 'IMPERFECT', pgn: '2ms' }],
        } as never;
        const r = applyOshbMorphology(analysis, [{ text: 'תְכַחֵד', oshbMorphCode: 'HVpj2ms' }, { text: 'תְכַחֵד', oshbMorphCode: 'HVpi2ms' }]);
        expect(r.verbTable.map(row => row.verbForm)).toEqual([VerbForm.JUSSIVE, VerbForm.IMPERFECT]);
    });
});

