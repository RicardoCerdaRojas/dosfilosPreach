/**
 * Lo que vale para toda consulta de la app (`main.tsx`).
 */

/**
 * Lo que se dejó de mirar sigue en caché media hora (no 5 minutos, el valor
 * por defecto): volver a una página después de un rato la muestra al tiempo
 * que la refresca, en vez de volver al esqueleto y descargar todo otra vez.
 */
export const QUERY_GC_TIME_MS = 30 * 60_000;

/**
 * Un permiso negado no se arregla reintentando: se reintentaba 3 veces con
 * espera creciente (~7 s) antes de mostrar nada. Pasó con el material del
 * proyecto, que no tenía regla en Firestore (fundador, 2026-10-29). El resto
 * de los fallos, como siempre: hasta 3 reintentos.
 */
export function queryRetry(failureCount: number, error: unknown): boolean {
    if ((error as { code?: string } | null)?.code === 'permission-denied') return false;
    return failureCount < 3;
}
