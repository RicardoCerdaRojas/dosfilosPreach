/**
 * La clave de cita que se deriva del autor de un libro de la biblioteca.
 *
 * Vivía dentro de la pantalla de corpus y sólo corría al AGREGAR una fuente:
 * corregir después el autor del libro no recalculaba nada, y una fuente sin
 * autor quedaba sin clave y fuera de las citas sin aviso (Robertson, TP
 * Santiago 2:14-26). Ahora también la usa la tarjeta de la fuente para
 * proponerla. Heurística: el autor siempre puede retocar el resultado.
 *
 *   "Daniel B. Wallace"     → "Wallace"   (gana el último token)
 *   "Bauckham, Richard"     → "Bauckham"  (gana lo de antes de la coma)
 *   "Barrick & Busenitz"    → "Barrick"   (el primer autor)
 *   "Watson and Callan"     → "Watson"
 *   "deSilva"               → "deSilva"
 *   ""                      → ""          (quien llama lo omite)
 */
export function deriveCitationKeyFromAuthor(author: string | null | undefined): string {
    const trimmed = (author ?? '').trim();
    if (!trimmed) return '';
    const firstAuthor = trimmed.split(/\s+(?:&|and|y)\s+/i)[0]!.trim();
    if (firstAuthor.includes(',')) {
        const beforeComma = firstAuthor.split(',')[0]!.trim();
        if (beforeComma) return beforeComma;
    }
    const tokens = firstAuthor.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return firstAuthor;
    return tokens[tokens.length - 1]!;
}

/**
 * El título de la obra a partir de su rótulo, cuando la ficha no lo trae.
 *
 * El rótulo suele ser el nombre del archivo, y muchos traen la colección
 * pegada: «James — Baker Exegetical Commentary on the New Testament». Usado
 * entero como título, la cita salió «(McCartney, James — Baker Exegetical
 * Commentary on the New Testament, 173)» (TP Santiago 2:14-26). Sólo se corta
 * cuando lo que sigue a la raya tiene forma de colección; cualquier otro
 * rótulo queda como está.
 */
export function workTitleFromLabel(label: string): string {
    const partes = label.split(/\s+[—–]\s+/);
    if (partes.length < 2) return label.trim();
    const resto = partes.slice(1).join(' — ');
    const esColeccion = /commentary|comentario|series|serie|library|biblioteca|testament|testamento|exegetical|exeg[ée]tico/i.test(resto);
    return esColeccion && partes[0]!.trim().length >= 3 ? partes[0]!.trim() : label.trim();
}
