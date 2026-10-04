import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { usePreachHighlights } from '../usePreachHighlights';

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
        deleteAnnotation: jest.fn(async () => undefined),
    };
    return { AnnotationRepositoryImpl: jest.fn(() => repo), __repo: repo };
});
const repo = (jest.requireMock('@/data/repositories/annotation.repository.impl') as { __repo: Record<string, jest.Mock> })
    .__repo;

type Api = ReturnType<typeof usePreachHighlights>;
const SECTION = { slug: 'huida', title: 'La huida', body: 'Jonás huyó a Tarsis. Dios no lo soltó.' };

function Sonda({ onApi }: { onApi: (api: Api) => void }) {
    onApi(usePreachHighlights('s1', SECTION, false));
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
    act(() => api.endSelection({ start: 0, end: 5 }, 100));
    act(() => api.applyGlyph(glyph));
    await flush();
}

describe('marcas de predicador en el atril', () => {
    it('poner un glifo lo ancla a la palabra y aparece sobre ella', async () => {
        await pick('pause');
        expect(repo.createGlyph).toHaveBeenCalledWith('s1', expect.objectContaining({ sectionSlug: 'huida', exact: 'Jonás' }), 'pause');
        expect(api.glyphs).toEqual([{ id: 'g1', glyph: 'pause', start: 0 }]);
        expect(api.popoverOpen).toBe(false);
    });

    it('otro glifo sobre la misma palabra la cambia; el mismo la quita', async () => {
        await pick('pause');
        await pick('look');
        expect(repo.updateGlyph).toHaveBeenCalledWith('s1', 'g1', 'look');
        expect(api.glyphs[0]?.glyph).toBe('look');
        expect(repo.createGlyph).toHaveBeenCalledTimes(1);

        await pick('look');
        expect(repo.deleteAnnotation).toHaveBeenCalledWith('s1', 'g1');
        expect(api.glyphs).toEqual([]);
    });

    it('el popover sabe qué glifo tiene la palabra elegida', async () => {
        await pick('emphasis');
        act(() => api.endSelection({ start: 0, end: 5 }, 100));
        expect(api.pendingGlyph).toBe('emphasis');
        act(() => api.endSelection({ start: 6, end: 11 }, 100));
        expect(api.pendingGlyph).toBeNull();
    });
});
