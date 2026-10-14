import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * El visor se abre también por recurso, sin trabajo (Biblioteca, tarjeta de
 * fuente): no busca la clave en el trabajo y nombra el libro con lo que trae
 * el destino.
 */
const pedidos: Array<string | null> = [];
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({
    useExegesisPaper: (id: string | undefined) => ({
        paper: id ? { sources: [{ sourceType: 'commentary-critical', citationKey: 'McCartney', displayLabel: 'James — Baker', sourceLibraryResourceId: 'res-mccartney' }] } : null,
    }),
}));
vi.mock('@/hooks/exegesis/useDocumentPageIndex', () => ({
    useDocumentPageIndex: (id: string | null) => { pedidos.push(id); return { isLoading: false, data: undefined }; },
    useDocumentPdfUrl: () => ({ isLoading: false, data: { url: 'https://pdf' } }),
}));
vi.mock('@/hooks/library/usePageNumbering', () => ({ usePageNumbering: () => ({ isLoading: false, data: undefined }) }));
const { useCitationSheet } = await import('../useCitationSheet');

describe('useCitationSheet — por recurso o por clave del trabajo', () => {
    it('por clave: busca la fuente en el trabajo y usa su recurso y su nombre', () => {
        const { result } = renderHook(() => useCitationSheet('p1', { sourceKey: 'McCartney', page: 204, pageKind: 'printed' }, true));
        expect(result.current.resourceId).toBe('res-mccartney');
        expect(result.current.label).toBe('James — Baker');
        expect(result.current.citationKey).toBe('McCartney');
    });
    it('por recurso, sin trabajo: usa el recurso del destino y su nombre', () => {
        const { result } = renderHook(() => useCitationSheet(null, { sourceKey: 'Motyer', page: 1, resourceId: 'res-motyer', label: 'The Message of James' }, true));
        expect(result.current.resourceId).toBe('res-motyer');
        expect(result.current.label).toBe('The Message of James');
        expect(pedidos.at(-1)).toBe('res-motyer');
    });
    it('la cita de una hoja sin numeración confirmada es «hoja N», no una página adivinada', () => {
        const { result } = renderHook(() => useCitationSheet('p1', { sourceKey: 'McCartney', page: 204, pageKind: 'printed' }, true));
        expect(result.current.anchorFor(224)).toBe('hoja 224');
    });
    it('abierta en la página hallada, la citada sigue siendo el ancla', () => {
        const { result } = renderHook(() => useCitationSheet('p1', { sourceKey: 'McCartney', page: 203, openAt: { page: 202 } }, true));
        expect(result.current.anchorSheet).toBe(203);
        expect(result.current.viewSheet).toBe(202);
    });
    it('una clave que no está en el trabajo y sin recurso: no hay documento', () => {
        const { result } = renderHook(() => useCitationSheet('p1', { sourceKey: 'Wallace', page: 165 }, true));
        expect(result.current.resourceId).toBeNull();
    });
});
