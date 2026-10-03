import { describe, it, expect, vi } from 'vitest';
import { heredarConPaginas } from '../heredarConPaginas';

/**
 * Jonás 4:5-11 (2026-10-02): once fuentes heredadas llegaron sin páginas y el
 * análisis las leyó desde la portada. Heredar ahora propone páginas para el
 * pasaje nuevo.
 */
const fuente = (id: string, sourceType = 'commentary-expository') =>
    ({ id, sourceLibraryResourceId: `lib-${id}`, corpusId: `lib-${id}`, sourceType, displayLabel: id }) as never;

function montar(creadas: unknown[], fijadas: Record<string, Array<{ start: number; end: number }>> = {}, rangos: Record<string, Array<{ start: number; end: number }>> = {}) {
    const guardadas: Array<{ id: string; hojas: unknown; fijadas: unknown }> = [];
    const proponer = vi.fn(async (resourceId: string) => {
        if (resourceId === 'lib-roto') throw new Error('callable caída');
        return { ranges: rangos[resourceId] ?? [{ start: 10, end: 12 }], kind: 'structural', pageIndex: [] };
    });
    const deps = {
        heredar: async () => ({ creadas: creadas as never, fijadasDelHermano: fijadas }),
        proponer,
        guardar: async (f: { id: string }, _p: unknown, hojas: unknown, fij: unknown) => { guardadas.push({ id: f.id, hojas, fijadas: fij }); },
    };
    return { deps, guardadas, proponer };
}

describe('heredarConPaginas', () => {
    it('cada comentario heredado queda con páginas para este pasaje', async () => {
        const { deps, guardadas } = montar([fuente('burt'), fuente('sasson')]);
        const r = await heredarConPaginas(deps);
        expect(r).toEqual({ creadas: 2, conPaginas: 2, porLema: 0, sinPropuesta: 0 });
        expect(guardadas.map(g => g.id)).toEqual(['burt', 'sasson']);
    });

    it('suma las hojas fijadas del hermano a la propuesta', async () => {
        const { deps, guardadas } = montar([fuente('burt')], { burt: [{ start: 3, end: 5 }] });
        await heredarConPaginas(deps);
        expect(guardadas[0]!.hojas).toEqual([{ start: 3, end: 5 }, { start: 10, end: 12 }]);
        expect(guardadas[0]!.fijadas).toEqual([{ start: 3, end: 5 }]);
    });

    it('léxicos y gramáticas no se proponen: van al selector', async () => {
        const { deps, proponer } = montar([fuente('ortiz', 'lexicon-technical'), fuente('farfan', 'grammar-syntax'), fuente('burt')]);
        const r = await heredarConPaginas(deps);
        expect(r.porLema).toBe(2);
        expect(proponer).toHaveBeenCalledTimes(1);
    });

    it('sin propuesta (o con error) la fuente queda sin páginas, no limitada a lo fijado', async () => {
        const { deps, guardadas } = montar(
            [fuente('vacio'), fuente('roto')],
            { vacio: [{ start: 3, end: 5 }] },
            { 'lib-vacio': [] },
        );
        const r = await heredarConPaginas(deps);
        expect(r.sinPropuesta).toBe(2);
        expect(guardadas).toHaveLength(0);
    });

    it('guarda de a una aunque proponga en paralelo', async () => {
        let enVuelo = 0;
        let maximo = 0;
        const { deps } = montar([fuente('a'), fuente('b'), fuente('c'), fuente('d')]);
        const lento = { ...deps, guardar: async () => {
            enVuelo++; maximo = Math.max(maximo, enVuelo);
            await new Promise(r => setTimeout(r, 5));
            enVuelo--;
        } };
        await heredarConPaginas({ ...lento, concurrencia: 3 });
        expect(maximo).toBe(1);
    });

    it('un guardado que falla no deja sin páginas a las siguientes', async () => {
        const { deps, guardadas } = montar([fuente('burt'), fuente('sasson'), fuente('allen')]);
        const guardar = deps.guardar;
        deps.guardar = async (f, p, h, fij) => {
            if (f.id === 'burt') throw new Error('escritura rechazada');
            return guardar(f, p, h, fij);
        };
        const r = await heredarConPaginas(deps);
        expect(guardadas.map(g => g.id)).toEqual(['sasson', 'allen']);
        expect(r).toMatchObject({ conPaginas: 2, sinPropuesta: 1 });
    });
});
