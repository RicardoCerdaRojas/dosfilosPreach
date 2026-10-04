/**
 * Lo que la hoja impresa dice del sermón además de su texto: quién lo predica,
 * a qué serie pertenece y cómo se llama el archivo.
 *
 * El autor: los sermones nacen con `authorName: 'Pastor'` (el wizard no conoce
 * el nombre), y así salía en el documento. Ese valor es un relleno, no un
 * nombre: si el pastor no escribió otro, vale el nombre de su cuenta; si
 * tampoco hay, la hoja no nombra a nadie.
 */
export const AUTHOR_PLACEHOLDER = 'Pastor';

export interface SermonPrintOptions {
    /** Quién lo predica; `null` para no nombrar a nadie. */
    author?: string | null;
    /** El título de la serie, si el sermón es parte de una. */
    series?: string | null;
}

export function sermonPrintAuthor(stored: string | null | undefined, accountName?: string | null): string | null {
    const propio = stored?.trim();
    if (propio && propio !== AUTHOR_PLACEHOLDER) return propio;
    return accountName?.trim() || null;
}

/** «Compasión temporal vs misericordia universal» → `compasion-temporal-vs-misericordia-universal`. */
export function sermonFileName(title: string, extension: 'pdf' | 'docx'): string {
    const base = title
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/, '');
    return `${base || 'sermon'}.${extension}`;
}
