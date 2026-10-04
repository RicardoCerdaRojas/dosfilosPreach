/**
 * «Listo para el domingo» (C7): lo que falta para subir tranquilo, dicho en
 * el inicio y no descubierto en el púlpito.
 *
 * Sólo lo que la app puede saber y el pastor puede resolver desde acá:
 * - SIN CONEXIÓN: el sermón está en el maletín (no «probablemente en caché»).
 * - DURACIÓN: la fijó él, no es la estimación de las palabras.
 * - LECTURA: el pasaje del sermón se encontró en la Biblia de la app, así que
 *   la página de Lectura del atril va a tener texto. Si el pastor apagó esa
 *   página, o el sermón no cita pasaje, no hay nada que revisar.
 */
export type ReadinessKey = 'offline' | 'duration' | 'reading';

export interface ReadinessItem {
    key: ReadinessKey;
    done: boolean;
}

export interface ReadinessInput {
    offline: boolean;
    durationSet: boolean;
    /** La página de Lectura está encendida y el sermón cita algún pasaje. */
    readingWanted: boolean;
    /** El pasaje se encontró; `null` mientras se busca. */
    readingFound: boolean | null;
}

export function sundayReadiness({ offline, durationSet, readingWanted, readingFound }: ReadinessInput): ReadinessItem[] {
    const items: ReadinessItem[] = [
        { key: 'offline', done: offline },
        { key: 'duration', done: durationSet },
    ];
    // Mientras se busca el pasaje no se afirma nada: ni listo ni faltante.
    if (readingWanted && readingFound !== null) items.push({ key: 'reading', done: readingFound });
    return items;
}

export const isReady = (items: ReadinessItem[]) => items.every((item) => item.done);
