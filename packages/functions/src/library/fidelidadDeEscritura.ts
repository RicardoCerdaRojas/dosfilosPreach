/**
 * Fidelidad de escritura del texto extraído: ¿llegaron el griego y el hebreo
 * CON sus marcas?
 *
 * Es la copia de producción de `scriptFidelity`, de
 * `scripts/extraction-bakeoff/lib/metrics.mjs`. El bakeoff la usa para comparar
 * motores fuera de línea; acá mide cada libro real que se extrae. Una prueba de
 * paridad corre las dos sobre los mismos textos: si alguien afina una, la otra
 * tiene que acompañar, o la ficha y el bakeoff dejan de hablar de lo mismo.
 *
 * Lo que agrega sobre `censusOf`: el censo cuenta LETRAS, y una extracción que
 * reconoce las letras y tira los espíritus y acentos pasa el censo con nota
 * perfecta. Para exégesis ese texto no sirve, y en un diff se ve bien.
 *
 * Cómo leer los números (medido en el bakeoff):
 *   - griego politónico corrido: `greekDiacriticRatio` entre 0,35 y 0,60;
 *   - hebreo puntuado: `niqqudRatio` entre 0,6 y 1,0;
 *   - un ratio cerca de 0 con muchas letras es la firma del motor que
 *     reconoció la letra y perdió la marca.
 */

const RE_GREEK_LETTER = /\p{Script=Greek}/gu;
const RE_HEBREW_CHAR = /\p{Script=Hebrew}/gu;
/** Consonantes hebreas, con las cinco finales. */
const RE_HEBREW_CONSONANT = /[א-ת]/gu;
/** Niqqud. Excluye maqaf (U+05BE) y paseq (U+05C0), que son puntuación. */
const RE_NIQQUD = /[ְ-ׇֽֿׁׂ]/gu;
/** Te'amim: los acentos de cantilación de BHS y las ediciones críticas. */
const RE_CANTILLATION = /[֑-֯]/gu;
/** Marcas combinantes genéricas: así llegan espíritus y acentos tras NFD. */
const RE_COMBINING = /[̀-ͯ]/u;
const RE_REPLACEMENT = /�/gu;
const RE_GREEK = /\p{Script=Greek}/u;
const RE_ORPHAN_CANDIDATE = /[̀-֑ͯ-ׇ]/u;
const RE_SPACE = /\s/u;

export interface FidelidadDeEscritura {
    greekLetters: number;
    greekDiacritics: number;
    greekDiacriticRatio: number;
    hebrewChars: number;
    hebrewConsonants: number;
    niqqud: number;
    niqqudRatio: number;
    cantillation: number;
    cantillationRatio: number;
    /** U+FFFD: el motor no supo qué carácter era y lo dijo. */
    replacementChars: number;
    /** Marcas sin letra que las lleve: el texto se ve casi bien y no se puede buscar. */
    orphanCombining: number;
}

const contar = (text: string, re: RegExp): number => (text.match(re) ?? []).length;
const ratio = (num: number, den: number): number => (den ? num / den : 0);

export function fidelidadDeEscritura(text: string): FidelidadDeEscritura {
    const t = text ?? '';
    // NFD para las marcas a propósito: un motor no debe puntuar distinto por
    // entregar ἀ precompuesta o α + U+0313. La pregunta es si la marca llegó.
    const nfc = t.normalize('NFC');
    const nfd = t.normalize('NFD');

    const greekLetters = contar(nfc, RE_GREEK_LETTER);
    const greekDiacritics = marcasSobreGriego(nfd);
    const hebrewConsonants = contar(nfc, RE_HEBREW_CONSONANT);
    const niqqud = contar(nfc, RE_NIQQUD);
    const cantillation = contar(nfc, RE_CANTILLATION);

    return {
        greekLetters,
        greekDiacritics,
        greekDiacriticRatio: ratio(greekDiacritics, greekLetters),
        hebrewChars: contar(nfc, RE_HEBREW_CHAR),
        hebrewConsonants,
        niqqud,
        niqqudRatio: ratio(niqqud, hebrewConsonants),
        cantillation,
        cantillationRatio: ratio(cantillation, hebrewConsonants),
        replacementChars: contar(nfc, RE_REPLACEMENT),
        orphanCombining: marcasHuerfanas(nfd),
    };
}

/**
 * Marcas combinantes cuya base es griega. Se atribuye cada marca al último
 * carácter no combinante, que es lo que hace quien la dibuja; así el español
 * acentuado de alrededor no infla el ratio del griego.
 */
function marcasSobreGriego(nfd: string): number {
    let total = 0;
    let baseGriega = false;
    for (const ch of nfd) {
        if (RE_COMBINING.test(ch)) {
            if (baseGriega) total++;
            continue;
        }
        baseGriega = RE_GREEK.test(ch);
    }
    return total;
}

/** Marcas al principio del texto o después de un espacio: no tienen letra. */
function marcasHuerfanas(nfd: string): number {
    let huerfanas = 0;
    let anterior = '';
    for (const ch of nfd) {
        if (RE_ORPHAN_CANDIDATE.test(ch) && (anterior === '' || RE_SPACE.test(anterior))) huerfanas++;
        anterior = ch;
    }
    return huerfanas;
}
