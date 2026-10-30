import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ExegeticalPaper } from '@dosfilos/domain';

/**
 * La revisión antes de exportar corrige el ensamble en la app (fase
 * «Lecciones del TI #2», etapa 2). Lo que importa del contrato: corrige el
 * texto que BAJA, guarda en el paso de ensamble, y no pisa un ensamble
 * regenerado sin aceptar.
 */
const mutateAsync = vi.fn();
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({ saveStepEdit: { mutateAsync, isPending: false } }),
}));
const { useExportReview } = await import('../useExportReview');

const TEXTO = '## Salmo 23:4\n\nEl lexico dice aqui que el valle es oscuro.';
const PSA = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 4 };
const conEnsamble = (enPantalla: string) => ({
    id: 'p1', displayLanguage: 'es', title: 'T', passage: PSA, sources: [], rubric: null, cover: null,
    assembledMarkdown: TEXTO,
    steps: [
        { id: 'v4', kind: 'verse', order: 4, verseRef: PSA, accepted: { markdown: 'El lexico dice aqui.' }, current: null },
        { id: 'ens', kind: 'assembly', order: 99, verseRef: null, accepted: { markdown: TEXTO }, current: { markdown: enPantalla } },
    ],
}) as unknown as ExegeticalPaper;

beforeEach(() => mutateAsync.mockReset());

describe('useExportReview', () => {
    it('con el ensamble al día: avisa, y «Aplicar» guarda en el paso de ensamble el texto que baja, corregido', async () => {
        const { result } = renderHook(() => useExportReview(conEnsamble(TEXTO)));
        expect(result.current.blockedBy).toBeNull();
        expect(result.current.findings.map(f => f.find)).toEqual(['lexico', 'aqui']);
        expect(result.current.mechanicalCount).toBe(2);
        await act(() => result.current.apply(result.current.findings[0]!));
        expect(mutateAsync).toHaveBeenCalledWith({ paperId: 'p1', stepId: 'ens', markdown: '## Salmo 23:4\n\nEl léxico dice aqui que el valle es oscuro.' });
    });

    it('«Aplicar las correcciones automáticas» las guarda todas en una sola edición', async () => {
        const { result } = renderHook(() => useExportReview(conEnsamble(TEXTO)));
        await act(() => result.current.applyMechanical());
        expect(mutateAsync).toHaveBeenCalledTimes(1);
        expect(mutateAsync.mock.calls[0]![0].markdown).toBe('## Salmo 23:4\n\nEl léxico dice aquí que el valle es oscuro.');
    });

    it('REVISIÓN: con un ensamble regenerado sin aceptar no corrige: pisaría la versión nueva', async () => {
        const { result } = renderHook(() => useExportReview(conEnsamble('## Salmo 23:4\n\nOtro texto, el nuevo.')));
        expect(result.current.blockedBy).toBe('difiere');
        expect(result.current.mechanicalCount).toBe(0);
        // Sigue avisando sobre lo que baja.
        expect(result.current.findings.map(f => f.find)).toEqual(['lexico', 'aqui']);
        await act(() => result.current.apply(result.current.findings[0]!));
        await act(() => result.current.applyMechanical());
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('sin ensamble revisa lo que armaría el exportador y solo avisa', async () => {
        const sinEnsamble = { ...conEnsamble(TEXTO), assembledMarkdown: null, steps: [conEnsamble(TEXTO).steps[0]] } as unknown as ExegeticalPaper;
        const { result } = renderHook(() => useExportReview(sinEnsamble));
        expect(result.current.blockedBy).toBe('sin-ensamble');
        expect(result.current.findings.map(f => f.find)).toEqual(['lexico', 'aqui']);
        await act(() => result.current.apply(result.current.findings[0]!));
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('tolera un trabajo nulo (se llama antes del retorno temprano de la página)', () => {
        const { result } = renderHook(() => useExportReview(null));
        expect(result.current.findings).toEqual([]);
    });
});

describe('REVISIÓN: la corrección no se pierde mientras el trabajo vuelve a leerse', () => {
    it('después de guardar, no aplica otra hasta que el trabajo trae el texto corregido', async () => {
        mutateAsync.mockResolvedValue(undefined);
        const { result, rerender } = renderHook(({ p }) => useExportReview(p), { initialProps: { p: conEnsamble(TEXTO) } });
        await act(() => result.current.apply(result.current.findings[0]!));
        expect(result.current.isApplying).toBe(true);
        // Una segunda corrección sobre el texto viejo borraría la primera: se ignora.
        await act(() => result.current.apply(result.current.findings[1]!));
        expect(mutateAsync).toHaveBeenCalledTimes(1);
        // El trabajo vuelve con el texto guardado: se puede seguir.
        const guardado = mutateAsync.mock.calls[0]![0].markdown as string;
        const releido = { ...conEnsamble(guardado), assembledMarkdown: guardado } as ExegeticalPaper;
        rerender({ p: releido });
        expect(result.current.isApplying).toBe(false);
        expect(result.current.findings.map(f => f.find)).toEqual(['aqui']);
    });

    it('si guardar falla, no queda trabado', async () => {
        mutateAsync.mockRejectedValueOnce(new Error('red'));
        const { result } = renderHook(() => useExportReview(conEnsamble(TEXTO)));
        await act(async () => { await expect(result.current.apply(result.current.findings[0]!)).rejects.toThrow('red'); });
        expect(result.current.isApplying).toBe(false);
    });
});
