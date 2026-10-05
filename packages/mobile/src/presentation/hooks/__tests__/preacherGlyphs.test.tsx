import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { firstWordOf, usePreachHighlights } from '../usePreachHighlights';

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@/data/repositories/annotation.repository.impl', () => {
    const repo = {
        list: jest.fn(async () => []),
        listGlyphs: jest.fn(async () => []),
        createGlyph: jest.fn(async (_sermonId: string, anchor: object, glyph: string) => ({
            ...anchor,
            id: 'g1',
            type: 'glyph',
            glyph,
            createdAt: new Date(),
            updatedAt: new Date(),
            updatedBy: 'mobile',
        })),
        updateGlyph: jest.fn(async () => undefined),
        createHighlight: jest.fn(async (_sermonId: string, anchor: object, color: string, style: string) => ({
            ...anchor,
            id: 'h1',
            type: 'highlight',
            color,
            style,
            createdAt: new Date(),
            updatedAt: new Date(),
            updatedBy: 'mobile',
        })),
        deleteAnnotation: jest.fn(async () => undefined),
    };
    return { AnnotationRepositoryImpl: jest.fn(() => repo), __repo: repo };
});
const repo = (jest.requireMock('@/data/repositories/annotation.repository.impl') as { __repo: Record<string, jest.Mock> })
    .__repo;

type Api = ReturnType<typeof usePreachHighlights>;
const SECTION = { slug: 'huida', title: 'La huida', body: 'Jonás huyó a Tarsis. Dios no lo soltó.' };
const OTRA = { slug: 'tormenta', title: 'La tormenta', body: 'Jehová hizo levantar un gran viento.' };

function Sonda({ onApi }: { onApi: (api: Api) => void }) {
    // Dos movimientos a la vista, como en el sermón continuo.
    onApi(usePreachHighlights('s1', [SECTION, OTRA], false));
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
    Object.values(repo).forEach((m) => m.mockClear());
    // Sin recolección por temporizador: un temporizador vivo deja a jest sin
    // poder salir (en CI corre sin --forceExit).
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
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

/** Elegir «Jonás» (offsets 0–5) y tocar un glifo en el popover. */
async function pick(glyph: Parameters<Api['applyGlyph']>[0]) {
    act(() => api.endSelection('huida', { start: 0, end: 5 }, 100));
    act(() => api.applyGlyph(glyph));
    await flush();
}

describe('marcas de predicador en el atril', () => {
    it('poner un glifo lo ancla a la palabra y aparece sobre ella', async () => {
        await pick('pause');
        expect(repo.createGlyph).toHaveBeenCalledWith('s1', expect.objectContaining({ sectionSlug: 'huida', exact: 'Jonás' }), 'pause');
        expect(api.glyphsBySlug.huida).toEqual([{ id: 'g1', glyph: 'pause', start: 0 }]);
        expect(api.popoverOpen).toBe(false);
    });

    it('otro glifo sobre la misma palabra la cambia; el mismo la quita', async () => {
        await pick('pause');
        await pick('look');
        expect(repo.updateGlyph).toHaveBeenCalledWith('s1', 'g1', 'look');
        expect(api.glyphsBySlug.huida[0]?.glyph).toBe('look');
        expect(repo.createGlyph).toHaveBeenCalledTimes(1);

        await pick('look');
        expect(repo.deleteAnnotation).toHaveBeenCalledWith('s1', 'g1');
        expect(api.glyphsBySlug.huida).toEqual([]);
    });

    it('el popover sabe qué glifo tiene la palabra elegida', async () => {
        await pick('emphasis');
        act(() => api.endSelection('huida', { start: 0, end: 5 }, 100));
        expect(api.pendingGlyph).toBe('emphasis');
        act(() => api.endSelection('huida', { start: 6, end: 11 }, 100));
        expect(api.pendingGlyph).toBeNull();
    });

    it('REGRESIÓN: con varias palabras elegidas, el glifo se ancla sólo a la primera', async () => {
        act(() => api.endSelection('huida', { start: 0, end: 19 }, 100)); // «Jonás huyó a Tarsis»
        act(() => api.applyGlyph('look'));
        await flush();
        expect(repo.createGlyph).toHaveBeenCalledWith('s1', expect.objectContaining({ exact: 'Jonás', offset: 0, length: 5 }), 'look');
    });

    it('REGRESIÓN: un glifo en otra palabra de la selección no se reemplaza', async () => {
        // Glifo en «huyó» (6), luego se eligen «Jonás huyó»: va a «Jonás».
        act(() => api.endSelection('huida', { start: 6, end: 10 }, 100));
        act(() => api.applyGlyph('pause'));
        await flush();
        act(() => api.endSelection('huida', { start: 0, end: 10 }, 100));
        expect(api.pendingGlyph).toBeNull();
        act(() => api.applyGlyph('look'));
        await flush();
        expect(repo.updateGlyph).not.toHaveBeenCalled();
        expect(repo.createGlyph).toHaveBeenCalledTimes(2);
    });

    it('con dos movimientos a la vista, la marca va al movimiento donde se eligió', async () => {
        act(() => api.beginSelection('tormenta', { start: 0, end: 6 }));
        expect(api.selection).toEqual({ slug: 'tormenta', range: { start: 0, end: 6 } });
        act(() => api.endSelection('tormenta', { start: 0, end: 6 }, 100));
        act(() => api.applyMark('yellow', 'highlight'));
        await flush();
        expect(repo.createHighlight).toHaveBeenCalledWith(
            's1',
            expect.objectContaining({ sectionSlug: 'tormenta', exact: 'Jehová' }),
            'yellow',
            'highlight',
        );
    });

    it('la primera palabra salta espacios y corta en el siguiente', () => {
        const body = 'Jonás huyó';
        expect(firstWordOf(body, { start: 0, end: 10 })).toEqual({ start: 0, end: 5 });
        expect(firstWordOf(body, { start: 5, end: 10 })).toEqual({ start: 6, end: 10 });
    });
});
