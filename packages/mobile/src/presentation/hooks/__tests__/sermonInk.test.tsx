import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { InkStroke } from '@dosfilos/domain';

import { inkAnchorKey, sentenceContaining, useInkNotes } from '../useInkNotes';

jest.mock('@/data/repositories/annotation.repository.impl', () => {
    let seq = 0;
    const repo = {
        listInk: jest.fn(async () => []),
        newInkNoteId: jest.fn(() => `real${++seq}`),
        appendInkStroke: jest.fn(async () => 'x'),
        replaceInkStrokes: jest.fn(async () => undefined),
        deleteAnnotation: jest.fn(async () => undefined),
        restoreInkNote: jest.fn(async () => undefined),
    };
    return { AnnotationRepositoryImpl: jest.fn(() => repo), __repo: repo };
});
const repo = (jest.requireMock('@/data/repositories/annotation.repository.impl') as { __repo: Record<string, jest.Mock> })
    .__repo;

type Api = ReturnType<typeof useInkNotes>;
const A = { slug: 'a', title: 'A', body: 'Primera de A. Segunda de A.' };
const B = { slug: 'b', title: 'B', body: 'Primera de B. Segunda de B.' };
const stroke = (y: number): InkStroke => ({ points: [{ x: 0, y }, { x: 1, y }], width: 0.05, color: 'ink' });

function Sonda({ section, onApi }: { section: typeof A; onApi: (api: Api) => void }) {
    onApi(useInkNotes('s1', [{ section, sentenceStarts: [0, 14] }], `k-${section.slug}`, section.slug));
    return null;
}

/** El sermón continuo: los dos movimientos a la vista, un solo historial. */
function SondaContinua({ onApi }: { onApi: (api: Api) => void }) {
    onApi(
        useInkNotes(
            's1',
            [
                { section: A, sentenceStarts: [0, 14] },
                { section: B, sentenceStarts: [0, 14] },
            ],
            'k-todo',
            'sermon',
        ),
    );
    return null;
}

const flush = () =>
    act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    });

let api: Api;
let client: QueryClient;
let renderer: ReactTestRenderer;
const mount = (section: typeof A) =>
    act(() => {
        renderer.update(
            <QueryClientProvider client={client}>
                <Sonda section={section} onApi={(a) => (api = a)} />
            </QueryClientProvider>,
        );
    });

beforeEach(async () => {
    Object.values(repo).forEach((m) => m.mockClear());
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    act(() => {
        renderer = create(
            <QueryClientProvider client={client}>
                <Sonda section={A} onApi={(a) => (api = a)} />
            </QueryClientProvider>,
        );
    });
    await flush();
});
afterEach(() => {
    act(() => renderer.unmount());
    client.clear();
});

describe('tinta del sermón', () => {
    it('REGRESIÓN: un trazo en el segundo movimiento no se agrega a la nota del primero', () => {
        act(() => api.addStroke('a|0', stroke(1)));
        mount(B);
        act(() => api.addStroke('b|0', stroke(2)));
        expect(api.notes).toHaveLength(1);
        expect(api.notes[0]!.sectionSlug).toBe('b');
        expect(api.allNotes.map((n) => n.sectionSlug).sort()).toEqual(['a', 'b']);
    });

    it('REGRESIÓN: deshacer justo después de dibujar borra el documento real (no resucita)', () => {
        act(() => api.addStroke('a|0', stroke(1)));
        const created = repo.appendInkStroke.mock.calls[0]![4];
        expect(created).toMatch(/^real/);
        act(() => api.undo());
        expect(repo.deleteAnnotation).toHaveBeenCalledWith('s1', created);
        expect(api.notes).toEqual([]);
    });

    it('REGRESIÓN: el historial es del movimiento: al cambiar, no se rehace en el otro', () => {
        act(() => api.addStroke('a|0', stroke(1)));
        act(() => api.undo());
        expect(api.canRedo).toBe(true);
        mount(B);
        expect(api.canRedo).toBe(false);
        act(() => api.redo());
        expect(api.notes).toEqual([]);
    });

    it('limpiar y deshacer devuelve las notas con su id', () => {
        act(() => api.addStroke('a|0', stroke(1)));
        act(() => api.addStroke('a|14', stroke(2)));
        const ids = api.notes.map((n) => n.id).sort();
        act(() => api.clearNotes(api.notes));
        expect(api.notes).toEqual([]);
        act(() => api.undo());
        expect(api.notes.map((n) => n.id).sort()).toEqual(ids);
        expect(repo.restoreInkNote).toHaveBeenCalledTimes(2);
    });
});

describe('tinta en el sermón continuo', () => {
    const mountContinuous = () =>
        act(() => {
            renderer.update(
                <QueryClientProvider client={client}>
                    <SondaContinua onApi={(a) => (api = a)} />
                </QueryClientProvider>,
            );
        });

    it('cada trazo va a la nota de SU movimiento, aunque las dos oraciones empiecen en 0', () => {
        mountContinuous();
        act(() => api.addStroke('a|0', stroke(1)));
        act(() => api.addStroke('b|0', stroke(2)));
        expect(api.notes.map((n) => n.sectionSlug).sort()).toEqual(['a', 'b']);
        expect(api.notes.every((n) => n.strokes.length === 1)).toBe(true);
    });

    it('cada nota se dibuja junto a la oración de su movimiento, no la del otro', () => {
        mountContinuous();
        act(() => {
            api.rememberBlock('a', 0, { x: 0, y: 100, height: 20 });
            api.rememberBlock('b', 0, { x: 0, y: 900, height: 20 });
        });
        act(() => api.addStroke('b|0', stroke(1)));
        expect(api.anchorRectFor(api.notes[0]!)).toEqual({ x: 0, y: 900, height: 20 });
        expect(api.anchorAt(10, 905)?.offset).toBe(inkAnchorKey('b', 0));
    });

    it('un solo historial: deshacer alcanza al otro movimiento', () => {
        mountContinuous();
        act(() => api.addStroke('a|0', stroke(1)));
        act(() => api.addStroke('b|0', stroke(2)));
        act(() => api.undo());
        act(() => api.undo());
        expect(api.notes).toEqual([]);
    });
});

describe('la oración que contiene un ancla', () => {
    it('la nota vieja anclada al comienzo del párrafo cae en su primera oración', () => {
        expect(sentenceContaining([0, 14, 30], 0)).toBe(0);
        expect(sentenceContaining([0, 14, 30], 20)).toBe(14);
    });

    it('un ancla corrida por un escape que ya no se muestra encuentra su oración', () => {
        expect(sentenceContaining([0, 15, 30], 14)).toBe(15);
    });
});
