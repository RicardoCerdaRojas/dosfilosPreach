import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mirrorRepetition, verseWords, type ChapterStructure } from '@dosfilos/domain';

/**
 * Revisión adversarial (espejo en hebreo): el mapa de la ficha (palabra del análisis → su letra en el espejo)
 * pasa por la alineación con el análisis. Gn 9:6, con el análisis alineado palabra por palabra.
 */
const ch = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'public', 'language-data', 'v1', 'he', 'Gen', '9.json'), 'utf8')) as ChapterStructure;
const words = verseWords(ch, 6);
vi.mock('@/components/language-structure/useVerseStructure', () => ({
    useVerseStructure: () => ({ loading: false, unavailable: false, nodes: [], words, ordinal: new Map(words.map((w, i) => [w.r, i])), frontedByOrdinal: new Map(), phrases: [], phrasesKnown: true, mirror: mirrorRepetition(ch, 6) }),
    conLectura: () => new Map(),
}));
const { useEstructuraHebrea } = await import('../useEstructuraHebrea');

describe('repetición en espejo en la ficha hebrea', () => {
    it('Gn 9:6: cada una de las cuatro palabras del análisis lleva su letra, y las otras ninguna', () => {
        const analisis = { words: words.map(w => ({ hebrewText: w.t })), promptVersion: 5, clauseReadings: [] } as never;
        const { espejos } = renderHook(() => useEstructuraHebrea(analisis, { book: 'Gen', chapter: 9, verse: 6 })).result.current;
        expect([...espejos.entries()].map(([i, m]) => [i, m.position])).toEqual([[0, 'A'], [1, 'B'], [4, 'B2'], [5, 'A2']]);
        expect(espejos.get(0)!.a.normalize('NFD').replace(/[֑-֯]/g, '')).toBe('שֹׁפֵךְ'.normalize('NFD'));
        expect(espejos.get(0)!.sources!.map(s => s.work)).toEqual(['professor']);
    });
});
