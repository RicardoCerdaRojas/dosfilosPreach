import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * La sección «Estructura» del hebreo lee `analyzedRef`: el versículo DEL
 * análisis, no el seleccionado (revisión adversarial de G1 + G5). Antes salía
 * de `hebrewVerse`, que el camino de caché nunca llena.
 */
const pendientes = new Map<string, (v: unknown) => void>();
const checkCache = vi.fn(({ chapter, verse }: { chapter: number; verse: number }) =>
    new Promise(res => pendientes.set(`${chapter}:${verse}`, res)));
const getVerseText = { execute: vi.fn(async () => ({ reference: 'Ruth.1.1', words: [] })) };
vi.mock('../../HebrewTutorProvider', () => ({
    useHebrewTutor: () => ({
        analyzeVerse: { execute: vi.fn() },
        getBibleNavigation: { getBookIndex: vi.fn(async () => ({ bookIndex: { versesPerChapter: [22] } })) },
        getVerseText,
        checkCache,
    }),
}));
vi.mock('../../../../hooks/useAuthorization', () => ({ useAuthorization: () => ({ isAdmin: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'es' } }) }));
const { useVerseAnalysis } = await import('../useVerseAnalysis');

describe('useVerseAnalysis — el versículo del análisis', () => {
    it('un análisis de la caché trae su referencia', async () => {
        const { result } = renderHook(() => useVerseAnalysis());
        act(() => result.current.navigate('Ruth', 1, 16));
        await act(async () => pendientes.get('1:16')!({ reference: 'Rut 1:16', words: [] }));
        expect(result.current.analyzedRef).toEqual({ book: 'Ruth', chapter: 1, verse: 16 });
    });

    it('la respuesta tardía de una navegación anterior no pisa la actual', async () => {
        const { result } = renderHook(() => useVerseAnalysis());
        act(() => result.current.navigate('Ruth', 1, 14));
        act(() => result.current.navigate('Ruth', 1, 17));
        await act(async () => pendientes.get('1:17')!({ reference: 'Rut 1:17', words: [] }));
        await act(async () => pendientes.get('1:14')!({ reference: 'Rut 1:14', words: [] }));
        await waitFor(() => expect(result.current.analyzedRef).toEqual({ book: 'Ruth', chapter: 1, verse: 17 }));
        expect((result.current.analysis as { reference: string }).reference).toBe('Rut 1:17');
    });
});
