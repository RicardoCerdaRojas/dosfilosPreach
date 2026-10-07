import { proposeSortedAuthor, type BibliographicData } from '@dosfilos/domain';

/**
 * Lo que la biblioteca ya sabe del libro y a la ficha le falta: el autor y
 * el título de la tarjeta (TP #6: Wallace figuraba con autor en la
 * biblioteca y su ficha decía «falta autor»). Sólo llena huecos, y lo que
 * llena se marca para revisarlo: el título de la biblioteca a veces trae la
 * colección pegada.
 */
export function prefillFromLibrary(
    data: BibliographicData | null | undefined,
    resource: { author?: string | null; title?: string | null } | undefined,
): { values: Partial<Record<'author' | 'authorSorted' | 'title', string>>; fields: Array<'author' | 'authorSorted' | 'title'> } {
    const values: Partial<Record<'author' | 'authorSorted' | 'title', string>> = {};
    const author = resource?.author?.trim();
    const title = resource?.title?.trim();
    if (!data?.author?.trim() && author) {
        values.author = author;
        if (!data?.authorSorted?.trim()) values.authorSorted = proposeSortedAuthor(author);
    }
    if (!data?.title?.trim() && title) values.title = title;
    return { values, fields: Object.keys(values) as Array<'author' | 'authorSorted' | 'title'> };
}
