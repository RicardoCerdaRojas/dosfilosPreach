/**
 * La clave de cita que se deriva del autor de un libro de la biblioteca.
 *
 * Vivía dentro de la pantalla de corpus y sólo corría al AGREGAR una fuente:
 * corregir después el autor del libro no recalculaba nada, y una fuente sin
 * autor quedaba sin clave y fuera de las citas sin aviso (Robertson, TP
 * Santiago 2:14-26). Ahora también la usa la tarjeta de la fuente para
 * proponerla. Heurística: el autor siempre puede retocar el resultado.
 *
 *   "Daniel B. Wallace"              → "Wallace"
 *   "Bauckham, Richard"              → "Bauckham"
 *   "D. A. Carson & Douglas J. Moo"  → "Carson y Moo"   (TP #6: proponía «Carson»)
 *   "Hagner, Bock y Moo"             → "Hagner, Bock y Moo"
 *   cuatro o más                     → "Aland et al."
 *   "David A. de Silva"              → "de Silva"
 *   ""                               → ""   (quien llama lo omite)
 *
 * Una edición crítica se cita por su sigla, no por su editor: Nestle-Aland
 * proponía «Aland» (TP #6). Por eso también mira el título.
 */
export function deriveCitationKeyFromAuthor(
    author: string | null | undefined,
    title?: string | null,
    language: 'es' | 'en' = 'es',
): string {
    const sigla = criticalEditionSigla(author ?? '', title ?? '');
    if (sigla) return sigla;
    const apellidos = (author ?? '')
        .split(/\s*;\s*|\s+(?:&|and|y)\s+/i)
        .map(surnameOf)
        .filter(Boolean);
    const y = language === 'en' ? 'and' : 'y';
    if (apellidos.length === 0) return '';
    if (apellidos.length === 1) return apellidos[0]!;
    if (apellidos.length <= 3) return `${apellidos.slice(0, -1).join(', ')} ${y} ${apellidos[apellidos.length - 1]}`;
    return `${apellidos[0]} et al.`;
}

const PARTICULAS = new Set(['de', 'da', 'del', 'di', 'du', 'van', 'von', 'der', 'den', 'la', 'le']);

/** El apellido de UN autor: lo de antes de la coma, o el último nombre con su partícula. */
function surnameOf(raw: string): string {
    const limpio = raw.replace(/\(\s*eds?\.?\s*\)|\beds?\.$/gi, '').replace(/[,.\s]+$/, '').trim();
    if (!limpio) return '';
    if (limpio.includes(',')) return limpio.split(',')[0]!.trim();
    const tokens = limpio.split(/\s+/).filter(Boolean);
    let desde = tokens.length - 1;
    while (desde > 0 && PARTICULAS.has(tokens[desde - 1]!.toLowerCase())) desde--;
    return tokens.slice(desde).join(' ');
}

/**
 * La sigla con que se cita una edición crítica, o `null`.
 *
 * Sólo las que el gremio cita por sigla. El número de edición se toma del
 * título o del autor cuando está («28th edition», «NA27»); Nestle-Aland sin
 * número se propone como NA28, la edición vigente.
 */
function criticalEditionSigla(author: string, title: string): string | null {
    const todo = `${title} ${author}`;
    if (/novum\s+testamentum\s+graece|nestle[\s-]*aland/i.test(todo)) {
        const n = todo.match(/\bNA\s?(\d{2})\b/i)?.[1] ?? todo.match(/\b(2[5-9])(?:st|nd|rd|th|a|ª)?\b/)?.[1];
        return `NA${n ?? '28'}`;
    }
    if (/the\s+greek\s+new\s+testament/i.test(title) && /united\s+bible\s+societies|\bUBS/i.test(todo)) {
        const n = todo.match(/\bUBS\s?(\d)\b/i)?.[1] ?? todo.match(/\b([3-6])(?:st|nd|rd|th)\b/)?.[1];
        return `UBS${n ?? '5'}`;
    }
    if (/biblia\s+hebraica\s+stuttgartensia/i.test(todo)) return 'BHS';
    if (/biblia\s+hebraica\s+quinta/i.test(todo)) return 'BHQ';
    return null;
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
