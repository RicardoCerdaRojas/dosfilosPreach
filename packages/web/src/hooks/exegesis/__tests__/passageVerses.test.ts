import { describe, it, expect, vi } from 'vitest';

vi.mock('@dosfilos/infrastructure', () => ({
    MorphhbOriginalLanguageProvider: class {},
    SBLGNTBibleProvider: class {},
    TestamentDispatcherOriginalLanguageProvider: class {},
}));
const { passageVerses } = await import('../usePassageLemmas');

describe('passageVerses — de qué versículos salen los lemas', () => {
    const passage = { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 11 };

    it('con pasos, los de los pasos', () => {
        const steps = [
            { kind: 'verse', verseRef: { bookId: 'JON', chapterStart: 4, verseStart: 5 } },
            { kind: 'conclusion', verseRef: null },
            { kind: 'verse', verseRef: { bookId: 'JON', chapterStart: 4, verseStart: 6 } },
        ];
        expect(passageVerses({ passage, steps } as never).map(v => v.verse)).toEqual([5, 6]);
    });

    it('antes de generar los pasos, el pasaje entero si cabe en un capítulo', () => {
        expect(passageVerses({ passage, steps: [] } as never).map(v => v.verse)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    });

    it('un pasaje de varios capítulos sin pasos: nada (no se inventan versículos)', () => {
        expect(passageVerses({ passage: { ...passage, chapterEnd: 5 }, steps: [] } as never)).toEqual([]);
    });
});
