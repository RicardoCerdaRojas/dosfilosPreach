import { describe, it, expect, vi } from 'vitest';
import { AnalyzeVerseUseCase } from '../analyze-verse';

/**
 * Banco fuera de muestra de la waw disyuntiva (2026-11-11): el asistente veía
 * el versículo solo y fallaba donde el valor depende de lo que lo rodea
 * (Gn 18:18 por 18:17; 2 S 6:23 cierra antes de 7:1). Ahora recibe el anterior
 * y el siguiente, cruzando de capítulo.
 */
const VERSOS: Record<number, number> = { 6: 23, 7: 29 };
const provider = {
    loadBook: vi.fn(),
    getChapterCount: vi.fn().mockReturnValue(24),
    getVerseCount: vi.fn((_k: string, c: number) => VERSOS[c] ?? 20),
    getVerse: vi.fn((_k: string, c: number, v: number) => ({
        reference: `2Sam.${c}.${v}`, displayReference: `2 S ${c}:${v}`, hebrewText: `texto ${c}:${v}`, words: [],
    })),
};
const analisis = { reference: 'x', hebrewText: 'x', transliteration: '', literalTranslation: '', fluidTranslation: '', words: [], verbTable: [], analyzedAt: '' };

async function vecinos(chapter: number, verse: number, p: object = provider) {
    const service = { analyzeVerse: vi.fn().mockResolvedValue(analisis) };
    await new AnalyzeVerseUseCase(p as never, service as never).execute({ morphhbKey: '2Sam', chapter, verse, forceRefresh: true } as never);
    return service.analyzeVerse.mock.calls[0]![8];
}

describe('el análisis hebreo recibe los versículos vecinos', () => {
    it('en medio del capítulo: el anterior y el siguiente', async () => {
        expect(await vecinos(6, 10)).toEqual({
            previous: { reference: '2 S 6:9', hebrewText: 'texto 6:9' },
            next: { reference: '2 S 6:11', hebrewText: 'texto 6:11' },
        });
    });

    it('2 S 6:23, último del capítulo: el siguiente es 7:1', async () => {
        expect((await vecinos(6, 23)).next).toEqual({ reference: '2 S 7:1', hebrewText: 'texto 7:1' });
    });

    it('primero del capítulo: el anterior es el último del capítulo previo', async () => {
        expect((await vecinos(7, 1)).previous).toEqual({ reference: '2 S 6:23', hebrewText: 'texto 6:23' });
    });

    it('primero y último del libro: sin el vecino que no existe', async () => {
        expect(await vecinos(1, 1)).not.toHaveProperty('previous');
        expect(await vecinos(24, 20)).not.toHaveProperty('next');
    });

    it('si leer un vecino falla, el análisis sigue sin él', async () => {
        const roto = {
            ...provider,
            getVerse: vi.fn((_k: string, c: number, v: number) => {
                if (v !== 10) throw new Error('fuera de rango');
                return { reference: `2Sam.${c}.${v}`, displayReference: `2 S ${c}:${v}`, hebrewText: 'x', words: [] };
            }),
        };
        expect(await vecinos(6, 10, roto)).toEqual({});
    });
});
