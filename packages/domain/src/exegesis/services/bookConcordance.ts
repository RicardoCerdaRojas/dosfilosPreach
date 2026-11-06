import type { PassageReference } from '../../bible/canon/passage-reference';
import type { GreekPos, GreekVerseTokens } from '../../greek-analyzer/morphGntToken';
import { pericopeContextRange } from './pericopeContext';

/**
 * Las clases de palabra que cuentan como contenido. Artículos, pronombres,
 * preposiciones y partículas aparecen en casi todos los versículos: su
 * concordancia sería el libro entero y no diría nada del argumento.
 */
const CLASES_DE_CONTENIDO: ReadonlySet<GreekPos> = new Set<GreekPos>(['N', 'A', 'V']);

/**
 * Hasta cuántos versículos del libro puede aparecer un lema para entrar.
 *
 * Ocho, porque así se midió la compuerta R (`docs/FASE_DEL_CORPUS_AL_TEXTO_2026-11.md`,
 * §6 bis): con ese tope, 5:3 trajo θησαυρίζω y 5:6 trajo los vínculos con 2:6.
 * Un lema más frecuente es vocabulario común del libro, no un eco.
 */
export const MAX_APARICIONES_EN_EL_LIBRO = 8;

/** Una aparición del lema fuera del pasaje del trabajo. */
export interface ConcordanceOccurrence {
    readonly chapter: number;
    readonly verse: number;
    /** El versículo entero, en griego: el analizador tiene que poder leerlo. */
    readonly text: string;
}

export interface ConcordanceEntry {
    readonly lemma: string;
    /** `true` si el lema está en el versículo analizado; `false` si solo en el resto del entorno. */
    readonly inVerse: boolean;
    readonly occurrences: ReadonlyArray<ConcordanceOccurrence>;
}

/**
 * La concordancia interna del libro para un versículo: los lemas de contenido
 * poco frecuentes del versículo y del pasaje, con sus otras apariciones en el
 * mismo libro.
 *
 * Es un cálculo sobre MorphGNT, no una deducción del modelo. Existe porque la
 * devolución del TP #10 corrigió 5:6 por no apoyarse en 5:4–5 y 2:6, y 5:3 por
 * no responder que θησαυρίζω puede ir sin objeto: la evidencia estaba en el
 * mismo libro y el analizador no la tenía delante. Con esta lista, la compuerta
 * R pasó (3 de 3 en 5:6, junto con la regla de vecinos de la prosa).
 *
 * Solo griego: el hebreo de OSHB trae lema por palabra, pero ninguna compuerta
 * lo midió.
 *
 * Las apariciones que el analizador ya ve en el texto del entorno
 * (`pericopeContextRange`: ±4 versículos, dentro del pasaje y del capítulo) se
 * dejan fuera. Las del resto del pasaje SÍ entran: en un pasaje de 4:13–5:20,
 * 5:12 no está en el entorno de 5:3 y el analizador no la vería.
 */
export function buildBookConcordance(input: {
    /** El libro entero, versículo por versículo. */
    readonly book: ReadonlyArray<GreekVerseTokens>;
    readonly verseRef: PassageReference;
    readonly paperPassage: PassageReference;
}): ConcordanceEntry[] {
    const { book, verseRef, paperPassage } = input;
    const apariciones = new Map<string, GreekVerseTokens[]>();
    for (const v of book) {
        for (const lema of lemasDeContenido(v)) {
            const lista = apariciones.get(lema) ?? [];
            lista.push(v);
            apariciones.set(lema, lista);
        }
    }

    const enVersiculo = (v: GreekVerseTokens) => dentro(v.reference, verseRef);
    const entorno = pericopeContextRange(paperPassage, verseRef);
    const visible = (v: GreekVerseTokens) => enVersiculo(v)
        || (v.reference.chapter === verseRef.chapterStart && v.reference.verse >= entorno.from && v.reference.verse <= entorno.to);
    const propios = new Set(book.filter(enVersiculo).flatMap(lemasDeContenido));
    const delPasaje = new Set(book.filter(visible).flatMap(lemasDeContenido));

    const entrada = (lemma: string, inVerse: boolean): ConcordanceEntry | null => {
        const todas = apariciones.get(lemma) ?? [];
        if (todas.length > MAX_APARICIONES_EN_EL_LIBRO) return null;
        const fuera = todas.filter(v => !visible(v));
        if (fuera.length === 0) return null;
        return {
            lemma,
            inVerse,
            occurrences: fuera.map(v => ({ chapter: v.reference.chapter, verse: v.reference.verse, text: v.text })),
        };
    };

    return [
        ...[...propios].map(l => entrada(l, true)),
        ...[...delPasaje].filter(l => !propios.has(l)).map(l => entrada(l, false)),
    ].filter((e): e is ConcordanceEntry => e !== null);
}

/** Los lemas de contenido de un versículo, sin repetir y en el orden del texto. */
function lemasDeContenido(v: GreekVerseTokens): string[] {
    return [...new Set(v.tokens.filter(t => CLASES_DE_CONTENIDO.has(t.pos)).map(t => t.lemma))];
}

/**
 * Si el versículo cae dentro del pasaje. Un pasaje sin versículos
 * (`verseStart` nulo) abarca sus capítulos enteros.
 */
function dentro(ref: { chapter: number; verse: number }, passage: PassageReference): boolean {
    if (ref.chapter < passage.chapterStart || ref.chapter > passage.chapterEnd) return false;
    if (ref.chapter === passage.chapterStart && passage.verseStart != null && ref.verse < passage.verseStart) return false;
    const fin = passage.verseEnd ?? (passage.chapterEnd === passage.chapterStart ? passage.verseStart : null);
    if (ref.chapter === passage.chapterEnd && fin != null && ref.verse > fin) return false;
    return true;
}
