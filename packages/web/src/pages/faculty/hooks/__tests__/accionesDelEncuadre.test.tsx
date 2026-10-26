import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * Las acciones del encuadre del panel del proyecto (UX 13 y 16). Requisitos
 * y el planificador ya no van al panel por la URL: abren el diálogo en el
 * lugar (`useFramingDialogInPlace`, deuda 13). `?encuadre=1` sigue abriendo
 * el diálogo del panel para los enlaces guardados; `volver` se limpia.
 */
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
const { useProjectFramingActions, useFramingDialogInPlace } = await import('../useProjectFramingActions');

let ubicacion = '';
function Espia() {
    const l = useLocation();
    ubicacion = `${l.pathname}${l.search}`;
    return null;
}

const proyecto = { id: 'ezr', type: 'exegetical', framing: { centralIdea: 'Dios restaura.' } } as never;

function montar(url: string) {
    const mutateAsync = vi.fn().mockResolvedValue({});
    const wrapper = ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="*" element={<><Espia />{children}</>} />
            </Routes>
        </MemoryRouter>
    );
    const r = renderHook(() => useProjectFramingActions({
        projectId: 'ezr', projects: [proyecto], project: proyecto, updateProject: { mutateAsync } as never,
    }), { wrapper });
    return { ...r, mutateAsync };
}

beforeEach(() => { vi.clearAllMocks(); ubicacion = ''; });

describe('useProjectFramingActions', () => {
    it('?encuadre=1 abre el diálogo y limpia la dirección (también un «volver» viejo); guardar cierra y avisa sin acción', async () => {
        const { result, mutateAsync } = montar('/dashboard/projects/ezr?encuadre=1&volver=requisitos');
        await waitFor(() => expect(result.current.framingOpen).toBe(true));
        expect(ubicacion).toBe('/dashboard/projects/ezr');
        await act(() => result.current.guardarEncuadre({ framingPatch: { centralIdea: 'x' }, bibleBooks: ['EZR'] }));
        expect(mutateAsync).toHaveBeenCalledWith({ projectId: 'ezr', framingPatch: { centralIdea: 'x' }, bibleBooks: ['EZR'] });
        expect(result.current.framingOpen).toBe(false);
        expect(toastSuccess).toHaveBeenCalledWith('framing.dialog.saved');
    });

    it('si guardar falla, avisa, relanza y el diálogo queda abierto', async () => {
        const { result, mutateAsync } = montar('/dashboard/projects/ezr?encuadre=1');
        await waitFor(() => expect(result.current.framingOpen).toBe(true));
        mutateAsync.mockRejectedValueOnce(new Error('red'));
        await act(async () => {
            await expect(result.current.guardarEncuadre({ framingPatch: {}, bibleBooks: ['EZR'] })).rejects.toThrow('red');
        });
        expect(toastError).toHaveBeenCalledWith('framing.dialog.saveFailed');
        expect(result.current.framingOpen).toBe(true);
    });

    it('revisar la idea manda la revisión; el caso de uso fija la idea guardada', async () => {
        const { result, mutateAsync } = montar('/dashboard/projects/ezr');
        await act(() => result.current.consolidarEncuadre({ centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'y' }));
        expect(mutateAsync.mock.calls[0]![0].framingPatch.revision).toMatchObject({ centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'y' });
    });
});

describe('useFramingDialogInPlace (Requisitos y planificador)', () => {
    const montarEnElLugar = (onSaved = vi.fn()) => {
        const mutateAsync = vi.fn().mockResolvedValue({});
        const r = renderHook(() => useFramingDialogInPlace({ project: { id: 'ezr' }, updateProject: { mutateAsync, isPending: false }, onSaved }));
        return { ...r, mutateAsync, onSaved };
    };

    it('abre, guarda en UNA escritura, cierra, avisa y entrega lo guardado; no navega', async () => {
        const { result, mutateAsync, onSaved } = montarEnElLugar();
        expect(result.current.open).toBe(false);
        act(() => result.current.onOpenChange(true));
        expect(result.current.open).toBe(true);
        const save = { framingPatch: { rhythm: { sundays: 6 } }, bibleBooks: ['EZR'] as never };
        await act(() => result.current.onSave(save));
        expect(mutateAsync).toHaveBeenCalledTimes(1);
        expect(mutateAsync).toHaveBeenCalledWith({ projectId: 'ezr', ...save });
        expect(result.current.open).toBe(false);
        expect(onSaved).toHaveBeenCalledWith(save);
        expect(toastSuccess).toHaveBeenCalledWith('framing.dialog.saved');
        expect(result.current.saving).toBe(false);
    });

    it('si falla, queda abierto, no entrega nada y relanza (el diálogo conserva lo escrito)', async () => {
        const { result, mutateAsync, onSaved } = montarEnElLugar();
        act(() => result.current.onOpenChange(true));
        mutateAsync.mockRejectedValueOnce(new Error('red'));
        await act(async () => {
            await expect(result.current.onSave({ framingPatch: {}, bibleBooks: ['EZR'] })).rejects.toThrow('red');
        });
        expect(result.current.open).toBe(true);
        expect(onSaved).not.toHaveBeenCalled();
        expect(toastError).toHaveBeenCalledWith('framing.dialog.saveFailed');
    });
});
