import { describe, expect, it } from 'vitest';
import {
    fallaAlCrearJob, latir, marcarArchivosBorrados, marcarGastoRegistrado, MAX_TRAMOS_POR_LOTE, rondasSinGasto, vigilarTareas,
    LATIDO_VENCIDO_MS, SIN_LATIDO_ABANDONAR_MS, SIN_LATIDO_REENCOLAR_MS,
    abandonarLibro, aplicarLectura, archivosParaBorrar, cancelar, emparejarRespuestas, leerRonda, nuevoLote,
    pedidosDeRonda, planearReintento, reclamarRonda, registrarJob, registrarLibro, registrarSubida, resumirLote,
    revisarTramosOk, soltarCandado, tomarCandado, VENCE_RECLAMO_MS, type Lote, type RespuestaCruda,
} from '../estadoDelLote';

const T0 = 1_000_000;
const archivo = (n: string) => ({ name: `files/${n}`, uri: `https://x/${n}` });
const texto = (n: number) => `Contenido legible de la página ${n} con bastante texto para contar como leída.`;
const respuesta = (indice: number | null, paginas: number[], extra: Partial<RespuestaCruda> = {}): RespuestaCruda => ({
    metadata: indice === null ? null : { tramo: String(indice) },
    text: JSON.stringify({ pages: paginas.map(p => ({ page: p, md: texto(p) })) }),
    finishReason: 'STOP', error: null, entrada: 1000, salida: 500, ...extra,
});

function loteDeDos(): Lote {
    return nuevoLote({
        id: 'b6', dueno: 'u', creadoPor: 'admin', creadoPorEmail: 'a@x', estimadoUsd: 1, porTramo: 20, ahora: T0,
        libros: [{ rid: 'A', titulo: 'Libro A', uid: 'u' }, { rid: 'B', titulo: 'Libro B', uid: 'u' }],
    });
}

/** A con 2 tramos (1-20, 21-25), B con 1 (1-10); ronda 1 creada con su job. */
function loteEnCurso(): Lote {
    const l = loteDeDos();
    registrarLibro(l, 'A', { totalPaginas: 25, tramos: [{ desde: 1, hasta: 20, archivo: archivo('a1') }, { desde: 21, hasta: 25, archivo: archivo('a2') }] }, T0);
    registrarLibro(l, 'B', { totalPaginas: 10, tramos: [{ desde: 1, hasta: 10, archivo: archivo('b1') }] }, T0);
    reclamarRonda(l, 1, T0);
    registrarJob(l, 1, 'batches/1', [0, 1, 2], T0);
    return l;
}

describe('preparar y abrir la ronda 1', () => {
    it('la ronda 1 se abre cuando el último libro termina, y una tarea repetida no duplica tramos', () => {
        const l = loteDeDos();
        expect(registrarLibro(l, 'A', { totalPaginas: 25, tramos: [{ desde: 1, hasta: 20, archivo: archivo('a1') }] }, T0)).toBe(true);
        expect(l.rondas).toHaveLength(0);
        expect(l.estado).toBe('preparando');
        expect(registrarLibro(l, 'A', { totalPaginas: 25, tramos: [{ desde: 1, hasta: 20, archivo: archivo('a1') }] }, T0)).toBe(false);
        expect(l.tramos).toHaveLength(1);
        registrarLibro(l, 'B', { saltado: 'el PDF pide contraseña para abrirse' }, T0);
        expect(l.rondas.map(r => r.numero)).toEqual([1]);
        expect(l.estado).toBe('en-curso');
        expect(l.libros[1]).toMatchObject({ estado: 'saltado', motivo: 'el PDF pide contraseña para abrirse' });
    });

    it('si ningún libro se pudo preparar, el lote falla en vez de esperar', () => {
        const l = loteDeDos();
        registrarLibro(l, 'A', { saltado: 'x' }, T0);
        registrarLibro(l, 'B', { saltado: 'y' }, T0);
        expect(l).toMatchObject({ estado: 'fallido', rondas: [] });
    });

    it('sólo uno reclama la ronda; el reclamo vence a los 15 minutos', () => {
        const l = loteDeDos();
        registrarLibro(l, 'A', { totalPaginas: 5, tramos: [{ desde: 1, hasta: 5, archivo: archivo('a1') }] }, T0);
        registrarLibro(l, 'B', { saltado: 'x' }, T0);
        expect(reclamarRonda(l, 1, T0)).toBe(true);
        expect(reclamarRonda(l, 1, T0 + 1000)).toBe(false);
        expect(reclamarRonda(l, 1, T0 + VENCE_RECLAMO_MS + 1)).toBe(true);
        expect(registrarJob(l, 1, 'batches/1', [0], T0)).toBe(true);
        expect(registrarJob(l, 1, 'batches/2', [0], T0)).toBe(false);
        expect(reclamarRonda(l, 1, T0 + 10 * VENCE_RECLAMO_MS)).toBe(false);
    });

    it('un lote cancelado no acepta libros ni reclamos', () => {
        const l = loteDeDos();
        cancelar(l, T0);
        expect(registrarLibro(l, 'A', { totalPaginas: 5, tramos: [{ desde: 1, hasta: 5, archivo: archivo('a1') }] }, T0)).toBe(false);
        expect(l.estado).toBe('cancelado');
    });
});

describe('emparejar las respuestas', () => {
    it('manda la marca del pedido, aunque vuelvan en otro orden', () => {
        const pares = emparejarRespuestas([0, 1, 2], [respuesta(2, [1]), respuesta(0, [1]), respuesta(1, [1])]);
        expect(pares.get(0)?.metadata?.tramo).toBe('0');
        expect(pares.get(2)?.metadata?.tramo).toBe('2');
    });
    it('sin marcas, por posición sólo contra lo que de verdad se envió', () => {
        const pares = emparejarRespuestas([4, 7], [respuesta(null, [1]), respuesta(null, [2])]);
        expect([...pares.keys()]).toEqual([4, 7]);
        expect(emparejarRespuestas([0, 1, 2], [respuesta(null, [1]), respuesta(null, [1])]).size).toBe(0);
    });
    it('una marca ajena (no enviada) o repetida no se usa', () => {
        const pares = emparejarRespuestas([0, 1], [respuesta(99, [1]), respuesta(2, [1]), respuesta(0, [1]), respuesta(0, [2])]);
        expect([...pares.keys()]).toEqual([0]);
    });
});

describe('leer una ronda', () => {
    it('ok, incompleto y fallo, cada uno a su tramo; el gasto se aplica una sola vez', () => {
        const l = loteEnCurso();
        const r = [
            respuesta(1, [1, 2, 3, 4, 5]),
            respuesta(0, Array.from({ length: 15 }, (_, i) => i + 1)),
            respuesta(2, [], { finishReason: 'MAX_TOKENS' }),
        ];
        const lectura = leerRonda(l, 1, 'JOB_STATE_SUCCEEDED', r);
        expect(lectura.entrada).toBe(3000);
        expect(aplicarLectura(l, 1, lectura, 0.25, T0)).toBe(true);
        expect(l.tramos.map(t => t.estado)).toEqual(['incompleto', 'ok', 'fallo']);
        expect(l.tramos[0]!.faltan).toEqual([{ desde: 16, hasta: 20 }]);
        expect(l.tramos[1]!.estado).toBe('ok');
        expect(lectura.paginas.get('A')!.map(p => p.page)).toContain(21);
        expect(l.uso).toEqual({ entrada: 3000, salida: 1500, usd: 0.25 });
        expect(aplicarLectura(l, 1, lectura, 0.25, T0)).toBe(false);
        expect(l.uso.usd).toBe(0.25);
        expect(l.estado).toBe('listo');
    });

    it('un job que terminó mal deja en fallo lo pendiente', () => {
        const l = loteEnCurso();
        aplicarLectura(l, 1, leerRonda(l, 1, 'JOB_STATE_EXPIRED', null), 0, T0);
        expect(l.tramos.every(t => t.estado === 'fallo' && /JOB_STATE_EXPIRED/.test(t.motivo!))).toBe(true);
    });

    it('revisar: un tramo ok con una página en blanco pasa a incompleto', () => {
        const l = loteEnCurso();
        l.tramos[2]!.estado = 'ok';
        const paginas = Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: i === 6 ? '' : texto(i + 1), md: i === 6 ? '' : texto(i + 1) }));
        expect(revisarTramosOk(l, 'B', paginas)).toBe(1);
        expect(l.tramos[2]).toMatchObject({ estado: 'incompleto', faltan: [{ desde: 7, hasta: 7 }] });
    });
});

describe('reintentar', () => {
    function listoConFallas(): Lote {
        const l = loteEnCurso();
        const r = [respuesta(0, Array.from({ length: 15 }, (_, i) => i + 1)), respuesta(1, [1, 2, 3, 4, 5]), respuesta(2, [], { error: { code: 500 } })];
        aplicarLectura(l, 1, leerRonda(l, 1, 'JOB_STATE_SUCCEEDED', r), 0, T0);
        return l;
    }

    it('no se reintenta con una ronda en curso', () => {
        expect(() => planearReintento(loteEnCurso(), new Map(), T0)).toThrow(/ronda en curso/);
    });

    it('incompleto pide lo que faltó; un fallo entero se parte en dos; abre la ronda 2 sin job', () => {
        const l = listoConFallas();
        const plan = planearReintento(l, new Map(), T0);
        expect(plan).toMatchObject({ ronda: 2, abandonadas: 0 });
        expect(plan.libros.sort()).toEqual(['A', 'B']);
        const nuevos = l.tramos.filter(t => t.ronda === 2).map(t => [t.rid, t.desde, t.hasta]);
        expect(nuevos).toEqual([['A', 16, 20], ['B', 1, 5], ['B', 6, 10]]);
        expect(l.tramos[0]!.estado).toBe('reemplazado');
        expect(l.rondas[1]).toMatchObject({ numero: 2, job: null, leida: false });
        expect(l.estado).toBe('en-curso');
        // Sin recortes subidos, la ronda no se reclama.
        expect(reclamarRonda(l, 2, T0)).toBe(false);
        registrarSubida(l, 2, l.tramos.filter(t => t.ronda === 2).map(t => ({ indice: t.indice, archivo: archivo(`r2-${t.indice}`) })), T0);
        expect(reclamarRonda(l, 2, T0)).toBe(true);
        expect(pedidosDeRonda(l, 2)).toHaveLength(3);
    });

    it('las páginas en blanco también en el PDF se abandonan sin pedirlas', () => {
        const l = listoConFallas();
        l.tramos[2]!.estado = 'ok';
        // Capa con texto en todas las páginas menos 16-20.
        const capa = Array.from({ length: 25 }, (_, i) => (i >= 15 && i < 20 ? 0 : 500));
        const plan = planearReintento(l, new Map([['A', capa]]), T0);
        expect(plan.ronda).toBeNull();
        expect(l.tramos[0]).toMatchObject({ estado: 'ok' });
        expect(l.tramos.filter(t => t.estado === 'abandonado')).toHaveLength(5);
    });

    it('una página sola que ya falló sola se abandona', () => {
        const l = listoConFallas();
        l.tramos[2]!.estado = 'ok';
        l.tramos[0]!.faltan = [{ desde: 18, hasta: 18 }];
        l.tramos[0]!.desde = 18; l.tramos[0]!.hasta = 18; l.tramos[0]!.intento = 2;
        const plan = planearReintento(l, new Map(), T0);
        expect(plan).toMatchObject({ ronda: null, abandonadas: 1 });
    });
});

describe('abandonar, cancelar, candado y resumen', () => {
    it('una tarea agotada en un reintento deja sus tramos en fallo; si la ronda queda vacía, se da por leída', () => {
        const l = loteEnCurso();
        aplicarLectura(l, 1, leerRonda(l, 1, 'JOB_STATE_FAILED', null), 0, T0);
        const plan = planearReintento(l, new Map(), T0);
        expect(plan.ronda).toBe(2);
        abandonarLibro(l, 'A', 2, 'no se pudo subir', T0);
        expect(l.rondas[1]!.leida).toBe(false);
        abandonarLibro(l, 'B', 2, 'no se pudo subir', T0);
        expect(l.rondas[1]).toMatchObject({ leida: true, estadoJob: 'SIN_PEDIDOS' });
        expect(l.estado).toBe('listo');
    });

    it('cancelar devuelve los jobs sin leer y libera sus recortes', () => {
        const l = loteEnCurso();
        expect(cancelar(l, T0).jobs).toEqual(['batches/1']);
        expect(archivosParaBorrar(l)).toEqual([{ ronda: 1, nombres: ['files/a1', 'files/a2', 'files/b1'] }]);
        expect(cancelar(l, T0).jobs).toEqual([]);
    });

    it('el candado es de uno a la vez y vence', () => {
        const l = loteEnCurso();
        expect(tomarCandado(l, 'sondeo', T0)).toBe(true);
        expect(tomarCandado(l, 'boton', T0 + 1)).toBe(false);
        expect(tomarCandado(l, 'boton', T0 + VENCE_RECLAMO_MS + 1)).toBe(true);
        soltarCandado(l, 'sondeo');
        expect(l.candado?.por).toBe('boton');
    });

    it('el resumen no lleva los recortes y dice qué botones valen', () => {
        const l = loteEnCurso();
        const r = resumirLote(l);
        expect(JSON.stringify(r)).not.toContain('files/');
        expect(r).toMatchObject({ paginas: 35, puedeReintentar: false, puedeCancelar: true });
        aplicarLectura(l, 1, leerRonda(l, 1, 'JOB_STATE_FAILED', null), 0, T0);
        expect(resumirLote(l)).toMatchObject({ estado: 'listo', puedeReintentar: true, puedeCancelar: false });
    });
});

describe('lo que quedó a medias (revisión adversarial)', () => {
    it('una tarea que dio señales y calla se abandona; sin señales, se reencola y después se abandona', () => {
        const l = loteDeDos();
        latir(l, 'A', 1, T0);
        expect(vigilarTareas(l, T0 + LATIDO_VENCIDO_MS - 1)).toEqual({ reencolar: [], abandonar: [] });
        const tarde = vigilarTareas(l, T0 + LATIDO_VENCIDO_MS + 1);
        expect(tarde.abandonar.map(a => a.rid)).toEqual(['A']);
        expect(tarde.reencolar).toEqual([]);
        expect(vigilarTareas(l, T0 + SIN_LATIDO_REENCOLAR_MS + 1).reencolar).toEqual([{ rid: 'B', ronda: 1 }]);
        expect(vigilarTareas(l, T0 + SIN_LATIDO_ABANDONAR_MS + 1).abandonar.map(a => a.rid)).toEqual(['A', 'B']);
        registrarLibro(l, 'B', { saltado: 'x' }, T0);
        expect(vigilarTareas(l, T0 + SIN_LATIDO_ABANDONAR_MS + 1).abandonar.map(a => a.rid)).toEqual(['A']);
    });

    it('crear el job falla tres veces: el lote falla con el error a la vista', () => {
        const l = loteDeDos();
        registrarLibro(l, 'A', { totalPaginas: 5, tramos: [{ desde: 1, hasta: 5, archivo: archivo('a1') }] }, T0);
        registrarLibro(l, 'B', { saltado: 'x' }, T0);
        for (let i = 0; i < 2; i++) {
            expect(reclamarRonda(l, 1, T0)).toBe(true);
            fallaAlCrearJob(l, 1, 'payload demasiado grande', T0);
            expect(l.estado).toBe('en-curso');
        }
        expect(reclamarRonda(l, 1, T0)).toBe(true);
        fallaAlCrearJob(l, 1, 'payload demasiado grande', T0);
        expect(l).toMatchObject({ estado: 'fallido', motivo: expect.stringContaining('payload demasiado grande') });
        expect(archivosParaBorrar(l)).toEqual([{ ronda: 1, nombres: ['files/a1'] }]);
    });

    it('un lote cancelado mientras se creaba el job no lo anota', () => {
        const l = loteDeDos();
        registrarLibro(l, 'A', { totalPaginas: 5, tramos: [{ desde: 1, hasta: 5, archivo: archivo('a1') }] }, T0);
        registrarLibro(l, 'B', { saltado: 'x' }, T0);
        reclamarRonda(l, 1, T0);
        cancelar(l, T0);
        expect(registrarJob(l, 1, 'batches/1', [0], T0)).toBe(false);
    });

    it('el tope de tramos se mira con el lote fresco', () => {
        const l = loteDeDos();
        const muchos = Array.from({ length: MAX_TRAMOS_POR_LOTE }, (_, i) => ({ desde: i + 1, hasta: i + 1, archivo: archivo(`a${i}`) }));
        registrarLibro(l, 'A', { totalPaginas: MAX_TRAMOS_POR_LOTE, tramos: muchos }, T0);
        registrarLibro(l, 'B', { totalPaginas: 1, tramos: [{ desde: 1, hasta: 1, archivo: archivo('b') }] }, T0);
        expect(l.libros[1]).toMatchObject({ estado: 'saltado', motivo: expect.stringContaining('no tiene lugar') });
    });

    it('el gasto de una ronda se marca una sola vez; los recortes borrados dejan de guardarse', () => {
        const l = loteEnCurso();
        aplicarLectura(l, 1, leerRonda(l, 1, 'JOB_STATE_FAILED', null), 0, T0);
        expect(rondasSinGasto(l).map(r => r.numero)).toEqual([1]);
        expect(marcarGastoRegistrado(l, 1)).toBe(true);
        expect(marcarGastoRegistrado(l, 1)).toBe(false);
        expect(rondasSinGasto(l)).toEqual([]);
        marcarArchivosBorrados(l, [1]);
        expect(l.tramos.every(t => t.archivo === null)).toBe(true);
    });

    it('un libro ya reemplazado no se vuelve a pedir al reintentar', () => {
        const l = loteEnCurso();
        aplicarLectura(l, 1, leerRonda(l, 1, 'JOB_STATE_FAILED', null), 0, T0);
        l.libros[0]!.aplicado = { fecha: T0, reemplazado: true, motivo: 'x' };
        expect(resumirLote(l).paginasConFallas).toBe(10);
        const plan = planearReintento(l, new Map(), T0);
        expect(plan.libros).toEqual(['B']);
    });
});
