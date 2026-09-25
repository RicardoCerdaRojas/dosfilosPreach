import type { ExegeticalStepVersion } from '../entities/ExegeticalStep';

/**
 * Cuántas versiones se guardan por paso.
 *
 * Cinco, y el número sale de medir los 224 pasos que hay en producción:
 *
 *   0 versiones → 48 pasos      3 → 7
 *   1           → 150           4 → 3
 *   2           → 10            5 → 4
 *                              11 → 1
 *                              13 → 1
 *
 * Con tope cinco, 218 de los 224 pasos no cambian en nada. Los dos que
 * recorta son justamente los que inflan el documento: el trabajo de Santiago
 * 2:1-13 pesa 932 KB, de los cuales 313 KB son 25 versiones guardadas, y el
 * límite duro de un documento de Firestore es 1 MB. A 91% del tope, la
 * próxima regeneración podía dejar el trabajo inmodificable —no lento:
 * imposible de escribir—.
 */
export const MAX_STEP_VERSIONS = 5;

/**
 * El historial de un paso, recortado a lo último.
 *
 * NUNCA suelta la versión aceptada ni la actual, aunque queden fuera del
 * tope. Son las dos que el documento y la pantalla están usando: perderlas no
 * es perder historia, es romper el trabajo. Un paso puede entonces guardar más
 * de `max` versiones, y eso está bien —el tope acota el crecimiento, no
 * promete un número exacto—.
 */
export function trimStepVersions(
    versions: ReadonlyArray<ExegeticalStepVersion>,
    keepIds: ReadonlyArray<string | null | undefined>,
    max: number = MAX_STEP_VERSIONS,
): ExegeticalStepVersion[] {
    if (versions.length <= max) return [...versions];

    const obligadas = new Set(keepIds.filter((id): id is string => !!id));
    // Se recorta por el PRINCIPIO: lo último escrito es lo que el autor está
    // mirando, y lo primero es de lo que ya se alejó.
    const ultimas = new Set(versions.slice(-max).map(v => v.id));

    return versions.filter(v => ultimas.has(v.id) || obligadas.has(v.id));
}
