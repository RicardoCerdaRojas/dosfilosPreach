/**
 * Los datos con que se cita un libro, y cómo se escriben.
 *
 * Existe porque el compositor recibía `author: "Ross"` y
 * `title: "A Commentary on the Psalms 1-41 (Kregel Exegetical Library)"`
 * —la clave de cita y el nombre del archivo— y de ahí tenía que sacar una
 * bibliografía Turabian completa. Lo que hacía era inventar: ciudad,
 * editorial y año salían del modelo, no del libro. En el trabajo de Salmo
 * 23 hubo que corregirlos a mano, uno por uno, contra los ejemplares.
 *
 * La regla de este módulo: lo que no está, no se escribe. Un campo vacío
 * sale como hueco visible —y la interfaz lo pide— en vez de rellenarse
 * con algo verosímil.
 */

export interface BibliographicData {
    /** Como firma el autor: «Allen P. Ross». */
    author?: string;
    /**
     * El mismo nombre para ordenar alfabéticamente: «Ross, Allen P.».
     *
     * Se guarda aparte y no se deduce: en español «Ricardo Cerda Rojas»
     * ordena por «Cerda Rojas» y cualquier regla automática parte el
     * apellido por la mitad. Se propone una forma y el autor la corrige.
     */
    authorSorted?: string;
    /** Título completo, sin el subtítulo. */
    title?: string;
    subtitle?: string;
    /** Título abreviado para las notas siguientes: «Commentary on the Psalms». */
    shortTitle?: string;
    /** Volumen dentro de una obra mayor: «1». */
    volume?: string;
    /** Título del volumen, cuando lo tiene: «1–41». */
    volumeTitle?: string;
    /** Colección: «Kregel Exegetical Library». */
    series?: string;
    /** Edición, cuando no es la primera: «2ª ed.». */
    edition?: string;
    /** Traductor o editor, cuando la cita lo exige. */
    translator?: string;
    editor?: string;
    city?: string;
    publisher?: string;
    year?: string;
    /**
     * El ISBN del ejemplar, sin guiones y siempre en trece dígitos.
     *
     * Se normaliza el de diez a trece porque son la misma tirada escrita
     * de dos maneras y muchas ediciones imprimen las dos. Es la única
     * excepción a «se guarda lo que está impreso»: el valor equivale al
     * impreso, no lo reemplaza por otro.
     *
     * No se imprime en la entrada de Turabian. Se guarda porque identifica
     * LA TIRADA: es la única llave que permite pedirle a un catálogo los
     * datos de este ejemplar y no los de otra edición, cuyas páginas no
     * son las que se citan.
     */
    isbn?: string;
}

/**
 * Todos los campos de la ficha, en el orden en que se leen de una portada.
 *
 * Vive acá y no en el formulario porque el formulario no es la única
 * pantalla que los recorre, y porque `satisfies` obliga a que cada nombre
 * sea un campo real: un campo renombrado en la interfaz de datos rompe la
 * compilación en vez de desaparecer en silencio de la pantalla.
 */
export const BIBLIOGRAPHY_FIELDS = [
    'author', 'authorSorted', 'title', 'subtitle', 'shortTitle',
    'volume', 'volumeTitle', 'series', 'edition', 'translator', 'editor',
    'city', 'publisher', 'year', 'isbn',
] as const satisfies ReadonlyArray<keyof BibliographicData>;
export type BibliographyField = (typeof BIBLIOGRAPHY_FIELDS)[number];

/** Campos sin los cuales una entrada bibliográfica queda coja. */
export const REQUIRED_BIBLIOGRAPHY_FIELDS = ['author', 'title', 'city', 'publisher', 'year'] as const;
export type RequiredBibliographyField = (typeof REQUIRED_BIBLIOGRAPHY_FIELDS)[number];

/**
 * Qué falta para poder citar este libro sin inventar nada.
 *
 * Es la lista que la interfaz muestra y la que decide si la bibliografía
 * se puede imprimir completa.
 */
export function missingBibliographyFields(data: BibliographicData | null | undefined): RequiredBibliographyField[] {
    if (!data) return [...REQUIRED_BIBLIOGRAPHY_FIELDS];
    return REQUIRED_BIBLIOGRAPHY_FIELDS.filter(field => !(data[field] ?? '').trim());
}

export function hasCompleteBibliography(data: BibliographicData | null | undefined): boolean {
    return missingBibliographyFields(data).length === 0;
}

/**
 * Propone la forma ordenable de un nombre: «Allen P. Ross» → «Ross, Allen P.».
 *
 * Es una PROPUESTA, no una regla: toma la última palabra como apellido,
 * que acierta en inglés y falla con los apellidos compuestos del español.
 * Por eso lo que se guarda es lo que el autor deja escrito.
 */
export function proposeSortedAuthor(author: string): string {
    const clean = author.trim().replace(/\s+/g, ' ');
    if (!clean || clean.includes(',')) return clean;
    // Con dos autores, mover la última palabra al frente produce basura:
    // «Bill T. Arnold and John H. Choi» daba «Choi, Bill T. Arnold and
    // John H.», y eso se imprimía en la bibliografía del trabajo. Un
    // nombre coordinado se deja como está y lo ordena la persona.
    if (TIENE_COORDINACION.test(clean)) return clean;
    const parts = clean.split(' ');
    if (parts.length < 2) return clean;
    const surname = parts[parts.length - 1]!;
    return `${surname}, ${parts.slice(0, -1).join(' ')}`;
}

/**
 * Nombres que no se ordenan moviendo la última palabra.
 *
 * Dos autores en un campo —«X and Y», «X y Y», «X & Y»— y los sufijos
 * de linaje: «Walter C. Kaiser Jr.» daba «Jr., Walter C. Kaiser».
 */
const TIENE_COORDINACION = /\s(and|y|e|&)\s|\s&\s|[\s,](jr|sr|ii|iii|h)\.?$/i;

/**
 * La entrada de bibliografía, en Turabian:
 *
 *   Ross, Allen P. *A Commentary on the Psalms*. Vol. 1, *1–41*. Kregel
 *   Exegetical Library. Grand Rapids: Kregel, 2011.
 *
 * Lo que falte se omite, y el hueco se nota. No se escribe «s.f.» ni
 * «n.p.»: esas abreviaturas afirman que el dato NO EXISTE, y lo que pasa
 * aquí es que no se ha escrito todavía.
 */
export function formatBibliographyEntry(data: BibliographicData): string {
    const parts: string[] = [];
    const author = (data.authorSorted ?? '').trim() || proposeSortedAuthor((data.author ?? '').trim());
    // «Ross, Allen P.» ya termina en punto: agregarle otro deja «P..».
    if (author) parts.push(author.endsWith('.') ? author : `${author}.`);

    const title = titleWithSubtitle(data);
    if (title) parts.push(`*${title}*.`);
    if (data.volume?.trim()) {
        parts.push(data.volumeTitle?.trim()
            ? `Vol. ${data.volume.trim()}, *${data.volumeTitle.trim()}*.`
            : `Vol. ${data.volume.trim()}.`);
    }
    if (data.edition?.trim()) parts.push(`${data.edition.trim()}.`);
    if (data.translator?.trim()) parts.push(`Traducido por ${data.translator.trim()}.`);
    if (data.editor?.trim()) parts.push(`Editado por ${data.editor.trim()}.`);
    if (data.series?.trim()) parts.push(`${data.series.trim()}.`);

    const imprint = formatImprint(data);
    if (imprint) parts.push(`${imprint}.`);

    return parts.join(' ').trim();
}

/**
 * La primera nota al pie, que va completa:
 *
 *   Allen P. Ross, *A Commentary on the Psalms*, vol. 1, *1–41*, Kregel
 *   Exegetical Library (Grand Rapids: Kregel, 2011), 561.
 */
export function formatFirstNote(data: BibliographicData, pages?: string): string {
    const parts: string[] = [];
    const author = (data.author ?? '').trim();
    if (author) parts.push(author);

    const title = titleWithSubtitle(data);
    if (title) parts.push(`*${title}*`);
    if (data.volume?.trim()) {
        parts.push(data.volumeTitle?.trim()
            ? `vol. ${data.volume.trim()}, *${data.volumeTitle.trim()}*`
            : `vol. ${data.volume.trim()}`);
    }
    if (data.edition?.trim()) parts.push(data.edition.trim());
    if (data.series?.trim()) parts.push(data.series.trim());

    const imprint = formatImprint(data);
    const head = parts.join(', ');
    const withImprint = imprint ? `${head} (${imprint})` : head;
    return appendPages(withImprint, pages);
}

/**
 * Las notas siguientes, abreviadas: «Ross, *Commentary on the Psalms*, 562».
 */
export function formatShortNote(data: BibliographicData, pages?: string): string {
    const author = shortAuthor(data);
    const title = (data.shortTitle ?? '').trim() || (data.title ?? '').trim();
    const head = [author, title ? `*${title}*` : ''].filter(Boolean).join(', ');
    return appendPages(head, pages);
}

/** Apellido solo, que es como empiezan las notas abreviadas. */
function shortAuthor(data: BibliographicData): string {
    const sorted = (data.authorSorted ?? '').trim();
    if (sorted) return sorted.split(',')[0]!.trim();
    const author = (data.author ?? '').trim();
    if (!author) return '';
    const parts = author.split(/\s+/);
    return parts[parts.length - 1]!;
}

function titleWithSubtitle(data: BibliographicData): string {
    const title = (data.title ?? '').trim();
    const subtitle = (data.subtitle ?? '').trim();
    if (!title) return '';
    return subtitle ? `${title}: ${subtitle}` : title;
}

/** «Grand Rapids: Kregel, 2011», con lo que haya. */
function formatImprint(data: BibliographicData): string {
    const city = (data.city ?? '').trim();
    const publisher = (data.publisher ?? '').trim();
    const year = (data.year ?? '').trim();
    const place = city && publisher ? `${city}: ${publisher}` : city || publisher;
    if (place && year) return `${place}, ${year}`;
    return place || year;
}

function appendPages(text: string, pages?: string): string {
    const p = (pages ?? '').trim();
    if (!text) return p;
    return p ? `${text}, ${p}` : text;
}
