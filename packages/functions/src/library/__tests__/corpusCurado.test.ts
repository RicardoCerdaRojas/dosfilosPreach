import { describe, it, expect } from 'vitest';
import { indicesOf, rankCuratedChunks, MAX_CURATED_CHUNKS } from '../retrieveCuratedCorpus';

/**
 * La búsqueda entra en lo curado.
 *
 * El camino anterior le pedía al índice lo más cercano del LIBRO ENTERO y
 * recortaba después a las hojas admitidas. Medido sobre las 43 fuentes con
 * receta de la base, esa selección es el 5-10% de los fragmentos de su libro
 * y en los peores casos el 0,3%: Tuggy, 4 de 1394; McComiskey, 3 de 959. Con
 * un pool de 60 sobre 1394 candidatos, acertar esos 4 es una lotería —y
 * cuando sale mal la fuente vuelve vacía por dónde cayó el corte, no por
 * falta de material—.
 */
const fila = (chunkIndex: number, page: number, text: string, embedding: number[], extra: Record<string, unknown> = {}) =>
    ({ chunkIndex, text, userId: 'u1', metadata: { page, section: null }, embedding, ...extra });

const rankear = (rows: ReadonlyArray<ReturnType<typeof fila>>, opts: Partial<{ ranges: Array<{ start: number; end: number }>; pool: number; uid: string; vector: number[] }> = {}) =>
    rankCuratedChunks({
        rows,
        resourceId: 'res-1',
        uid: opts.uid ?? 'u1',
        ranges: opts.ranges ?? [{ start: 70, end: 80 }],
        vector: opts.vector ?? [1, 0],
        pool: opts.pool ?? 60,
    });

describe('rankCuratedChunks — ordena lo admitido, no lo descarta', () => {
    it('ordena por cercania a la consulta', () => {
        const out = rankear([
            fila(1, 70, 'lejos', [0, 1]),
            fila(2, 71, 'cerca', [1, 0]),
            fila(3, 72, 'a medias', [1, 1]),
        ]);
        expect(out.map(c => c.text)).toEqual(['cerca', 'a medias', 'lejos']);
        expect(out[0]!.score).toBeCloseTo(1, 5);
        expect(out[2]!.score).toBeCloseTo(0, 5);
    });

    it('un fragmento poco cercano ENTRA igual si esta en las hojas admitidas', () => {
        // El caso de Burt. Sus 22 fragmentos son el 8% del libro y ninguno
        // gano el ranking global, asi que la fuente —ancla de su paso— volvio
        // muda teniendo material justo sobre la palabra del versiculo.
        const out = rankear([fila(1, 73, 'la palabra traducida como enojarse admite entristecerse', [0, 1])]);
        expect(out).toHaveLength(1);
        expect(out[0]!.text).toContain('entristecerse');
    });

    it('la receta sigue mandando: una hoja fuera de los tramos no entra', () => {
        // El indice de hojas puede mapear un fragmento de mas en el borde.
        const out = rankear([fila(1, 71, 'dentro', [1, 0]), fila(2, 81, 'fuera', [1, 0])]);
        expect(out.map(c => c.text)).toEqual(['dentro']);
    });

    it('un fragmento sin hoja no entra: no se puede comprobar que este admitido', () => {
        expect(rankear([{ ...fila(1, 0, 'x', [1, 0]), metadata: { page: null, section: null } }])).toEqual([]);
    });

    it('no devuelve mas que el pool', () => {
        const rows = Array.from({ length: 10 }, (_, i) => fila(i, 70 + (i % 10), `t${i}`, [1, 0]));
        expect(rankear(rows, { pool: 3 })).toHaveLength(3);
    });

    it('un fragmento de otro usuario no se lee aunque se pida por clave', () => {
        // La lectura por clave no lleva el `where('userId')` que filtraba en
        // el camino del indice. La regla se aplica sobre la fila.
        const ajeno = { ...fila(1, 70, 'privado de otro', [1, 0]), userId: 'u2' };
        expect(rankear([ajeno])).toEqual([]);
    });

    it('la biblioteca compartida si se lee: no tiene dueno individual', () => {
        const core = { ...fila(1, 70, 'curado y compartido', [1, 0]), userId: 'otro', stores: ['core'] };
        expect(rankear([core]).map(c => c.text)).toEqual(['curado y compartido']);
    });

    it('un embedding ausente puntua cero, no rompe', () => {
        const out = rankear([fila(1, 70, 'con vector', [1, 0]), { ...fila(2, 71, 'sin vector', []), embedding: undefined }]);
        expect(out.map(c => c.text)).toEqual(['con vector', 'sin vector']);
        expect(out[1]!.score).toBe(0);
    });
});

describe('indicesOf — cuantos fragmentos se leen por clave', () => {
    it('enumera los tramos', () => {
        expect(indicesOf([{ start: 3, end: 5 }, { start: 9, end: 9 }])).toEqual([3, 4, 5, 9]);
    });

    it('sin tramos no hay lectura por clave', () => {
        expect(indicesOf([])).toBeNull();
    });

    it('por encima del tope se vuelve al indice', () => {
        // Leer un libro entero por su clave seria mas caro que una busqueda
        // imperfecta. La mayor seleccion medida tiene 153 fragmentos.
        expect(indicesOf([{ start: 0, end: MAX_CURATED_CHUNKS + 1 }])).toBeNull();
        expect(indicesOf([{ start: 0, end: MAX_CURATED_CHUNKS - 1 }])).toHaveLength(MAX_CURATED_CHUNKS);
    });

    it('un tramo mal formado no se interpreta', () => {
        expect(indicesOf([{ start: 5, end: 3 }])).toBeNull();
        expect(indicesOf([{ start: -1, end: 3 }])).toBeNull();
    });
});
