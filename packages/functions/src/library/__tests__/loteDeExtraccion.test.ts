import { describe, it, expect } from 'vitest';
import { compararExtracciones, leerRespuestaDeTramo, partirTramo, pedidoDeTramo, planearTramos, tramosQueFaltan, unirPaginas } from '../loteDeExtraccion';
import { medirExtraccion } from '../medirExtraccion';
import { PROMPT_DE_EXTRACCION } from '../geminiExtraction';
import { repararEscapes } from '../rescatarPaginas';

describe('planearTramos y partirTramo', () => {
    it('cubre el libro sin solaparse', () => {
        expect(planearTramos(45, 20)).toEqual([{ desde: 1, hasta: 20 }, { desde: 21, hasta: 40 }, { desde: 41, hasta: 45 }]);
    });
    it('un tramo que no salió se parte en dos; uno de una página, no', () => {
        expect(partirTramo({ desde: 21, hasta: 40 })).toEqual([{ desde: 21, hasta: 30 }, { desde: 31, hasta: 40 }]);
        expect(partirTramo({ desde: 7, hasta: 7 })).toEqual([{ desde: 7, hasta: 7 }]);
    });
});

describe('pedidoDeTramo', () => {
    it('pide lo mismo que la extracción en línea', () => {
        const p = pedidoDeTramo('files/abc');
        expect(p.contents[0]!.parts[0]).toEqual({ text: PROMPT_DE_EXTRACCION });
        expect(p.config.responseMimeType).toBe('application/json');
    });
});

describe('leerRespuestaDeTramo', () => {
    const tramo = { desde: 101, hasta: 103 };
    it('numera las páginas en el libro', () => {
        const r = leerRespuestaDeTramo({ text: JSON.stringify({ pages: [{ page: 1, md: '# Uno' }, { page: 2, md: 'Dos' }] }), finishReason: 'STOP' }, tramo);
        expect(r.ok && r.paginas.map(p => p.page)).toEqual([101, 102]);
    });
    it('una respuesta cortada o con error no sirve', () => {
        expect(leerRespuestaDeTramo({ text: '{}', finishReason: 'MAX_TOKENS' }, tramo).ok).toBe(false);
        expect(leerRespuestaDeTramo({ error: { code: 13 } }, tramo).ok).toBe(false);
    });
    it('descarta números fuera del tramo', () => {
        const r = leerRespuestaDeTramo({ text: JSON.stringify({ pages: [{ page: 1, md: 'a' }, { page: 9, md: 'b' }] }), finishReason: 'STOP' }, tramo);
        expect(r.ok && r.paginas.map(p => p.page)).toEqual([101]);
    });
});

describe('unirPaginas', () => {
    it('una entrada por página, en orden, con las marcas de producción', () => {
        const u = unirPaginas([{ page: 2, text: 'b', md: 'b' }, { page: 1, text: 'a', md: 'a' }, { page: 2, text: 'B', md: 'B' }]);
        expect(u.paginas.map(p => p.md)).toEqual(['a', 'B']);
        expect(u.markdown).toContain('<!-- page: 1 -->');
        expect(u.texto).toContain('[PAGE 2]');
    });
});

describe('compararExtracciones — nunca deja un libro peor', () => {
    const md = (paginas: number, texto: string) => Array.from({ length: paginas }, (_, i) => `<!-- page: ${i + 1} -->\n${texto}`).join('\n');
    const caso = (texto: string, total = 3) => ({ texto, medicion: medirExtraccion(texto, total, Array(total).fill(900)) });
    const LARGO = 'texto '.repeat(30);

    it('menos páginas faltantes: reemplaza', () => {
        const actual = caso(md(2, LARGO));
        const nueva = caso(md(3, LARGO));
        expect(compararExtracciones(actual, nueva, false)).toMatchObject({ reemplazar: true });
    });
    it('más faltantes: no', () => {
        expect(compararExtracciones(caso(md(3, LARGO)), caso(md(2, LARGO)), true).reemplazar).toBe(false);
    });
    it('pierde hebreo: no, aunque sea el modelo nuevo', () => {
        const heb = 'בְּרֵאשִׁית בָּרָא '.repeat(20);
        expect(compararExtracciones(caso(md(3, heb)), caso(md(3, LARGO)), true)).toMatchObject({ reemplazar: false, motivo: expect.stringContaining('hebreo') });
    });
    it('igual de completo, sólo cambia el modelo: reemplaza si el modelo mejora; si no, no', () => {
        expect(compararExtracciones(caso(md(3, LARGO)), caso(md(3, LARGO)), true).reemplazar).toBe(true);
        expect(compararExtracciones(caso(md(3, LARGO)), caso(md(3, LARGO)), false).reemplazar).toBe(false);
    });
    it('recupera un texto estructurado vacío', () => {
        const vacio = caso(md(3, ''));
        expect(compararExtracciones(vacio, caso(md(3, LARGO)), false).motivo).toContain('recuperado');
    });
});

/** Varner (2026-10-15): tramos de 20 que volvieron con 15, sin correr la numeración. */
describe('tramosQueFaltan', () => {
    it('agrupa las páginas omitidas para pedirlas otra vez', () => {
        const devueltas = [81, 82, 84, 85, 86, 90, 91, 92, 93, 94, 95, 96, 97, 98, 100].map(page => ({ page }));
        expect(tramosQueFaltan({ desde: 81, hasta: 100 }, devueltas)).toEqual([
            { desde: 83, hasta: 83 }, { desde: 87, hasta: 89 }, { desde: 99, hasta: 99 },
        ]);
    });
    it('un tramo completo no pide nada', () => {
        expect(tramosQueFaltan({ desde: 1, hasta: 3 }, [{ page: 1 }, { page: 2 }, { page: 3 }])).toEqual([]);
    });
});

/** Varner (2026-10-15): tablas con `\|` dejaban la respuesta ilegible. */
describe('respuestas con escapes inválidos', () => {
    it('una tabla con \\| se lee igual', () => {
        const conBarraInvalida = '{"pages":[{"page":1,"md":"| A: diá \\| P: x |"}]}';
        expect(() => JSON.parse(conBarraInvalida)).toThrow();
        const r = leerRespuestaDeTramo({ text: conBarraInvalida, finishReason: 'STOP' }, { desde: 103, hasta: 103 });
        expect(r.ok && r.paginas[0]!.md).toBe('| A: diá \\| P: x |');
    });
});

describe('repararEscapes', () => {
    it('duplica sólo las barras que no escapan nada; respeta \\\\ y los escapes válidos', () => {
        expect(repararEscapes('a \\| b')).toBe('a \\\\| b');
        expect(repararEscapes('\\n \\" \\\\')).toBe('\\n \\" \\\\');
        expect(repararEscapes('\\\\|')).toBe('\\\\|');
    });
});
