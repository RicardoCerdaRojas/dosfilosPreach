/**
 * LA TABLA DE LIBROS DE LA BIBLIA EN CASTELLANO — una sola, para todas las
 * superficies.
 *
 * POR QUÉ EXISTE: esta tabla estaba escrita DOS VECES —una en el repositorio de
 * la página de Biblia y otra en el del asistente— y las dos copias ya habían
 * divergido: la del asistente reconocía `Gén`, `Éx` y `Núm`; la de la página, no.
 * O sea que escribir "Éxodo 3" funcionaba en un lado de la aplicación y "Éx 3"
 * fallaba en el otro, sin ningún error de por medio. Esa clase de desajuste ya
 * había costado dos PRs: el primero arregló una sola copia y el asistente siguió
 * roto en producción.
 *
 * LA CLAVE ES LO QUE ESCRIBE EL PASTOR; el valor es el id del libro en los datos.
 * El orden importa: la forma acentuada canónica va PRIMERO y sus variantes
 * después, porque la resolución devuelve la primera clave que calza y esa
 * primera clave es la que se le muestra de vuelta. Con "filemon" escrito a la
 * ligera, el pastor debe ver "Filemón".
 */
export const BIBLE_BOOKS_ES: Record<string, string> = {

        // Antiguo Testamento
        'Génesis': 'gn', 'Genesis': 'gn', 'Gn': 'gn', 'Gen': 'gn', 'Gén': 'gn',
        'Éxodo': 'ex', 'Exodo': 'ex', 'Ex': 'ex', 'Éx': 'ex',
        'Levítico': 'lv', 'Levitico': 'lv', 'Lv': 'lv', 'Lev': 'lv',
        'Números': 'nm', 'Numeros': 'nm', 'Nm': 'nm', 'Num': 'nm', 'Núm': 'nm',
        'Deuteronomio': 'dt', 'Dt': 'dt', 'Deut': 'dt',
        'Josué': 'js', 'Josue': 'js', 'Jos': 'js',
        'Jueces': 'jud', 'Jue': 'jud',
        'Rut': 'rt', 'Rt': 'rt',
        '1 Samuel': '1sm', '1Samuel': '1sm', '1 Sam': '1sm', '1S': '1sm', '1Sm': '1sm',
        '2 Samuel': '2sm', '2Samuel': '2sm', '2 Sam': '2sm', '2S': '2sm', '2Sm': '2sm',
        '1 Reyes': '1kgs', '1Reyes': '1kgs', '1 Rey': '1kgs', '1R': '1kgs', '1Kgs': '1kgs',
        '2 Reyes': '2kgs', '2Reyes': '2kgs', '2 Rey': '2kgs', '2R': '2kgs', '2Kgs': '2kgs',
        '1 Crónicas': '1ch', '1Cronicas': '1ch', '1 Cro': '1ch', '1Cr': '1ch', '1Ch': '1ch',
        '2 Crónicas': '2ch', '2Cronicas': '2ch', '2 Cro': '2ch', '2Cr': '2ch', '2Ch': '2ch',
        'Esdras': 'ezr', 'Esd': 'ezr',
        'Nehemías': 'ne', 'Nehemias': 'ne', 'Neh': 'ne',
        'Ester': 'et', 'Est': 'et',
        'Job': 'job', 'Jb': 'job',
        'Salmos': 'ps', 'Sal': 'ps', 'Sl': 'ps', 'Salmo': 'ps',
        'Proverbios': 'prv', 'Prov': 'prv', 'Pr': 'prv',
        'Eclesiastés': 'ec', 'Eclesiastes': 'ec', 'Ecl': 'ec',
        'Cantares': 'so', 'Cant': 'so', 'Cnt': 'so', 'Ct': 'so',
        'Isaías': 'is', 'Isaias': 'is', 'Isa': 'is', 'Is': 'is',
        'Jeremías': 'jr', 'Jeremias': 'jr', 'Jer': 'jr', 'Jr': 'jr',
        'Lamentaciones': 'lm', 'Lam': 'lm', 'Lm': 'lm',
        'Ezequiel': 'ez', 'Eze': 'ez',
        'Daniel': 'dn', 'Dan': 'dn', 'Dn': 'dn',
        'Oseas': 'ho', 'Os': 'ho',
        'Joel': 'jl', 'Jl': 'jl',
        'Amós': 'am', 'Amos': 'am', 'Am': 'am',
        'Abdías': 'ob', 'Abdias': 'ob', 'Abd': 'ob',
        'Jonás': 'jn', 'Jonas': 'jn', 'Jon': 'jn',
        'Miqueas': 'mi', 'Miq': 'mi',
        'Nahúm': 'na', 'Nahum': 'na', 'Nah': 'na',
        'Habacuc': 'hk', 'Hab': 'hk',
        'Sofonías': 'zp', 'Sofonias': 'zp', 'Sof': 'zp',
        'Hageo': 'hg', 'Hag': 'hg',
        'Zacarías': 'zc', 'Zacarias': 'zc', 'Zac': 'zc',
        'Malaquías': 'ml', 'Malaquias': 'ml', 'Mal': 'ml',

        // Nuevo Testamento - Spanish names
        'Mateo': 'mt', 'Mat': 'mt', 'Mt': 'mt',
        'Marcos': 'mk', 'Mar': 'mk', 'Mc': 'mk', 'Mr': 'mk',
        'Lucas': 'lk', 'Luc': 'lk', 'Lc': 'lk',
        'Juan': 'jo', 'Jn': 'jo',
        'Hechos': 'act', 'Hch': 'act', 'Hec': 'act',
        'Romanos': 'rm', 'Rom': 'rm', 'Ro': 'rm', 'Rm': 'rm',
        '1 Corintios': '1co', '1Corintios': '1co', '1Cor': '1co', '1 Cor': '1co', '1Co': '1co',
        '2 Corintios': '2co', '2Corintios': '2co', '2Cor': '2co', '2 Cor': '2co', '2Co': '2co',
        'Gálatas': 'gl', 'Galatas': 'gl', 'Gál': 'gl', 'Gal': 'gl', 'Ga': 'gl',
        'Efesios': 'eph', 'Ef': 'eph', 'Efe': 'eph',
        'Filipenses': 'ph', 'Fil': 'ph', 'Fp': 'ph',
        'Colosenses': 'col', 'Col': 'col',
        '1 Tesalonicenses': '1ts', '1Tesalonicenses': '1ts', '1Tes': '1ts', '1 Tes': '1ts', '1Ts': '1ts',
        '2 Tesalonicenses': '2ts', '2Tesalonicenses': '2ts', '2Tes': '2ts', '2 Tes': '2ts', '2Ts': '2ts',
        '1 Timoteo': '1ti', '1Timoteo': '1ti', '1Tim': '1ti', '1 Tim': '1ti', '1Ti': '1ti',
        '2 Timoteo': '2ti', '2Timoteo': '2ti', '2Tim': '2ti', '2 Tim': '2ti', '2Ti': '2ti',
        'Tito': 'tit', 'Tit': 'tit', 'Ti': 'tit',
        'Filemón': 'phm', 'Filemon': 'phm', 'Flm': 'phm', 'Flmn': 'phm',
        'Hebreos': 'hb', 'Heb': 'hb', 'He': 'hb',
        'Santiago': 'jm', 'Sant': 'jm', 'Stg': 'jm',
        '1 Pedro': '1pe', '1Pedro': '1pe', '1Ped': '1pe', '1 Ped': '1pe', '1Pe': '1pe', '1P': '1pe',
        '2 Pedro': '2pe', '2Pedro': '2pe', '2Ped': '2pe', '2 Ped': '2pe', '2Pe': '2pe', '2P': '2pe',
        '1 Juan': '1jo', '1Juan': '1jo', '1Jn': '1jo', '1 Jn': '1jo',
        '2 Juan': '2jo', '2Juan': '2jo', '2Jn': '2jo', '2 Jn': '2jo',
        '3 Juan': '3jo', '3Juan': '3jo', '3Jn': '3jo', '3 Jn': '3jo',
        'Judas': 'jd', 'Jud': 'jd',
        'Apocalipsis': 're', 'Apoc': 're', 'Ap': 're'
};

/**
 * Libros de un solo capítulo, por id.
 *
 * Cambian cómo se lee un número suelto: "Filemón 8" es el VERSÍCULO 8, no el
 * capítulo 8 — que no existe. Sin esta lista, la referencia se resuelve a un
 * capítulo inexistente y el pasaje aparece vacío sin explicación.
 */
export const SINGLE_CHAPTER_BOOK_IDS = new Set<string>([
    'ob',  // Abdías
    'phm', // Filemón
    '2jo', // 2 Juan
    '3jo', // 3 Juan
    'jd',  // Judas
]);

/** Minúsculas y sin tildes: "FILEMÓN", "filemon" y "Filemón" son lo mismo. */
export function normalizeBookName(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Resuelve un nombre de libro escrito por una persona.
 *
 * Devuelve LAS DOS FORMAS porque cada superficie necesita una distinta: la
 * página de Biblia usa el id (`'phm'`) para leer los datos, y el asistente usa
 * la clave (`'Filemón'`) para mostrarla y para volver a entrar en la tabla. Que
 * las dos salgan de la misma resolución es lo que impide que vuelvan a
 * discrepar sobre qué libro es "filemon".
 */
export function resolveBibleBook(bookName: string): { key: string; id: string } | null {
    const buscado = normalizeBookName(bookName.trim());
    for (const [key, id] of Object.entries(BIBLE_BOOKS_ES)) {
        if (normalizeBookName(key) === buscado) return { key, id };
    }
    return null;
}
