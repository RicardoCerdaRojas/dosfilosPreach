import type { ExpectedLengthRange } from '../entities/PaperRubric';

/**
 * Cuánto ocupa lo escrito, frente a lo que el curso exige.
 *
 * Nace de un trabajo que debía tener doce páginas y llegó con ~930
 * palabras de prosa útil —un tercio— sin que nada lo dijera hasta abrir
 * el Word terminado. La rúbrica ya guardaba la extensión exigida
 * (`expectedLength`) y nadie la comparaba nunca con la salida.
 *
 * La cuenta de palabras es exacta; las páginas son una estimación y así
 * hay que nombrarlas en la interfaz. La estimación vale para el formato
 * del seminario y para ningún otro: Times New Roman 12 a doble espacio
 * con márgenes de una pulgada entra ~250 palabras por página, y las
 * notas al pie a 10 pt y espacio simple, ~500.
 */
const WORDS_PER_PAGE = 250;
const FOOTNOTE_WORDS_PER_PAGE = 500;

/** Citas entre paréntesis: viajan a las notas al pie, no al cuerpo. */
const INLINE_CITATION = /\(\s*[^,()]+?\s*,\s*"[^"]+"(?:\s*,\s*(?:pp?\.\s*)?[\d–\-—,\s]+)?\s*\)/g;

export interface PaperLengthEstimate {
    /** Palabras del cuerpo, sin las citas que se vuelven notas. */
    words: number;
    /** Palabras que quedan en las notas al pie. */
    footnoteWords: number;
    /** Páginas estimadas en el formato del seminario. */
    estimatedPages: number;
}

export type LengthVerdict = 'unknown' | 'short' | 'ok' | 'long';

export interface PaperLengthCheck extends PaperLengthEstimate {
    verdict: LengthVerdict;
    /** Lo exigido, en la unidad en que se declaró. `null` si no se declaró. */
    expected: ExpectedLengthRange | null;
    /**
     * Cuánto falta para llegar al mínimo, en la unidad exigida. `0` cuando
     * ya se llegó; `null` cuando no hay mínimo declarado.
     */
    missing: number | null;
}

/**
 * Palabras impresas de un texto: secuencias que empiezan con letra o
 * cifra.
 *
 * No es `countWords` del presupuesto de movimientos, que parte por
 * espacios para estimar tiempo hablado: ahí un guion suelto cuenta como
 * palabra y da igual, porque se lee como pausa. Aquí lo que se cuenta son
 * palabras que ocupan renglón, y un «—» no ocupa uno.
 */
export function countProseWords(text: string): number {
    const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
    return matches ? matches.length : 0;
}

/**
 * Mide un texto en markdown como lo va a ver el documento final.
 *
 * Los encabezados cuentan —ocupan renglón— pero las marcas de markdown
 * no, y las citas entre paréntesis se cuentan aparte porque en el
 * documento bajan al pie con letra más chica.
 */
export function estimateLength(markdown: string): PaperLengthEstimate {
    // Tipado explícito: `match` devuelve `RegExpMatchArray | null` y el
    // `?? []` deja una unión con `never[]` que rompe el `reduce`.
    const citations: string[] = markdown.match(INLINE_CITATION) ?? [];
    const footnoteWords = citations.reduce((sum, c) => sum + countProseWords(c), 0);

    const body = markdown
        .replace(INLINE_CITATION, ' ')
        // Marcas de markdown: no se imprimen.
        .replace(/[*_`>#]|^\s*[-+]\s+/gm, ' ');
    const words = countProseWords(body);

    const pages = words / WORDS_PER_PAGE + footnoteWords / FOOTNOTE_WORDS_PER_PAGE;
    // Media página es la unidad más fina que una estimación así sostiene.
    return { words, footnoteWords, estimatedPages: Math.round(pages * 2) / 2 };
}

/**
 * Compara lo escrito con la extensión que declara la rúbrica.
 *
 * Sin extensión declarada el veredicto es `unknown` y no se inventa una:
 * un trabajo corto para un curso es exacto para otro, y una advertencia
 * falsa enseña a ignorar las advertencias.
 */
export function checkLength(markdown: string, expected: ExpectedLengthRange | null): PaperLengthCheck {
    const estimate = estimateLength(markdown);
    if (!expected || (expected.min === null && expected.max === null)) {
        return { ...estimate, verdict: 'unknown', expected: expected ?? null, missing: null };
    }

    const actual = expected.unit === 'words' ? estimate.words : estimate.estimatedPages;
    const missing = expected.min !== null ? Math.max(0, round(expected.min - actual)) : null;

    const verdict: LengthVerdict = expected.min !== null && actual < expected.min
        ? 'short'
        : expected.max !== null && actual > expected.max
            ? 'long'
            : 'ok';

    return { ...estimate, verdict, expected, missing };
}

function round(n: number): number {
    return Math.round(n * 2) / 2;
}

/**
 * Cuántas palabras le tocan a cada verso para llegar a lo exigido.
 *
 * El trabajo no es solo versos: la introducción y la conclusión ocupan su
 * parte, y en los trabajos de exégesis vistos hasta ahora rondan un
 * quinto del total. El resto se reparte parejo entre los versos, que es
 * una aproximación —un verso con tres cruces de traducción da para más
 * que uno con una cláusula nominal— pero sirve para lo que se usa: poner
 * un número delante de quien recompone, en vez de dejarlo adivinar.
 *
 * `null` cuando el curso no declara extensión o no hay versos: no se
 * inventa un objetivo.
 */
export function wordsPerVerseTarget(
    expected: ExpectedLengthRange | null,
    verseCount: number,
): number | null {
    if (!expected || verseCount <= 0) return null;
    const target = expected.min ?? expected.max;
    if (target === null || target <= 0) return null;

    const totalWords = expected.unit === 'words' ? target : target * WORDS_PER_PAGE;
    const forVerses = totalWords * 0.8;
    return Math.round(forVerses / verseCount / 50) * 50;
}
