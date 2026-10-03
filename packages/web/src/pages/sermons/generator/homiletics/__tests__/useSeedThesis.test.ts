import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getBySermonId = vi.hoisted(() => vi.fn());
vi.mock('@dosfilos/application', () => ({ pastoralSeedService: { getBySermonId } }));

import { useSeedThesis } from '../useSeedThesis';

/**
 * La idea central de «Elige el enfoque» sale de la semilla, no de
 * `rules.pastoralSeed`, que el asistente nunca tiene (revisión adversarial de F3).
 */
describe('useSeedThesis', () => {
    it('lee la idea central y el género de la semilla del sermón', async () => {
        getBySermonId.mockResolvedValue({
            insight: { centralIdea: '  Dios tiene compasión de los que no la merecen. ' },
            contextGenre: { genre: 'narrative' },
        });
        const { result } = renderHook(() => useSeedThesis('s1', 'u1'));
        await waitFor(() => expect(result.current.centralIdea).toBe('Dios tiene compasión de los que no la merecen.'));
        expect(result.current.genre).toBe('narrative');
        expect(getBySermonId).toHaveBeenCalledWith('s1', { userId: 'u1' });
    });

    it('sin sermón o sin semilla no muestra nada', async () => {
        getBySermonId.mockResolvedValue(null);
        const { result } = renderHook(() => useSeedThesis('s2', 'u1'));
        await waitFor(() => expect(getBySermonId).toHaveBeenCalledWith('s2', { userId: 'u1' }));
        expect(result.current).toEqual({});
        getBySermonId.mockClear();
        renderHook(() => useSeedThesis(null, 'u1'));
        expect(getBySermonId).not.toHaveBeenCalled();
    });
});
