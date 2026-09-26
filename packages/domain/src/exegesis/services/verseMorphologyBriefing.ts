import type { GreekMorphTag, GreekVerseTokens, GreekWordToken } from '../../greek-analyzer/morphGntToken';

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
 * Esto es griego solamente. El hebreo tiene morfología igual de determinista
 * en morphhb, con otro sistema de códigos que habría que mapear; entregar una
 * traducción aproximada de esos códigos sería inventar precisión.
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
