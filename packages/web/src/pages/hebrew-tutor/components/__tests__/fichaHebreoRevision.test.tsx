import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/** La ficha hebrea de la revisión del profesor (2026-11): U4 (artículo y rol de MACULA) y U5 (función del verbo finito). */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));
const { BLOQUES_HEBREO } = await import('../../ficha/bloquesHebreo');
const { FichaCompleta } = await import('@/components/word-ficha/Ficha');

/** U4 (revisión del profesor, Rut 3:6 הַגֹּרֶן): el artículo y el rol de MACULA como datos. */
describe('Ficha hebrea — el artículo y el rol de la palabra (U4)', () => {
    const SUSTANTIVO = { hebrewText: 'הַגֹּרֶן', category: 'NOUN', morphemes: [], translation: 'la era' };

    it('Rut 3:6: «objeto directo» contra el adv de MACULA se avisa, con la pista de «a» o «hacia»', () => {
        const d = { word: { ...SUSTANTIVO, syntacticFunction: 'Objeto directo de וַתֵּרֶד' }, role: 'adv' };
        render(<FichaCompleta registro={BLOQUES_HEBREO} d={d as never} />);
        expect(screen.getByTestId('ficha-rol-macula').textContent).toContain('verseAnalyzer.ficha.role.adv');
        expect(screen.getByTestId('ficha-rol-choque')).toBeTruthy();
        expect(screen.getByTestId('ficha-funcion').textContent).toContain('verseAnalyzer.ficha.role.adverbialHint');
    });

    it('si coinciden, el rol se muestra sin aviso; un rol que no se nombra (frase preposicional) no se muestra', () => {
        const { unmount } = render(<FichaCompleta registro={BLOQUES_HEBREO} d={{ word: { ...SUSTANTIVO, syntacticFunction: 'Complemento adverbial de dirección' }, role: 'adv' } as never} />);
        expect(screen.getByTestId('ficha-rol-macula')).toBeTruthy();
        expect(screen.queryByTestId('ficha-rol-choque')).toBeNull();
        unmount();
        render(<FichaCompleta registro={BLOQUES_HEBREO} d={{ word: { ...SUSTANTIVO, syntacticFunction: 'Complemento' }, role: 'pp' } as never} />);
        expect(screen.queryByTestId('ficha-rol-macula')).toBeNull();
    });

    it('el antecedente del artículo: «ya se nombró en el v. 3», con la palabra en hebreo y la fuente de Putnam', () => {
        const d = { word: SUSTANTIVO, article: { ordinal: 1, antecedent: { text: 'הַגֹּרֶן', verse: 3 }, sameVerse: false } };
        render(<FichaCompleta registro={BLOQUES_HEBREO} d={d as never} />);
        const caja = screen.getByTestId('ficha-articulo');
        expect(caja.textContent).toContain('הַגֹּרֶן');
        expect(caja.textContent).toContain('verseAnalyzer.ficha.article.seenBefore');
        expect(caja.textContent).toContain('Putnam');
    });
});

/** U5 (revisión del profesor, Rut 3:5 אֶעֱשֶׂה): la función del verbo finito, con el cohortativo por función. */
describe('Ficha hebrea — la función del verbo finito (U5)', () => {
    const VERBO = { hebrewText: 'אֶעֱשֶׂה', category: 'VERB', morphemes: [], translation: 'haré', syntacticFunction: 'Verbo principal de la promesa' };
    const cand = { ordinal: 3, text: 'אֶעֱשֶׂה', form: 'imperfect' as const, rule: 'vfYiqtolPrimera' as const, allowed: ['future', 'resolve', 'wish'] as const, status: 'medida' as const };

    it('Rut 3:5: elegida «resolve» sobre un yiqtol, se nombra «Cohortativo por función» y cita el cohortativo y Putnam', () => {
        const d = { word: VERBO, verb: { candidate: cand, fn: 'resolve' as const, by: 'assistant' as const } };
        render(<FichaCompleta registro={BLOQUES_HEBREO} d={d as never} />);
        const bloque = screen.getByTestId('verb-function-note');
        expect(bloque.textContent).toContain('verseAnalyzer.verb.cohortativeByFunction');
        expect(bloque.textContent).toContain('verseAnalyzer.verb.title.imperfect');
        expect(bloque.textContent).toContain('verseAnalyzer.ficha.recognizedBy.vfYiqtolPrimera');
        expect(bloque.textContent).toContain('Putnam');
        // La función libre del asistente va dentro del bloque, no aparte.
        expect(bloque.textContent).toContain('Verbo principal de la promesa');
        expect(screen.queryByTestId('ficha-funcion')).toBeNull();
    });

    it('sin función elegida (análisis anterior), el bloque no aparece y queda la función libre', () => {
        render(<FichaCompleta registro={BLOQUES_HEBREO} d={{ word: VERBO, verb: { candidate: cand } } as never} />);
        expect(screen.queryByTestId('verb-function-note')).toBeNull();
        expect(screen.getByTestId('ficha-funcion').textContent).toContain('Verbo principal de la promesa');
    });

    it('«future» sobre el mismo yiqtol se nombra como futuro, no como cohortativo', () => {
        render(<FichaCompleta registro={BLOQUES_HEBREO} d={{ word: VERBO, verb: { candidate: cand, fn: 'future', by: 'assistant' } } as never} />);
        const t = screen.getByTestId('verb-function-note').textContent ?? '';
        expect(t).toContain('verseAnalyzer.verb.functions.future');
        expect(t).not.toContain('cohortativeByFunction');
    });
});
