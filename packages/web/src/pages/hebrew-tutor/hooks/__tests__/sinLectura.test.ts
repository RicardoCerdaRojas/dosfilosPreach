import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/** Revisión de G1 + G5: «sin lectura» distingue análisis viejo de lectura vacía. */
let filas: unknown[] | null = [{}];
let verbos: unknown[] = [{}];
vi.mock('@/components/language-structure/useVerseStructure', () => ({
    useVerseStructure: () => ({ loading: false, unavailable: false, nodes: filas, words: [], ordinal: new Map(), frontedByOrdinal: new Map(), hebrewVerbs: verbos }),
    conLectura: () => new Map(),
}));
const { useEstructuraHebrea } = await import('../useEstructuraHebrea');
const ref = { book: 'Ruth', chapter: 1, verse: 14 };
const analisis = (extra: object) => ({ words: [], ...extra }) as never;

describe('por qué no hay lectura de cláusulas (hebreo)', () => {
    it('un análisis anterior a v3 es «stale»', () => {
        filas = [{}];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 2 }), ref)).result.current.sinLectura).toBe('stale');
        expect(renderHook(() => useEstructuraHebrea(analisis({}), ref)).result.current.sinLectura).toBe('stale');
    });

    it('un análisis vigente sin lecturas (el asistente no las devolvió o no pasaron) es «empty», no «stale»', () => {
        filas = [{}];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 5, clauseReadings: [] }), ref)).result.current.sinLectura).toBe('empty');
    });

    it('un v4 tiene la waw, pero no la función del verbo: «staleVerb» (U5, Rut 3:5)', () => {
        filas = [{}];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 4, clauseReadings: [{}] }), ref)).result.current.sinLectura).toBe('staleVerb');
    });

    it('un v3 tiene lectura, pero su waw disyuntiva salía «pero» por defecto: «staleWaw» (revisión del profesor, 2026-11)', () => {
        filas = [{ relation: 'disjunctive' }];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 3, clauseReadings: [{}] }), ref)).result.current.sinLectura).toBe('staleWaw');
    });

    it('el motivo se dice sólo si el versículo lo tiene: v3 sin waw disyuntiva → el del verbo; sin verbo finito → el genérico', () => {
        filas = [{ relation: 'chain' }];
        verbos = [{}];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 3, clauseReadings: [{}] }), ref)).result.current.sinLectura).toBe('staleVerb');
        verbos = [];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 4, clauseReadings: [{}] }), ref)).result.current.sinLectura).toBe('staleHebrew');
        verbos = [{}];
    });

    it('con lecturas, o sin filas que leer, no hay aviso', () => {
        filas = [{}];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 5, clauseReadings: [{}] }), ref)).result.current.sinLectura).toBeNull();
        filas = [];
        expect(renderHook(() => useEstructuraHebrea(analisis({ promptVersion: 5 }), ref)).result.current.sinLectura).toBeNull();
    });
});
