/**
 * La orquestación de un rango, separada de la nube para poder probarla entera.
 *
 * POR QUÉ EXISTE ESTE MÓDULO. Los dos defectos que rompieron la extracción en
 * cola el 12-09-2026 no estaban en ninguna de las piezas —`siguienteRango`,
 * `verificarCobertura` y la calibración tenían pruebas y todas pasaban—: estaban
 * en el CABLEADO, en quién le pasa qué valor a quién. El total de páginas se
 * leía del documento en vez de venir en la carga, llegaba `null`, y la cadena
 * terminaba tras el primer rango dando un libro de 392 páginas por completo con
 * 24.
 *
 * Es una lección que este repo ya tenía escrita, de las citas ancladas:
 * «el dominio tenía tests; el CABLEADO no, y ahí aparecieron todos los
 * defectos». Mientras la orquestación viviera dentro del cuerpo de un
 * `onTaskDispatched` no había forma de recorrerla sin la plataforma, y por eso
 * nadie la recorría.
 *
 * Acá las operaciones de entrada/salida son PUERTAS inyectadas. El disparador
 * las construye contra Firestore, Storage y Gemini; una prueba las construye en
 * memoria y hace correr la cadena completa —diecinueve rangos de un libro de
 * 392 páginas— en milisegundos y sin gastar un peso.
 */

import type { Rango } from './planDeRangos';
import { siguienteRango, planDeRangos } from './planDeRangos';
import { densidadDe, densidadDeReferencia, tamanoParaDensidad } from './calibrarTanda';
import { porcentajeDeAvance } from './corridaDeExtraccion';
import type { MuestraDeDensidad } from './geminiExtraction';

export interface CargaDeRango {
    resourceId: string;
    runId: string;
    /**
     * Cuántas páginas tiene el libro.
     *
     * Viaja en la CARGA y no se lee del documento. `pageCount` se escribe al
     * TERMINAR la extracción, así que en una subida nueva todavía no existe: la
     * tarea leía `null` y la cadena se cortaba en el primer rango.
     */
    totalPaginas: number;
    desde: number;
    hasta: number;
    tamano: number;
    /**
     * Densidad más alta (tokens por página) vista hasta aquí en este libro.
     *
     * Viaja entre tareas porque la cadena no tiene otra memoria: cada tarea
     * nace sabiendo sólo lo que le pasaron.
     */
    densidadMaxima?: number | null;
}

/** Lo mínimo del recurso que la orquestación necesita saber. */
export interface RecursoDeCorrida {
    userId: string;
    extractionRunId?: string;
}

export interface PuertasDeRango {
    leerRecurso(resourceId: string): Promise<RecursoDeCorrida | null>;
    latir(resourceId: string): Promise<void>;
    /** ¿Este rango ya quedó escrito por un intento anterior? */
    rangoYaEscrito(recurso: RecursoDeCorrida, carga: CargaDeRango, rango: Rango): Promise<boolean>;
    extraerRango(
        recurso: RecursoDeCorrida,
        carga: CargaDeRango,
        rango: Rango,
        laSiguienteRelee: boolean,
    ): Promise<{ paginas: Array<{ page: number }>; muestra: MuestraDeDensidad | null }>;
    guardarRango(
        recurso: RecursoDeCorrida,
        carga: CargaDeRango,
        rango: Rango,
        paginas: Array<{ page: number }>,
    ): Promise<void>;
    guardarTamano(resourceId: string, tamano: number): Promise<void>;
    guardarAvance(resourceId: string, avance: Avance): Promise<void>;
    encolar(carga: CargaDeRango): Promise<void>;
    /** Ensambla los rangos y deja el recurso listo. */
    terminar(recurso: RecursoDeCorrida, carga: CargaDeRango): Promise<void>;
}

export interface Avance {
    paginasHechas: number;
    totalPaginas: number;
    porcentaje: number;
    ultimoRango: string;
    rangosEstimados: number;
}

export type ResultadoDeRango =
    | { estado: 'siguiente'; rango: Rango; tamano: number }
    | { estado: 'terminado'; paginas: number }
    | { estado: 'descartado'; motivo: string };

/**
 * Procesa un rango y decide qué sigue: encolar el siguiente, o ensamblar.
 *
 * Devuelve qué hizo en vez de no devolver nada, para que una prueba pueda
 * recorrer la cadena entera sin espiar registros ni efectos secundarios.
 */
export async function procesarRango(
    puertas: PuertasDeRango,
    carga: CargaDeRango,
): Promise<ResultadoDeRango> {
    const { resourceId, runId, desde, hasta, tamano, totalPaginas } = carga;

    // La carga es lo ÚNICO que la cadena recuerda. Si viene incompleta no se
    // puede avanzar, y avanzar a medias fue exactamente el defecto: sin total,
    // la cadena creía haber terminado.
    if (!resourceId || !runId || !desde || !hasta || !tamano) {
        return { estado: 'descartado', motivo: 'carga incompleta' };
    }
    if (!Number.isFinite(totalPaginas) || totalPaginas <= 0) {
        return { estado: 'descartado', motivo: 'la carga no dice cuántas páginas tiene el libro' };
    }

    const recurso = await puertas.leerRecurso(resourceId);
    if (!recurso) return { estado: 'descartado', motivo: 'el recurso ya no existe' };

    // Una corrida vieja no debe seguir escribiendo sobre una nueva.
    if (recurso.extractionRunId !== runId) {
        return { estado: 'descartado', motivo: 'la corrida ya no es la vigente' };
    }

    await puertas.latir(resourceId);

    const rango: Rango = { desde, hasta };
    let tamanoParaElResto = tamano;
    let densidadParaElResto = carga.densidadMaxima ?? null;

    // Cloud Tasks reintenta. Una tarea que murió DESPUÉS de escribir su rango
    // no vuelve a pagar la llamada al modelo.
    if (!(await puertas.rangoYaEscrito(recurso, carga, rango))) {
        const { paginas, muestra } = await puertas.extraerRango(
            recurso, carga, rango, hasta < totalPaginas,
        );
        await puertas.guardarRango(recurso, carga, rango, paginas);

        // La densidad se remide en CADA rango. El principio de un libro son
        // portadilla, créditos e índice: medido sobre Sasson, sus primeras 24
        // páginas dieron 611 tokens/página y su cuerpo 1 555.
        const referencia = densidadDeReferencia(
            densidadParaElResto,
            muestra ? densidadDe(muestra.tokensDeSalida, muestra.paginas) : null,
        );
        if (referencia !== null && referencia !== densidadParaElResto) {
            densidadParaElResto = referencia;
            tamanoParaElResto = tamanoParaDensidad(referencia);
            // Se guarda AHORA y no al final: un corte por tiempo perdía también
            // lo medido, y el reintento volvía a arrancar conservador.
            await puertas.guardarTamano(resourceId, tamanoParaElResto);
        }
    }

    const plan = planDeRangos(totalPaginas, tamanoParaElResto);
    await puertas.guardarAvance(resourceId, {
        paginasHechas: hasta,
        totalPaginas,
        porcentaje: porcentajeDeAvance({ paginasHechas: hasta, totalPaginas }),
        ultimoRango: `${desde}-${hasta}`,
        rangosEstimados: plan.length,
    });

    const siguiente = siguienteRango(hasta, tamanoParaElResto, totalPaginas);
    if (siguiente) {
        await puertas.encolar({
            resourceId, runId, totalPaginas,
            desde: siguiente.desde, hasta: siguiente.hasta,
            tamano: tamanoParaElResto,
            densidadMaxima: densidadParaElResto,
        });
        return { estado: 'siguiente', rango: siguiente, tamano: tamanoParaElResto };
    }

    // Quien acaba de ver que no hay rango siguiente es quien sabe que el libro
    // está completo. Preguntárselo a otro agrega una espera y un punto de fallo.
    await puertas.terminar(recurso, carga);
    return { estado: 'terminado', paginas: hasta };
}
