import { describe, it, expect } from 'vitest';
import { compararExtracciones, leerRespuestaDeTramo, medirTexto, paginaLeida, partirTramo, rellenarConCapa, separarEnBlanco, sinPaginas, pedidoDeTramo, planearTramos, tramosQueFaltan, unirPaginas } from '../loteDeExtraccion';
import { medirExtraccion } from '../medirExtraccion';
import { PROMPT_DE_EXTRACCION } from '../geminiExtraction';

/** Una página leída de verdad: al menos los 40 caracteres de la medición. */
const LEIDA = 'Texto de una página leída de verdad, con más de cuarenta letras.';
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
    it('con justo las páginas del tramo pero numeradas con el folio, manda la posición', () => {
        const uno = leerRespuestaDeTramo({ text: JSON.stringify({ pages: [{ page: 5, md: 'folio 5' }] }), finishReason: 'STOP' }, { desde: 77, hasta: 77 });
        expect(uno.ok && uno.paginas.map(p => p.page)).toEqual([77]);
        const tres = leerRespuestaDeTramo({ text: JSON.stringify({ pages: [{ page: 40, md: 'a' }, { page: 41, md: 'b' }, { page: 42, md: 'c' }] }), finishReason: 'STOP' }, tramo);
        expect(tres.ok && tres.paginas.map(p => p.page)).toEqual([101, 102, 103]);
    });
});

describe('unirPaginas', () => {
    it('una entrada por página, en orden, con las marcas de producción', () => {
        const u = unirPaginas([{ page: 2, text: 'b', md: 'b' }, { page: 1, text: 'a', md: 'a' }, { page: 2, text: 'B', md: 'B' }]);
        expect(u.paginas.map(p => p.md)).toEqual(['a', 'B']);
        expect(u.markdown).toContain('<!-- page: 1 -->');
        expect(u.texto).toContain('[PAGE 2]');
    });
    it('una página en blanco no pisa a una con texto', () => {
        const u = unirPaginas([{ page: 1, text: LEIDA, md: LEIDA }, { page: 1, text: '', md: '' }, { page: 1, text: '12', md: '12' }]);
        expect(u.paginas.map(p => p.md)).toEqual([LEIDA]);
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
    it('perder un puñado de letras «griegas» (ruido del OCR viejo) no frena', () => {
        expect(compararExtracciones(caso(md(3, LARGO + ' Το Ν.')), caso(md(3, LARGO)), true).reemplazar).toBe(true);
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
        const devueltas = [81, 82, 84, 85, 86, 90, 91, 92, 93, 94, 95, 96, 97, 98, 100].map(page => ({ page, md: LEIDA }));
        expect(tramosQueFaltan({ desde: 81, hasta: 100 }, devueltas)).toEqual([
            { desde: 83, hasta: 83 }, { desde: 87, hasta: 89 }, { desde: 99, hasta: 99 },
        ]);
    });
    it('una página devuelta en blanco se vuelve a pedir', () => {
        expect(tramosQueFaltan({ desde: 1, hasta: 3 }, [{ page: 1, md: LEIDA }, { page: 2, md: '  ' }, { page: 3, text: LEIDA }])).toEqual([{ desde: 2, hasta: 2 }]);
    });
    it('un tramo completo no pide nada', () => {
        expect(tramosQueFaltan({ desde: 1, hasta: 3 }, [{ page: 1, md: LEIDA }, { page: 2, md: LEIDA }, { page: 3, md: LEIDA }])).toEqual([]);
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

describe('medirTexto', () => {
    it('sin capa de texto, el total del PDF sigue contando las páginas ausentes', () => {
        const texto = '<!-- page: 1 -->\n' + 'texto '.repeat(30);
        expect(medirTexto(texto, 3, null).paginasFaltantes.total).toBe(2);
    });
});

describe('rescate con escapes inválidos', () => {
    it('una respuesta cortada con \\| se rescata igual', () => {
        const cortada = '{"pages":[{"page":1,"md":"| a \\| b |"},{"page":2,"md":"sin cerr';
        const r = leerRespuestaDeTramo({ text: cortada, finishReason: 'STOP' }, { desde: 1, hasta: 2 });
        expect(r.ok && r.paginas[0]!.md).toBe('| a \\| b |');
    });
});

describe('separarEnBlanco', () => {
    const capa = [900, 0, 900, 900, 5, 900];
    it('con capa de texto, las páginas vacías en el PDF no se vuelven a pedir', () => {
        expect(separarEnBlanco([{ desde: 2, hasta: 4 }, { desde: 5, hasta: 6 }], capa)).toEqual({ pedir: [{ desde: 3, hasta: 4 }, { desde: 6, hasta: 6 }], enBlanco: [2, 5] });
    });
    it('un libro escaneado (sin capa) se sigue pidiendo entero', () => {
        expect(separarEnBlanco([{ desde: 2, hasta: 4 }], [0, 0, 0, 10]).pedir).toEqual([{ desde: 2, hasta: 4 }]);
        expect(separarEnBlanco([{ desde: 2, hasta: 4 }], null).enBlanco).toEqual([]);
    });
});

describe('rellenarConCapa', () => {
    const LARGA = 'palabra '.repeat(60);
    it('sólo rellena páginas sin texto del modelo que en el PDF sí tienen texto', () => {
        const r = rellenarConCapa([{ page: 1, text: LEIDA, md: LEIDA }, { page: 2, text: '', md: '' }], 4, [LARGA, LARGA, 'corto', LARGA]);
        expect(r.rellenadas).toEqual([2, 4]);
        expect(unirPaginas(r.paginas).paginas.map(p => p.md?.slice(0, 7))).toEqual([LEIDA.slice(0, 7), 'palabra', '', 'palabra']);
    });
});

describe('un solo criterio de «página leída» (revisión adversarial del lote)', () => {
    it('un folio o un título corrido no es una página leída: se vuelve a pedir y se rellena', () => {
        expect(paginaLeida({ md: 'JAMES 3' })).toBe(false);
        expect(tramosQueFaltan({ desde: 12, hasta: 12 }, [{ page: 12, md: '12' }])).toEqual([{ desde: 12, hasta: 12 }]);
        const capa = Array(12).fill('palabra '.repeat(60));
        expect(rellenarConCapa([{ page: 12, text: '12', md: '12' }], 12, capa).rellenadas).toContain(12);
    });
    it('una página omitida y en blanco también en el PDF lleva su marca: la medición no la cuenta ausente', () => {
        const capa = ['palabra '.repeat(60), '', 'palabra '.repeat(60)];
        const r = rellenarConCapa([{ page: 1, text: LEIDA, md: LEIDA }, { page: 3, text: LEIDA, md: LEIDA }], 3, capa);
        const u = unirPaginas(r.paginas);
        expect(u.markdown).toContain('<!-- page: 2 -->');
        expect(medirTexto(u.markdown, 3, capa.map(c => c.replace(/\s/g, '').length)).paginasFaltantes.total).toBe(0);
    });
});

describe('sinPaginas (lote biblioteca2, 2026-10-17)', () => {
    it('quita las páginas abandonadas de lo que falta y reagrupa', () => {
        expect(sinPaginas([{ desde: 3, hasta: 7 }, { desde: 10, hasta: 10 }], new Set([4, 5, 10]))).toEqual([{ desde: 3, hasta: 3 }, { desde: 6, hasta: 7 }]);
        expect(sinPaginas([{ desde: 1, hasta: 2 }], new Set([1, 2]))).toEqual([]);
    });
});
