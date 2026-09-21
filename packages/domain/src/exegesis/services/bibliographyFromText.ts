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

/**
 * Cuánto texto del arranque se mira.
 *
 * Medido sobre los 68 libros de la biblioteca: en 47 hay tres o más
 * señales de página de créditos dentro de las primeras 12.000 letras.
 */
export const LETRAS_DE_ARRANQUE = 12_000;

/**
 * Hasta dónde se persigue la página de créditos cuando no está al frente.
 *
 * Algunos ejemplares abren con un índice largo y los créditos quedan
 * detrás. Pasado este punto ya es cuerpo del libro, y una editorial
 * nombrada en el cuerpo es la de OTRO libro citado.
 */
const LETRAS_DE_BUSQUEDA = 60_000;

/** Cuánto se lleva alrededor de la marca de créditos hallada tarde. */
export const VENTANA_ANTES = 3_000;
export const VENTANA_DESPUES = 6_000;
/** Lo que separa el arranque del tramo de créditos hallado tarde. */
export const CORTE_VISIBLE = '\n[…]\n';

/**
 * Cuánto se mira alrededor de la marca de créditos para dar por bueno un
 * pie de imprenta.
 *
 * Existe porque comprobar contra TODO el arranque no comprueba nada: el
 * prefacio de un libro cita otros libros con su ciudad, su editorial y su
 * año, y esos datos están tan «escritos en el texto» como los propios.
 * Medido sobre un arranque real de Ross con un prefacio que cita a
 * Brueggemann, la ficha entera salía aceptada y falsa.
 */
export const VENTANA_DE_CREDITOS = 1_200;

/**
 * Dónde vive la portada: el frente del frente.
 *
 * El autor y el título están impresos en las primeras hojas. Un libro
 * citado en el prefacio, no.
 */
export const LETRAS_DE_PORTADA = 2_500;

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

    // Se retrocede el largo de la marca más larga: si una cayera justo
    // sobre el corte («IS|BN»), ni el arranque ni la búsqueda la verían.
    const desdeLaBusqueda = Math.max(0, letrasDeArranque - LARGO_DE_MARCA);
    const marca = plegado.slice(desdeLaBusqueda).search(MARCAS_DE_CREDITOS);
    if (marca < 0) return arranque;

    const centro = desdeLaBusqueda + marca;
    const desde = Math.max(letrasDeArranque, centro - VENTANA_ANTES);
    return `${arranque}${CORTE_VISIBLE}${limpio.slice(desde, centro + VENTANA_DESPUES)}`;
}

/** La marca de créditos más larga, en letras. */
const LARGO_DE_MARCA = 'reservados todos los derechos'.length;

/**
 * El tramo donde puede estar impreso el pie de imprenta.
 *
 * Devuelve vacío cuando el ejemplar no tiene página de créditos: entonces
 * NO hay de dónde sacar ciudad, editorial ni año, y el hueco queda a la
 * vista, que es la respuesta correcta.
 */
export function creditsRegionOf(frontMatter: string): string {
    const texto = frontMatter ?? '';
    const marca = foldForSearch(texto).search(MARCAS_DE_CREDITOS);
    if (marca < 0) return '';
    return texto.slice(Math.max(0, marca - VENTANA_DE_CREDITOS), marca + VENTANA_DE_CREDITOS);
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
        if (!largoDeIsbn || !isbnValido(limpio)) return;
        // El de diez se pasa a trece ANTES de comparar: el mismo ejemplar
        // se imprime con las dos notaciones, una debajo de la otra, y
        // tomarlas por dos ISBN distintos dejaba sin proponer justo a los
        // libros que sí declaran el suyo.
        const canonico = limpio.length === 10 ? aIsbn13(limpio) : limpio;
        if (!encontrados.includes(canonico)) encontrados.push(canonico);
    };

    // Declarado con su nombre: «ISBN 978-0-8254-2562-2», de diez o de trece.
    // La etiqueta puede traer su propio número —«ISBN-13:»—, y sin quitarlo
    // los dígitos de la etiqueta entran al ISBN y lo echan a perder.
    recorrer(/isbn(?:-1[03])?[^0-9]{0,12}([0-9][0-9\s-]{8,16}[0-9x])/g, plegado, agregar);
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

/**
 * El mismo ejemplar, escrito en trece dígitos.
 *
 * «0-8254-2562-X» y «978-0-8254-2562-2» son el MISMO libro: el de trece
 * es el de diez con el prefijo 978 y otro dígito de control.
 */
function aIsbn13(isbn10: string): string {
    const cuerpo = `978${isbn10.slice(0, 9)}`;
    let suma = 0;
    for (let i = 0; i < 12; i += 1) suma += Number(cuerpo[i]) * (i % 2 === 0 ? 1 : 3);
    return `${cuerpo}${(10 - (suma % 10)) % 10}`;
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

/**
 * Campos que se buscan en la PORTADA, o sea al frente del arranque.
 *
 * El autor y el título del libro están impresos en sus primeras hojas.
 * Un libro citado en el prefacio también trae autor y título, y por eso
 * no vale mirar el arranque entero.
 */
const CAMPOS_DE_PORTADA = [
    'author', 'title', 'subtitle', 'volume', 'volumeTitle', 'series',
] as const;

/**
 * Campos que se buscan SOLO en la página de créditos.
 *
 * La ciudad, la editorial y el año están impresos ahí y en ningún otro
 * lugar del libro propio. Donde sí aparecen en cualquier página es en las
 * citas de otros libros, que es exactamente lo que no se quiere copiar.
 */
const CAMPOS_DEL_PIE_DE_IMPRENTA = [
    'edition', 'translator', 'editor', 'city', 'publisher', 'year',
] as const;

/**
 * Los dos únicos tramos que se le muestran al modelo.
 *
 * El prefacio NO viaja. Cita otros libros con su ciudad, su editorial y
 * su año, y un modelo al que se le enseña eso lo copia: un ejemplar de
 * Ross cuyo prefacio cita a Brueggemann devolvía la ficha de Brueggemann,
 * completa y con el rótulo «del libro». Lo que no se manda no se copia.
 */
export interface ReadableRegions {
    /** Las primeras hojas: ahí están el autor y el título. */
    cover: string;
    /** Alrededor de la marca de copyright: ahí está el pie de imprenta. */
    credits: string;
}

export function readableRegionsOf(text: string): ReadableRegions {
    const frontMatter = frontMatterOf(text);
    return {
        cover: frontMatter.slice(0, LETRAS_DE_PORTADA),
        credits: creditsRegionOf(frontMatter),
    };
}

/**
 * Deja de la propuesta solo lo que el texto respalda.
 *
 * `authorSorted` y `shortTitle` son los dos casos derivados y se aceptan
 * por otra vía: el primero reordena el nombre y el segundo recorta el
 * título, así que ninguno de los dos aparece literal en la portada.
 */
export function keepOnlyWhatIsWritten(
    raw: BibliographicData | null | undefined,
    source: string | ReadableRegions,
): { data: BibliographicData; discarded: Array<keyof BibliographicData> } {
    const data: BibliographicData = {};
    const discarded: Array<keyof BibliographicData> = [];
    if (!raw) return { data, discarded };

    // Se aceptan los dos tramos ya recortados —es lo que ve el modelo— o el
    // texto entero, que se recorta igual. Comprobar contra otra cosa que la
    // que se mostró abriría la puerta que este módulo cierra.
    const regiones = typeof source === 'string' ? readableRegionsOf(source) : source;
    const portada = comparable(regiones.cover);
    const creditos = comparable(regiones.credits);
    const anioMaximo = new Date().getFullYear() + ANIO_MAXIMO_SOBRE_HOY;

    const aceptar = (campo: keyof BibliographicData, donde: string) => {
        const valor = (raw[campo] ?? '').toString().trim();
        if (!valor) return;
        if (valor.length > LARGO_MAXIMO_DE_CAMPO) { discarded.push(campo); return; }
        if (!donde.includes(comparable(valor))) { discarded.push(campo); return; }
        if (campo === 'year' && !anioCreible(valor, anioMaximo)) { discarded.push(campo); return; }
        data[campo] = valor;
    };

    for (const campo of CAMPOS_DE_PORTADA) aceptar(campo, portada);
    for (const campo of CAMPOS_DEL_PIE_DE_IMPRENTA) aceptar(campo, creditos);

    const ordenado = (raw.authorSorted ?? '').trim();
    if (ordenado) {
        if (esElMismoNombreOrdenado(ordenado, data.author ?? '')) data.authorSorted = ordenado;
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

/**
 * ¿«Ross, Allen P.» es «Allen P. Ross» puesto al revés?
 *
 * Se comprueba la VUELTA, no el juego de palabras: con un juego, «Allen,
 * Ross P.» también pasaba, y la bibliografía se ordenaría por «Allen».
 * La coma parte el nombre en apellido y nombres, y al volver a pegarlos
 * al revés tiene que salir el nombre aceptado, palabra por palabra.
 */
function esElMismoNombreOrdenado(ordenado: string, autor: string): boolean {
    const nombre = comparable(autor);
    if (!nombre) return false;
    const coma = ordenado.indexOf(',');
    // Un nombre de una sola palabra se ordena solo: es igual a sí mismo.
    if (coma < 0) return comparable(ordenado) === nombre;
    const apellido = comparable(ordenado.slice(0, coma));
    const nombres = comparable(ordenado.slice(coma + 1));
    return `${nombres} ${apellido}`.trim() === nombre;
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
