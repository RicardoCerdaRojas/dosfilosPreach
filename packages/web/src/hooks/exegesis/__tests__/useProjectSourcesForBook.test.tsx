import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * Etapa 3 de ADR-046: lo que hereda un estudio de la serie del proyecto. La
 * regla es del dominio; aquí se prueba que el hook no hace renders en ciclo.
 */
let resources: unknown[] = [];
let isLoading = false;
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources, isLoading }) }));
const { useProjectSourcesForBook } = await import('../useProjectSourcesForBook');

const biblioteca = () => [
    { id: 'williamson', title: 'Ezra, Nehemiah', author: 'Williamson', exegeticalType: 'commentary-critical', coversBibleBooks: ['EZR', 'NEH'] },
    { id: 'moo', title: 'Romans', author: 'Moo', exegeticalType: 'commentary-critical', coversBibleBooks: ['ROM'] },
    { id: 'halot', title: 'HALOT', author: 'Koehler', exegeticalType: 'lexicon-technical', scope: 'whole-bible' },
];
const proyecto = { id: 'neh', sourceIds: ['williamson', 'moo', 'halot'] } as never;

beforeEach(() => {
    resources = biblioteca();
    isLoading = false;
});

describe('useProjectSourcesForBook', () => {
    it('hereda las obras del libro sin las desmarcadas, y lista todas las heredables', () => {
        const { result } = renderHook(() => useProjectSourcesForBook(proyecto, 'NEH', ['halot']));
        expect(result.current.sources.map(s => s.corpusId)).toEqual(['williamson']);
        expect(result.current.entries.map(e => e.resourceId)).toEqual(['williamson', 'halot']);
        expect(result.current.resourceOf('moo')?.title).toBe('Romans');
    });

    it('una biblioteca nueva con lo mismo no cambia la referencia de las fuentes', () => {
        const { result, rerender } = renderHook(() => useProjectSourcesForBook(proyecto, 'NEH'));
        const antes = result.current.sources;
        resources = biblioteca();
        rerender();
        expect(result.current.sources).toBe(antes);
    });

    it('mientras la biblioteca carga lo dice', () => {
        resources = [];
        isLoading = true;
        const { result } = renderHook(() => useProjectSourcesForBook(proyecto, 'NEH'));
        expect(result.current.isLoading).toBe(true);
    });
});
