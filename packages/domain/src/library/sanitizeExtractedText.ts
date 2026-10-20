/**
 * Saneamiento del texto extraído de un PDF, ANTES de que entre al índice.
 *
 * ## Por qué existe
 *
 * Un PDF es un archivo que sube un tercero, y su texto termina en dos lugares
 * peligrosos: dentro del prompt de un modelo (como contexto recuperado) y
 * dentro de una cita que el pastor lee y firma. Entre esos dos destinos hay
 * una familia de caracteres que el ojo no ve y el modelo sí:
 *
 *   - **Caracteres de ancho cero** (`U+200B`, `U+FEFF`, `U+2060`): texto
 *     invisible que puede llevar instrucciones al modelo sin que nadie que
 *     revise el documento lo note.
 *   - **El bloque TAG** (`U+E0000`–`U+E007F`): el canal clásico de inyección
 *     invisible. Codifica ASCII completo en caracteres que ningún visor
 *     dibuja.
 *   - **Overrides bidireccionales** (`U+202A`–`U+202E`, `U+2066`–`U+2069`):
 *     hacen que lo MOSTRADO difiera de lo ALMACENADO. Un revisor humano lee
 *     una cosa y el modelo recibe otra.
 *   - **Controles C0/C1**: ruido de extracción que ninguna tipografía dibuja.
 *
 * Nada de esto es hipotético para este corpus: los PDFs de la biblioteca ya
 * demostraron traer codificaciones rotas (fuentes griegas sin mapa Unicode),
 * así que la capa de texto de un PDF NO es texto confiable.
 *
 * ## Qué NO toca, a propósito
 *
 * - **Marcas combinantes.** Los espíritus y acentos del griego politónico y
 *   el niqqud/cantilación del hebreo (`U+0591`–`U+05C7`) son la carga útil de
 *   este producto. Se conservan intactas: sacarlas sería destruir justo lo que
 *   el tier promete.
 * - **`U+200E`/`U+200F` (LRM/RLM).** Son invisibles, pero no ocultan texto:
 *   sólo empujan la dirección de un tramo neutro. En un corpus con hebreo
 *   ayudan a que la cita se lea bien, y no habilitan el ataque que motiva este
 *   módulo —que es meter texto que el humano no ve y el modelo sí—. Los
 *   overrides sí lo habilitan, y esos se van.
 * - **Los marcadores de página** `<!-- page: N -->` y la estructura Markdown.
 *   Son el contrato con el chunker; tocarlos rompería la cita verificable.
 * - **Las elisiones.** `ἀλλ᾽`, `μεθ᾿`, `δ᾽`: ahí el signo NO es un espíritu,
 *   es un apóstrofo. Ver `normalizeGreekBreathings` para cómo se distinguen.
 *
 * ## Y una cosa que sí compone: los espíritus partidos
 *
 * El OCR de un libro escaneado emite a menudo el espíritu como carácter
 * SUELTO delante de la vocal —`᾿Ι` en vez de `Ἰ`— y esas son dos cadenas
 * distintas para cualquier búsqueda. Medido sobre los dos comentarios de
 * Santiago que entran a la biblioteca: en Metzger, **289 de 368** iotas
 * mayúsculas con espíritu están partidas (el 78%), así que buscar `Ἰησοῦ`
 * no encuentra la mayoría de las menciones de Jesús. Ver
 * `normalizeGreekBreathings`.
 *
 * ## Espejo en `packages/functions`
 *
 * `packages/functions` no depende de `@dosfilos/domain` a propósito (corre en
 * otro runtime). Este módulo está duplicado ahí, y un test de paridad compara
 * las dos tablas LEYENDO el fuente. Si tocás `SANITIZER_RANGES` acá, tocá la
 * copia — el test lo exige.
 */

/** Categoría de carácter removido. Se reporta por separado para poder auditar. */
export type SanitizedCategory =
    | 'control'
    | 'zeroWidth'
    | 'softHyphen'
    | 'bidi'
    | 'tag'
    | 'privateUse';

/**
 * Tabla única de rangos removidos: `[inicio, fin, categoría]`, ambos extremos
 * inclusive, en code points.
 *
 * ⚠️ Espejada en `packages/functions/src/library/sanitizeExtractedText.ts`.
 * El test de paridad compara las dos tablas leyendo el fuente.
 */
export const SANITIZER_RANGES: ReadonlyArray<readonly [number, number, SanitizedCategory]> = [
    // C0: todo menos \t (0x09) y \n (0x0A). \r se normaliza antes, no se remueve acá.
    [0x0000, 0x0008, 'control'],
    [0x000b, 0x000c, 'control'],
    [0x000e, 0x001f, 'control'],
    [0x007f, 0x009f, 'control'],   // DEL + C1
    [0x00ad, 0x00ad, 'softHyphen'], // guion suave: en PDFs parte palabras a mitad
    [0x180e, 0x180e, 'zeroWidth'],  // MONGOLIAN VOWEL SEPARATOR
    [0x200b, 0x200d, 'zeroWidth'],  // ZWSP, ZWNJ, ZWJ
    [0x202a, 0x202e, 'bidi'],       // LRE, RLE, PDF, LRO, RLO
    [0x2060, 0x2064, 'zeroWidth'],  // WORD JOINER + invisibles matemáticos
    [0x2066, 0x2069, 'bidi'],       // LRI, RLI, FSI, PDI
    [0xe000, 0xf8ff, 'privateUse'], // Uso privado: glifos sin significado Unicode
    [0xfeff, 0xfeff, 'zeroWidth'],  // BOM / ZWNBSP
    [0xfff9, 0xfffb, 'control'],    // anotación interlineal
    [0xe0000, 0xe007f, 'tag'],      // bloque TAG: canal de inyección invisible
];

export interface SanitizationReport {
    /** Total de code points removidos. */
    removed: number;
    /** Desglose por categoría. Sólo aparecen las categorías con al menos uno. */
    byCategory: Partial<Record<SanitizedCategory, number>>;
    /** `true` si se normalizó algún fin de línea CRLF/CR. */
    normalizedLineEndings: boolean;
    /** Espíritus griegos sueltos que se volvieron a pegar a su vocal. */
    greekBreathingsComposed: number;
    /** Letras de otro alfabeto dentro de palabras griegas, cambiadas por la griega (`normalizeGreekLookalikes`). */
    greekLookalikesFixed?: number;
}

export interface SanitizedText {
    text: string;
    report: SanitizationReport;
}

/**
 * Signos de respiración/acento en su forma SUELTA (spacing) y las marcas
 * combinantes equivalentes. `[codePoint suelto, combinantes...]`.
 *
 * Ojo con lo que NO está acá: `U+1FBD` (KORONIS). Es el mismo dibujo, pero
 * su uso real en estos textos es el apóstrofo de elisión —`ἀλλ᾽`, `δ᾽`— y
 * componerlo destruiría la palabra. Se deja fuera a propósito; la regla de
 * contexto de `normalizeGreekBreathings` es la segunda defensa.
 *
 * ⚠️ Espejada en `packages/functions/src/library/sanitizeExtractedText.ts`.
 */
export const GREEK_SPACING_BREATHINGS: ReadonlyArray<readonly [number, readonly number[]]> = [
    [0x1fbf, [0x0313]],          // PSILI (espíritu suave)
    [0x1ffe, [0x0314]],          // DASIA (espíritu áspero)
    [0x1fcd, [0x0313, 0x0300]],  // PSILI + VARIA
    [0x1fce, [0x0313, 0x0301]],  // PSILI + OXIA
    [0x1fcf, [0x0313, 0x0342]],  // PSILI + PERISPOMENI
    [0x1fdd, [0x0314, 0x0300]],  // DASIA + VARIA
    [0x1fde, [0x0314, 0x0301]],  // DASIA + OXIA
    [0x1fdf, [0x0314, 0x0342]],  // DASIA + PERISPOMENI
];

/**
 * Vocales y rho: lo único a lo que un espíritu puede pertenecer.
 *
 * Se prueba contra la BASE del carácter (NFD, primer code point) para que
 * `ά` cuente como alfa y `Ἰ` como iota. Probar la forma compuesta obligaría a
 * enumerar las decenas de precompuestas del bloque politónico, y ese bloque
 * además contiene los propios signos sueltos, que no son vocales.
 */
const GREEK_VOWEL_OR_RHO = /^[αεηιουωρΑΕΗΙΟΥΩΡ]/u;

/**
 * Signos de respiración/acento en su forma suelta. Viven DENTRO del bloque
 * griego extendido pero no son letras, y esa diferencia decide: `᾽᾿Αρμαγεδῶ`
 * —dos signos seguidos, cosa que el OCR produce— sólo se compone si el
 * primero no cuenta como letra.
 */
const GREEK_SPACING_MARKS = /[\u1fbd\u1fbf-\u1fc1\u1fcd-\u1fcf\u1fdd-\u1fdf\u1fed-\u1fef\u1ffd\u1ffe]/u;

/** Rango griego completo, marcas incluidas. Filtrar con `isGreekLetter`. */
const GREEK_RANGE = /[\u0370-\u03ff\u1f00-\u1fff]/u;

/** Letra griega de verdad: del rango griego, pero no uno de sus signos sueltos. */
function isGreekLetter(char: string): boolean {
    return GREEK_RANGE.test(char) && !GREEK_SPACING_MARKS.test(char);
}

/** Marcas combinantes, que hay que sacar para mirar la letra de abajo. */
const COMBINING_MARKS = /[\u0300-\u036f\u0342\u0345]/gu;

/**
 * Vuelve a pegar los espíritus que el OCR dejó sueltos delante de la vocal.
 *
 * `᾿Ιησοῦ` (dos caracteres: espíritu suelto + iota) pasa a ser `Ἰησοῦ` (uno).
 * Son cadenas distintas para cualquier búsqueda y para cualquier embedding,
 * y el pastor que escribe `Ἰησοῦ` en el buscador no encuentra la página que
 * la contiene.
 *
 * ## La regla de contexto, que es lo delicado
 *
 * Se compone SÓLO cuando el signo abre palabra —el carácter anterior no es
 * una letra griega— y lo sigue una vocal o rho. Las dos condiciones juntas
 * son las que separan el espíritu de la elisión:
 *
 * | Caso | Anterior | Siguiente | Qué se hace |
 * |---|---|---|---|
 * | `᾿Ιησοῦ` (espíritu) | espacio | `Ι` | se compone |
 * | `ἀλλ᾽ αὐτὸς` (elisión) | `λ` | espacio | se deja |
 * | `ἀφ᾽ὑμῶν` (elisión sin espacio) | `φ` | `ὑ` | **se deja** — por el anterior |
 * | `᾿ aary` (ruido de OCR) | espacio | espacio | se deja |
 *
 * La tercera fila es la que obliga a mirar el carácter ANTERIOR: un espíritu
 * nunca sigue a una letra griega, pero una elisión siempre lo hace. Medido
 * sobre los dos comentarios reales: la regla compone 569 espíritus partidos
 * y no toca ninguna de las 537 elisiones.
 */
export function normalizeGreekBreathings(input: string): { text: string; composed: number } {
    const spacing = new Map<number, readonly number[]>(
        GREEK_SPACING_BREATHINGS.map(([cp, combining]) => [cp, combining])
    );

    const chars = [...input];
    const out: string[] = [];
    let composed = 0;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i]!;
        const combining = spacing.get(char.codePointAt(0)!);
        const next = chars[i + 1];

        if (combining && next && GREEK_VOWEL_OR_RHO.test(next.normalize('NFD'))) {
            // El anterior es el que distingue espíritu de elisión: se mira la
            // salida, no la entrada, porque un signo ya compuesto en esta misma
            // pasada dejó una letra griega ahí. Se le quitan las combinantes
            // para llegar a la letra de abajo.
            const prev = out.length > 0 ? out[out.length - 1]! : '';
            const prevBase = prev.replace(COMBINING_MARKS, '').slice(-1);
            const openWord = prevBase === '' || !isGreekLetter(prevBase);
            if (openWord) {
                out.push(next + combining.map((cp) => String.fromCodePoint(cp)).join(''));
                composed++;
                i++; // la vocal ya se consumió
                continue;
            }
        }
        out.push(char);
    }

    // NFC pega la marca combinante a su base: `Ι` + U+0313 → `Ἰ`.
    return { text: out.join('').normalize('NFC'), composed };
}

/**
 * El signo de micro «µ» (U+00B5) dentro de una palabra griega es una «μ»
 * (U+03BC) mal codificada: a la vista son idénticas, pero la búsqueda no las
 * iguala («μανθάνω» no encuentra «µανθάνω») y la clave del lema pierde la
 * letra. Medido (lote `kittel-y-tuggy`, 2026-10-20): la lectura por visión
 * del léxico de Tuggy trajo 1.946 «µ» y ninguna en la capa de texto del PDF;
 * Kittel, ninguna. Sólo se cambia en contexto griego: junto a una letra
 * griega o a otra «µ» (γάµµα), entre paréntesis dentro de la palabra
 * (ἐμπί(µ)πλημι), como cifra (µ´) o junto a su mayúscula (Μ µ). Un «5 µg»
 * suelto no se toca. Idempotente.
 *
 * ⚠️ Espejada en `packages/functions/src/library/sanitizeExtractedText.ts`
 * (prueba de paridad allá).
 */
const LETRA_GRIEGA = '\\u0370-\\u03FF\\u1F00-\\u1FFF';
const GRIEGO = `${LETRA_GRIEGA}\\u0300-\\u036F`;
const MICRO_EN_GRIEGO = new RegExp([
    // Pegada a una letra griega o a otra «µ» (γάµµα), también entre paréntesis
    // dentro de la palabra: ἐμπί(µ)πλημι.
    `\\u00B5(?=\\)?[${GRIEGO}\\u00B5])`,
    // Detrás: una LETRA griega (con sus marcas). Una marca sola sobre una base
    // latina («café» en NFD) no cuenta.
    `(?<=[${LETRA_GRIEGA}][\\u0300-\\u036F]*\\(?)\\u00B5`,
    // La cifra griega: µ´ (40).
    '\\u00B5(?=[\\u00B4\\u0374\\u02B9])',
    // La letra suelta junto a su mayúscula: «Μ µ», «Μ, µ».
    '(?<=\\u039C[,\\s]{1,2})\\u00B5',
].join('|'), 'g');

export function normalizeGreekLookalikes(input: string): { text: string; fixed: number } {
    let fixed = 0;
    const text = input.replace(MICRO_EN_GRIEGO, () => { fixed++; return '\u03BC'; });
    return { text, fixed };
}

function categoryOf(codePoint: number): SanitizedCategory | null {
    for (const [start, end, category] of SANITIZER_RANGES) {
        if (codePoint >= start && codePoint <= end) return category;
    }
    return null;
}

/**
 * Sanea el texto extraído. Idempotente: aplicarlo dos veces da lo mismo que
 * una.
 *
 * Recorre por code point (no por unidad UTF-16) para que el bloque TAG, que
 * vive fuera del BMP, se detecte entero en vez de por mitades de par
 * suplente.
 */
export function sanitizeExtractedText(input: string): SanitizedText {
    if (!input) {
        return {
            text: input ?? '',
            report: { removed: 0, byCategory: {}, normalizedLineEndings: false, greekBreathingsComposed: 0 },
        };
    }

    // Fines de línea primero: CRLF y CR sueltos pasan a \n. Se hace antes del
    // barrido para que el \r no se cuente como control removido — es una
    // normalización, no una remoción, y contarla como tal inflaría el reporte
    // en cualquier documento de origen Windows.
    const normalized = input.replace(/\r\n?/g, '\n');
    const normalizedLineEndings = normalized !== input;

    const byCategory: Partial<Record<SanitizedCategory, number>> = {};
    let removed = 0;
    let out = '';

    for (const char of normalized) {
        const codePoint = char.codePointAt(0)!;
        const category = categoryOf(codePoint);
        if (category) {
            byCategory[category] = (byCategory[category] ?? 0) + 1;
            removed++;
            continue;
        }
        out += char;
    }

    // Los espíritus se componen DESPUÉS de remover: un invisible entre el
    // signo y su vocal —que es exactamente lo que el saneo acaba de sacar—
    // rompería la regla de adyacencia y dejaría el espíritu suelto.
    const greek = normalizeGreekBreathings(out);
    const parecidas = normalizeGreekLookalikes(greek.text);

    return {
        text: parecidas.text,
        report: {
            removed,
            byCategory,
            normalizedLineEndings,
            greekBreathingsComposed: greek.composed,
            greekLookalikesFixed: parecidas.fixed,
        },
    };
}

/** Azúcar para los llamadores que no necesitan el reporte. */
export function sanitizeExtractedTextOnly(input: string): string {
    return sanitizeExtractedText(input).text;
}

/** Resumen de una línea para logs, o `null` si no hubo nada que hacer. */
export function describeSanitization(report: SanitizationReport): string | null {
    const partes: string[] = [];
    if (report.removed > 0) {
        const detail = Object.entries(report.byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([category, count]) => `${category}=${count}`)
            .join(' ');
        partes.push(`${report.removed} caracteres invisibles removidos (${detail})`);
    }
    if (report.greekBreathingsComposed > 0) {
        partes.push(`${report.greekBreathingsComposed} espíritus griegos recompuestos`);
    }
    return partes.length > 0 ? partes.join('; ') : null;
}
