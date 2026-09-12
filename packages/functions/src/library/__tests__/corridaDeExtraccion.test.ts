import { describe, it, expect } from 'vitest';
import {
    corridaSigueViva,
    rutaDeRango,
    carpetaDeRangos,
    porcentajeDeAvance,
    LATIDO_MAXIMO_SEGUNDOS,
} from '../corridaDeExtraccion';
import { isStalledExtraction, STALLED_AFTER_SECONDS } from '../sweepStalledExtractions';
import { ordenarPorPaginaInicial } from '../ensamblarExtraccion';

const enSegundos = (base: Date, s: number) => new Date(base.getTime() + s * 1000);
const T0 = new Date('2026-09-11T12:00:00Z');

/**
 * LA CONTRADICCIÓN QUE ESTE PR TENÍA QUE RESOLVER, y que apareció leyendo el
 * diseño antes de escribirlo —`docs/REVISION_ADVERSARIAL.md` §1, constantes
 * hermanas—.
 *
 * `sweepStalledExtractions` mata todo recurso en `processing` más viejo que
 * 1 200 s, con este razonamiento escrito en su comentario: «la invocación más
 * larga que existe hoy es el callable de reproceso, con 900 s de tope».
 *
 * La cola rompe ese supuesto. Un diccionario de 1 006 páginas son ~25 rangos de
 * ~200 s: **83 minutos en `processing`, avanzando perfectamente**. Juzgado por
 * la hora de arranque, el barrido lo mataría a los 20 minutos.
 */
describe('el barrido y la cola no pueden contradecirse', () => {
    it('un libro que lleva 80 minutos pero acaba de avanzar NO está colgado', () => {
        const ochentaMinutos = enSegundos(T0, 80 * 60);
        expect(
            isStalledExtraction(
                {
                    processingStartedAt: T0,
                    extractionHeartbeatAt: enSegundos(ochentaMinutos, -60),
                },
                ochentaMinutos,
            ),
        ).toBe(false);
    });

    it('un libro que arrancó recién pero dejó de latir SÍ está colgado', () => {
        // La cadena se cortó: nadie encoló al siguiente. Eso es lo que hay que
        // detectar, y la hora de arranque no lo dice.
        const ahora = enSegundos(T0, STALLED_AFTER_SECONDS + 60);
        expect(
            isStalledExtraction(
                { processingStartedAt: T0, extractionHeartbeatAt: T0 },
                ahora,
            ),
        ).toBe(true);
    });

    it('un recurso anterior a la cola se sigue juzgando como antes', () => {
        // Sin latido, el respaldo es el arranque: el comportamiento viejo, para
        // los recursos que nunca van a tener latido.
        expect(isStalledExtraction({ processingStartedAt: T0 }, enSegundos(T0, 100))).toBe(false);
        expect(
            isStalledExtraction({ processingStartedAt: T0 }, enSegundos(T0, STALLED_AFTER_SECONDS + 1)),
        ).toBe(true);
    });

    it('sin ninguna fecha no se mata: matar por sospecha es el error inverso', () => {
        expect(isStalledExtraction({}, T0)).toBe(false);
    });
});

describe('corridaSigueViva', () => {
    it('el límite es el latido máximo, no la edad de la corrida', () => {
        expect(corridaSigueViva(T0, null, enSegundos(T0, LATIDO_MAXIMO_SEGUNDOS))).toBe(true);
        expect(corridaSigueViva(T0, null, enSegundos(T0, LATIDO_MAXIMO_SEGUNDOS + 1))).toBe(false);
    });

    it('sin fechas se la da por viva', () => {
        expect(corridaSigueViva(null, null, T0)).toBe(true);
    });
});

describe('rutaDeRango', () => {
    /**
     * El `runId` en la ruta es lo que impide que una corrida vieja contamine a
     * la nueva. Sin él, dos extracciones del mismo libro lanzadas con minutos
     * de diferencia escribirían la página 50 en el mismo archivo.
     */
    it('separa las corridas y nombra por el rango', () => {
        const a = rutaDeRango('u1', 'r1', 'corrida-A', { desde: 41, hasta: 83 });
        const b = rutaDeRango('u1', 'r1', 'corrida-B', { desde: 41, hasta: 83 });
        expect(a).not.toBe(b);
        expect(a).toContain('corrida-A/41-83.json');
        expect(a.startsWith(carpetaDeRangos('u1', 'r1', 'corrida-A'))).toBe(true);
    });

    it('el nombre es deducible, que es lo que hace idempotente el reintento', () => {
        // Una tarea que murió DESPUÉS de escribir debe poder preguntarse «¿lo
        // mío ya está?» sin leer un índice en ninguna parte.
        const r = { desde: 1, hasta: 24 };
        expect(rutaDeRango('u', 'res', 'run', r)).toBe(rutaDeRango('u', 'res', 'run', r));
    });
});

describe('ordenarPorPaginaInicial', () => {
    /**
     * El dedup del ensamblado conserva la ÚLTIMA copia de cada página, porque
     * en el rango posterior esa página cae al principio de la ventana, donde el
     * modelo lee mejor. Storage devuelve los archivos en orden ALFABÉTICO, y
     * ahí «121-163» va antes que «41-83»: leerlos así se quedaría con la copia
     * equivocada de cada página solapada.
     */
    it('ordena por número y no alfabéticamente', () => {
        const comoLosDevuelveStorage = [
            'p/121-163.json', 'p/1-43.json', 'p/161-170.json', 'p/41-83.json', 'p/81-123.json',
        ];
        expect(ordenarPorPaginaInicial(comoLosDevuelveStorage)).toEqual([
            'p/1-43.json', 'p/41-83.json', 'p/81-123.json', 'p/121-163.json', 'p/161-170.json',
        ]);
    });
});

describe('porcentajeDeAvance', () => {
    it('nunca llega a 100 antes de que el libro esté guardado', () => {
        // Un progreso que dice «listo» sobre un libro que todavía no se escribió
        // es la clase de optimismo que ya costó caro en la tarjeta de recursos.
        expect(porcentajeDeAvance({ paginasHechas: 170, totalPaginas: 170 })).toBe(99);
    });

    it('cifras imposibles no producen porcentajes imposibles', () => {
        expect(porcentajeDeAvance({ paginasHechas: 0, totalPaginas: 0 })).toBe(0);
        expect(porcentajeDeAvance({ paginasHechas: -5, totalPaginas: 100 })).toBe(0);
    });

    it('informa el avance real en el medio', () => {
        expect(porcentajeDeAvance({ paginasHechas: 83, totalPaginas: 170 })).toBe(49);
    });
});
