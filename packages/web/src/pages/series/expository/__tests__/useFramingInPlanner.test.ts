import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFramingInPlanner } from '../useFramingInPlanner';

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

const montar = (p: ReturnType<typeof panorama>) => renderHook(({ pan }) => useFramingInPlanner({
    project: proyecto, projectState: 'ok', bookParam: 'EZR', lang: 'es', panorama: pan as never, macroSections: null,
    analyzedBookId: 'EZR', updateProject: { mutateAsync: vi.fn() }, setCollapsedPasses: vi.fn(),
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

    it('el aviso de domingos lleva al encuadre del proyecto', () => {
        const { result } = montar(panorama());
        expect(result.current.unitsNotice(4)).toMatchObject({ units: 4, sundays: 3, calendarHref: '/dashboard/projects/ezr?encuadre=1' });
    });
});
