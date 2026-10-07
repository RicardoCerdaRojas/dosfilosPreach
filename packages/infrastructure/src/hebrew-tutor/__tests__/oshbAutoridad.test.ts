import { describe, it, expect } from 'vitest';
import { buildVerseAnalysisPrompt } from '../knowledge/hebrew-prompt-builder';
import { selectRelevantChunks } from '../knowledge/knowledge-selector';

/** Bitácora del módulo de hebreo #1 y #3 (Rut 1:13, 1:16). */
const verse = {
    reference: 'Ruth.1.16', displayReference: 'Rut 1:16', hebrewText: 'אַל־תִּפְגְּעִי־בִי',
    words: [{ text: 'אַל', lemma: '408', oshbMorphCode: 'HTn' }, { text: 'תִּפְגְּעִי', lemma: '6293', oshbMorphCode: 'HVqj2fs' }],
};

describe('el prompt del tutor de hebreo', () => {
    it('REGRESIÓN: OSHB es autoridad para la morfología del verbo, con la lectura del código', () => {
        const prompt = buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText));
        const texto = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        expect(texto).toContain('MORFOLOGÍA DE OSHB — AUTORIDAD para el verbo');
        expect(texto).not.toContain('NO es autoridad');
        expect(texto).toContain('HVqj2fs');
        expect(texto).toMatch(/j yusivo/);
    });

    it('REGRESIÓN: siempre lleva la regla de אַל + prefijo = yusivo', () => {
        const ids = selectRelevantChunks('וַיֹּאמֶר').map(c => c.id);
        expect(ids).toContain('farfan-volitivos');
        const chunk = selectRelevantChunks('x').find(c => c.id === 'farfan-volitivos')!;
        expect(chunk.content).toMatch(/אַל \+ forma de prefijo = YUSIVO/);
    });
});
