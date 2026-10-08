import { alignWordsToTokens, type StructureWord, type WordAnalysis } from '@dosfilos/domain';

/**
 * Palabra de la estructura (OSHB, sin ketiv) → palabra del análisis hebreo.
 * El análisis puede juntar dos tokens unidos por maqaf («אֶל־אֲשֶׁר»): se
 * alinea por esqueleto consonántico, igual que la reconciliación con morphhb.
 * Una palabra que no calza queda sin enlace (`undefined`), sin correr a las demás.
 */
export function alinearConAnalisis(
    analisis: readonly { hebrewText: string; morphemes?: WordAnalysis['morphemes'] }[],
    palabras: readonly StructureWord[],
): Array<number | undefined> {
    const out: Array<number | undefined> = new Array(palabras.length).fill(undefined);
    alignWordsToTokens(analisis as WordAnalysis[], palabras.map(w => ({ text: w.t }))).forEach((tramo, i) => {
        if (tramo) for (let k = 0; k < tramo.count; k++) out[tramo.start + k] = i;
    });
    return out;
}
