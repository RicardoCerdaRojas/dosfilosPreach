import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { GreekVerseTokens } from '../../greek-analyzer/morphGntToken';
import type { HebrewVerseMorphology } from './verseMorphologyBriefing';

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
            const clave = lemmaKey(lemma);
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

/** Una palabra griega sin acentos, espíritus ni mayúsculas, con sigma única. */
export function greekFold(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        // Sigma final y sigma lunada (ϲ, la de muchas ediciones críticas) son σ.
        .replace(/[ςϲ]/g, 'σ')
        .replace(/[^\u03B1-\u03C9]/g, '');
}

/**
 * La clave con que se reconoce un lema: consonantes si es hebreo, la palabra
 * plegada si es griego.
 *
 * Sólo existía la hebrea: un lema griego quedaba en cadena vacía, se
 * descartaba, y «Páginas por lema» decía «Todavía no hay lemas» con BDAG.
 * Debe plegar IGUAL que `lemmaKey` de functions (`documentTextSearch.ts`),
 * que es quien busca en el léxico: hay una prueba de paridad allá.
 */
export function lemmaKey(text: string): string {
    return consonantsOf(text) || greekFold(text);
}

/** Un versículo del pasaje con su morfología, tal como la dan los proveedores. */
export interface VerseMorphologyEntry {
    chapter: number;
    verse: number;
    morphology: GreekVerseTokens | HebrewVerseMorphology;
}

export interface PassageLemma {
    /** La forma de diccionario: el lema de MorphGNT, o el de Strong para el hebreo. */
    lemma: string;
    /** Cómo aparece la primera vez en el pasaje. */
    term: string;
    /** Veces que aparece en el pasaje. */
    occurrences: number;
    /** «4:6», la primera vez. */
    firstVerse: string;
    /** Número de Strong, para los lemas hebreos (de morphhb). */
    strong?: number;
}

/** Sustantivo común, verbo o adjetivo: lo que un léxico explica. */
const GREEK_CONTENT = new Set(['N', 'V', 'A']);

/**
 * Los lemas de TODO el pasaje, de la morfología.
 *
 * «Páginas por lema» los sacaba de los versículos ya analizados: con 4:5-4:7
 * analizados, el léxico no proponía nada de 4:8-11 (faltaban חוּס, חָרָה,
 * עָמַל). Era circular: para analizar bien hacen falta las hojas del léxico,
 * y las hojas salían del análisis.
 *
 * Quedan los sustantivos comunes, los verbos y los adjetivos. Artículos,
 * preposiciones, conjunciones, partículas, pronombres y nombres propios no
 * tienen una entrada que valga la pena. En hebreo el lema llega como número de
 * Strong («c/3318», «4480 a») y `strongToLemma` lo traduce; si no puede, se usa
 * la palabra tal como aparece.
 *
 * En el orden en que aparecen, sin repetir.
 */
export function passageLemmas(
    verses: ReadonlyArray<VerseMorphologyEntry>,
    strongToLemma: (strong: number) => string | undefined = () => undefined,
): PassageLemma[] {
    const out = new Map<string, PassageLemma>();
    const add = (lemma: string, term: string, ref: string, strong?: number) => {
        const key = lemmaKey(lemma);
        if (key.length < 2) return;
        const prev = out.get(key);
        if (prev) prev.occurrences++;
        else out.set(key, { lemma, term, occurrences: 1, firstVerse: ref, ...(strong ? { strong } : {}) });
    };
    for (const v of verses) {
        const ref = `${v.chapter}:${v.verse}`;
        for (const t of v.morphology.tokens) {
            if ('pos' in t) {
                if (GREEK_CONTENT.has(t.pos)) add(t.lemma, t.text, ref);
                continue;
            }
            const morphemes = t.oshbMorphCode.replace(/^[HA]/, '').split('/');
            // Verbo, sustantivo común o adjetivo; `Np` es nombre propio.
            const content = morphemes.find(m => /^(V|Nc|Ng|A)/.test(m));
            if (!content) continue;
            const strong = t.lemma.split('/').map(p => p.trim()).find(p => /^\d+/.test(p));
            const n = strong ? parseInt(strong, 10) : NaN;
            const surface = t.text.replace(/\//g, '');
            add((Number.isFinite(n) && strongToLemma(n)) || surface, surface, ref, Number.isFinite(n) ? n : undefined);
        }
    }
    return [...out.values()];
}

/**
 * Une los lemas que eligió el análisis (primero: son los términos clave) con
 * los del pasaje entero, sin repetir por `lemmaKey`.
 */
export function mergeLemmas(
    fromAnalyses: ReadonlyArray<{ lemma: string; term: string }>,
    fromPassage: ReadonlyArray<{ lemma: string; term: string }>,
): Array<{ lemma: string; term: string }> {
    const seen = new Set<string>();
    const out: Array<{ lemma: string; term: string }> = [];
    for (const l of [...fromAnalyses, ...fromPassage]) {
        const key = lemmaKey(l.lemma);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ lemma: l.lemma, term: l.term });
    }
    return out;
}
