import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/** Revisión de G1 + G5: un análisis que llega después de navegar no se pone en el versículo nuevo. */
let resolver: (v: unknown) => void = () => {};
const save = vi.fn();
vi.mock('@dosfilos/infrastructure', () => ({
    FirestoreGreekInsightRepository: class { get = vi.fn().mockResolvedValue(null); save = save; },
    GreekInsightService: class { analyzeVerse = vi.fn(() => new Promise(r => { resolver = r; })); },
}));
const { useGreekInsight } = await import('../useGreekInsight');
const tokens = [{ text: 'a' }] as never;

describe('useGreekInsight', () => {
    it('el resultado de JAS 1:1 que llega estando en JAS 1:2 se guarda, pero no se muestra en 1:2', async () => {
        const { result, rerender } = renderHook(({ ref }) => useGreekInsight(ref, tokens), { initialProps: { ref: 'JAS 1:1' } });
        await waitFor(() => expect(result.current.checking).toBe(false));
        let pendiente: Promise<void> = Promise.resolve();
        act(() => { pendiente = result.current.generate(); });
        rerender({ ref: 'JAS 1:2' });
        await act(async () => { resolver({ reference: 'JAS 1:1', words: [{}] }); await pendiente; });
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ reference: 'JAS 1:1' }));
        expect(result.current.insight).toBeNull();
    });
});
