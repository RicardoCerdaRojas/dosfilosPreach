import type { Sermon } from '../entities/Sermon';
import type { RAGSource } from '../entities/SermonGenerator';

/**
 * Si publicar otra vez un borrador crearía una copia distinta de la última.
 *
 * Re-publicar creaba una copia nueva cada vez, aunque nada hubiera cambiado:
 * en la serie de Jonás, 1:4-16 y 3:1-10 quedaron con dos copias publicadas
 * iguales (#2 del ejercicio). Decisión del fundador (2026-10-03): si la copia
 * sería distinta, se avisa que es una versión nueva y se crea; si no, no se
 * crea nada.
 *
 * Se comparan el título, el contenido y la bibliografía, que es lo que ve
 * quien abre el sermón publicado. Las fechas y los contadores no: cambian en
 * cada publicación por definición.
 */
export type PublicationChange = 'first' | 'changed' | 'unchanged';

type Published = Pick<Sermon, 'title' | 'content'> & { bibliography?: ReadonlyArray<RAGSource> | undefined };

const text = (s: string | undefined) =>
    (s ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(l => l.trimEnd())
        .join('\n')
        .trim();

const sources = (b: ReadonlyArray<RAGSource> | undefined) =>
    (b ?? [])
        // `ragSources` llega crudo del JSON del modelo: `page` puede venir como número.
        .map(s => [s.title, s.author, s.page].map(x => String(x ?? '').trim()).join('|'))
        .sort()
        .join('\n');

export function publicationChange(next: Published, last: Published | null | undefined): PublicationChange {
    if (!last) return 'first';
    const same =
        text(next.title) === text(last.title) &&
        text(next.content) === text(last.content) &&
        sources(next.bibliography) === sources(last.bibliography);
    return same ? 'unchanged' : 'changed';
}

/** Publicar sin cambios no crea copia: quien llama avisa y, si quiere, abre la que ya está. */
export class PublicationUnchangedError extends Error {
    constructor(public readonly copyId: string) {
        super('Sin cambios desde la última publicación');
        this.name = 'PublicationUnchangedError';
        Object.setPrototypeOf(this, PublicationUnchangedError.prototype);
    }
}
