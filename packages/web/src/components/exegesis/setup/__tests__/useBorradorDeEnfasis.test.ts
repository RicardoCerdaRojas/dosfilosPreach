import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SourceType, StepEmphasis } from '@dosfilos/domain';
import { useBorradorDeEnfasis } from '../useBorradorDeEnfasis';

const enfasis = (tipos: SourceType[]): StepEmphasis => ({
    emphasizedTypes: tipos,
    deemphasizedTypes: [],
    citationOverrides: [],
});

const SUGERENCIA: SourceType[] = ['historical-background', 'theological-monograph', 'commentary-expository'];

describe('useBorradorDeEnfasis', () => {
    it('sin nada guardado arranca de la sugerencia de la rúbrica', () => {
        const { result } = renderHook(() => useBorradorDeEnfasis(enfasis([]), enfasis(SUGERENCIA)));
        expect(result.current.emphasized).toEqual(SUGERENCIA);
    });

    it('una relectura con el mismo contenido NO descarta lo que el pastor editó (el defecto)', () => {
        // Cada relectura del trabajo trae objetos nuevos con el mismo contenido:
        // pasa al volver a la ventana y al guardar otra tarjeta.
        const { result, rerender } = renderHook(
            ({ guardado, sugerencia }) => useBorradorDeEnfasis(guardado, sugerencia),
            { initialProps: { guardado: enfasis([]), sugerencia: enfasis(SUGERENCIA) } },
        );
        act(() => result.current.setEmphasized(['commentary-critical', 'biblical-text-edition']));

        rerender({ guardado: enfasis([]), sugerencia: enfasis([...SUGERENCIA]) });
        rerender({ guardado: enfasis([]), sugerencia: enfasis([...SUGERENCIA]) });

        expect(result.current.emphasized).toEqual(['commentary-critical', 'biblical-text-edition']);
    });

    it('se resincroniza cuando lo guardado cambia de verdad (otra pestaña guardó)', () => {
        const { result, rerender } = renderHook(
            ({ guardado }) => useBorradorDeEnfasis(guardado, enfasis(SUGERENCIA)),
            { initialProps: { guardado: enfasis(['grammar-syntax']) } },
        );
        expect(result.current.emphasized).toEqual(['grammar-syntax']);

        rerender({ guardado: enfasis(['lexicon-technical', 'grammar-syntax']) });
        expect(result.current.emphasized).toEqual(['lexicon-technical', 'grammar-syntax']);
    });

    it('lo guardado manda sobre la sugerencia', () => {
        const { result } = renderHook(() =>
            useBorradorDeEnfasis(enfasis(['grammar-syntax']), enfasis(SUGERENCIA)),
        );
        expect(result.current.emphasized).toEqual(['grammar-syntax']);
    });

    it('vaciar el borrador no se revierte solo en la siguiente relectura', () => {
        const { result, rerender } = renderHook(
            ({ sugerencia }) => useBorradorDeEnfasis(enfasis([]), sugerencia),
            { initialProps: { sugerencia: enfasis(SUGERENCIA) } },
        );
        act(() => result.current.setEmphasized([]));
        rerender({ sugerencia: enfasis([...SUGERENCIA]) });
        expect(result.current.emphasized).toEqual([]);
    });
});
