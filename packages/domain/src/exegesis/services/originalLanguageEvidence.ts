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

/**
 * Marcas de transliteración académica semítica.
 *
 * Son las que usa un comentario que escribe el hebreo en alfabeto latino:
 * macrones y circunflejos para las vocales largas, puntos bajo las enfáticas,
 * y los dos signos de álef y ayin. NO incluye las tildes del español ni del
 * inglés, que aparecen en cualquier libro y no dirían nada.
 */
const TRANSLITERACION = /[ḥḤṭṬṣṢśŚšŠʾʿāēīōūîêôûĕăŏḏḵṯḡ]/g;

export function countTransliterationMarks(text: string): number {
    return (text.match(TRANSLITERACION) ?? []).length;
}

/**
 * Cuánta transliteración basta para decir que el autor escribe así.
 *
 * Medido sobre el corpus de producción, entre los libros que NO tienen ni un
 * carácter en lengua original: Sasson marca 6,3 ‰, el siguiente 0,3 ‰ y todo
 * el resto 0,0 ‰. Sasson está veinte veces por encima del segundo, así que el
 * umbral cae en tierra de nadie y no en el borde de una distribución.
 */
const MIN_TRANSLITERACION = 2;

/**
 * Por qué un libro no tiene lengua original en el texto leído.
 *
 * `'transliterated'` — el autor escribe el hebreo en alfabeto latino. Sasson
 * discute «the root hãyâ in the G-imperfect with a waw-conversive»: está
 * haciendo morfología seria, sólo que sin caracteres hebreos. El libro es así
 * y no hay nada que reparar.
 *
 * `'lost'` — no hay ni original ni transliteración. La extracción lo perdió.
 * Adamson entra aquí: escribe «6€§a00¢e» donde el libro imprime δέξασθε, y su
 * transliteración mide 0,0 ‰.
 *
 * La distinción salió de equivocarme. La primera versión de esta comprobación
 * marcaba los dos casos igual, y a un comentario semítico serio lo acusaba de
 * roto por seguir la convención de su colección.
 */
export type OriginalLanguageAbsence = 'transliterated' | 'lost';

export function classifyOriginalLanguageAbsence(text: string): OriginalLanguageAbsence {
    const porMil = text.length > 0 ? (1000 * countTransliterationMarks(text)) / text.length : 0;
    return porMil >= MIN_TRANSLITERACION ? 'transliterated' : 'lost';
}

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
): ReadonlyMap<string, OriginalLanguageAbsence> {
    const out = new Map<string, OriginalLanguageAbsence>();
    for (const s of sources) {
        if (!s.citationKey) continue;
        if (s.text.length < MIN_CHARS_PARA_AFIRMAR_AUSENCIA) continue;
        if (countOriginalLanguageChars(s.text) > 0) continue;
        out.set(s.citationKey, classifyOriginalLanguageAbsence(s.text));
    }
    return out;
}

export interface UnreadableOriginalClaim {
    /** Ruta de la afirmación dentro del análisis, como las usa la revisión. */
    path: string;
    sourceKey: string;
    /** La primera forma en lengua original que la afirmación trae. */
    form: string;
    /**
     * Por qué la fuente no la contiene. Cambia lo que hay que hacer: un libro
     * transliterado no se re-extrae, se cita de otro modo.
     */
    absence: OriginalLanguageAbsence;
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
    sinLenguaOriginal: ReadonlyMap<string, OriginalLanguageAbsence>,
): UnreadableOriginalClaim[] {
    if (sinLenguaOriginal.size === 0) return [];
    const out: UnreadableOriginalClaim[] = [];
    for (const claim of collectAnalysisClaims(analysis)) {
        const absence = sinLenguaOriginal.get(claim.sourceKey);
        if (!absence) continue;
        // La forma puede venir en la afirmación o en la cita textual que el
        // analizador dijo haber copiado; las dos son lectura de la fuente.
        const form = primeraForma(`${claim.claim} ${claim.verbatimQuote ?? ''}`);
        if (!form) continue;
        out.push({ path: claim.path, sourceKey: claim.sourceKey, form, absence });
    }
    return out;
}
