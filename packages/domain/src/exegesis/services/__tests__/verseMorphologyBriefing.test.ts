import { describe, expect, it } from 'vitest';
import {
    buildHebrewMorphologyBlock,
    buildVerseMorphologyBlock,
    countGreekMoods,
    describeGreekToken,
} from '../verseMorphologyBriefing';
import type { GreekVerseTokens, GreekWordToken } from '../../../greek-analyzer/morphGntToken';

const verbo = (text: string, tag: Record<string, string>): GreekWordToken =>
    ({ text, lemma: text, pos: 'V', tag, transliteration: '' } as unknown as GreekWordToken);

/**
 * Santiago 2:2–3, tal como lo tabula MorphGNT. La prótasis tiene CINCO
 * subjuntivos —εἰσέλθῃ dos veces, ἐπιβλέψητε, εἴπητε dos veces— y el análisis
 * del trabajo enumeró cuatro.
 */
const SANTIAGO_2_2_3: GreekWordToken[] = [
    verbo('εἰσέλθῃ', { tense: 'A', voice: 'A', mood: 'S', person: '3', number: 'S' }),
    verbo('εἰσέλθῃ', { tense: 'A', voice: 'A', mood: 'S', person: '3', number: 'S' }),
    verbo('ἐπιβλέψητε', { tense: 'A', voice: 'A', mood: 'S', person: '2', number: 'P' }),
    verbo('εἴπητε', { tense: 'A', voice: 'A', mood: 'S', person: '2', number: 'P' }),
    verbo('εἴπητε', { tense: 'A', voice: 'A', mood: 'S', person: '2', number: 'P' }),
    verbo('κάθου', { tense: 'P', voice: 'M', mood: 'D', person: '2', number: 'S' }),
    verbo('φοροῦντα', { tense: 'P', voice: 'A', mood: 'P', case: 'A', number: 'S', gender: 'M' }),
];

describe('countGreekMoods — el recuento que falló', () => {
    it('cuenta OCURRENCIAS y no formas distintas', () => {
        // Contar formas distintas da cuatro subjuntivos —εἰσέλθῃ una vez—, que
        // es exactamente el error medido.
        expect(countGreekMoods(SANTIAGO_2_2_3).subjuntivo).toBe(5);
        expect(new Set(SANTIAGO_2_2_3.filter(t => t.tag.mood === 'S').map(t => t.text)).size).toBe(3);
    });

    it('separa los modos entre sí', () => {
        const c = countGreekMoods(SANTIAGO_2_2_3);
        expect(c.imperativo).toBe(1);
        expect(c.participio).toBe(1);
        expect(c.indicativo).toBeUndefined();
    });

    it('lo que no es verbo no entra en el recuento de modos', () => {
        const sustantivo = { text: 'συναγωγήν', lemma: 'συναγωγή', pos: 'N', tag: { case: 'A' } } as unknown as GreekWordToken;
        expect(countGreekMoods([sustantivo])).toEqual({});
    });
});

describe('describeGreekToken', () => {
    it('un verbo personal se lee con tiempo, voz, modo y persona', () => {
        expect(describeGreekToken(SANTIAGO_2_2_3[0]!))
            .toBe('εἰσέλθῃ (εἰσέλθῃ) — aoristo activa subjuntivo, 3ª singular');
    });

    it('un participio no lleva persona sino caso, número y género', () => {
        const d = describeGreekToken(SANTIAGO_2_2_3[6]!);
        expect(d).toContain('participio');
        expect(d).toContain('acusativo singular masculino');
        expect(d).not.toContain('ª');
    });

    it('una forma declinada se lee por su caso', () => {
        const sust = { text: 'συναγωγήν', lemma: 'συναγωγή', pos: 'N', tag: { case: 'A', number: 'S', gender: 'F' } } as unknown as GreekWordToken;
        expect(describeGreekToken(sust)).toBe('συναγωγήν (συναγωγή) — acusativo singular femenino');
    });
});

describe('buildVerseMorphologyBlock', () => {
    const verso = (tokens: GreekWordToken[]): GreekVerseTokens =>
        ({ reference: { chapter: 2, verse: 2 }, text: '', tokens } as GreekVerseTokens);

    it('el resumen dice cuántos hay de cada modo', () => {
        expect(buildVerseMorphologyBlock(verso(SANTIAGO_2_2_3), 'es')).toContain('5 subjuntivos');
    });

    it('avisa explícitamente que se cuentan ocurrencias', () => {
        // Es la instrucción que separa «cuatro» de «cinco».
        expect(buildVerseMorphologyBlock(verso(SANTIAGO_2_2_3), 'es')).toContain('Cuenta OCURRENCIAS');
        expect(buildVerseMorphologyBlock(verso(SANTIAGO_2_2_3), 'en')).toContain('Count OCCURRENCES');
    });

    it('va rotulado como dato y no como análisis', () => {
        // Lo que NO es calculable —función sintáctica, rango semántico,
        // decisión de traducción— sigue siendo del analizador.
        expect(buildVerseMorphologyBlock(verso(SANTIAGO_2_2_3), 'es')).toContain('DATO, no análisis');
    });

    it('sin tokens no se agrega un bloque vacío', () => {
        // El hebreo y los libros fuera de MorphGNT pasan por acá sin bloque.
        expect(buildVerseMorphologyBlock(null, 'es')).toBe('');
        expect(buildVerseMorphologyBlock(verso([]), 'es')).toBe('');
    });
});

/** Salmo 23:2-3 tal como lo tabula morphhb. */
const SALMO_23: Array<{ text: string; lemma: string; oshbMorphCode: string }> = [
    { text: 'בִּ/נְא֣וֹת', lemma: 'b/4999', oshbMorphCode: 'HR/Ncfpc' },
    { text: 'יַרְבִּיצֵ֑/נִי', lemma: '7257', oshbMorphCode: 'HVhi3ms/Sp1cs' },
    { text: 'יְנַהֲלֵֽ/נִי', lemma: '5095', oshbMorphCode: 'HVpi3ms/Sp1cs' },
    { text: 'יְשׁוֹבֵ֑ב', lemma: '7725', oshbMorphCode: 'HVoi3ms' },
    { text: 'יַֽנְחֵ֥/נִי', lemma: '5148', oshbMorphCode: 'HVhi3ms/Sp1cs' },
];

describe('buildHebrewMorphologyBlock', () => {
    const verso = (tokens: typeof SALMO_23) => ({ tokens });

    it('el resumen cuenta ocurrencias por forma y tallo', () => {
        // Dos hifiles imperfectos: יַרְבִּיצֵנִי y יַנְחֵנִי.
        expect(buildHebrewMorphologyBlock(verso(SALMO_23), 'es')).toContain('2 imperfecto hifils');
    });

    it('cada palabra sale con sus morfemas, junturas incluidas', () => {
        const bloque = buildHebrewMorphologyBlock(verso(SALMO_23), 'es');
        expect(bloque).toContain('preposición + sustantivo femenino plural constructo');
        expect(bloque).toContain('polel imperfecto 3ª masculino singular');
    });

    it('la barra de morphhb no se imprime: separa morfemas, no palabras', () => {
        expect(buildHebrewMorphologyBlock(verso(SALMO_23), 'es')).toContain('יְשׁוֹבֵ֑ב');
        expect(buildHebrewMorphologyBlock(verso([SALMO_23[0]!]), 'es')).not.toContain('בִּ/נְא֣וֹת');
    });

    it('avisa que un código crudo NO se adivina', () => {
        // Es la instrucción que impide que el modelo invente un nombre de
        // tallo donde el sistema decidió callar.
        const b = buildHebrewMorphologyBlock(verso(SALMO_23), 'es');
        expect(b).toContain('NO lo adivines');
        expect(buildHebrewMorphologyBlock(verso(SALMO_23), 'en')).toContain('Do NOT guess');
    });

    it('va rotulado como dato, igual que el griego', () => {
        expect(buildHebrewMorphologyBlock(verso(SALMO_23), 'es')).toContain('DATO, no análisis');
    });

    it('sin tokens no se agrega un bloque vacío', () => {
        expect(buildHebrewMorphologyBlock(null, 'es')).toBe('');
        expect(buildHebrewMorphologyBlock(verso([]), 'es')).toBe('');
    });
});
