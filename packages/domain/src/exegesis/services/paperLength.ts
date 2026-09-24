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
 * Qué secciones va a tener el documento.
 *
 * Sale de la MISMA marca que decide qué entra al ensamble, y por eso el
 * presupuesto y el documento no pueden discrepar: si la introducción no va,
 * su parte de la extensión vuelve a los versículos en vez de reservarse para
 * una sección que nadie va a escribir.
 */
export interface DocumentSections {
    /** Cuántos versículos pertenecen al documento. */
    verses: number;
    introduction: boolean;
    conclusion: boolean;
}

/** Qué fracción del trabajo se lleva la introducción, y otro tanto la conclusión. */
const PARTE_DEL_MARCO = 0.1;

/**
 * Las palabras que le tocan a cada sección del documento.
 *
 * Una sola función en vez de constantes sueltas, porque las partes tienen que
 * sumar el trabajo ENTERO y sueltas se desincronizan en cuanto alguien ajusta
 * una. Hay una prueba que suma.
 *
 * El marco —introducción y conclusión— se lleva un décimo cada uno cuando
 * está, y NADA cuando no. Un trabajo de sólo versículos reparte el cien por
 * ciento entre ellos: reservarle extensión a una sección que no va escrita
 * deja el documento corto sin que nadie sepa por qué.
 *
 * `null` en cada parte que no corresponde, y en todas cuando el curso no
 * declara extensión: no se inventa un objetivo.
 */
export function sectionBudgets(
    expected: ExpectedLengthRange | null,
    sections: DocumentSections,
): { perVerse: number | null; introduction: number | null; conclusion: number | null } {
    const vacio = { perVerse: null, introduction: null, conclusion: null };
    if (!expected) return vacio;
    const target = expected.min ?? expected.max;
    if (target === null || target <= 0) return vacio;

    const totalWords = expected.unit === 'words' ? target : target * WORDS_PER_PAGE;
    const marco = (sections.introduction ? PARTE_DEL_MARCO : 0)
        + (sections.conclusion ? PARTE_DEL_MARCO : 0);

    return {
        perVerse: sections.verses > 0
            ? redondeaA50(totalWords * (1 - marco) / sections.verses)
            : null,
        introduction: sections.introduction ? redondeaA50(totalWords * PARTE_DEL_MARCO) : null,
        conclusion: sections.conclusion ? redondeaA50(totalWords * PARTE_DEL_MARCO) : null,
    };
}

/** Un presupuesto se dice en decenas, no en unidades: «unas 150 palabras». */
function redondeaA50(words: number): number {
    return Math.max(50, Math.round(words / 50) * 50);
}

/**
 * La instrucción de extensión que reciben los compositores.
 *
 * Una sola redacción para los tres —versículo, introducción, conclusión— y
 * para los que vengan. Tres textos distintos diciendo lo mismo derivan solos:
 * uno se vuelve un ruego («intentá no pasarte»), otro un límite duro, y el
 * mismo trabajo sale con secciones que obedecen distinto.
 *
 * Cadena vacía cuando no hay presupuesto: sin extensión declarada, callar es
 * más honesto que inventar un número.
 */
export function buildWordBudgetBlock(words: number | null, language: 'es' | 'en'): string {
    if (!words || words <= 0) return '';
    return language === 'en'
        ? [
            '## Length',
            `Write approximately ${words} words for this section. This is a budget, not a suggestion: the paper has a length the course grades, and every section spending more than its share takes it from another.`,
            'Cut breadth, never rigor. Fewer points, each fully argued and cited — not the same points said more briefly.',
        ].join('\n')
        : [
            '## Extensión',
            `Escribí aproximadamente ${words} palabras para esta sección. Es un presupuesto, no una sugerencia: el trabajo tiene una extensión que el curso califica, y cada sección que gasta de más se lo quita a otra.`,
            'Recortá amplitud, nunca rigor. Menos puntos, cada uno argumentado y citado entero — no los mismos puntos dichos más corto.',
        ].join('\n');
}
