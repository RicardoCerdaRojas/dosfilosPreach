import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { InkStroke } from '@dosfilos/domain';

import { useBibleInk } from '../useBibleInk';

jest.mock('@react-native-firebase/firestore', () => ({
    collection: jest.fn(() => ({ path: 'users/u1/bibleInk' })),
    doc: jest.fn((_ref: unknown, id: string) => ({ id })),
    getDocs: jest.fn(async () => ({ docs: [] })),
    setDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    serverTimestamp: jest.fn(() => 'ts'),
}));
jest.mock('@/data/sources/firebase.source', () => ({
    getFirebaseAuth: () => ({ currentUser: { uid: 'u1' } }),
    getFirebaseDb: () => ({}),
}));
const firestore = jest.requireMock('@react-native-firebase/firestore') as Record<'setDoc' | 'deleteDoc', jest.Mock>;

type Api = ReturnType<typeof useBibleInk>;
const stroke = (y: number): InkStroke => ({ points: [{ x: 0, y }, { x: 1, y }], width: 0.05, color: 'ink' });

function Sonda({ onApi }: { onApi: (api: Api) => void }) {
    onApi(useBibleInk('JON', 1, 'k'));
    return null;
}

const flush = () =>
    act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    });

let api: Api;
let client: QueryClient;
let renderer: ReactTestRenderer;
beforeEach(async () => {
    firestore.setDoc.mockClear();
    firestore.deleteDoc.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    act(() => {
        renderer = create(
            <QueryClientProvider client={client}>
                <Sonda onApi={(a) => (api = a)} />
            </QueryClientProvider>,
        );
    });
    await flush();
});
afterEach(() => {
    act(() => renderer.unmount());
    client.clear();
});

const strokes = () => api.notes.flatMap((n) => n.strokes);

describe('tinta de la Biblia: deshacer, rehacer y limpiar', () => {
    it('un trazo se deshace y se rehace', () => {
        const a = stroke(1);
        act(() => api.addStroke(3, a));
        expect(strokes()).toEqual([a]);
        act(() => api.undo());
        expect(strokes()).toEqual([]);
        expect(firestore.deleteDoc).toHaveBeenCalled();
        act(() => api.redo());
        expect(strokes()).toEqual([a]);
    });

    it('lo borrado con la goma vuelve a su lugar al deshacer', () => {
        const a = stroke(1);
        const b = stroke(2);
        act(() => api.addStroke(3, a));
        act(() => api.addStroke(3, b));
        act(() => api.eraseStroke('JON.1.3', a));
        expect(strokes()).toEqual([b]);
        act(() => api.undo());
        expect(strokes()).toEqual([a, b]);
    });

    it('limpiar el capítulo se puede deshacer', () => {
        act(() => api.addStroke(3, stroke(1)));
        act(() => api.addStroke(7, stroke(2)));
        act(() => api.clearNotes(api.notes));
        expect(api.notes).toEqual([]);
        expect(api.canUndo).toBe(true);
        act(() => api.undo());
        expect(api.notes.map((n) => n.verse).sort()).toEqual([3, 7]);
        // Se vuelven a guardar con su id.
        expect(firestore.setDoc).toHaveBeenLastCalledWith({ id: expect.stringMatching(/^JON\.1\.(3|7)$/) }, expect.anything());
    });

    it('sin nada que deshacer, deshacer no hace nada', () => {
        expect(api.canUndo).toBe(false);
        act(() => api.undo());
        expect(api.notes).toEqual([]);
    });
});
