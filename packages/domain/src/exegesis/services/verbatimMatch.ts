/**
 * Busca una oración citada textualmente dentro de fragmentos de la fuente.
 *
 * Es el cotejo barato: cuando el analizador copió la oración, no hace falta
 * juzgar significado, basta con encontrarla. Lo que complica la búsqueda es
 * la extracción del PDF, que parte palabras con guion al final de línea,
 * cambia comillas y guiones, y pega o parte espacios. Por eso se compara
 * sobre una forma normalizada, y se admite una coincidencia por ventana de
 * palabras cuando el texto extraído perdió o cambió alguna.
 */

export interface VerbatimChunk {
    text: string;
    pageHint: string | null;
}

export interface VerbatimMatch {
    chunkIndex: number;
    pageHint: string | null;
    /** 1 cuando la oración aparece entera; menos cuando coincide por ventana. */
    score: number;
}

/** Mínimo de palabras de la cita que deben aparecer en la ventana. */
export const VERBATIM_WINDOW_THRESHOLD = 0.85;
/** Debajo de esto una «oración» es demasiado corta para afirmar que se encontró. */
const MIN_QUOTE_TOKENS = 4;

export function normalizeForVerbatim(text: string): string {
    return text
        .normalize('NFKC')
        .toLowerCase()
        // Palabra partida por guion al final de línea: «pre- ceding» → «preceding».
        .replace(/(\p{L})[-‐­]\s*\n\s*(\p{L})/gu, '$1$2')
        .replace(/(\p{L})-\s+(\p{L})/gu, '$1$2')
        .replace(/[‘’‚‛‹›]/g, "'")
        .replace(/[“”„‟«»]/g, '"')
        .replace(/[–—‒―]/g, '-')
        .replace(/­/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokens(text: string): string[] {
    return normalizeForVerbatim(text)
        .split(/[^\p{L}\p{N}]+/u)
        .filter(t => t.length > 0);
}

/**
 * La mejor coincidencia de `quote` entre los fragmentos, o `null`.
 *
 * Primero busca la oración entera normalizada; si no está, desliza una
 * ventana del largo de la cita sobre las palabras del fragmento y se queda
 * con la proporción de palabras de la cita que aparecen en la ventana. Los
 * fragmentos con página ganan a igual puntaje, porque son los que sirven
 * para cotejar la página.
 */
export function findVerbatim(
    quote: string,
    chunks: ReadonlyArray<VerbatimChunk>,
): VerbatimMatch | null {
    const needle = normalizeForVerbatim(quote);
    const needleTokens = tokens(quote);
    if (needleTokens.length < MIN_QUOTE_TOKENS) return null;

    let best: VerbatimMatch | null = null;
    const consider = (candidate: VerbatimMatch) => {
        if (!best) { best = candidate; return; }
        if (candidate.score > best.score) { best = candidate; return; }
        if (candidate.score === best.score && !best.pageHint && candidate.pageHint) best = candidate;
    };

    chunks.forEach((chunk, chunkIndex) => {
        if (normalizeForVerbatim(chunk.text).includes(needle)) {
            consider({ chunkIndex, pageHint: chunk.pageHint, score: 1 });
            return;
        }
        const hay = tokens(chunk.text);
        if (hay.length < needleTokens.length) return;
        const needleSet = new Set(needleTokens);
        // Ventana un poco más ancha que la cita, para tolerar una palabra
        // intercalada por la extracción sin perder las de los bordes.
        const width = Math.min(hay.length, needleTokens.length + 2);
        let bestWindow = 0;
        for (let start = 0; start + width <= hay.length; start++) {
            const window = new Set(hay.slice(start, start + width));
            let hits = 0;
            for (const t of needleSet) if (window.has(t)) hits++;
            const score = hits / needleSet.size;
            if (score > bestWindow) bestWindow = score;
            if (bestWindow === 1) break;
        }
        if (bestWindow >= VERBATIM_WINDOW_THRESHOLD) {
            // Una coincidencia por ventana nunca vale tanto como la oración entera.
            consider({ chunkIndex, pageHint: chunk.pageHint, score: Math.min(bestWindow, 0.99) });
        }
    });

    return best;
}
