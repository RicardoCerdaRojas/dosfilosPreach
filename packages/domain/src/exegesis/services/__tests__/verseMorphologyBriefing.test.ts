import { describe, expect, it } from 'vitest';
import {
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
        expect(buildVerseMorphologyBlock(verso(SANTIAGO_2_2_3), 'es')).toContain('Contá OCURRENCIAS');
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
