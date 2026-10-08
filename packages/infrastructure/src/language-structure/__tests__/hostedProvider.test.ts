import { describe, it, expect, vi } from 'vitest';
import { HostedLanguageStructureProvider } from '../HostedLanguageStructureProvider';

const capitulo = { lang: 'gr', book: 'JAS', chapter: 2, words: [], clauses: [] };
const respuesta = (status: number, body: unknown = capitulo, tipo = 'application/json') =>
    ({ status, ok: status >= 200 && status < 300, headers: new Headers({ 'content-type': tipo }), json: async () => body }) as Response;

describe('HostedLanguageStructureProvider', () => {
    it('pide el capítulo al sitio, una sola vez aunque lo pidan dos a la vez', async () => {
        const f = vi.fn().mockResolvedValue(respuesta(200));
        const p = new HostedLanguageStructureProvider('/language-data/v1', f);
        const [a, b] = await Promise.all([p.getChapter('gr', 'JAS', 2), p.getChapter('gr', 'JAS', 2)]);
        expect(a).toEqual(capitulo);
        expect(b).toBe(a);
        expect(f).toHaveBeenCalledTimes(1);
        expect(f).toHaveBeenCalledWith('/language-data/v1/gr/JAS/2.json');
    });

    it('un capítulo que no existe es null; un fallo de red no queda guardado', async () => {
        const f = vi.fn().mockResolvedValueOnce(respuesta(404)).mockResolvedValueOnce(respuesta(503)).mockResolvedValueOnce(respuesta(200));
        const p = new HostedLanguageStructureProvider('/x', f);
        expect(await p.getChapter('he', 'Ruth', 99)).toBeNull();
        await expect(p.getChapter('gr', 'JAS', 2)).rejects.toThrow(/503/);
        expect(await p.getChapter('gr', 'JAS', 2)).toEqual(capitulo);
    });

    it('REGRESIÓN (revisión): el HTML que el hosting devuelve con 200 para lo que no existe es «no existe»', async () => {
        const f = vi.fn().mockResolvedValue(respuesta(200, '<!doctype html>', 'text/html; charset=utf-8'));
        expect(await new HostedLanguageStructureProvider('/x', f).getChapter('gr', 'JHN', 99)).toBeNull();
    });
});

describe('HostedLanguageStructureProvider — claves de libro', () => {
    it('«Cant» (catálogo del tutor de hebreo) se pide como «Song» (OSHB)', async () => {
        const urls: string[] = [];
        const p = new HostedLanguageStructureProvider('/language-data/v1', (async (url: string) => {
            urls.push(url);
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        }) as typeof fetch);
        await p.getChapter('he', 'Cant', 2);
        expect(urls).toEqual(['/language-data/v1/he/Song/2.json']);
    });
});
