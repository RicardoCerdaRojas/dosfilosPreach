import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../analyzerPrompts';

/**
 * Lo elegido pesa 3–4 veces el presupuesto y el reparto corta, incluso lo
 * fijado. Sin registrarlo no se distingue «no halló la hoja» de «la halló y no
 * llegó» (§5 de FASE_DEL_CORPUS_AL_TEXTO_2026-11).
 */
const REF = { bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 3, verseEnd: 3 } as const;
const hojas = (desde: number, n: number, largo: number) =>
    Array.from({ length: n }, (_, i) => `--- p. ${desde + i} ---\n${'x'.repeat(largo)}`).join('\n');

const entrada = (sources: unknown[]): AnalyzeVerseInput => ({
    paperPassage: { ...REF, verseStart: 1, verseEnd: 6 },
    verseRef: REF,
    language: 'es',
    originalLanguageText: null,
    pericopeContext: null,
    assignmentBrief: null,
    stepEmphasis: null,
    styleGuideContent: '',
    sources,
    priorAcceptedAnalyses: [],
    regenerationHint: null,
    missingSourceTypes: [],
} as unknown as AnalyzeVerseInput);

describe('lo que llegó al prompt, por fuente', () => {
    it('una fuente que entra entera registra todas sus hojas', () => {
        const { materialRead } = buildAnalyzerPrompt(entrada([
            { citationKey: 'Mayor', displayLabel: 'Mayor, James', sourceType: 'commentary', textContent: hojas(155, 3, 100) },
        ]));
        expect(materialRead).toEqual([{ sourceKey: 'Mayor', label: 'Mayor, James', read: 'p. 155–157', truncated: false, pinnedCut: false }]);
    });

    it('una fuente que el reparto corta registra solo las hojas que quedaron', () => {
        // 300 hojas de 1.000 caracteres no caben en el tope del mensaje.
        const { materialRead, userMessage } = buildAnalyzerPrompt(entrada([
            { citationKey: 'Wallace', displayLabel: 'Wallace', sourceType: 'grammar-syntax', textContent: hojas(1, 300, 1000) },
        ]));
        const [w] = materialRead;
        expect(w?.truncated).toBe(true);
        const ultima = Number(w!.read!.match(/–(\d+)$/)![1]);
        expect(ultima).toBeLessThan(300);
        expect(userMessage).toContain(`--- p. ${ultima} ---`);
        expect(userMessage).not.toContain(`--- p. ${ultima + 1} ---`);
    });

    it('si lo fijado no cabe entero, lo dice', () => {
        const largo = hojas(1, 300, 1000);
        const { materialRead } = buildAnalyzerPrompt(entrada([
            { citationKey: 'Robertson', displayLabel: 'Robertson', sourceType: 'grammar-syntax', textContent: largo, pinnedChars: largo.length },
        ]));
        expect(materialRead[0]?.pinnedCut).toBe(true);
    });

    it('sin anclas, read es nulo y la fuente igual figura', () => {
        const { materialRead } = buildAnalyzerPrompt(entrada([
            { citationKey: 'BDAG', displayLabel: 'BDAG', sourceType: 'lexicon', textContent: 'texto sin anclas' },
        ]));
        expect(materialRead[0]).toMatchObject({ sourceKey: 'BDAG', read: null, truncated: false });
    });
});
