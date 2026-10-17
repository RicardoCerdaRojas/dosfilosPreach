import { beforeAll, describe, expect, it } from 'vitest';
import type { Lote } from '../estadoDelLote';
import {
    abandonarLibroEnTarea, cancelarLote, crearJobSiToca, lanzarLote, procesarLibro, reintentarLote, sondearLote,
} from '../orquestarLote';
import { armar, lanzar, PLAZO, prepararPdfs, responder } from './fakesDelLote';

beforeAll(prepararPdfs);

describe('lanzar', () => {
    it('valida los libros y encola uno por libro', async () => {
        const x = armar();
        x.recurso('C', { userId: 'otro' });
        x.recurso('D', { textExtractionStatus: 'processing' });
        await expect(lanzar(x.d, ['A', 'C', 'D'])).rejects.toMatchObject({ codigo: 'failed-precondition', message: expect.stringMatching(/otra biblioteca.*se está extrayendo/) });
        await expect(lanzarLote(x.d, { nombre: 'Mal Nombre', dueno: 'u', ids: ['A'], estimadoUsd: 0, por: 'a', email: null })).rejects.toMatchObject({ codigo: 'invalid-argument' });
        expect(await lanzar(x.d)).toEqual({ id: 'b6', libros: 2 });
        expect(x.encolados).toEqual([{ loteId: 'b6', rid: 'A', ronda: 1 }, { loteId: 'b6', rid: 'B', ronda: 1 }]);
        await expect(lanzar(x.d)).rejects.toMatchObject({ codigo: 'already-exists' });
    });
});

describe('de punta a punta', () => {
    it('prepara, crea UN job con las marcas, recoge, cobra una vez y borra los recortes', async () => {
        const x = armar();
        await lanzar(x.d);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'A', ronda: 1 }, PLAZO);
        expect(x.g.jobs).toHaveLength(0);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        // Cloud Tasks repite la tarea de A: no sube ni crea nada más.
        await procesarLibro(x.d, { loteId: 'b6', rid: 'A', ronda: 1 }, PLAZO);
        expect(x.g.subidos).toHaveLength(3);
        // El nombre lleva la hora del lote: nunca choca con un job de la terminal (`reproceso-b6-r1`).
        expect(x.g.jobs).toEqual([{ nombre: `panel-b6-${x.lote().creado}-r1`, pedidos: [0, 1, 2].map(i => ({ indice: i, uri: `https://f/files/${i}` })) }]);
        expect(x.lote()).toMatchObject({ estado: 'en-curso', rondas: [{ numero: 1, job: 'batches/1' }] });
        expect(x.guardados.has('users/u/lotes/b6/A.capa.json')).toBe(true);

        // Todavía corriendo: nada cambia.
        expect(await sondearLote(x.d, 'b6', 's1')).toBe('hecho');
        expect(x.gastos).toHaveLength(0);

        x.g.estados.set('batches/1', {
            estado: 'JOB_STATE_SUCCEEDED',
            // En otro orden: se empareja por la marca.
            respuestas: [responder(2, Array.from({ length: 10 }, (_, i) => i + 1)), responder(0, Array.from({ length: 20 }, (_, i) => i + 1)), responder(1, [1, 2, 3])],
        });
        await sondearLote(x.d, 'b6', 's2');
        await sondearLote(x.d, 'b6', 's3');
        expect(x.gastos).toEqual([{ entrada: 6000, salida: 3000 }]);
        const l = x.lote();
        expect(l.tramos.map(t => t.estado)).toEqual(['ok', 'incompleto', 'ok']);
        expect(l.uso.usd).toBeCloseTo((6000 * 0.375 + 3000 * 1.875) / 1e6, 9);
        expect(l.estado).toBe('listo');
        expect(l.candado).toBeNull();
        expect(x.g.borrados.sort()).toEqual(['files/0', 'files/1', 'files/2']);
        expect(JSON.parse(x.guardados.get('users/u/lotes/b6/B.r1.json')!)).toHaveLength(10);

        // Reintentar: sólo A (páginas 24-25), una ronda 2 con su propio job.
        expect(await reintentarLote(x.d, 'b6', 'boton')).toEqual({ ronda: 2, libros: 1, abandonadas: 0 });
        expect(x.encolados.at(-1)).toEqual({ loteId: 'b6', rid: 'A', ronda: 2 });
        await procesarLibro(x.d, { loteId: 'b6', rid: 'A', ronda: 2 }, PLAZO);
        expect(x.g.jobs[1]).toEqual({ nombre: `panel-b6-${x.lote().creado}-r2`, pedidos: [{ indice: 3, uri: 'https://f/files/3' }] });
        expect(x.lote().tramos[3]).toMatchObject({ desde: 24, hasta: 25, ronda: 2 });
    });

    it('un job que quedó sin anotar se reusa en vez de crear otro', async () => {
        const x = armar();
        await lanzar(x.d, ['B']);
        x.g.huerfano = 'batches/huerfano';
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        expect(x.g.jobs).toHaveLength(0);
        expect(x.lote().rondas[0]!.job).toBe('batches/huerfano');
    });

    it('una tarea agotada salta el libro y la ronda sigue con el otro', async () => {
        const x = armar();
        await lanzar(x.d);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        await abandonarLibroEnTarea(x.d, { loteId: 'b6', rid: 'A', ronda: 1 }, 'no se pudo preparar: timeout');
        expect(x.lote().libros[0]).toMatchObject({ estado: 'saltado', motivo: 'no se pudo preparar: timeout' });
        expect(x.g.jobs).toHaveLength(1);
        expect(x.g.jobs[0]!.pedidos).toHaveLength(1);
    });

    it('un PDF cifrado de más de 60 MB se salta con el aviso', async () => {
        const grande = Buffer.concat([Buffer.alloc(61 * 1024 * 1024), Buffer.from('/Encrypt')]);
        const x = armar({ archivos: { 'users/u/a.pdf': grande } });
        await lanzar(x.d, ['A']);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'A', ronda: 1 }, PLAZO);
        expect(x.lote()).toMatchObject({ estado: 'fallido', libros: [{ estado: 'saltado', motivo: expect.stringMatching(/cifrado.*60 MB.*terminal/) }] });
        expect(x.g.subidos).toHaveLength(0);
    });

    it('cancelar cancela el job sin leer y borra sus recortes; las tareas que llegan después no hacen nada', async () => {
        const x = armar();
        await lanzar(x.d);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'A', ronda: 1 }, PLAZO);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        await cancelarLote(x.d, 'b6');
        expect(x.g.cancelados).toEqual(['batches/1']);
        expect(x.g.borrados).toHaveLength(3);
        expect(x.lote().estado).toBe('cancelado');
        await procesarLibro(x.d, { loteId: 'b6', rid: 'A', ronda: 1 }, PLAZO);
        expect(x.g.subidos).toHaveLength(3);
    });

    it('si otra ejecución leyó la ronda mientras ésta bajaba las respuestas, no se cobra otra vez', async () => {
        const x = armar();
        await lanzar(x.d, ['B']);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        x.d.gemini.verJob = async () => {
            const l = x.lote();
            Object.assign(l.rondas[0]!, { leida: true, gastoRegistrado: true, revisada: true });
            x.docs.set('admin_lotes/b6', l as unknown as Record<string, unknown>);
            return { estado: 'JOB_STATE_SUCCEEDED', respuestas: [responder(0, Array.from({ length: 10 }, (_, i) => i + 1))] };
        };
        await sondearLote(x.d, 'b6', 's1');
        expect(x.gastos).toEqual([]);
        expect(x.lote().uso.usd).toBe(0);
    });

    it('si crear el job falla tres veces, el lote falla y se borran sus recortes', async () => {
        const x = armar();
        await lanzar(x.d, ['B']);
        x.d.gemini.crearJob = async () => { throw new Error('payload demasiado grande'); };
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        expect(x.lote().estado).toBe('en-curso');
        const l = x.lote();
        // Dos intentos más fuera del sondeo (tareas que reclaman la ronda): tres fallos.
        for (let i = 0; i < 2; i++) await crearJobSiToca(x.d, 'b6', 1);
        expect(x.lote()).toMatchObject({ estado: 'fallido', motivo: expect.stringContaining('payload demasiado grande') });
        expect(x.g.borrados).toEqual(['files/0']);
        expect(l.rondas[0]!.job).toBeNull();
    });

    it('cancelado mientras se creaba el job: el job se cancela en Gemini', async () => {
        const x = armar();
        await lanzar(x.d, ['B']);
        const crear = x.d.gemini.crearJob;
        x.d.gemini.crearJob = async (n, p) => { await cancelarLote(x.d, 'b6'); return crear(n, p); };
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        expect(x.g.cancelados).toEqual(['batches/1']);
        expect(x.lote().rondas[0]!.job).toBeNull();
    });

    it('un sondeo que murió tras leer la ronda: el siguiente anota el gasto y revisa', async () => {
        const x = armar();
        await lanzar(x.d, ['B']);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        x.g.estados.set('batches/1', { estado: 'JOB_STATE_SUCCEEDED', respuestas: [responder(0, Array.from({ length: 10 }, (_, i) => i + 1))] });
        const registrar = x.d.registrarGasto;
        x.d.registrarGasto = async () => { throw new Error('el sondeo murió'); };
        await expect(sondearLote(x.d, 'b6', 's1')).rejects.toThrow('el sondeo murió');
        x.d.registrarGasto = registrar;
        expect(x.lote().rondas[0]).toMatchObject({ leida: true, gastoRegistrado: true, revisada: false });
        await sondearLote(x.d, 'b6', 's2');
        // Se marcó antes de anotar: se pierde esa anotación, nunca se duplica.
        expect(x.gastos).toEqual([]);
        expect(x.lote().rondas[0]!.revisada).toBe(true);
    });

    it('una tarea que murió sin avisar: el sondeo abandona el libro y la ronda sigue con el otro', async () => {
        const x = armar();
        await lanzar(x.d);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        const l = x.lote();
        l.latidos['A:1'] = -100_000_000;
        x.docs.set('admin_lotes/b6', l as unknown as Record<string, unknown>);
        await sondearLote(x.d, 'b6', 's1');
        expect(x.lote().libros[0]).toMatchObject({ estado: 'saltado', motivo: expect.stringContaining('dejó de responder') });
        expect(x.g.jobs).toHaveLength(1);
    });

    it('el sondeo no corre si otro tiene el candado', async () => {
        const x = armar();
        await lanzar(x.d, ['B']);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        const l = x.lote();
        l.candado = { hasta: Number.MAX_SAFE_INTEGER, por: 'otro' };
        x.docs.set('admin_lotes/b6', l as unknown as Record<string, unknown>);
        expect(await sondearLote(x.d, 'b6', 's1')).toBe('ocupado');
        await expect(reintentarLote(x.d, 'b6', 'boton')).rejects.toMatchObject({ codigo: 'failed-precondition' });
    });
});
