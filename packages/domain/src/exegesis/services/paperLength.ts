import {
    DEFAULT_PAPER_FORMATTING,
    type ExpectedLengthRange,
    type LineSpacing,
    type PaperFormatting,
} from '../entities/PaperRubric';

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
 * del seminario y para ningún otro: Times New Roman 12 con márgenes de una
 * pulgada. Cuántas palabras entran en esa página depende del interlineado
 * que pida la entrega, y eso lo resuelve `wordsPerPage`; las notas al pie
 * van a 10 pt y espacio simple en las dos guías, ~500.
 */
/**
 * Renglones de cuerpo que entran en una página, por interlineado.
 *
 * Carta menos dos pulgadas de margen deja nueve pulgadas de caja = 648 puntos.
 * Un renglón de Times New Roman 12 a espacio simple ocupa ~13,8 puntos; los
 * otros dos interlineados son ese renglón por 1,5 y por 2.
 */
const RENGLONES_A_ESPACIO_SIMPLE = 47;

/**
 * Cuántos renglones simples ocupa un renglón, por interlineado.
 *
 * Los tres tamaños salen de ESTE multiplicador y no de tres cuentas sueltas:
 * tres números escritos a mano se desincronizan en cuanto alguien toca uno, y
 * la relación entre ellos —doble es exactamente el doble de simple— es lo que
 * hay que preservar. Son los mismos multiplicadores que el exportador aplica
 * sobre `TMS.singleLine` para maquetar el Word; si algún día hay un cuarto
 * interlineado, se agrega en los dos sitios.
 */
const ALTO_DE_RENGLON: Record<LineSpacing, number> = {
    single: 1,
    'one-and-a-half': 1.5,
    double: 2,
};

/**
 * Palabras que entran en un renglón de 6,5 pulgadas en Times New Roman 12.
 *
 * No es una medición independiente: es el número que hace que el caso ya
 * validado —doble espacio, sin línea entre párrafos— siga dando las 250
 * palabras por página que esta función tenía cableadas. 23 × 11 = 253. Lo que
 * este cambio introduce es variar los RENGLONES según el interlineado, no una
 * escala nueva.
 */
const PALABRAS_POR_RENGLON = 11;

/**
 * Lo que cuesta la línea en blanco entre párrafos.
 *
 * Un párrafo de prosa académica ocupa unos diez renglones, así que la línea
 * extra se paga una vez cada diez: la página rinde un décimo menos.
 */
const RINDE_CON_LINEA_EXTRA = 0.9;

/**
 * Palabras de cuerpo que entran en una página, según el formato de ESTA
 * entrega.
 *
 * Era una constante —250— con un comentario que decía de dónde salía: doble
 * espacio. La rúbrica ya guardaba el interlineado y el exportador ya lo
 * respetaba; el único que seguía midiendo todo a doble espacio era este
 * estimador, y a un trabajo a espacio simple le anunciaba el doble de páginas
 * de las que iba a ocupar. Medido en Santiago 2:1-13: 881 palabras a espacio
 * simple: el aviso decía 3,5 páginas contra un máximo de 3, y el documento
 * entregado cumplía.
 *
 * El número no sale de un ajuste hasta que cuadre, sale de la caja de texto:
 * renglones que entran en la página por palabras que entran en el renglón.
 * A doble espacio y sin línea entre párrafos —la maquetación de la casa— da
 * 253, que redondea a las mismas 250 de antes.
 */
export function wordsPerPage(formatting: PaperFormatting | null): number {
    const f = formatting ?? DEFAULT_PAPER_FORMATTING;
    const renglones = Math.floor(RENGLONES_A_ESPACIO_SIMPLE / ALTO_DE_RENGLON[f.lineSpacing])
        * (f.blankLineBetweenParagraphs ? RINDE_CON_LINEA_EXTRA : 1);
    // Un presupuesto de página se dice en cuartos de centenar, no en unidades.
    return Math.round(renglones * PALABRAS_POR_RENGLON / 25) * 25;
}

/**
 * Las notas al pie no siguen el interlineado del cuerpo: van a 10 puntos y
 * espacio simple en las dos guías, así que su rendimiento es fijo.
 */
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
export function estimateLength(
    markdown: string,
    formatting: PaperFormatting | null = null,
): PaperLengthEstimate {
    // Tipado explícito: `match` devuelve `RegExpMatchArray | null` y el
    // `?? []` deja una unión con `never[]` que rompe el `reduce`.
    const citations: string[] = markdown.match(INLINE_CITATION) ?? [];
    const footnoteWords = citations.reduce((sum, c) => sum + countProseWords(c), 0);

    const body = markdown
        .replace(INLINE_CITATION, ' ')
        // Marcas de markdown: no se imprimen.
        .replace(/[*_`>#]|^\s*[-+]\s+/gm, ' ');
    const words = countProseWords(body);

    const pages = words / wordsPerPage(formatting) + footnoteWords / FOOTNOTE_WORDS_PER_PAGE;
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
export function checkLength(
    markdown: string,
    expected: ExpectedLengthRange | null,
    formatting: PaperFormatting | null = null,
): PaperLengthCheck {
    const estimate = estimateLength(markdown, formatting);
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
    formatting: PaperFormatting | null = null,
): { perVerse: number | null; introduction: number | null; conclusion: number | null } {
    const vacio = { perVerse: null, introduction: null, conclusion: null };
    if (!expected) return vacio;
    const target = expected.min ?? expected.max;
    if (target === null || target <= 0) return vacio;

    const totalWords = expected.unit === 'words' ? target : target * wordsPerPage(formatting);
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
