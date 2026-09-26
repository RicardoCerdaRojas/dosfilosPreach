import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import { collectAnalysisClaims } from './analysisClaims';

/**
 * Una forma griega atribuida a un libro cuyo texto no tiene ni una letra
 * griega no pudo leerse de ahí.
 *
 * No es una heurística sobre la calidad de la extracción: es una
 * imposibilidad de lectura. Si los 18.888 caracteres que el sistema leyó de
 * Adamson no contienen un solo carácter griego, entonces «Adamson trata
 * μέντοι como un punto crucial» no salió de esas páginas — la forma la puso
 * el modelo desde lo que sabe.
 *
 * Eso NO la vuelve falsa: Adamson escribe el griego transliterado —su
 * extracción dice «logos» donde el libro imprime λόγος— y el modelo puede
 * estar normalizando una discusión real. Lo que sí es cierto, y es lo que se
 * reporta, es que la forma no está en el texto que se leyó, así que nadie la
 * verificó contra la fuente. El verificador de citas no puede atraparlo: sale
 * a buscar la afirmación dentro de un texto que no tiene griego, y no
 * encontrar nada ahí es su comportamiento normal.
 *
 * Medido en Santiago 2:1-13: de 26 afirmaciones con griego y fuente
 * declarada, 3 apuntan a Adamson —καλῶς, διεκρίθητε, μέντοι—, cuya extracción
 * destruyó el griego entero (`6€§a00¢e` por δέξασθε).
 *
 * De los 34 libros del corpus de producción, el reparto no deja lugar a dudas
 * sobre qué es normal: Mayor tiene 1.470 ‰ de caracteres en lengua original,
 * Porter 810 ‰, Wallace 1.248 ‰ — y Adamson, 0.
 */

/** Griego politónico y hebreo, que es lo que estos libros citan. */
const LETRA_ORIGINAL = /[Ͱ-Ͽἀ-῿֐-׿]/g;

export function countOriginalLanguageChars(text: string): number {
    return (text.match(LETRA_ORIGINAL) ?? []).length;
}

/**
 * Cuánto texto hace falta para que el cero signifique algo.
 *
 * Un fragmento corto puede no tener griego por casualidad. Con casi dos mil
 * caracteres de un comentario sobre una epístola griega, el cero ya no es
 * casualidad: es que la extracción lo perdió. El caso medido tiene 18.888.
 */
export const MIN_CHARS_PARA_AFIRMAR_AUSENCIA = 2000;

export interface SourceTextSample {
    citationKey: string | null;
    /** Todo lo que el sistema leyó de esa fuente para este trabajo. */
    text: string;
}

/**
 * Las claves de cita cuyo texto leído NO tiene lengua original.
 *
 * Devuelve sólo las que tienen texto de sobra: sin eso, una fuente con dos
 * frases entraría en la lista y la advertencia sería ruido.
 */
export function sourcesWithoutOriginalLanguage(
    sources: ReadonlyArray<SourceTextSample>,
): ReadonlySet<string> {
    const out = new Set<string>();
    for (const s of sources) {
        if (!s.citationKey) continue;
        if (s.text.length < MIN_CHARS_PARA_AFIRMAR_AUSENCIA) continue;
        if (countOriginalLanguageChars(s.text) === 0) out.add(s.citationKey);
    }
    return out;
}

export interface UnreadableOriginalClaim {
    /** Ruta de la afirmación dentro del análisis, como las usa la revisión. */
    path: string;
    sourceKey: string;
    /** La primera forma en lengua original que la afirmación trae. */
    form: string;
}

/** La forma original más larga de un texto, para nombrar el hallazgo. */
function primeraForma(text: string): string | null {
    const formas = text.match(/[Ͱ-Ͽἀ-῿֐-׿]+/g) ?? [];
    return formas.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Afirmaciones que citan lengua original apoyándose en una fuente que no la
 * tiene en el texto leído.
 *
 * El orden es el del análisis, que es el de la revisión de citas: la lista se
 * lee al lado del texto y no como un informe aparte.
 */
export function claimsQuotingUnreadableOriginal(
    analysis: CanonicalVerseAnalysis,
    sinLenguaOriginal: ReadonlySet<string>,
): UnreadableOriginalClaim[] {
    if (sinLenguaOriginal.size === 0) return [];
    const out: UnreadableOriginalClaim[] = [];
    for (const claim of collectAnalysisClaims(analysis)) {
        if (!sinLenguaOriginal.has(claim.sourceKey)) continue;
        // La forma puede venir en la afirmación o en la cita textual que el
        // analizador dijo haber copiado; las dos son lectura de la fuente.
        const form = primeraForma(`${claim.claim} ${claim.verbatimQuote ?? ''}`);
        if (!form) continue;
        out.push({ path: claim.path, sourceKey: claim.sourceKey, form });
    }
    return out;
}
