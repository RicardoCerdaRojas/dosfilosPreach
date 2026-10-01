import type { Sermon } from '../entities/Sermon';

/**
 * Si el borrador de una perícopa del plan ya está terminado.
 *
 * La regla vieja era «el asistente llegó al paso 4», y el asistente tiene los
 * pasos 0 a 3: ningún borrador terminaba nunca por sí solo. Publicar crea una
 * copia aparte y anota la publicación en el borrador (`publishedCopyId`,
 * `lastPublishedAt`), pero el plan no lo miraba. En la serie de Jonás, tres
 * sermones publicados figuraban como «Borrador» (2026-10-01).
 *
 * Terminado es cualquiera de:
 *  - publicado desde el asistente (la marca que deja la copia publicada);
 *  - el propio documento está publicado;
 *  - marcado a mano desde el plan (`markedCompleteAt`, o el `currentStep >= 4`
 *    que escribía la marca anterior);
 *  - un sermón sin asistente (anterior a él) que ya tiene contenido.
 */
export function isPlannedSermonDone(
    draft: Pick<Sermon, 'status' | 'content' | 'wizardProgress'>,
): boolean {
    const wp = draft.wizardProgress;
    if (draft.status === 'published') return true;
    if (wp?.publishedCopyId || wp?.lastPublishedAt) return true;
    if (wp?.markedCompleteAt) return true;
    if (wp && wp.currentStep >= 4) return true;
    return !wp && (draft.content?.length ?? 0) > 100;
}
