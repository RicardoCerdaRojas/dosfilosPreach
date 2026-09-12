/**
 * El estado de una extracción que avanza por rangos, y dónde vive lo que cada
 * rango produjo.
 *
 * La extracción larga dejó de ser una invocación: ahora es una CADENA de tareas
 * que puede durar más de una hora. Eso rompe dos supuestos que el código tenía
 * escritos en otras partes, y este módulo existe para sostenerlos:
 *
 * 1. «Un recurso en `processing` más viejo que 1 200 s está muerto»
 *    (`sweepStalledExtractions`). Con la cadena, un diccionario legítimo pasa
 *    ~83 minutos en `processing`. Lo que distingue vivo de muerto ya no es
 *    cuándo empezó, sino **cuándo avanzó por última vez**: el latido.
 * 2. «Si la invocación muere, se pierde todo». Ahora cada rango persiste lo
 *    suyo, así que un fallo cuesta ese rango y el reintento retoma.
 */

import type { Rango } from './planDeRangos';
import { nombreDeRango } from './planDeRangos';

/**
 * Cada cuánto, como máximo, un rango deja constancia de que sigue vivo.
 *
 * Un rango tarda ~200 s medidos, y `leerRangoPartiendoSiNoEntra` puede
 * partirlo y tardar bastante más. El latido se escribe al EMPEZAR y al
 * TERMINAR cada rango, así que el hueco máximo entre dos latidos es lo que
 * tarda el rango más lento.
 */
export const LATIDO_MAXIMO_SEGUNDOS = 1200;

export interface EstadoDeCorrida {
    /**
     * Identifica esta corrida concreta.
     *
     * Sin él, dos extracciones del mismo libro lanzadas con minutos de
     * diferencia escribirían sus rangos en el mismo lugar y se mezclarían: la
     * página 50 de una y la 50 de la otra, sin forma de saber cuál es cuál. Una
     * tarea cuyo `runId` ya no es el vigente se retira en silencio.
     */
    runId: string;
    totalPaginas: number;
    /** Tamaño de rango vigente. Cambia una vez, tras calibrar el primero. */
    tamano: number;
    /** Cuántas páginas distintas se llevan traídas, para mostrar avance. */
    paginasHechas: number;
    /** Último rango que terminó, como `«41-83»`. */
    ultimoRango: string | null;
}

/**
 * ¿Esta corrida sigue viva?
 *
 * PURA y con el reloj por parámetro, porque es la regla que decide si un
 * barrido automático mata trabajo ajeno. Una función así no puede depender de
 * `Date.now()` escondido: el caso que hay que poder probar es justamente el
 * límite.
 *
 * Sin latido se cae al arranque, que es el comportamiento anterior: un recurso
 * de antes de este cambio no tiene latido y se lo sigue juzgando como siempre.
 */
export function corridaSigueViva(
    latidoAt: Date | null,
    comienzoAt: Date | null,
    ahora: Date,
    maximoSegundos: number = LATIDO_MAXIMO_SEGUNDOS,
): boolean {
    const referencia = latidoAt ?? comienzoAt;
    // Sin ninguna fecha no se puede afirmar que esté muerta, y matar por
    // sospecha es el error inverso —y peor— del que este barrido corrige.
    if (!referencia) return true;
    return (ahora.getTime() - referencia.getTime()) / 1000 <= maximoSegundos;
}

/**
 * Dónde se guarda lo que produjo un rango.
 *
 * El `runId` va en la ruta para que los rangos de una corrida anterior no se
 * confundan con los de ésta. Y el nombre sale del rango, no de un contador:
 * así una tarea que reintenta puede preguntarse «¿lo mío ya está escrito?»
 * antes de volver a pagar la llamada al modelo.
 */
export function rutaDeRango(
    userId: string,
    resourceId: string,
    runId: string,
    rango: Rango,
): string {
    return `users/${userId}/library/${resourceId}/ranges/${runId}/${nombreDeRango(rango)}`;
}

/** Carpeta de todos los rangos de una corrida, para leerlos al ensamblar. */
export function carpetaDeRangos(userId: string, resourceId: string, runId: string): string {
    return `users/${userId}/library/${resourceId}/ranges/${runId}/`;
}

/** Una página tal como se guarda en el archivo de un rango. */
export interface PaginaGuardada {
    page: number;
    text: string;
    md?: string;
}

/**
 * Progreso legible para la interfaz.
 *
 * Se calcula acá y no en el cliente porque la interfaz no conoce el plan: sólo
 * ve el documento. Devolver el porcentaje ya hecho evita que cada pantalla
 * invente su propia cuenta.
 */
export function porcentajeDeAvance(estado: Pick<EstadoDeCorrida, 'paginasHechas' | 'totalPaginas'>): number {
    if (!estado.totalPaginas || estado.totalPaginas <= 0) return 0;
    const bruto = (estado.paginasHechas / estado.totalPaginas) * 100;
    // Nunca 100 antes de que el ensamblado haya escrito: un progreso que dice
    // «listo» sobre un libro que todavía no se guardó es la clase de optimismo
    // que ya nos costó caro en la tarjeta de recursos.
    return Math.max(0, Math.min(99, Math.round(bruto)));
}
