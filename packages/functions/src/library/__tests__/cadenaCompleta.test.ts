import { describe, it, expect } from 'vitest';
import { procesarRango, type CargaDeRango, type PuertasDeRango, type RecursoDeCorrida } from '../procesarRango';
import { primerRango } from '../planDeRangos';
import { TANDA_INICIAL } from '../calibrarTanda';

/**
 * LA PRUEBA QUE FALTABA: la cadena ENTERA, de punta a punta.
 *
 * Los dos defectos que rompieron la extracción en cola el 12-09-2026 no estaban
 * en ninguna pieza. `siguienteRango`, `verificarCobertura` y la calibración
 * tenían pruebas y todas pasaban. Estaban en el CABLEADO —quién le pasa qué
 * valor a quién— y ninguna prueba miraba eso:
 *
 *     ⛓️ [Cola] …: 392 páginas en cola (~19 rangos)
 *     📦 [Rango] …: páginas 1-24 de null
 *     🧩 [Rango] …: 24 páginas de 1 rangos — listo
 *
 * Un libro de 392 páginas dado por completo con 24.
 *
 * Acá la cadena se recorre entera con puertas en memoria: cada `encolar` vuelve
 * como la carga del paso siguiente, igual que haría Cloud Tasks. Lo que se
 * comprueba no es una función, es el RECORRIDO: que avance, que cubra el libro
 * sin huecos y que termine una sola vez.
 */

/** Densidades reales de Sasson: su arranque liviano y su cuerpo. */
const PORTADA = 611;
const CUERPO = 1555;

interface Registro {
    rangosLeidos: Array<{ desde: number; hasta: number }>;
    paginasGuardadas: number[];
    encolados: CargaDeRango[];
    avances: number[];
    terminados: number;
    tamanosGuardados: number[];
}

/**
 * Puertas en memoria. `densidadPorPagina` deja simular un libro cuyo arranque
 * es más liviano que su cuerpo, que es el caso real que rompió la calibración.
 */
function fabricarPuertas(opciones: {
    recurso?: RecursoDeCorrida | null;
    densidadPorPagina?: (desde: number) => number;
    fallarEnRango?: number;
    yaEscritos?: Set<string>;
}): { puertas: PuertasDeRango; registro: Registro } {
    const registro: Registro = {
        rangosLeidos: [], paginasGuardadas: [], encolados: [],
        avances: [], terminados: 0, tamanosGuardados: [],
    };
    const recurso = opciones.recurso === undefined
        ? { userId: 'u1', extractionRunId: 'corrida-1' }
        : opciones.recurso;

    const puertas: PuertasDeRango = {
        async leerRecurso() { return recurso; },
        async latir() { /* el latido no cambia el recorrido */ },
        async rangoYaEscrito(_r, _c, rango) {
            return opciones.yaEscritos?.has(`${rango.desde}-${rango.hasta}`) ?? false;
        },
        async extraerRango(_r, _c, rango) {
            if (opciones.fallarEnRango === rango.desde) {
                throw new Error(`la API falló leyendo ${rango.desde}-${rango.hasta}`);
            }
            registro.rangosLeidos.push({ ...rango });
            const paginas = [];
            for (let p = rango.desde; p <= rango.hasta; p++) paginas.push({ page: p });
            const porPagina = opciones.densidadPorPagina?.(rango.desde) ?? CUERPO;
            return { paginas, muestra: { tokensDeSalida: porPagina * paginas.length, paginas: paginas.length } };
        },
        async guardarRango(_r, _c, _rango, paginas) {
            registro.paginasGuardadas.push(...paginas.map(p => p.page));
        },
        async guardarTamano(_id, tamano) { registro.tamanosGuardados.push(tamano); },
        async guardarAvance(_id, avance) { registro.avances.push(avance.porcentaje); },
        async encolar(carga) { registro.encolados.push(carga); },
        async terminar() { registro.terminados++; },
    };
    return { puertas, registro };
}

/** Hace correr la cadena como lo haría Cloud Tasks, hasta que termine. */
async function correrCadena(
    puertas: PuertasDeRango,
    primera: CargaDeRango,
    registro: Registro,
    topeDePasos = 200,
) {
    let carga: CargaDeRango | null = primera;
    let pasos = 0;
    let ultimo;
    while (carga) {
        if (++pasos > topeDePasos) throw new Error('la cadena no termina: posible bucle');
        const antes = registro.encolados.length;
        ultimo = await procesarRango(puertas, carga);
        carga = registro.encolados.length > antes ? registro.encolados[registro.encolados.length - 1]! : null;
    }
    return { pasos, ultimo };
}

const primeraCarga = (totalPaginas: number, tamano = TANDA_INICIAL): CargaDeRango => {
    const r = primerRango(tamano, totalPaginas)!;
    return {
        resourceId: 'res-1', runId: 'corrida-1', totalPaginas,
        desde: r.desde, hasta: r.hasta, tamano, densidadMaxima: null,
    };
};

describe('la cadena recorre el libro entero', () => {
    it('Sasson: 392 páginas, sin huecos, y termina UNA vez', async () => {
        const { puertas, registro } = fabricarPuertas({});
        const { pasos, ultimo } = await correrCadena(puertas, primeraCarga(392), registro);

        expect(ultimo).toEqual({ estado: 'terminado', paginas: 392 });
        expect(registro.terminados).toBe(1);
        expect(pasos).toBeGreaterThan(1);

        // Lo que de verdad importa: ninguna página del libro quedó sin leer.
        const cubiertas = new Set(registro.paginasGuardadas);
        for (let p = 1; p <= 392; p++) {
            expect(cubiertas.has(p), `falta la página ${p}`).toBe(true);
        }
        expect(Math.max(...registro.paginasGuardadas)).toBe(392);
    });

    /**
     * EL DEFECTO EXACTO DEL 12-09-2026. Con el total ausente, la cadena
     * terminaba tras el primer rango y el libro quedaba certificado con 24 de
     * sus 392 páginas — sin error y sin aviso.
     */
    it('sin total en la carga NO termina en falso: se descarta', async () => {
        const { puertas, registro } = fabricarPuertas({});
        const sinTotal = { ...primeraCarga(392), totalPaginas: null as unknown as number };

        const r = await procesarRango(puertas, sinTotal);
        expect(r.estado).toBe('descartado');
        // Y sobre todo: NO ensambló nada.
        expect(registro.terminados).toBe(0);
    });

    it('el total NO se lee del recurso: viaja en la carga', async () => {
        // El recurso no dice cuántas páginas tiene —es una subida nueva, donde
        // `pageCount` todavía no se escribió— y la cadena igual completa.
        const { puertas, registro } = fabricarPuertas({
            recurso: { userId: 'u1', extractionRunId: 'corrida-1' },
        });
        await correrCadena(puertas, primeraCarga(392), registro);
        expect(registro.terminados).toBe(1);
        expect(Math.max(...registro.paginasGuardadas)).toBe(392);
    });

    it('un libro que entra en un solo rango termina sin encolar nada', async () => {
        const { puertas, registro } = fabricarPuertas({});
        const { ultimo } = await correrCadena(puertas, primeraCarga(20), registro);
        expect(ultimo).toEqual({ estado: 'terminado', paginas: 20 });
        expect(registro.encolados).toHaveLength(0);
    });

    it('el avance crece y nunca dice 100 antes de guardar', async () => {
        const { puertas, registro } = fabricarPuertas({});
        await correrCadena(puertas, primeraCarga(392), registro);
        expect(registro.avances.length).toBeGreaterThan(1);
        expect(Math.max(...registro.avances)).toBeLessThanOrEqual(99);
        // Monótono: un avance que retrocede confunde más que no tenerlo.
        for (let i = 1; i < registro.avances.length; i++) {
            expect(registro.avances[i]!).toBeGreaterThanOrEqual(registro.avances[i - 1]!);
        }
    });
});

describe('la cadena se corrige al encontrar un tramo más denso', () => {
    it('el arranque liviano no fija el tamaño de todo el libro', async () => {
        // Primeras 24 páginas livianas —portada e índice—, el resto denso.
        const { puertas, registro } = fabricarPuertas({
            densidadPorPagina: (desde) => (desde <= 24 ? PORTADA : CUERPO),
        });
        await correrCadena(puertas, primeraCarga(392), registro);

        expect(registro.terminados).toBe(1);
        // El tamaño se achicó al ver el cuerpo, y nunca volvió a crecer.
        expect(registro.tamanosGuardados.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < registro.tamanosGuardados.length; i++) {
            expect(registro.tamanosGuardados[i]!).toBeLessThanOrEqual(registro.tamanosGuardados[i - 1]!);
        }
        // Y el libro salió entero igual.
        expect(Math.max(...registro.paginasGuardadas)).toBe(392);
    });
});

describe('la cadena no avanza sobre terreno que no le corresponde', () => {
    it('una corrida vieja se retira sin tocar nada', async () => {
        const { puertas, registro } = fabricarPuertas({
            recurso: { userId: 'u1', extractionRunId: 'otra-corrida' },
        });
        const r = await procesarRango(puertas, primeraCarga(392));
        expect(r).toEqual({ estado: 'descartado', motivo: 'la corrida ya no es la vigente' });
        expect(registro.encolados).toHaveLength(0);
        expect(registro.terminados).toBe(0);
    });

    it('un recurso borrado a mitad de camino corta la cadena', async () => {
        const { puertas, registro } = fabricarPuertas({ recurso: null });
        const r = await procesarRango(puertas, primeraCarga(392));
        expect(r.estado).toBe('descartado');
        expect(registro.terminados).toBe(0);
    });

    it('un rango que falla NO deja el libro dado por terminado', async () => {
        // Los rangos ya hechos se conservan; lo que no puede pasar es que el
        // fallo se convierta en un libro «completo» al que le falta un tramo.
        const { puertas, registro } = fabricarPuertas({ fallarEnRango: 22 });
        await expect(correrCadena(puertas, primeraCarga(392), registro)).rejects.toThrow();
        expect(registro.terminados).toBe(0);
    });

    it('un rango ya escrito no se vuelve a leer, pero la cadena sigue', async () => {
        // Idempotencia: el reintento de una tarea que murió DESPUÉS de escribir
        // no vuelve a pagar la llamada al modelo.
        const { puertas, registro } = fabricarPuertas({ yaEscritos: new Set(['1-24']) });
        await correrCadena(puertas, primeraCarga(392), registro);
        expect(registro.rangosLeidos.some(r => r.desde === 1)).toBe(false);
        expect(registro.terminados).toBe(1);
    });
});
