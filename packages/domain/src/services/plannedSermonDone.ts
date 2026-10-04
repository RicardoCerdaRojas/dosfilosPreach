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

/** Lo mínimo de un sermón publicado para enlazarlo con el plan. */
export interface PublishedLink {
    id: string;
    /** La copia publicada guarda acá el borrador del que salió. */
    sourceSermonId?: string;
    publishedAt?: Date;
    /** Cuántas veces se predicó ESTA copia. */
    timesPreached?: number;
}

/** Las copias publicadas de un borrador: el propio documento o las que apuntan a él. */
function copiesOf<T extends PublishedLink>(draftId: string, published: readonly T[]): T[] {
    // SÓLO `id` y `sourceSermonId`, como la web (findByDraftId). `versionOf`
    // NO: «crear versión» desde el borrador raíz deja `versionOf = borrador`
    // en la versión, y su copia publicada se tomaba por la del plan — el plan
    // de Jonás abría la versión «Retiro jóvenes» (revisión adversarial de A6).
    return published.filter((s) => s.id === draftId || s.sourceSermonId === draftId);
}

/**
 * El sermón publicado que corresponde a la perícopa del plan.
 *
 * El plan guarda el id del BORRADOR (`draftId`), y publicar crea una COPIA
 * con id propio que apunta al borrador en `sourceSermonId`. La tablet buscaba
 * el `draftId` entre los ids de las copias y no lo encontraba nunca: las
 * semanas del plan salían «sin escribir» y «Púlpito» deshabilitado aunque el
 * sermón estuviera publicado (mismo defecto que #728 en la web).
 *
 * Si se publicó varias veces, la copia más reciente. Recibe la lista ENTERA
 * de publicados, no la deduplicada por cadena de versiones de la pantalla de
 * sermones: esa ya descartó copias.
 */
export function publishedForDraft<T extends PublishedLink>(draftId: string, published: readonly T[]): T | undefined {
    let best: T | undefined;
    for (const s of copiesOf(draftId, published)) {
        if (!best || (s.publishedAt?.getTime() ?? 0) > (best.publishedAt?.getTime() ?? 0)) best = s;
    }
    return best;
}

/**
 * ¿Se predicó la perícopa? Cuenta TODAS las copias: republicar crea una copia
 * con el historial vacío, y mirar sólo la última hacía que una semana ya
 * predicada volviera a «sin predicar».
 */
export function timesPreachedForDraft<T extends PublishedLink>(draftId: string, published: readonly T[]): number {
    return copiesOf(draftId, published).reduce((n, s) => n + (s.timesPreached ?? 0), 0);
}
