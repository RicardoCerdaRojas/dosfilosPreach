/**
 * La ficha bibliográfica leída del propio ejemplar.
 *
 * El problema que resuelve: la ficha era cien por ciento manual y de 68
 * libros de la biblioteca ninguno la tenía, así que la bibliografía del
 * trabajo salía coja o —antes de que existiera la ficha— inventada por el
 * modelo. Ciudad, editorial y año del trabajo de Salmo 23 hubo que
 * corregirlos a mano contra los ejemplares.
 *
 * LA REGLA DE ESTE MÓDULO: un dato solo vale si está ESCRITO en el libro.
 * El modelo lee la página de créditos y propone; `keepOnlyWhatIsWritten`
 * descarta todo lo que no aparezca literalmente en el texto que se le dio.
 * Sabe de memoria que Ross lo publicó Kregel y lo diría aunque el PDF no
 * lo dijera: ese acierto de memoria es indistinguible de un invento, y en
 * una bibliografía un dato verosímil y falso es peor que un hueco, porque
 * el hueco se ve.
 */

import { foldForSearch } from '../../bible/searchMatching';
import type { BibliographicData } from './bibliography';

/** De dónde salió el dato. Se marca para que la interfaz pueda decirlo. */
export type BibliographyOrigin = 'ejemplar' | 'catalogo' | 'busqueda';

export interface BibliographyProposal {
    data: BibliographicData;
    origin: BibliographyOrigin;
    /** Lo que el modelo propuso y el texto no respaldaba. */
    discarded: ReadonlyArray<keyof BibliographicData>;
}

/**
 * Cuánto texto del arranque se mira.
 *
 * Medido sobre los 68 libros de la biblioteca: en 47 hay tres o más
 * señales de página de créditos dentro de las primeras 12.000 letras.
 */
const LETRAS_DE_ARRANQUE = 12_000;

/**
 * Hasta dónde se persigue la página de créditos cuando no está al frente.
 *
 * Algunos ejemplares abren con un índice largo y los créditos quedan
 * detrás. Pasado este punto ya es cuerpo del libro, y una editorial
 * nombrada en el cuerpo es la de OTRO libro citado.
 */
const LETRAS_DE_BUSQUEDA = 60_000;

/** Cuánto se lleva alrededor de la marca de créditos hallada tarde. */
const VENTANA_ANTES = 3_000;
const VENTANA_DESPUES = 6_000;

/**
 * Lo que delata una página de créditos. Se busca sobre el texto plegado,
 * que conserva las posiciones del original.
 */
const MARCAS_DE_CREDITOS = /©|copyright|derechos reservados|reservados todos los derechos|deposito legal|isbn|printed in|impreso en|first published|primera edicion/;

/** Un año de imprenta creíble: ni el 0123 de una numeración ni el 3024. */
const ANIO_MINIMO = 1450;
const ANIO_MAXIMO_SOBRE_HOY = 1;

/** Un campo más largo que esto no es un dato, es un párrafo mal recortado. */
const LARGO_MAXIMO_DE_CAMPO = 300;

/**
 * El tramo del libro donde vive la portada y los créditos.
 *
 * Devuelve el arranque y, si la marca de créditos aparece más tarde, el
 * tramo que la rodea. Los dos van pegados con un corte visible: es lo que
 * se le manda al modelo Y lo que después se usa para comprobar que cada
 * dato está escrito, así que tienen que ser el mismo texto.
 */
export function frontMatterOf(text: string, letrasDeArranque = LETRAS_DE_ARRANQUE): string {
    const limpio = (text ?? '').trim();
    if (!limpio) return '';
    const arranque = limpio.slice(0, letrasDeArranque);
    if (limpio.length <= letrasDeArranque) return arranque;

    const plegado = foldForSearch(limpio.slice(0, LETRAS_DE_BUSQUEDA));
    if (MARCAS_DE_CREDITOS.test(foldForSearch(arranque))) return arranque;

    const marca = plegado.slice(letrasDeArranque).search(MARCAS_DE_CREDITOS);
    if (marca < 0) return arranque;

    const centro = letrasDeArranque + marca;
    const desde = Math.max(letrasDeArranque, centro - VENTANA_ANTES);
    return `${arranque}\n[…]\n${limpio.slice(desde, centro + VENTANA_DESPUES)}`;
}

/**
 * Los ISBN que el texto declara, sin guiones y con el dígito de control
 * comprobado.
 *
 * El control importa: sin él, cualquier tira de dígitos de un índice pasa
 * por ISBN, y un ISBN equivocado apunta a OTRA edición, que es justo el
 * error que este camino existe para no cometer.
 */
export function isbnsIn(text: string): string[] {
    const plegado = foldForSearch(text ?? '');
    const encontrados: string[] = [];
    const agregar = (crudo: string) => {
        const limpio = crudo.replace(/[-\s]/g, '').toUpperCase();
        const largoDeIsbn = limpio.length === 13 || limpio.length === 10;
        if (largoDeIsbn && isbnValido(limpio) && !encontrados.includes(limpio)) encontrados.push(limpio);
    };

    // Declarado con su nombre: «ISBN 978-0-8254-2562-2», de diez o de trece.
    recorrer(/isbn[^0-9]{0,12}([0-9][0-9\s-]{8,16}[0-9x])/g, plegado, agregar);
    // Sin su nombre, solo con el prefijo de libro. Aparece así en la URL del
    // catálogo de la editorial, que es de donde salió el de Arnold. Un número
    // suelto de DIEZ dígitos no se toma por esta vía: uno de cada once pasa
    // la comprobación por azar, y un ISBN equivocado apunta a otra edición,
    // que es justo el error que este módulo existe para no cometer.
    recorrer(/(97[89][0-9\s-]{9,15}[0-9x])/g, plegado, agregar);

    return encontrados;
}

function recorrer(patron: RegExp, texto: string, agregar: (crudo: string) => void): void {
    let match: RegExpExecArray | null = patron.exec(texto);
    while (match !== null) {
        agregar(match[1] ?? '');
        match = patron.exec(texto);
    }
}

function isbnValido(isbn: string): boolean {
    if (isbn.length === 13) {
        let suma = 0;
        for (let i = 0; i < 12; i += 1) suma += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
        return (10 - (suma % 10)) % 10 === Number(isbn[12]);
    }
    let suma = 0;
    for (let i = 0; i < 9; i += 1) suma += Number(isbn[i]) * (10 - i);
    const control = isbn[9] === 'X' ? 10 : Number(isbn[9]);
    return (suma + control) % 11 === 0;
}

/**
 * El ISBN del ejemplar, cuando el libro declara UNO SOLO.
 *
 * No se le pregunta al modelo: se lee con el dígito de control, que es
 * una comprobación y no una opinión. Y si hay varios se devuelve ninguno:
 * un mismo libro publica ISBN distintos para la tapa dura, la rústica y
 * el electrónico, y elegir uno al azar apunta a una tirada que no es la
 * que se tiene en la mano.
 */
export function proposeIsbn(frontMatter: string): string | null {
    const encontrados = isbnsIn(frontMatter);
    return encontrados.length === 1 ? (encontrados[0] ?? null) : null;
}

/** Campos que tienen que estar escritos tal cual en el libro. */
const CAMPOS_LITERALES = [
    'author', 'title', 'subtitle', 'volume', 'volumeTitle',
    'series', 'edition', 'translator', 'editor', 'city', 'publisher', 'year',
] as const;

/**
 * Deja de la propuesta solo lo que el texto respalda.
 *
 * `authorSorted` y `shortTitle` son los dos casos derivados y se aceptan
 * por otra vía: el primero reordena el nombre y el segundo recorta el
 * título, así que ninguno de los dos aparece literal en la portada.
 */
export function keepOnlyWhatIsWritten(
    raw: BibliographicData | null | undefined,
    sourceText: string,
): { data: BibliographicData; discarded: Array<keyof BibliographicData> } {
    const data: BibliographicData = {};
    const discarded: Array<keyof BibliographicData> = [];
    if (!raw) return { data, discarded };

    const fuente = comparable(sourceText);
    const anioMaximo = new Date().getFullYear() + ANIO_MAXIMO_SOBRE_HOY;

    for (const campo of CAMPOS_LITERALES) {
        const valor = (raw[campo] ?? '').toString().trim();
        if (!valor) continue;
        if (valor.length > LARGO_MAXIMO_DE_CAMPO) { discarded.push(campo); continue; }
        if (!fuente.includes(comparable(valor))) { discarded.push(campo); continue; }
        if (campo === 'year' && !anioCreible(valor, anioMaximo)) { discarded.push(campo); continue; }
        data[campo] = valor;
    }

    const ordenado = (raw.authorSorted ?? '').trim();
    if (ordenado) {
        // Reordenar un nombre no agrega información; inventarlo, sí. Cada
        // palabra del nombre ordenado tiene que venir del nombre aceptado.
        const palabrasDelAutor = comparable(data.author ?? '').split(' ').filter(Boolean);
        const palabras = comparable(ordenado).replace(/,/g, ' ').split(' ').filter(Boolean);
        if (palabras.length > 0 && palabras.every(p => palabrasDelAutor.includes(p))) data.authorSorted = ordenado;
        else discarded.push('authorSorted');
    }

    const corto = (raw.shortTitle ?? '').trim();
    if (corto) {
        if (comparable(data.title ?? '').includes(comparable(corto))) data.shortTitle = corto;
        else discarded.push('shortTitle');
    }

    return { data, discarded };
}

/**
 * Rellena SOLO lo que está vacío y devuelve qué campos se llenaron.
 *
 * Lo que la persona ya escribió gana siempre: tiene el ejemplar en la
 * mano y el lector solo vio el PDF.
 */
export function completeWithProposal(
    current: BibliographicData | null | undefined,
    proposal: BibliographicData,
): { data: BibliographicData; filled: Array<keyof BibliographicData> } {
    const data: BibliographicData = { ...(current ?? {}) };
    const filled: Array<keyof BibliographicData> = [];
    for (const [campo, valor] of Object.entries(proposal) as Array<[keyof BibliographicData, string]>) {
        const escrito = (data[campo] ?? '').toString().trim();
        const propuesto = (valor ?? '').toString().trim();
        if (escrito || !propuesto) continue;
        data[campo] = propuesto;
        filled.push(campo);
    }
    return { data, filled };
}

/** Minúsculas, sin acentos y con los espacios colapsados. */
function comparable(text: string): string {
    // Un título cortado por el salto de línea del PDF trae el espacio en
    // otro lugar que el mismo título escrito de corrido.
    return foldForSearch(text ?? '').replace(/\s+/g, ' ').trim();
}

function anioCreible(valor: string, maximo: number): boolean {
    const n = Number(valor.replace(/[^0-9]/g, '').slice(0, 4));
    return Number.isFinite(n) && n >= ANIO_MINIMO && n <= maximo;
}
