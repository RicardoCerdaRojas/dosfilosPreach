/**
 * Si el `textContent` guardado de un recurso es el texto entero.
 *
 * La extracción lo guarda cortado por el tope de Firestore —800 KB en
 * `extractPdfWithGemini`, 900 KB en los otros caminos— y anota el largo real en
 * `characterCount`. El texto armado desde los fragmentos
 * indexados (E2) sirve para lo que quedó afuera, pero no es fiel: el
 * fragmentador deja fuera los encabezados, descarta cuerpos cortos y repite el
 * solapamiento entre piezas (revisión adversarial de E2). Por eso sólo se usa
 * cuando el guardado de verdad está cortado.
 */
export const TEXT_CONTENT_MAX_BYTES = 800_000;

export function textContentIsComplete(textContent: string | null | undefined, characterCount?: number | null): boolean {
    if (!textContent) return false;
    if (typeof characterCount === 'number' && characterCount > 0) return textContent.length >= characterCount;
    // Recursos viejos sin conteo: puede estar cortado si pasa el tope más chico
    // de los caminos (con margen por el recorte en límite de carácter).
    return new TextEncoder().encode(textContent).length < TEXT_CONTENT_MAX_BYTES - 4;
}
