import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * Las acciones del encuadre del panel del proyecto (UX 13 y 16): «Cambiar en
 * el encuadre» llega con `?encuadre=1&volver=requisitos`, abre el diálogo y,
 * al guardar, el aviso ofrece volver a Requisitos. Sin `volver`, no.
 */
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
const { useProjectFramingActions, requirementsUrl } = await import('../useProjectFramingActions');

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
    it('desde Requisitos: abre el diálogo, limpia la dirección y al guardar ofrece «Volver a Requisitos»', async () => {
        const { result, mutateAsync } = montar('/dashboard/projects/ezr?encuadre=1&volver=requisitos');
        await waitFor(() => expect(result.current.framingOpen).toBe(true));
        expect(ubicacion).toBe('/dashboard/projects/ezr');
        await act(() => result.current.guardarEncuadre({ framingPatch: { centralIdea: 'x' }, bibleBooks: ['EZR'] }));
        expect(mutateAsync).toHaveBeenCalledWith({ projectId: 'ezr', framingPatch: { centralIdea: 'x' }, bibleBooks: ['EZR'] });
        expect(result.current.framingOpen).toBe(false);
        const [, opciones] = toastSuccess.mock.calls[0]!;
        expect(opciones.action.label).toBe('framing.dialog.backToRequirements');
        act(() => opciones.action.onClick());
        expect(ubicacion).toBe(requirementsUrl('ezr'));
    });

    it('sin «volver», guardar avisa sin acción', async () => {
        const { result } = montar('/dashboard/projects/ezr?encuadre=1');
        await waitFor(() => expect(result.current.framingOpen).toBe(true));
        await act(() => result.current.guardarEncuadre({ framingPatch: {}, bibleBooks: ['EZR'] }));
        expect(toastSuccess.mock.calls[0]![1]).toBeUndefined();
    });

    it('cerrar sin guardar olvida el «volver»: abrir después desde el panel no lo ofrece', async () => {
        const { result } = montar('/dashboard/projects/ezr?encuadre=1&volver=requisitos');
        await waitFor(() => expect(result.current.framingOpen).toBe(true));
        act(() => result.current.setFramingOpen(false));
        act(() => result.current.setFramingOpen(true));
        await act(() => result.current.guardarEncuadre({ framingPatch: {}, bibleBooks: ['EZR'] }));
        expect(toastSuccess.mock.calls[0]![1]).toBeUndefined();
    });

    it('revisar la idea manda la revisión; el caso de uso fija la idea guardada', async () => {
        const { result, mutateAsync } = montar('/dashboard/projects/ezr');
        await act(() => result.current.consolidarEncuadre({ centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'y' }));
        expect(mutateAsync.mock.calls[0]![0].framingPatch.revision).toMatchObject({ centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'y' });
    });
});
