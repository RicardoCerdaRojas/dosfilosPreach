import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/** Fase F, F3: «Ver» en la Biblioteca abre el visor (PDF) o el archivo (lo demás). */
const open = vi.fn();
vi.mock('@/components/exegesis/citation/SourceViewerProvider', () => ({ useSourceViewer: () => ({ open, close: vi.fn() }) }));
const { useAbrirRecursoEnVisor, apellidoDelAutor } = await import('../useAbrirRecursoEnVisor');

describe('Biblioteca — abrir un recurso', () => {
    it('un PDF abre el visor ampliado, sin trabajo, citado por el apellido del autor', () => {
        const { result } = renderHook(() => useAbrirRecursoEnVisor());
        result.current({ id: 'r1', mimeType: 'application/pdf', title: 'The Message of James', author: 'John A Motyer', storageUrl: 'u' } as never);
        expect(open).toHaveBeenCalledWith({ paperId: null, citation: { sourceKey: 'Motyer', page: 1, resourceId: 'r1', label: 'The Message of James' } }, 'full');
    });
    it('lo que no es PDF se abre como archivo', () => {
        const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
        open.mockClear();
        const { result } = renderHook(() => useAbrirRecursoEnVisor());
        result.current({ id: 'r2', mimeType: 'application/epub+zip', title: 'X', author: 'Y', storageUrl: 'https://archivo' } as never);
        expect(abrir).toHaveBeenCalledWith('https://archivo', '_blank');
        expect(open).not.toHaveBeenCalled();
    });
    it('el apellido del primer autor', () => {
        expect(apellidoDelAutor('McCartney, Dan G.')).toBe('McCartney');
        expect(apellidoDelAutor('Eberhard Nestle y Kurt Aland')).toBe('Nestle');
        expect(apellidoDelAutor('')).toBe('');
    });
});
