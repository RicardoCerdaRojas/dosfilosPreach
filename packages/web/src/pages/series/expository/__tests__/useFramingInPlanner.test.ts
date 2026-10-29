import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
const { useFramingInPlanner } = await import('../useFramingInPlanner');

/**
 * La tarjeta «Tu lectura y lo que propone el panorama» se monta con una
 * `key` por corrida del panorama: un panorama nuevo vuelve a invitar a
 * anotar. Hoy el planificador además pone el panorama en null antes de cada
 * corrida, así que la key es la red para cualquier camino que lo reemplace
 * directamente (p. ej. regenerar solo el Pase 1).
 */
const panorama = () => ({ genre: 'narrative', purpose: 'p', pastoralProblem: 'pp', centralTheme: 'ct', movements: [], keyTerms: [] });
const proyecto = {
    id: 'ezr', title: 'Esdras', bibliographyCriteria: { bibleBooks: ['EZR'] },
    framing: { centralIdea: 'Idea', rhythm: { sundays: 3 } },
} as never;

const montar = (p: ReturnType<typeof panorama>, mutateAsync = vi.fn().mockResolvedValue({}), project: unknown = proyecto) => renderHook(({ pan }) => useFramingInPlanner({
    project: project as never, projectState: 'ok', bookParam: 'EZR', lang: 'es', panorama: pan as never, macroSections: null,
    analyzedBookId: 'EZR', updateProject: { mutateAsync }, setCollapsedPasses: vi.fn(),
}), { initialProps: { pan: p } });

describe('useFramingInPlanner — la corrida del panorama', () => {
    it('el mismo panorama conserva la key; uno nuevo la cambia', () => {
        const primero = panorama();
        const { result, rerender } = montar(primero);
        const k1 = result.current.contrast!.key;
        rerender({ pan: primero });
        expect(result.current.contrast!.key).toBe(k1);
        rerender({ pan: panorama() });
        expect(result.current.contrast!.key).not.toBe(k1);
    });

    it('«Ajustar el calendario» abre el encuadre AQUÍ, sin ir al panel por la URL', () => {
        const { result } = montar(panorama());
        const aviso = result.current.unitsNotice(4)!;
        expect(aviso).toMatchObject({ units: 4, sundays: 3 });
        expect(aviso).not.toHaveProperty('calendarHref');
        expect(result.current.framingDialog).toMatchObject({ project: proyecto, open: false });
        act(() => aviso.onAdjustCalendar());
        expect(result.current.framingDialog!.open).toBe(true);
    });

    it('al guardar el encuadre, la fecha y la frecuencia nuevas pasan a la serie; un ritmo borrado no pisa lo escrito', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({});
        const { result } = montar(panorama(), mutateAsync);
        act(() => result.current.setStartDate('2026-11-01'));
        act(() => result.current.unitsNotice(4)!.onAdjustCalendar());
        await act(() => result.current.framingDialog!.onSave({ framingPatch: { rhythm: { sundays: 4, startDate: '2026-12-06', frequency: 'biweekly' } }, bibleBooks: ['EZR'] as never }));
        expect(mutateAsync).toHaveBeenCalledWith({ projectId: 'ezr', framingPatch: { rhythm: { sundays: 4, startDate: '2026-12-06', frequency: 'biweekly' } }, bibleBooks: ['EZR'] });
        expect(result.current.startDate).toBe('2026-12-06');
        expect(result.current.frequency).toBe('biweekly');
        expect(result.current.framingDialog!.open).toBe(false);
        await act(() => result.current.framingDialog!.onSave({ framingPatch: { rhythm: null }, bibleBooks: ['EZR'] as never }));
        expect(result.current.startDate).toBe('2026-12-06');
        expect(result.current.frequency).toBe('biweekly');
    });

    it('sin proyecto no hay aviso ni diálogo', () => {
        const { result } = montar(panorama(), vi.fn(), null);
        expect(result.current.unitsNotice(4)).toBeNull();
        expect(result.current.framingDialog).toBeNull();
    });
});
