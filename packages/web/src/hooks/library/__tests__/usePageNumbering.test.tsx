import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * TP #9, B19: el título y el autor del libro salen del MISMO documento que
 * ya se lee para la numeración, sin otra lectura.
 */
let recurso: Record<string, unknown> | null = null;
const leidos: string[] = [];
vi.mock('@dosfilos/infrastructure', () => ({
    fetchDocumentPageIndex: async () => ({ pages: [{ sheet: 1, firstLine: 'x', lastLine: '' }, { sheet: 2, firstLine: 'y', lastLine: '' }] }),
    FirebaseLibraryRepository: class {
        async findById(id: string) { leidos.push(id); return recurso; }
    },
}));
vi.mock('@dosfilos/application', () => ({ libraryService: { updateResource: vi.fn() } }));
const { usePageNumbering } = await import('../usePageNumbering');

const envoltorio = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('usePageNumbering — título y autor', () => {
    it('trae el título y el autor del recurso', async () => {
        recurso = { userId: 'yo', title: 'Novum Testamentum Graece ', author: ' Barbara Aland' };
        leidos.length = 0;
        const { result } = renderHook(() => usePageNumbering('res-na28'), { wrapper: envoltorio() });
        await waitFor(() => expect(result.current.data).toBeDefined());
        expect(result.current.data?.title).toBe('Novum Testamentum Graece');
        expect(result.current.data?.author).toBe('Barbara Aland');
        expect(leidos).toEqual(['res-na28']);
    });

    it('sin autor (o sin recurso de biblioteca) queda en null', async () => {
        recurso = { userId: 'yo', title: 'NA28', author: '' };
        const { result } = renderHook(() => usePageNumbering('res-b'), { wrapper: envoltorio() });
        await waitFor(() => expect(result.current.data).toBeDefined());
        expect(result.current.data?.author).toBeNull();

        recurso = null;
        const otro = renderHook(() => usePageNumbering('res-c'), { wrapper: envoltorio() });
        await waitFor(() => expect(otro.result.current.data).toBeDefined());
        expect(otro.result.current.data?.author).toBeNull();
        expect(otro.result.current.data?.title).toBeNull();
    });
});
