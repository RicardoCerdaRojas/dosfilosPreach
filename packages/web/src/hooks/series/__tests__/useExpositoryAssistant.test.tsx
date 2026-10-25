import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * «Refinar» del Pase 5 (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, §1): la
 * observación del revisor se perdía en este hook antes de llegar al Pase 4.
 */
const run = vi.hoisted(() => vi.fn());
vi.mock('@dosfilos/application', () => ({
    seriesService: { expositoryPasses: { runPreachableConversion: run } },
}));

import { useExpositoryAssistant } from '../useExpositoryAssistant';

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
);

const base = {
    book: 'Esdras',
    displayLanguage: 'es' as const,
    verses: [{ chapter: 1, verse: 1, text: 'En el primer año de Ciro' }],
    panorama: { genre: 'narrative', purpose: 'p', pastoralProblem: 'pp', centralTheme: 'c', movements: [], keyTerms: [] } as never,
    macroSections: [],
    exegeticalUnits: [],
};

beforeEach(() => run.mockReset().mockResolvedValue({ payload: [], modelId: 'm' }));

describe('useExpositoryAssistant · runPreachable', () => {
    it('manda la observación de «Refinar» al servicio', async () => {
        const { result } = renderHook(() => useExpositoryAssistant(), { wrapper });
        await act(() => result.current.runPreachable.mutateAsync({ ...base, regenerationHint: '1. [crítico] Une 1:1-4 con 1:5-11.' }));
        expect(run.mock.calls[0]![0].regenerationHint).toBe('1. [crítico] Une 1:1-4 con 1:5-11.');
    });

    it('sin observación la carga queda como siempre', async () => {
        const { result } = renderHook(() => useExpositoryAssistant(), { wrapper });
        await act(() => result.current.runPreachable.mutateAsync(base));
        expect(run.mock.calls[0]![0]).toEqual(base);
    });
});
