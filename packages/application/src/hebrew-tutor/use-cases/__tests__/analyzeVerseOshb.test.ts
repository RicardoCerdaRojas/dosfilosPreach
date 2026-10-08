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

    it('REGRESIÓN (revisión): un análisis nuevo sale corregido, se guarda CRUDO y la corrección sigue a la segunda lectura', async () => {
        let guardado: unknown = null;
        const sessions = {
            getCachedAnalysis: vi.fn().mockImplementation(async () => JSON.parse(JSON.stringify(guardado))),
            cacheAnalysis: vi.fn().mockImplementation(async (_r: string, a: unknown) => { guardado = a; }),
        };
        const service = { analyzeVerse: vi.fn().mockResolvedValue(analisis) };
        const uc = new AnalyzeVerseUseCase(provider as never, service as never, sessions as never);
        const nuevo = await uc.execute({ morphhbKey: 'Ruth', chapter: 1, verse: 13, forceRefresh: true } as never);
        expect(nuevo.words[0]!.verbMorphology?.person).toBe(2);
        expect((guardado as typeof analisis).words[0]!.verbMorphology.person).toBe(3);
        const releido = await uc.execute({ morphhbKey: 'Ruth', chapter: 1, verse: 13 } as never);
        expect(releido.words[0]!.oshbReference).toMatchObject({ agreesWithAnalysis: false, corrections: [{ field: 'person', analysis: '3', oshb: '2' }] });
    });

    it('REGRESIÓN (Rut 1:17): la fórmula de juramento sale yusiva al leer', async () => {
        const v17 = {
            reference: 'Ruth.1.17', displayReference: 'Rut 1:17', hebrewText: 'x',
            words: [
                { text: 'כֹּה', lemma: '3541', oshbMorphCode: 'HD' }, { text: 'יַעֲשֶׂה', lemma: '6213 a', oshbMorphCode: 'HVqi3ms' },
                { text: 'וְכֹה', lemma: 'c/3541', oshbMorphCode: 'HC/D' }, { text: 'יֹסִיף', lemma: '3254', oshbMorphCode: 'HVhi3ms' },
            ],
        };
        const vm = { binyan: 'QAL', verbForm: 'IMPERFECT', verbType: 'STRONG', person: 3, gender: 'M', number: 'S', temporalValue: 'futuro', recognitionClues: [] };
        const guardado = {
            ...analisis,
            words: [
                { hebrewText: 'כֹּה', category: 'ADVERB', morphemes: [] }, { hebrewText: 'יַעֲשֶׂה', category: 'VERB', morphemes: [], verbMorphology: vm },
                { hebrewText: 'וְכֹה', category: 'ADVERB', morphemes: [] }, { hebrewText: 'יֹסִיף', category: 'VERB', morphemes: [], verbMorphology: { ...vm, binyan: 'HIFIL' } },
            ],
            clauses: [],
        };
        const prov = { loadBook: vi.fn(), getVerse: vi.fn().mockReturnValue(v17) };
        const sessions = { getCachedAnalysis: vi.fn().mockResolvedValue(guardado), cacheAnalysis: vi.fn() };
        const r = await new AnalyzeVerseUseCase(prov as never, { analyzeVerse: vi.fn() } as never, sessions as never).execute({ morphhbKey: 'Ruth', chapter: 1, verse: 17 } as never);
        expect(r.words[1]!.verbMorphology?.verbForm).toBe('JUSSIVE');
        expect(r.words[3]!.verbMorphology?.verbForm).toBe('JUSSIVE');
    });
});

