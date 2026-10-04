import type { PreachingLog } from '@dosfilos/domain';

/**
 * El registro tal como se guarda en `preachingHistory`.
 *
 * Agregar (arrayUnion) y quitar (arrayRemove, el «Deshacer») tienen que
 * mandar EL MISMO objeto: arrayRemove compara el mapa entero. Eran dos copias
 * a mano de la lista de campos; si una sumaba un campo, Deshacer dejaba de
 * borrar sin avisar (revisión adversarial de A5).
 */
export function toFirestoreLog(log: PreachingLog): Record<string, unknown> {
    return {
        date: log.date,
        location: log.location,
        durationMinutes: log.durationMinutes,
        ...(log.notes ? { notes: log.notes } : {}),
    };
}
