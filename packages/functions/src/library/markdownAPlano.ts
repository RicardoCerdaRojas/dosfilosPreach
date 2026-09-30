/**
 * Texto plano a partir del markdown de una página.
 *
 * La extracción por visión pedía cada página dos veces —`text` y `md`—, que es
 * el mismo contenido: duplicaba la salida que se paga y adelantaba el corte por
 * MAX_TOKENS. Ahora el modelo devuelve sólo el markdown y el texto plano se
 * deriva acá, gratis.
 *
 * Quita el MARCADO y nada más. Un solo carácter del contenido que se pierda acá
 * —una vocal hebrea, un espíritu griego, un asterisco que era del autor— es
 * texto que la búsqueda y las citas ya no encuentran, así que ante la duda se
 * deja: el texto plano sirve para vistas previas y el censo de escrituras, no
 * para reconstruir la página.
 */
export function markdownAPlano(md: string): string {
    return (md ?? '')
        .split('\n')
        // Filas separadoras de tabla: `|---|:---:|`.
        .filter((linea) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(linea))
        .map((linea) => linea
            // Encabezados y citas al principio del renglón.
            .replace(/^\s{0,3}#{1,6}\s+/, '')
            .replace(/^\s{0,3}>\s?/, '')
            // Viñetas.
            .replace(/^(\s*)[-*+]\s+/, '$1')
            // Celdas de tabla: los bordes se van, las divisiones quedan como separación.
            .replace(/^\s*\|\s*/, '')
            .replace(/\s*\|\s*$/, '')
            .replace(/\s*\|\s*/g, '  ')
            // Negrita y cursiva sólo cuando envuelven una palabra: un `*` suelto
            // puede ser del autor (una nota, un lema reconstruido).
            .replace(/(\*\*|__)(?=\S)([^*_\n]+?)(?<=\S)\1/g, '$2')
            .replace(/(^|[\s(])[*_](?=\S)([^*_\n]+?)(?<=\S)[*_](?=[\s).,;:!?]|$)/g, '$1$2'))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
