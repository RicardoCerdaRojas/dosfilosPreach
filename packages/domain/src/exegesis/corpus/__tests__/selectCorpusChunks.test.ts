import { describe, expect, it } from 'vitest';
import {
    selectForPrompt,
    sheetWithinRanges,
    fijadoPrimero,
    type CorpusChunk,
} from '../selectCorpusChunks';

function chunk(
    partial: Partial<CorpusChunk> & { chunkIndex: number },
): CorpusChunk {
    return {
        resourceId: 'libro-a',
        text: 'x'.repeat(1000),
        sheet: partial.chunkIndex,
        section: null,
        score: 0.5,
        ...partial,
    };
}

describe('selectForPrompt', () => {
    it('mete primero lo fijado, aunque no gane el ranking', () => {
        // La introducción del libro no menciona el versículo, así que su puntaje
        // es bajo — y aun así el usuario la marcó.
        const result = selectForPrompt({
            pinned: [chunk({ chunkIndex: 1, score: 0.05 })],
            ranked: [chunk({ chunkIndex: 50, score: 0.9 })],
            budgetChars: 5000,
        });

        expect(result.chunks.map(c => c.chunkIndex)).toEqual([1, 50]);
        expect(result.pinnedChars).toBe(1000);
        expect(result.rankedChars).toBe(1000);
    });

    it('devuelve los fragmentos en orden de documento, no por puntaje', () => {
        // Un comentario se lee corrido: barajarlo por cercanía le entrega al
        // modelo el material desordenado.
        const result = selectForPrompt({
            pinned: [],
            ranked: [
                chunk({ chunkIndex: 30, score: 0.9 }),
                chunk({ chunkIndex: 10, score: 0.7 }),
                chunk({ chunkIndex: 20, score: 0.8 }),
            ],
            budgetChars: 5000,
        });

        expect(result.chunks.map(c => c.chunkIndex)).toEqual([10, 20, 30]);
    });

    it('agrupa por fuente antes que por hoja', () => {
        const result = selectForPrompt({
            pinned: [],
            ranked: [
                chunk({ resourceId: 'libro-b', chunkIndex: 5, sheet: 5 }),
                chunk({ resourceId: 'libro-a', chunkIndex: 90, sheet: 90 }),
            ],
            budgetChars: 5000,
        });

        expect(result.chunks.map(c => c.resourceId)).toEqual(['libro-a', 'libro-b']);
    });

    it('corta el ranking cuando se acaba el presupuesto', () => {
        const result = selectForPrompt({
            pinned: [],
            ranked: [
                chunk({ chunkIndex: 1, score: 0.9 }),
                chunk({ chunkIndex: 2, score: 0.8 }),
                chunk({ chunkIndex: 3, score: 0.7 }),
            ],
            budgetChars: 2000,
        });

        expect(result.chunks.map(c => c.chunkIndex)).toEqual([1, 2]);
        expect(result.droppedRanked).toBe(1);
    });

    it('descarta por puntaje, no por orden de llegada', () => {
        const result = selectForPrompt({
            pinned: [],
            ranked: [
                chunk({ chunkIndex: 1, score: 0.1 }),
                chunk({ chunkIndex: 2, score: 0.9 }),
            ],
            budgetChars: 1000,
        });

        expect(result.chunks.map(c => c.chunkIndex)).toEqual([2]);
    });

    it('avisa cuando lo fijado se come el presupuesto entero', () => {
        // Sin esto, el paso sale pobre y nadie sabe por qué.
        const result = selectForPrompt({
            pinned: [chunk({ chunkIndex: 1 }), chunk({ chunkIndex: 2 })],
            ranked: [chunk({ chunkIndex: 50, score: 0.9 })],
            budgetChars: 2000,
        });

        expect(result.pinnedExhaustedBudget).toBe(true);
        expect(result.droppedRanked).toBe(1);
        expect(result.chunks).toHaveLength(2);
    });

    it('no avisa de presupuesto agotado cuando no había ranking que perder', () => {
        const result = selectForPrompt({
            pinned: [chunk({ chunkIndex: 1 })],
            ranked: [],
            budgetChars: 1000,
        });

        expect(result.pinnedExhaustedBudget).toBe(false);
    });

    it('no cuenta dos veces un fragmento fijado que también ganó el ranking', () => {
        const both = chunk({ chunkIndex: 7, score: 0.95 });
        const result = selectForPrompt({
            pinned: [both],
            ranked: [both],
            budgetChars: 5000,
        });

        expect(result.chunks).toHaveLength(1);
        expect(result.pinnedChars).toBe(1000);
        expect(result.rankedChars).toBe(0);
    });

    it('respeta un presupuesto de cero sin romperse', () => {
        const result = selectForPrompt({
            pinned: [],
            ranked: [chunk({ chunkIndex: 1 })],
            budgetChars: 0,
        });

        expect(result.chunks).toEqual([]);
        expect(result.droppedRanked).toBe(1);
    });
});

describe('sheetWithinRanges', () => {
    it('acepta una hoja dentro de un tramo', () => {
        expect(sheetWithinRanges(70, [{ start: 68, end: 72 }])).toBe(true);
    });

    it('rechaza una hoja que el usuario dejó afuera', () => {
        // Firestore devuelve lo más cercano de TODO el libro; la curaduría manda.
        expect(sheetWithinRanges(300, [{ start: 68, end: 72 }])).toBe(false);
    });

    it('rechaza un fragmento sin hoja conocida', () => {
        expect(sheetWithinRanges(null, [{ start: 1, end: 999 }])).toBe(false);
    });

    it('acepta los extremos del tramo', () => {
        expect(sheetWithinRanges(68, [{ start: 68, end: 72 }])).toBe(true);
        expect(sheetWithinRanges(72, [{ start: 68, end: 72 }])).toBe(true);
    });
});

describe('selectForPrompt — piso por fuente', () => {
    /** `n` fragmentos de `chars` cada uno, con puntaje descendente. */
    function chunksFor(resourceId: string, n: number, chars: number, baseScore: number): CorpusChunk[] {
        return Array.from({ length: n }, (_, i) => ({
            resourceId,
            chunkIndex: i,
            text: 'x'.repeat(chars),
            sheet: i + 1,
            section: null,
            score: baseScore - i * 0.001,
        }));
    }

    function charsBySource(chunks: CorpusChunk[]): Record<string, number> {
        const out: Record<string, number> = {};
        for (const c of chunks) out[c.resourceId] = (out[c.resourceId] ?? 0) + c.text.length;
        return out;
    }

    it('deja entrar al léxico aunque el comentario gane todo el ranking', () => {
        // La forma medida en un paso real: el comentario glosa el
        // versículo entero y puntúa alto en cada párrafo; el léxico
        // habla de una palabra y puntúa más bajo en todo.
        const comentario = chunksFor('comentario', 40, 2_000, 0.9);
        const lexico = chunksFor('lexico', 4, 1_000, 0.4);

        const out = selectForPrompt({
            ranked: [...comentario, ...lexico],
            pinned: [],
            budgetChars: 40_000,
        });

        const porFuente = charsBySource(out.chunks);
        expect(porFuente['lexico']).toBeGreaterThan(0);
        expect(porFuente['comentario']).toBeGreaterThan(0);
    });

    it('sin piso, el ranking global deja al léxico en cero', () => {
        const comentario = chunksFor('comentario', 40, 2_000, 0.9);
        const lexico = chunksFor('lexico', 4, 1_000, 0.4);

        const out = selectForPrompt({
            ranked: [...comentario, ...lexico],
            pinned: [],
            budgetChars: 40_000,
            perSourceFloorFraction: 0,
        });

        expect(charsBySource(out.chunks)['lexico']).toBeUndefined();
    });

    it('una fuente con poco material toma lo suyo y libera el resto', () => {
        const comentario = chunksFor('comentario', 40, 2_000, 0.9);
        const lexico = chunksFor('lexico', 1, 500, 0.4);

        const out = selectForPrompt({
            ranked: [...comentario, ...lexico],
            pinned: [],
            budgetChars: 40_000,
        });

        const porFuente = charsBySource(out.chunks);
        expect(porFuente['lexico']).toBe(500);
        // El piso es un techo de reserva, no una cuota a llenar: lo que
        // el léxico no usa se lo lleva la competencia libre.
        expect(porFuente['comentario']).toBeGreaterThanOrEqual(38_000);
    });

    it('nunca pasa el presupuesto', () => {
        const out = selectForPrompt({
            ranked: [
                ...chunksFor('a', 10, 3_000, 0.9),
                ...chunksFor('b', 10, 3_000, 0.8),
                ...chunksFor('c', 10, 3_000, 0.7),
            ],
            pinned: [],
            budgetChars: 20_000,
        });

        const total = out.chunks.reduce((n, c) => n + c.text.length, 0);
        expect(total).toBeLessThanOrEqual(20_000);
    });

    it('lo fijado sigue entrando antes que cualquier piso', () => {
        const out = selectForPrompt({
            ranked: chunksFor('comentario', 20, 2_000, 0.9),
            pinned: chunksFor('introduccion', 2, 1_500, 0),
            budgetChars: 20_000,
        });

        expect(charsBySource(out.chunks)['introduccion']).toBe(3_000);
        expect(out.pinnedChars).toBe(3_000);
    });
});

describe('fijadoPrimero — lo fijado adelante, cada grupo en su orden', () => {
    it('separa sin reordenar dentro de cada grupo', () => {
        const c = (i: number, pinned?: boolean) => ({ chunkIndex: i, pinned });
        expect(fijadoPrimero([c(1), c(2, true), c(3), c(4, true)])).toEqual({ fijados: [c(2, true), c(4, true)], consultados: [c(1), c(3)] });
    });
});
