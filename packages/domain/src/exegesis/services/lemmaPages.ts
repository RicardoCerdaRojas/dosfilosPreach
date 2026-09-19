import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';

/**
 * Qué páginas de un léxico hay que admitir para los lemas del pasaje.
 *
 * Elegirlas a mano es el trabajo que nadie hace bien: en el estudio de
 * Salmo 23:1–3 hubo que buscar siete entradas en un léxico de 807 páginas
 * y corregir después las que quedaron mal. Y elegirlas mal tiene precio:
 * el verificador no encuentra la cita porque su página no entró al corpus,
 * y la cita correcta se marca como dudosa.
 *
 * La propuesta es literal, no semántica: se busca el lema como PALABRA
 * ENTERA, comparando sólo consonantes. Medido contra las páginas que una
 * persona verificó a mano, los siete lemas del pasaje caen en las tres
 * primeras propuestas, y cinco en la primera.
 *
 * No decide: propone. Un léxico repite un lema en las entradas que lo
 * citan, así que la hoja con más apariciones suele ser su entrada, pero
 * «suele» no es «siempre» y quien firma el trabajo mira la página.
 */

export interface SheetHitCount {
    sheet: number;
    count: number;
    /** Renglón donde cae la primera aparición, para reconocer la entrada. */
    snippet?: string;
}

export interface LemmaPageProposal {
    lemma: string;
    /** Término tal como aparece en el verso, para nombrar la propuesta. */
    term: string;
    /** Hojas candidatas, la más probable primero. */
    sheets: SheetHitCount[];
}

/** Cuántas hojas se proponen por lema. Más allá de tres es ruido. */
export const MAX_SHEETS_PER_LEMMA = 3;

/**
 * Ordena las hojas candidatas de un lema.
 *
 * Manda cuántas veces aparece: la entrada de un lema lo escribe en su
 * encabezado y en cada forma que conjuga, mientras que las entradas
 * vecinas que lo citan de paso lo nombran una vez. A igual cantidad
 * gana la hoja anterior, porque un lema que aparece repartido entre dos
 * hojas suele empezar en la primera.
 */
export function rankLemmaSheets(hits: ReadonlyArray<SheetHitCount>): SheetHitCount[] {
    return [...hits]
        .sort((a, b) => (b.count - a.count) || (a.sheet - b.sheet))
        .slice(0, MAX_SHEETS_PER_LEMMA);
}

/**
 * Los lemas que el trabajo necesita buscar en un léxico.
 *
 * Salen de los análisis aceptados, que es donde el lema existe como dato
 * —el analizador lo escribe junto al término conjugado del verso—. Sin
 * análisis no hay lemas, y la interfaz debe decirlo en vez de proponer
 * páginas al azar.
 *
 * Se devuelven sin repetir: un mismo lema en dos versos es una sola
 * entrada del léxico.
 */
export function lemmasOfAnalyses(
    analyses: ReadonlyArray<CanonicalVerseAnalysis>,
): Array<{ lemma: string; term: string }> {
    const vistos = new Set<string>();
    const out: Array<{ lemma: string; term: string }> = [];
    for (const analysis of analyses) {
        for (const lexical of analysis.lexicalAnalyses ?? []) {
            const lemma = (lexical.lemma ?? '').trim() || (lexical.term ?? '').trim();
            if (!lemma) continue;
            const clave = consonantsOf(lemma);
            if (!clave || vistos.has(clave)) continue;
            vistos.add(clave);
            out.push({ lemma, term: (lexical.term ?? '').trim() || lemma });
        }
    }
    return out;
}

/**
 * Las consonantes de una palabra hebrea.
 *
 * Es la forma en que dos grafías del mismo lema se reconocen: el análisis
 * escribe «שׁוּב» con vocales y el léxico encabeza «שוב» sin ellas.
 */
export function consonantsOf(text: string): string {
    return (text.match(/[א-ת]/g) ?? []).join('');
}
