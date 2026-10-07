import { describe, it, expect, vi } from 'vitest';
import { AnalyzeVerseUseCase } from '../analyze-verse';

/** Rut 1:13 (bitácora del módulo de hebreo #1): el tutor dijo 3FP; OSHB, 2FP. */
const verse = {
    reference: 'Ruth.1.13', displayReference: 'Rut 1:13', hebrewText: 'תֵּֽעָגֵ֔נָה',
    words: [{ text: 'תֵּֽעָגֵ֔נָה', lemma: '5702', oshbMorphCode: 'HVNi2fp' }],
};
const analisis = {
    reference: 'Ruth.1.13', hebrewText: 'x', transliteration: '', literalTranslation: '', fluidTranslation: '',
    words: [{
        hebrewText: 'תֵּעָגֵנָה', category: 'VERB', morphemes: [],
        verbMorphology: { binyan: 'NIFAL', verbForm: 'IMPERFECT', verbType: 'STRONG', person: 3, gender: 'F', number: 'P', temporalValue: '', recognitionClues: [] },
    }],
    verbTable: [], analyzedAt: new Date(),
    // El asistente dijo «waw conjuntiva» en una cláusula que no empieza con waw.
    clauses: [{ firstWord: 0, lastWord: 0, type: 'VERBAL', connection: 'WAW_CONJUNCTIVE', connector: null, value: '', explanation: '' }],
};
const provider = { loadBook: vi.fn(), getVerse: vi.fn().mockReturnValue(verse) };

describe('el tutor de hebreo con la morfología de OSHB', () => {
    it('REGRESIÓN: lo guardado en caché sale corregido al leer', async () => {
        const sessions = { getCachedAnalysis: vi.fn().mockResolvedValue(analisis), cacheAnalysis: vi.fn() };
        const service = { analyzeVerse: vi.fn() };
        const r = await new AnalyzeVerseUseCase(provider as never, service as never, sessions as never).execute({ morphhbKey: 'Ruth', chapter: 1, verse: 13 } as never);
        expect(service.analyzeVerse).not.toHaveBeenCalled();
        expect(r.words[0]!.verbMorphology?.person).toBe(2);
        expect(r.words[0]!.oshbReference?.morphCode).toBe('HVNi2fp');
        // Y la conexión de las cláusulas se comprueba al leer.
        expect(r.clauses?.[0]?.connection).toBe('ASYNDETIC');
    });

    it('un análisis nuevo también, y se guarda corregido', async () => {
        const sessions = { getCachedAnalysis: vi.fn().mockResolvedValue(null), cacheAnalysis: vi.fn() };
        const service = { analyzeVerse: vi.fn().mockResolvedValue(analisis) };
        const r = await new AnalyzeVerseUseCase(provider as never, service as never, sessions as never).execute({ morphhbKey: 'Ruth', chapter: 1, verse: 13, forceRefresh: true } as never);
        expect(r.words[0]!.verbMorphology?.person).toBe(2);
        expect(sessions.cacheAnalysis.mock.calls[0]![1].words[0].verbMorphology.person).toBe(2);
    });
});
