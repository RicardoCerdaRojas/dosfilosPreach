/**
 * Si una extracción sirve para citar.
 *
 * Nace de un hallazgo sobre una biblioteca real de 59 obras. Cuatro libros
 * hebreos habían extraído CERO caracteres hebreos, y dos de ellos estaban
 * citados en trabajos entregados:
 *
 *   Sasson, «Jonah» (Anchor Bible)   790.779 chars   0 hebreo   205 citas
 *   Barrick & Busenitz, gramática    342.995 chars   0 hebreo    32 citas
 *   BHQ, aparato de los Doce         676.994 chars   0 hebreo
 *   «Hebreo Bíblico», manual         827.573 chars   0 hebreo
 *
 * En el BHQ se ve el daño exacto: la prosa inglesa quedó y la palabra hebrea
 * que cada nota discute desapareció. «Uncertainty as to the meaning of ___ is
 * the root of the problem» — el aparato entero es sobre esa palabra.
 *
 * POR QUÉ ESTA REGLA Y NO UN UMBRAL DE RUIDO. Medí la proporción de caracteres
 * raros sobre las 59 obras esperando que separara lo bueno de lo roto. NO
 * SEPARA: el BHS bien extraído da 0,069 y el manual roto 0,111, con obras sanas
 * a ambos lados. Lo que sí separa es la ausencia del alfabeto que el libro
 * necesita, y lo prueba el contraejemplo: «Gramática Hebreo» de Farfán, el
 * mismo tipo de libro que Barrick, extrajo 65.188 caracteres hebreos. No es un
 * límite del sistema; a esos cuatro les fue mal.
 *
 * La regla se aplica sólo cuando el libro DECLARA que necesita ese alfabeto.
 * Un comentario en español sobre Jonás legítimamente puede no traer hebreo, y
 * marcarlo sería ruido que enseña a ignorar la advertencia.
 */

/** Lo que el extractor contó al leer el documento completo. */
export interface ScriptCensus {
    totalChars: number;
    hebrew: number;
    greek: number;
    latin: number;
}

/** Alfabeto que el contenido de una obra requiere para ser citable. */
export type RequiredScript = 'hebrew' | 'greek';

export type ExtractionHealth =
    /** Trae el alfabeto que necesita, o no se le exige ninguno. */
    | { status: 'ok' }
    /** Declara necesitar un alfabeto y no trae prácticamente nada de él. */
    | { status: 'missing-script'; script: RequiredScript; found: number }
    /** Sin censo: extraído antes de que esto existiera. No se juzga. */
    | { status: 'unknown' };

/**
 * Piso por debajo del cual el alfabeto se considera ausente.
 *
 * No es cero: un OCR puede acertar un puñado de letras sueltas por casualidad y
 * eso no significa que el libro sea utilizable. Medido contra el corpus, la
 * separación es enorme y cualquier valor de este orden decide igual — las obras
 * sanas traen decenas de miles (Farfán 65.188, Ortiz 79.687, NA28 163.605) y las
 * rotas traen 0 u 8. No hay nada cerca del límite.
 */
const MIN_SCRIPT_CHARS = 200;

export function assessExtraction(
    census: ScriptCensus | null | undefined,
    required: ReadonlyArray<RequiredScript>,
): ExtractionHealth {
    if (!census || typeof census.totalChars !== 'number') return { status: 'unknown' };
    // Un documento vacío es otro problema —extracción fallida sin más— y lo
    // reporta el estado del recurso, no este chequeo.
    if (census.totalChars === 0) return { status: 'unknown' };

    for (const script of required) {
        const found = script === 'hebrew' ? census.hebrew : census.greek;
        if (found < MIN_SCRIPT_CHARS) return { status: 'missing-script', script, found };
    }
    return { status: 'ok' };
}

/**
 * Qué alfabeto necesita una obra para ser citable.
 *
 * Deliberadamente CONSERVADOR: devuelve vacío ante la duda. Un falso positivo
 * enseña a ignorar la advertencia, y una advertencia que se ignora no protege
 * de nada. Un comentario en español sobre Jonás legítimamente puede no traer
 * una letra hebrea.
 *
 * Dos señales, en este orden:
 *
 *   1. LOS LIBROS que cubre. Es un dato, no una inferencia: si edita o comenta
 *      libros del AT necesita hebreo; del NT, griego. Manda cuando está.
 *   2. EL TÍTULO, y sólo cuando nombra su propio idioma sin ambigüedad
 *      —«Biblia Hebraica», «Novum Testamentum Graece», «Gramática hebrea»—.
 *      No es una heurística difusa: esos títulos significan una sola cosa.
 *
 * El tipo de recurso acota a qué obras se les exige: sólo a las que existen
 * PARA dar acceso a la lengua original. A un comentario expositivo no se le
 * pide hebreo aunque comente el AT; a uno EXEGÉTICO sí, porque su razón de ser
 * es trabajar sobre el texto original.
 *
 * Ese último tipo se agregó con el ruido medido y aceptado a conciencia. De 13
 * comentarios exegéticos de una biblioteca real, los del NT están sanos —Mayor
 * 81.770 caracteres griegos, Metzger 45.922— y los cinco del AT traen CERO
 * hebreo. Dos o tres están rotos de verdad, Sasson entre ellos con 205 citas en
 * trabajos entregados; alguno, como una serie de divulgación mal categorizada,
 * probablemente tenga un cero legítimo. Se prefirió marcar de más antes que
 * dejar pasar el que sostiene doscientas citas: un falso positivo se corrige
 * recategorizando la obra, y el falso negativo ya costó un trabajo entregado.
 */
const TIPOS_QUE_EXIGEN_LENGUA = new Set(['critical-text', 'grammar', 'exegetical-commentary']);

const TITULO_HEBREO = /biblia\s+hebraica|hebraica|\bBHS\b|\bBHQ\b|hebreo|hebrew|hebrea|masor|aramaic|arameo/i;
const TITULO_GRIEGO = /novum\s+testamentum\s+graece|nestle[\s-]*aland|\bNA\s?2[0-9]\b|\bNTG\b|griego|griega|greek|septuaginta|\bLXX\b/i;

export function requiredScriptsFor(resource: {
    type?: string | null;
    title?: string | null;
    coversTestament?: 'OT' | 'NT' | 'both' | null;
}): RequiredScript[] {
    if (!resource.type || !TIPOS_QUE_EXIGEN_LENGUA.has(resource.type)) return [];

    // 1. Los libros que cubre, cuando el recurso los declara.
    if (resource.coversTestament === 'OT') return ['hebrew'];
    if (resource.coversTestament === 'NT') return ['greek'];
    // 'both' no exige nada: una obra que cruza los dos testamentos puede
    // tratar uno en profundidad y el otro de paso.
    if (resource.coversTestament === 'both') return [];

    // 2. El título, sólo si nombra un idioma y no el otro.
    const titulo = resource.title ?? '';
    const heb = TITULO_HEBREO.test(titulo);
    const gr = TITULO_GRIEGO.test(titulo);
    if (heb && !gr) return ['hebrew'];
    if (gr && !heb) return ['greek'];
    return [];
}
