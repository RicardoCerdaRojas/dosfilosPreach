import type { GreekMorphTag, GreekVerseTokens, GreekWordToken } from '../../greek-analyzer/morphGntToken';
import { countOshbVerbTypes, describeOshbCode } from './oshbMorphology';

/**
 * El inventario morfológico del versículo, contado y no opinado.
 *
 * La morfología del griego del NT es DETERMINISTA: viene columna por columna
 * en el archivo de MorphGNT que el sistema ya descarga para obtener el texto.
 * Aun así, al analizador se le entregaba sólo el texto corrido y se le pedía
 * que dedujera la morfología — que es pedirle que calcule a ojo algo que está
 * tabulado al lado.
 *
 * Medido en Santiago 2:2–3: la prótasis tiene CINCO subjuntivos —εἰσέλθῃ dos
 * veces, ἐπιβλέψητε y εἴπητε dos veces— y el análisis enumeró cuatro. No es
 * una invención: se verificó que las 983 formas que los 115 análisis de
 * producción enumeran están TODAS en su propio versículo, sin una sola
 * ausente. El defecto es de recuento, y un recuento no se arregla pidiendo más
 * cuidado: se arregla entregando la cuenta.
 *
 * Sirve para las dos lenguas. El griego llega tabulado por MorphGNT y el
 * hebreo por morphhb con los códigos de OSHB, que `oshbMorphology` decodifica
 * —sólo los tallos que se pudieron verificar; los raros salen con su código
 * crudo en vez de con una etiqueta inventada—.
 */

const MODO: Record<string, string> = {
    I: 'indicativo', D: 'imperativo', S: 'subjuntivo',
    O: 'optativo', N: 'infinitivo', P: 'participio',
};
const TIEMPO: Record<string, string> = {
    P: 'presente', I: 'imperfecto', F: 'futuro',
    A: 'aoristo', X: 'perfecto', Y: 'pluscuamperfecto',
};
const VOZ: Record<string, string> = { A: 'activa', M: 'media', P: 'pasiva' };
const CASO: Record<string, string> = {
    N: 'nominativo', G: 'genitivo', D: 'dativo', A: 'acusativo', V: 'vocativo',
};
const GENERO: Record<string, string> = { M: 'masculino', F: 'femenino', N: 'neutro' };
const NUMERO: Record<string, string> = { S: 'singular', P: 'plural' };

/** Cómo se lee una forma verbal: «aoristo activo subjuntivo, 3ª singular». */
function verbo(tag: GreekMorphTag): string {
    const partes = [
        tag.tense ? TIEMPO[tag.tense] : null,
        tag.voice ? VOZ[tag.voice] : null,
        tag.mood ? MODO[tag.mood] : null,
    ].filter(Boolean);
    const persona = tag.person && tag.number
        ? `${tag.person}ª ${NUMERO[tag.number]}`
        : null;
    // Participios e infinitivos no llevan persona pero sí caso y género.
    const declinado = tag.case
        ? [CASO[tag.case], tag.number ? NUMERO[tag.number] : null, tag.gender ? GENERO[tag.gender] : null]
            .filter(Boolean).join(' ')
        : null;
    return [partes.join(' '), persona ?? declinado].filter(Boolean).join(', ');
}

/** Cómo se lee una forma declinada: «genitivo singular femenino». */
function declinacion(tag: GreekMorphTag): string {
    return [
        tag.case ? CASO[tag.case] : null,
        tag.number ? NUMERO[tag.number] : null,
        tag.gender ? GENERO[tag.gender] : null,
    ].filter(Boolean).join(' ');
}

export function describeGreekToken(token: GreekWordToken): string {
    const cuerpo = token.pos === 'V' ? verbo(token.tag) : declinacion(token.tag);
    return cuerpo ? `${token.text} (${token.lemma}) — ${cuerpo}` : `${token.text} (${token.lemma})`;
}

/**
 * Cuántas formas hay de cada modo verbal, que es donde falló el recuento.
 *
 * Se cuentan las OCURRENCIAS y no las formas distintas: en Santiago 2:2
 * εἰσέλθῃ aparece dos veces y son dos subjuntivos, no uno. Contar formas
 * distintas es exactamente el error que produjo «cuatro» donde hay cinco.
 */
export function countGreekMoods(tokens: readonly GreekWordToken[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const t of tokens) {
        if (t.pos !== 'V' || !t.tag.mood) continue;
        const nombre = MODO[t.tag.mood] ?? t.tag.mood;
        out[nombre] = (out[nombre] ?? 0) + 1;
    }
    return out;
}

/**
 * El bloque que viaja al analizador.
 *
 * Va rotulado como DATO y no como análisis: dice qué hay, no qué significa.
 * La función sintáctica, el rango semántico y la decisión de traducción
 * siguen siendo del analizador, que es lo que no es calculable.
 *
 * Cadena vacía cuando no hay tokens: el hebreo y los libros fuera del corpus
 * de MorphGNT pasan por acá sin bloque, y el analizador trabaja como antes.
 */
export function buildVerseMorphologyBlock(
    verse: GreekVerseTokens | null,
    language: 'es' | 'en',
): string {
    if (!verse || verse.tokens.length === 0) return '';

    const conteo = countGreekMoods(verse.tokens);
    const resumen = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([modo, n]) => `${n} ${modo}${n === 1 ? '' : 's'}`)
        .join(', ');

    const lineas = verse.tokens.map(t => `- ${describeGreekToken(t)}`);

    return language === 'en'
        ? [
            '## Morphology of this verse (DATA, not analysis — computed, not inferred)',
            'Taken column by column from MorphGNT. It is not an opinion and it is not negotiable: every morphological statement in your analysis must square with this table, and every count must match it.',
            resumen ? `Verbal moods present: **${resumen}**. Count OCCURRENCES, not distinct forms: a form repeated twice is two.` : '',
            ...lineas,
        ].filter(Boolean).join('\n')
        : [
            '## Morfología de este versículo (DATO, no análisis — calculado, no deducido)',
            'Sale columna por columna de MorphGNT. No es una opinión ni es negociable: toda afirmación morfológica de tu análisis tiene que cuadrar con esta tabla, y todo recuento tiene que coincidir con ella.',
            resumen ? `Modos verbales presentes: **${resumen}**. Contá OCURRENCIAS, no formas distintas: una forma repetida dos veces son dos.` : '',
            ...lineas,
        ].filter(Boolean).join('\n');
}


/**
 * Una palabra hebrea tal como la trae morphhb: su texto y su código OSHB.
 *
 * Se declara acá y no se importa de `hebrew-tutor` para que este servicio no
 * dependa del tutor: son dos usos del mismo dato, no una jerarquía.
 */
export interface HebrewMorphToken {
    readonly text: string;
    readonly lemma: string;
    readonly oshbMorphCode: string;
}

export interface HebrewVerseMorphology {
    readonly tokens: readonly HebrewMorphToken[];
}

/** La barra de morphhb separa morfemas dentro de la palabra, no palabras. */
function limpiaTexto(text: string): string {
    return text.replace(/\//g, '');
}

/**
 * El mismo bloque que el griego, para el hebreo.
 *
 * Se mantiene la forma —resumen de recuentos arriba, una línea por palabra— y
 * el rótulo de DATO: lo que cambia entre lenguas es de dónde sale la tabla, no
 * qué se hace con ella.
 */
export function buildHebrewMorphologyBlock(
    verse: HebrewVerseMorphology | null,
    language: 'es' | 'en',
): string {
    if (!verse || verse.tokens.length === 0) return '';

    const conteo = countOshbVerbTypes(verse.tokens.map(t => t.oshbMorphCode));
    const resumen = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([forma, n]) => `${n} ${forma}${n === 1 ? '' : 's'}`)
        .join(', ');

    const lineas = verse.tokens.map(t =>
        `- ${limpiaTexto(t.text)} — ${describeOshbCode(t.oshbMorphCode)}`);

    return language === 'en'
        ? [
            '## Morphology of this verse (DATA, not analysis — computed, not inferred)',
            'Taken from morphhb (Westminster Leningrad Codex with OSHB tagging). It is not an opinion and it is not negotiable: every morphological statement in your analysis must square with this table, and every count must match it.',
            resumen ? `Verb forms present: **${resumen}**. Count OCCURRENCES, not distinct forms: a form repeated twice is two.` : '',
            'A code shown raw (e.g. `Vzi3ms`) is a stem this system does not name with certainty. Do NOT guess it — say what the code says.',
            ...lineas,
        ].filter(Boolean).join('\n')
        : [
            '## Morfología de este versículo (DATO, no análisis — calculado, no deducido)',
            'Sale de morphhb (Códice de Leningrado con etiquetado OSHB). No es una opinión ni es negociable: toda afirmación morfológica de tu análisis tiene que cuadrar con esta tabla, y todo recuento tiene que coincidir con ella.',
            resumen ? `Formas verbales presentes: **${resumen}**. Contá OCURRENCIAS, no formas distintas: una forma repetida dos veces son dos.` : '',
            'Un código que salga crudo (p. ej. `Vzi3ms`) es un tallo que este sistema no nombra con certeza. NO lo adivines: decí lo que el código dice.',
            ...lineas,
        ].filter(Boolean).join('\n');
}
