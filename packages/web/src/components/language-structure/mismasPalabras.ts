import type { StructureWord } from '@dosfilos/domain';

/** Sin puntuación, marcas del aparato ni diferencias de composición Unicode. */
const normal = (t: string) => t.normalize('NFC').replace(/[\s.,;·:’'"“”‘—⸀-⸏\d⸀-⸅]/g, '');

/**
 * ¿Los datos fijados (MACULA + MorphGNT por commit) y los tokens de la página
 * (MorphGNT cargado al vuelo) son el MISMO versículo, palabra por palabra? Sólo
 * entonces se enlazan sus posiciones. Comparar sólo la cantidad dejaba pasar
 * un texto distinto con el mismo número de palabras, o —por un instante al
 * cambiar de versículo— las reglas del nuevo sobre las palabras del anterior
 * (revisión de G2 + G3).
 */
export function mismasPalabras(datos: readonly StructureWord[], tokens: readonly { text: string }[] | undefined): boolean {
    if (!tokens || datos.length !== tokens.length || datos.length === 0) return false;
    return datos.every((w, i) => normal(w.t) === normal(tokens[i]!.text));
}
