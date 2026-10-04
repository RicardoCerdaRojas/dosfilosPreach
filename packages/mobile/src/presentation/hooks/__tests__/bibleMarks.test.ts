import { describe, expect, it, jest } from '@jest/globals';

import { withMarks, withoutMarks } from '../useBibleMarks';
import { verseKey } from '@/domain/bible/entities/BibleMark';

// jest sube los mocks por encima de los imports.
jest.mock('@/data/sources/firebase.source', () => ({ getFirebaseAuth: () => ({}), getFirebaseDb: () => ({}) }));
jest.mock('@react-native-firebase/firestore', () => ({}));

describe('marcas de la Biblia sin red (C1)', () => {
    const base = { versionId: 'rvr1960', bookId: 'jn', chapter: 4, color: 'yellow' as const, style: 'highlight' as const };

    it('la marca aparece YA, sin esperar al servidor', () => {
        const map = withMarks(undefined, { ...base, ranges: [{ verse: 2 }, { verse: 3, from: 0, to: 12 }] }, new Date(0));
        expect([...map.keys()].sort()).toEqual([verseKey('jn', 4, 2), verseKey('jn', 4, 3)].sort());
        expect(map.get(verseKey('jn', 4, 3))).toMatchObject({ from: 0, to: 12, color: 'yellow' });
    });

    it('volver a marcar el mismo versículo reemplaza, no duplica; quitar la borra', () => {
        let map = withMarks(undefined, { ...base, ranges: [{ verse: 2 }] }, new Date(0));
        map = withMarks(map, { ...base, color: 'blue' as never, ranges: [{ verse: 2 }] }, new Date(1));
        expect(map.size).toBe(1);
        expect(map.get(verseKey('jn', 4, 2))?.color).toBe('blue');
        expect(withoutMarks(map, { bookId: 'jn', chapter: 4, verses: [2] }).size).toBe(0);
    });
});
