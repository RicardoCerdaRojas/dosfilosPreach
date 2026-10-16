/**
 * El canon de 66 libros —id, capítulos y grafías— para reconocer pasajes en
 * los fragmentos de la biblioteca (fase «buscador de la biblioteca», etapa 3).
 *
 * Es una COPIA de `BIBLE_CANON` (`packages/domain/src/bible/canon/BibleCanon.ts`),
 * porque `functions` no importa `@dosfilos/domain`. La prueba de paridad
 * (`__tests__/refsDeTexto.test.ts`) la compara con el dominio libro por libro:
 * si alguien agrega una grafía allá y no acá, la prueba falla.
 *
 * Las grafías van en minúscula y sin acentos, como las normaliza el dominio.
 */
export type LibroDelCanon = readonly [id: string, capitulos: number, grafias: readonly string[]];

export const CANON_BIBLICO: ReadonlyArray<LibroDelCanon> = [
    ['GEN', 50, ['genesis', 'gen', 'gn', 'ge']],
    ['EXO', 40, ['exodo', 'exodus', 'exo', 'ex']],
    ['LEV', 27, ['levitico', 'leviticus', 'lev', 'lv']],
    ['NUM', 36, ['numeros', 'numbers', 'num', 'nu', 'nm']],
    ['DEU', 34, ['deuteronomio', 'deuteronomy', 'deut', 'deu', 'dt', 'dn']],
    ['JOS', 24, ['josue', 'joshua', 'jos', 'jos.', 'jue']],
    ['JDG', 21, ['jueces', 'judges', 'jue', 'jdg', 'jdc', 'jud']],
    ['RUT', 4, ['rut', 'ruth', 'rt', 'ru']],
    ['1SA', 31, ['1samuel', '1 samuel', '1sa', '1 sa', '1sam', '1 sam', 'i samuel', 'i sa', 'i sam', '1s', '1 s']],
    ['2SA', 24, ['2samuel', '2 samuel', '2sa', '2 sa', '2sam', '2 sam', 'ii samuel', 'ii sa', 'ii sam', '2s', '2 s']],
    ['1KI', 22, ['1reyes', '1 reyes', '1re', '1 re', '1r', '1 r', '1kings', '1 kings', '1ki', '1 ki', '1kgs', '1 kgs', 'i reyes', 'i kings']],
    ['2KI', 25, ['2reyes', '2 reyes', '2re', '2 re', '2r', '2 r', '2kings', '2 kings', '2ki', '2 ki', '2kgs', '2 kgs', 'ii reyes', 'ii kings']],
    ['1CH', 29, ['1cronicas', '1 cronicas', '1cr', '1 cr', '1cro', '1 cro', '1ch', '1 ch', '1chr', '1 chr', '1chron', '1 chron', 'i cronicas', 'i chronicles']],
    ['2CH', 36, ['2cronicas', '2 cronicas', '2cr', '2 cr', '2cro', '2 cro', '2ch', '2 ch', '2chr', '2 chr', '2chron', '2 chron', 'ii cronicas', 'ii chronicles']],
    ['EZR', 10, ['esdras', 'ezra', 'esd', 'esr', 'ezr']],
    ['NEH', 13, ['nehemias', 'nehemiah', 'neh', 'ne']],
    ['EST', 10, ['ester', 'esther', 'est', 'es']],
    ['JOB', 42, ['job', 'jb']],
    ['PSA', 150, ['salmos', 'salmo', 'psalms', 'psalm', 'sal', 'sl', 'sa', 'ps', 'psa']],
    ['PRO', 31, ['proverbios', 'proverbs', 'pr', 'pro', 'prov', 'prv']],
    ['ECC', 12, ['eclesiastes', 'ecclesiastes', 'ec', 'ecl', 'ecc', 'qoh', 'qohelet']],
    ['SNG', 8, ['cantares', 'cantar de los cantares', 'cant', 'ct', 'song of solomon', 'song of songs', 'song', 'sos', 'sng', 'cnt']],
    ['ISA', 66, ['isaias', 'isaiah', 'isa', 'is']],
    ['JER', 52, ['jeremias', 'jeremiah', 'jer', 'jr']],
    ['LAM', 5, ['lamentaciones', 'lamentations', 'lam', 'lm']],
    ['EZK', 48, ['ezequiel', 'ezekiel', 'ez', 'eze', 'ezk', 'ezeq']],
    ['DAN', 12, ['daniel', 'dan', 'dn', 'da']],
    ['HOS', 14, ['oseas', 'hosea', 'os', 'hos', 'ho']],
    ['JOL', 3, ['joel', 'jl', 'jol', 'joe']],
    ['AMO', 9, ['amos', 'am', 'amo']],
    ['OBA', 1, ['abdias', 'obadiah', 'abd', 'ab', 'oba', 'ob']],
    ['JON', 4, ['jonas', 'jonah', 'jon', 'jn']],
    ['MIC', 7, ['miqueas', 'micah', 'miq', 'mi', 'mic']],
    ['NAM', 3, ['nahum', 'nah', 'na', 'nam']],
    ['HAB', 3, ['habacuc', 'habakkuk', 'hab', 'hb']],
    ['ZEP', 3, ['sofonias', 'zephaniah', 'sof', 'so', 'zep', 'zeph']],
    ['HAG', 2, ['hageo', 'haggai', 'hag', 'hg']],
    ['ZEC', 14, ['zacarias', 'zechariah', 'zac', 'za', 'zec', 'zech']],
    ['MAL', 4, ['malaquias', 'malachi', 'mal', 'ml']],
    ['MAT', 28, ['mateo', 'matthew', 'mat', 'mt']],
    ['MRK', 16, ['marcos', 'mark', 'mar', 'mc', 'mk', 'mrk']],
    ['LUK', 24, ['lucas', 'luke', 'luc', 'lc', 'lk', 'luk']],
    ['JHN', 21, ['juan', 'john', 'jn', 'jhn', 'jua', 'jo']],
    ['ACT', 28, ['hechos', 'acts', 'hch', 'hec', 'hc', 'ac', 'act']],
    ['ROM', 16, ['romanos', 'romans', 'rom', 'ro', 'rm']],
    ['1CO', 16, ['1corintios', '1 corintios', '1co', '1 co', '1cor', '1 cor', '1corinthians', '1 corinthians', 'i corintios', 'i corinthians', '1c', '1 c']],
    ['2CO', 13, ['2corintios', '2 corintios', '2co', '2 co', '2cor', '2 cor', '2corinthians', '2 corinthians', 'ii corintios', 'ii corinthians', '2c', '2 c']],
    ['GAL', 6, ['galatas', 'galatians', 'gal', 'ga', 'gl']],
    ['EPH', 6, ['efesios', 'ephesians', 'efe', 'ef', 'eph', 'ep']],
    ['PHP', 4, ['filipenses', 'philippians', 'fil', 'fl', 'php', 'phil']],
    ['COL', 4, ['colosenses', 'colossians', 'col', 'co']],
    ['1TH', 5, ['1tesalonicenses', '1 tesalonicenses', '1ts', '1 ts', '1tes', '1 tes', '1thess', '1 thess', '1th', '1 th', 'i tesalonicenses', 'i thessalonians']],
    ['2TH', 3, ['2tesalonicenses', '2 tesalonicenses', '2ts', '2 ts', '2tes', '2 tes', '2thess', '2 thess', '2th', '2 th', 'ii tesalonicenses', 'ii thessalonians']],
    ['1TI', 6, ['1timoteo', '1 timoteo', '1ti', '1 ti', '1tim', '1 tim', '1timothy', '1 timothy', 'i timoteo', 'i timothy']],
    ['2TI', 4, ['2timoteo', '2 timoteo', '2ti', '2 ti', '2tim', '2 tim', '2timothy', '2 timothy', 'ii timoteo', 'ii timothy']],
    ['TIT', 3, ['tito', 'titus', 'tit', 'ti']],
    ['PHM', 1, ['filemon', 'philemon', 'flm', 'fm', 'phm', 'phlm']],
    ['HEB', 13, ['hebreos', 'hebrews', 'heb', 'he', 'hb']],
    ['JAS', 5, ['santiago', 'james', 'sant', 'stg', 'jas', 'jam', 'sg']],
    ['1PE', 5, ['1pedro', '1 pedro', '1pe', '1 pe', '1pet', '1 pet', '1peter', '1 peter', '1p', '1 p', 'i pedro', 'i peter']],
    ['2PE', 3, ['2pedro', '2 pedro', '2pe', '2 pe', '2pet', '2 pet', '2peter', '2 peter', '2p', '2 p', 'ii pedro', 'ii peter']],
    ['1JN', 5, ['1juan', '1 juan', '1jn', '1 jn', '1jhn', '1 jhn', '1jua', '1 jua', '1john', '1 john', 'i juan', 'i john']],
    ['2JN', 1, ['2juan', '2 juan', '2jn', '2 jn', '2jhn', '2 jhn', '2jua', '2 jua', '2john', '2 john', 'ii juan', 'ii john']],
    ['3JN', 1, ['3juan', '3 juan', '3jn', '3 jn', '3jhn', '3 jhn', '3jua', '3 jua', '3john', '3 john', 'iii juan', 'iii john']],
    ['JUD', 1, ['judas', 'jude', 'jud', 'jd', 'jds']],
    ['REV', 22, ['apocalipsis', 'revelation', 'apoc', 'apo', 'ap', 'rev', 're']],
];

/**
 * Grafías que nombran a dos libros y en las que el número de capítulo no
 * alcanza para decidir (p. ej. «Jn 3:16»: Jonás tiene 4 capítulos). El
 * dominio le pregunta al usuario; al indexar no hay a quién preguntar, así
 * que gana el uso más común en los comentarios.
 */
export const PREFERENCIA_SI_AMBIGUA: Readonly<Record<string, string>> = {
    jn: 'JHN',
    hb: 'HEB',
    dn: 'DAN',
    jue: 'JDG',
    jud: 'JUD',
};

/**
 * Abreviaturas de los comentarios que el dominio no tiene: las de la SBL
 * («Matt», «Exod», «Ezek», «Pss»), la de Marcos en la RVR («Mr») y los
 * romanos cortos («I Co», «II Cor»). Viven sólo acá a propósito: el dominio
 * también infiere el libro de una obra por las palabras de su TÍTULO, y ahí
 * «Mr», «Josh» o «Matt» serían nombres de persona. La prueba de paridad exige
 * que ninguna cree una ambigüedad nueva.
 */
export const GRAFIAS_DE_COMENTARIOS: Readonly<Record<string, readonly string[]>> = {
    EXO: ['exod'],
    JOS: ['josh'],
    JDG: ['judg'],
    EST: ['esth'],
    PSA: ['pss'],
    ECC: ['eccl', 'eccles'],
    EZK: ['ezek'],
    OBA: ['obad'],
    MAT: ['matt'],
    MRK: ['mr'],
    '1CO': ['i co', 'i cor'],
    '2CO': ['ii co', 'ii cor'],
    '1TI': ['1 tm'],
    '2TI': ['2 tm'],
};
