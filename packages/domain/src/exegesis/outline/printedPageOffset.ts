/**
 * Desfase entre la hoja física del PDF y el número impreso en el libro.
 *
 * `metadata.page` es la hoja del archivo, contada desde 1. El número que el
 * libro imprime en su encabezado o pie arranca después de las páginas
 * preliminares —portada, créditos, índice, prefacio— así que los dos números
 * no coinciden. Medido en `Obadiah, Jonah and Micah`: de 186 muestras
 * comparadas, NINGUNA coincide, y el desfase es constante en −2 (la hoja 77
 * lleva impreso el 75).
 *
 * Importa por dos razones:
 *
 *   1. El índice del propio comentario usa números impresos. Si el selector
 *      rotula la hoja 77 como «p. 77», el usuario que busca la página 77 del
 *      índice cae dos páginas más adelante.
 *   2. El visor de PDF navega por hoja física. Mostrar los dos números —
 *      «hoja 77 · impresa 75» — es lo único que deja al usuario cruzar entre
 *      lo que ve en pantalla y lo que dice el libro.
 *
 * La detección es deliberadamente conservadora: ante duda devuelve `null` y la
 * interfaz muestra solo el número de hoja. Un desfase inventado es peor que
 * ninguno — mandaría al usuario a la página equivocada con la confianza de un
 * dato verificado.
 */

/** Una hoja y el arranque de su texto, de donde se lee el encabezado corrido. */
export interface PageTextSample {
    /** Hoja física, tal como la guarda `metadata.page`. */
    page: number;
    /** Texto de la hoja. Alcanza con el principio; se ignora lo que sobre. */
    text: string;
}

export interface PrintedPageOffsetResult {
    /** `impresa = hoja + offset`. `null` cuando no hay evidencia suficiente. */
    offset: number | null;
    /** Hojas donde se pudo leer un número impreso. */
    samples: number;
    /** De esas, cuántas coinciden con el desfase elegido. */
    agreement: number;
}

export interface DetectPrintedPageOffsetOptions {
    /**
     * Desfase máximo aceptable. Por defecto el tope sobrio; sólo
     * `detectPrintedPageOffsetStaged` lo ensancha, y sólo tras fallar con él.
     */
    maxAbsOffset?: number;
}

/**
 * Cuántas hojas con número impreso legible hacen falta para arriesgar un
 * desfase. Con menos, cualquier número suelto del cuerpo —un versículo, una
 * nota al pie— puede imponerse por casualidad.
 */
const MIN_SAMPLES = 8;

/**
 * Qué proporción de las muestras tiene que estar de acuerdo. Los encabezados
 * corridos no aparecen en todas las hojas (las de apertura de capítulo suelen
 * omitirlos) y el OCR pierde algunos, así que no se exige unanimidad — pero sí
 * una mayoría amplia.
 */
const MIN_AGREEMENT_RATIO = 0.7;

/**
 * Desfase máximo aceptable en la primera pasada. Las preliminares de un libro
 * académico rara vez pasan de unas decenas de páginas; un desfase mayor casi
 * siempre significa que se leyó un número que no era el de la página.
 */
const MAX_ABS_OFFSET = 60;

/**
 * Desfase máximo de la segunda pasada, para los libros cuyas preliminares sí
 * son enormes.
 *
 * Medido en el comentario de Mayor sobre Santiago: su introducción ocupa unas
 * 234 páginas en numeración romana, de modo que el desfase real es de −278 y
 * el tope sobrio lo descartaba ANTES de evaluarlo. No es que el detector
 * fallara: tenía prohibido encontrarlo, y las citas del paper salieron con la
 * hoja del PDF en lugar de la página impresa.
 *
 * Se aplica sólo cuando la pasada sobria no concluye —ver
 * `detectPrintedPageOffsetStaged`—, porque ensanchar el tope de entrada
 * admite más números del cuerpo como candidatos y diluye el acuerdo: medido
 * sobre 49 recursos, hacerlo en una sola pasada gana Mayor pero pierde el
 * comentario WBC de Judas y 2 Pedro, que hoy detecta bien.
 */
const WIDE_ABS_OFFSET = 400;

/** Cuánto texto del principio y del final se mira para hallar el encabezado. */
const HEAD_CHARS = 70;
const TAIL_CHARS = 45;

/**
 * Un número suelto: rodeado de límites de palabra y no pegado a otro dígito.
 * De 1 a 4 cifras — más que eso no es un número de página.
 */
const STANDALONE_NUMBER = /(?<!\d)(\d{1,4})(?!\d)/g;

/**
 * Deduce el desfase mirando el encabezado corrido de cada hoja.
 *
 * Para cada hoja se juntan los números sueltos del principio y del final de su
 * texto —que es donde vive el encabezado o el folio— y se propone un desfase
 * por cada uno. Gana el desfase más frecuente, si reúne muestras suficientes y
 * acuerdo suficiente.
 *
 * Se cuenta UNA muestra por hoja, no una por número: una hoja cuyo cuerpo esté
 * lleno de cifras no puede pesar más que las demás.
 */
export function detectPrintedPageOffset(
    samples: ReadonlyArray<PageTextSample>,
    options: DetectPrintedPageOffsetOptions = {},
): PrintedPageOffsetResult {
    const maxAbsOffset = options.maxAbsOffset ?? MAX_ABS_OFFSET;
    /** Desfase → hojas que lo respaldan. */
    const votes = new Map<number, number>();
    let pagesWithNumber = 0;

    for (const sample of samples) {
        if (!Number.isFinite(sample.page) || sample.page < 1) continue;
        const candidates = candidateOffsets(sample, maxAbsOffset);
        if (candidates.size === 0) continue;
        pagesWithNumber++;
        for (const offset of candidates) {
            votes.set(offset, (votes.get(offset) ?? 0) + 1);
        }
    }

    if (pagesWithNumber < MIN_SAMPLES) {
        return { offset: null, samples: pagesWithNumber, agreement: 0 };
    }

    let best: number | null = null;
    let bestVotes = 0;
    for (const [offset, count] of votes) {
        // Ante empate gana el desfase más chico en valor absoluto: si tanto −2
        // como −37 explican la misma cantidad de hojas, −2 es la hipótesis
        // sobria (preliminares cortas) y −37 la que necesita una coincidencia.
        if (count > bestVotes || (count === bestVotes && best !== null && Math.abs(offset) < Math.abs(best))) {
            best = offset;
            bestVotes = count;
        }
    }

    if (best === null || bestVotes / pagesWithNumber < MIN_AGREEMENT_RATIO) {
        return { offset: null, samples: pagesWithNumber, agreement: bestVotes };
    }

    return { offset: best, samples: pagesWithNumber, agreement: bestVotes };
}

/**
 * Detecta el desfase probando primero la hipótesis sobria y ensanchando el
 * tope sólo si aquella no concluye.
 *
 * El orden importa y no es intercambiable con una sola pasada ancha. Medido
 * sobre los 49 recursos indexados de una biblioteca real:
 *
 *   - una sola pasada con tope 60  → 15 recursos con desfase
 *   - una sola pasada con tope 400 → 15 también: gana Mayor (−278) pero
 *     pierde el WBC de Judas y 2 Pedro, cuyo acuerdo cae de 89% a 36%
 *     porque el tope ancho admite números del cuerpo como candidatos
 *   - escalonada                   → 16, sin perder ninguno
 *
 * Es monótona por construcción: lo que ya resolvía la pasada sobria se
 * devuelve tal cual, y la ancha sólo corre donde antes no había respuesta.
 */
export function detectPrintedPageOffsetStaged(
    samples: ReadonlyArray<PageTextSample>,
): PrintedPageOffsetResult {
    const sober = detectPrintedPageOffset(samples);
    if (sober.offset !== null) return sober;
    return detectPrintedPageOffset(samples, { maxAbsOffset: WIDE_ABS_OFFSET });
}

/**
 * Desfases que propone una sola hoja. Es un conjunto porque el encabezado
 * puede traer más de un número (el del folio y el del capítulo, por ejemplo) y
 * a esta altura no hay forma de saber cuál es cuál — el consenso entre hojas
 * lo resuelve después.
 */
function candidateOffsets(sample: PageTextSample, maxAbsOffset: number): Set<number> {
    const text = sample.text ?? '';
    const zones = [text.slice(0, HEAD_CHARS), text.slice(-TAIL_CHARS)];
    const offsets = new Set<number>();

    for (const zone of zones) {
        for (const match of zone.matchAll(STANDALONE_NUMBER)) {
            const printed = Number(match[1]);
            if (!Number.isFinite(printed) || printed < 1) continue;
            const offset = printed - sample.page;
            if (Math.abs(offset) > maxAbsOffset) continue;
            offsets.add(offset);
        }
    }
    return offsets;
}

/**
 * Número impreso de una hoja. `null` cuando no se detectó desfase, o cuando la
 * cuenta cae en las preliminares (impresa ≤ 0), que es exactamente donde el
 * libro todavía no numera o numera en romanos.
 */
export function printedPageFor(sheet: number, offset: number | null): number | null {
    if (offset === null) return null;
    const printed = sheet + offset;
    return printed >= 1 ? printed : null;
}

/**
 * Hoja física que lleva impreso un número dado. La inversa de
 * `printedPageFor`.
 *
 * Una cita académica habla siempre en páginas impresas —«Adamson, 60» es
 * lo que el lector busca en el libro— y el visor navega por hoja física.
 * Sin esta conversión, abrir una cita lleva al lector dos páginas más
 * allá, y una herramienta de verificación que manda a la página
 * equivocada es peor que no tenerla.
 *
 * `null` cuando no hay desfase medido: entonces la única lectura honesta
 * es tratar el número como hoja y rotularlo como tal, en vez de fingir
 * una conversión que no se puede hacer.
 */
export function sheetForPrintedPage(printed: number, offset: number | null): number | null {
    if (offset === null) return null;
    if (!Number.isFinite(printed)) return null;
    const sheet = printed - offset;
    return sheet >= 1 ? sheet : null;
}
