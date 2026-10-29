import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Etapa 0 de la fase «Escritorio del proyecto» (deuda 3, 4 y 18).
 *
 * `useProjectAttachedSources` leía toda la biblioteca con Firestore directo,
 * sin manejar el rechazo y relevendo con cada guardado del proyecto. Ahora pide
 * los ids por el servicio, con React Query y una clave ordenada.
 *
 * `useLinkProjectSession` escribía el vínculo con Firestore directo; ahora pasa
 * por el repositorio de cada tutor, y su aviso de error no pega el mensaje
 * técnico.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const getResourcesByIds = vi.fn();
const reprocessProjectSource = vi.fn();
vi.mock('@dosfilos/application', () => ({
    libraryService: {
        getResourcesByIds: (...a: unknown[]) => getResourcesByIds(...a),
        reprocessProjectSource: (...a: unknown[]) => reprocessProjectSource(...a),
    },
}));
const vincularGriego = vi.fn();
const vincularHebreo = vi.fn();
vi.mock('@dosfilos/infrastructure', () => ({
    FirestoreGreekSessionRepository: class { linkToProject = vincularGriego; },
    FirestoreHebrewStudySessionRepository: class { linkToProject = vincularHebreo; },
}));

const { useProjectAttachedSources, attachedSourcesKey } = await import('../useProjectAttachedSources');
const { useLinkProjectSession } = await import('../useLinkProjectSession');

let client: QueryClient;
const envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const recurso = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, title: `Libro ${id}`, author: 'Autor', indexingStatus: 'ready', extractionVersion: '3.0-llamaparse', ...extra });

beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    getResourcesByIds.mockImplementation(async (_u: string, ids: string[]) => ids.map(id => recurso(id)));
});

describe('useProjectAttachedSources', () => {
    it('pide solo los ids del proyecto (ordenados, sin repetir) y avisa mientras carga', async () => {
        const { result } = renderHook(
            () => useProjectAttachedSources({ userId: 'u1', sourceIds: ['f2', 'f1', 'f2'] }),
            { wrapper: envoltura },
        );
        expect(result.current.isLoading).toBe(true);
        expect(result.current.sources).toEqual([]);
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(getResourcesByIds).toHaveBeenCalledWith('u1', ['f1', 'f2']);
        expect(result.current.sources).toEqual([
            { id: 'f1', title: 'Libro f1', author: 'Autor', indexingStatus: 'ready', extractionVersion: '3.0-llamaparse' },
            { id: 'f2', title: 'Libro f2', author: 'Autor', indexingStatus: 'ready', extractionVersion: '3.0-llamaparse' },
        ]);
        expect(result.current.error).toBeNull();
    });

    it('el mismo conjunto de ids en otro arreglo (otro guardado del proyecto) no vuelve a leer', async () => {
        const { result, rerender } = renderHook(
            ({ ids }) => useProjectAttachedSources({ userId: 'u1', sourceIds: ids }),
            { wrapper: envoltura, initialProps: { ids: ['f1', 'f2'] } },
        );
        await waitFor(() => expect(result.current.sources).toHaveLength(2));
        rerender({ ids: ['f2', 'f1'] });
        rerender({ ids: ['f1', 'f2'] });
        expect(getResourcesByIds).toHaveBeenCalledTimes(1);
        expect(attachedSourcesKey('u1', ['f2', 'f1'])).toEqual(attachedSourcesKey('u1', ['f1', 'f2', 'f1']));
    });

    it('sin fuentes no consulta, no carga y la lista es vacía de verdad', () => {
        const { result } = renderHook(
            () => useProjectAttachedSources({ userId: 'u1', sourceIds: [] }),
            { wrapper: envoltura },
        );
        expect(result.current.isLoading).toBe(false);
        expect(result.current.sources).toEqual([]);
        expect(getResourcesByIds).not.toHaveBeenCalled();
    });

    it('si la lectura falla, expone el error en vez de dejar un rechazo sin manejar', async () => {
        getResourcesByIds.mockRejectedValue(new Error('sin red'));
        const { result } = renderHook(
            () => useProjectAttachedSources({ userId: 'u1', sourceIds: ['f1'] }),
            { wrapper: envoltura },
        );
        await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
        expect(result.current.isLoading).toBe(false);
        expect(result.current.sources).toEqual([]);
    });

    it('procesar: avisa según el camino y vuelve a leer las fuentes', async () => {
        reprocessProjectSource.mockResolvedValue('reextracted');
        const { result } = renderHook(
            () => useProjectAttachedSources({ userId: 'u1', sourceIds: ['f1'] }),
            { wrapper: envoltura },
        );
        await waitFor(() => expect(result.current.sources).toHaveLength(1));
        await act(() => result.current.reprocessSource(result.current.sources[0]!));
        expect(reprocessProjectSource).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }));
        expect(toast.success).toHaveBeenCalledWith('reprocess.successReextracted');
        await waitFor(() => expect(getResourcesByIds).toHaveBeenCalledTimes(2));
        expect(result.current.reprocessing).toEqual({});
    });

    it('procesar con fallo: avisa y suelta el «procesando»', async () => {
        reprocessProjectSource.mockRejectedValue(new Error('resource-exhausted'));
        const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { result } = renderHook(
            () => useProjectAttachedSources({ userId: 'u1', sourceIds: ['f1'] }),
            { wrapper: envoltura },
        );
        await waitFor(() => expect(result.current.sources).toHaveLength(1));
        await act(() => result.current.reprocessSource(result.current.sources[0]!));
        expect(toast.error).toHaveBeenCalledWith('reprocess.error');
        expect(result.current.reprocessing).toEqual({});
        consola.mockRestore();
    });
});

describe('useLinkProjectSession', () => {
    it.each([
        ['greek', vincularGriego, ['greek', 'sessions']],
        ['hebrew', vincularHebreo, ['hebrew', 'sessions']],
    ] as const)('%s: vincula por su repositorio y refresca su lista', async (domain, vincular, clave) => {
        vincular.mockResolvedValue(undefined);
        const invalidar = vi.spyOn(client, 'invalidateQueries');
        const { result } = renderHook(() => useLinkProjectSession({ projectId: 'p1', domain }), { wrapper: envoltura });
        await act(() => result.current.link('s1'));
        expect(vincular).toHaveBeenCalledWith('s1', 'p1');
        expect(invalidar).toHaveBeenCalledWith({ queryKey: clave });
        expect(toast.success).toHaveBeenCalledWith('linkSession.toastSuccess');
        expect(result.current.linkingId).toBeNull();
    });

    it('con fallo: un aviso llano, sin el mensaje técnico', async () => {
        vincularGriego.mockRejectedValue(new Error('FirebaseError: permission-denied'));
        const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { result } = renderHook(() => useLinkProjectSession({ projectId: 'p1', domain: 'greek' }), { wrapper: envoltura });
        await act(() => result.current.link('s1'));
        expect(toast.error).toHaveBeenCalledWith('linkSession.toastError');
        expect(result.current.linkingId).toBeNull();
        consola.mockRestore();
    });

    it('sin proyecto no escribe nada', async () => {
        const { result } = renderHook(() => useLinkProjectSession({ projectId: null, domain: 'hebrew' }), { wrapper: envoltura });
        await act(() => result.current.link('s1'));
        expect(vincularHebreo).not.toHaveBeenCalled();
    });
});
