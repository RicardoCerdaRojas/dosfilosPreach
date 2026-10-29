/**
 * Título del libro y autor, bajo el rótulo de la fuente.
 *
 * TP #9 (B19): la cabecera del visor decía sólo el rótulo que el estudiante
 * escribió al subir el libro («Tuggy Léxico», «NA28»), sin el autor. El autor
 * sale del recurso de la biblioteca; si no lo trae, no se muestra nada.
 *
 * El título del recurso se agrega sólo si dice algo que el rótulo no dice:
 * repetir «The Letter of James» debajo de «The Letter of James» es ruido.
 */
export function subtituloDelLibro(
    label: string,
    title: string | null | undefined,
    author: string | null | undefined,
): string | null {
    const parts: string[] = [];
    const titulo = title?.trim();
    if (titulo && !seRepite(label, titulo)) parts.push(titulo);
    const autor = author?.trim();
    if (autor) parts.push(autor);
    return parts.length > 0 ? parts.join(' · ') : null;
}

/** Uno contiene al otro, sin tildes ni mayúsculas. */
function seRepite(a: string, b: string): boolean {
    const x = plegar(a);
    const y = plegar(b);
    return !!x && !!y && (x.includes(y) || y.includes(x));
}

function plegar(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
