import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/** Revisión de G1 + G5: «sin lectura» distingue análisis viejo de lectura vacía. */
let filas: unknown[] | null = [{}];
let verbos: unknown[] = [{}];
let datosFrases: { words: unknown[]; phrases: unknown[]; phrasesKnown: boolean } = { words: [], phrases: [], phrasesKnown: true };
vi.mock('@/components/language-structure/useVerseStructure', () => ({
    useVerseStructure: () => ({ loading: false, unavailable: false, nodes: filas, ordinal: new Map(), frontedByOrdinal: new Map(), hebrewVerbs: verbos, ...datosFrases }),
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

    it('U11b: la frase preposicional del dato; con un JSON viejo sin frases, sin dato (la marca sale como antes)', () => {
        const palabras = [{ r: '1!1', t: 'בְּאֶרֶץ', l: 'b/776', role: '' }, { r: '1!2', t: 'מוֹאָב', l: '4124', role: '' }, { r: '1!3', t: 'וַיֵּלֶךְ', l: 'c/1980', role: '' }];
        const an = analisis({ promptVersion: 5, words: palabras.map(w => ({ hebrewText: w.t })) });
        datosFrases = { words: palabras, phrases: [{ rs: ['1!1', '1!2'], kind: 'a' }], phrasesKnown: true };
        const { frases } = renderHook(() => useEstructuraHebrea(an, ref)).result.current;
        expect([frases.get(0), frases.get(1), frases.get(2)]).toEqual(['a', 'a', null]);
        datosFrases = { words: palabras, phrases: [], phrasesKnown: false };
        expect(renderHook(() => useEstructuraHebrea(an, ref)).result.current.frases.size).toBe(0);
        datosFrases = { words: [], phrases: [], phrasesKnown: true };
    });
});
