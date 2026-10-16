/**
 * Separa un texto en tramos por escritura, para dar al griego y al hebreo su
 * fuente propia (como en el resto de la plataforma): en «Consultar» el griego
 * de los extractos salía en la fuente de interfaz (rediseño, 2026-10-17).
 *
 * Un tramo de griego (o de hebreo) incluye los espacios y la puntuación que
 * hay ENTRE palabras de esa escritura, para que una frase entera quede en un
 * solo `<span>`; termina en una letra de la escritura.
 */

export type Escritura = 'griego' | 'hebreo' | null;

export interface Tramo {
    texto: string;
    escritura: Escritura;
}

const GRIEGO = '\\u0370-\\u03FF\\u1F00-\\u1FFF';
const HEBREO = '\\u0591-\\u05F4\\uFB1D-\\uFB4F';
const MARCAS = '\\u0300-\\u036F';
const ENTRE = "\\s·;,.:'’᾽ʼ\\-–—()\\[\\]";

const TRAMO = new RegExp(
    `([${GRIEGO}](?:[${GRIEGO}${MARCAS}${ENTRE}]*[${GRIEGO}${MARCAS}])?)|([${HEBREO}](?:[${HEBREO}${ENTRE}]*[${HEBREO}])?)`,
    'gu',
);

export function partirPorEscritura(texto: string): Tramo[] {
    const tramos: Tramo[] = [];
    let desde = 0;
    for (const m of texto.matchAll(TRAMO)) {
        const i = m.index ?? 0;
        if (i > desde) tramos.push({ texto: texto.slice(desde, i), escritura: null });
        tramos.push({ texto: m[0], escritura: m[1] !== undefined ? 'griego' : 'hebreo' });
        desde = i + m[0].length;
    }
    if (desde < texto.length) tramos.push({ texto: texto.slice(desde), escritura: null });
    return tramos;
}
