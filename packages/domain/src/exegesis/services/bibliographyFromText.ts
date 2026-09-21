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
    'author', 'title', 'subtitle', 'volume', 'volumeTitle',
] as const;

/**
 * Campos que se buscan SOLO en la página de créditos.
 *
 * La ciudad, la editorial y el año están impresos ahí y en ningún otro
 * lugar del libro propio. Donde sí aparecen en cualquier página es en las
 * citas de otros libros, que es exactamente lo que no se quiere copiar.
 */
const CAMPOS_DEL_PIE_DE_IMPRENTA = ['city', 'publisher', 'year'] as const;

/**
 * Campos que valen en cualquiera de los dos tramos.
 *
 * La colección se imprime en la portadilla Y en el bloque de
 * catalogación; la edición, el traductor y el editor, en una o en otra
 * según la casa. Y ninguno de los cuatro es un dato que las citas de
 * otros libros falsifiquen: nadie copia el «traducido por» ajeno.
 */
const CAMPOS_DE_CUALQUIER_TRAMO = ['series', 'edition', 'translator', 'editor'] as const;

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
    /** La página legal: ahí está el pie de imprenta. Vacía si no la hay. */
    credits: string;
    /** Por qué camino se recortó. `letras` es el de respaldo, y es peor. */
    origin: 'hojas' | 'letras';
}

/**
 * Cuántas hojas del frente son «la portada» como mucho.
 *
 * El corte de verdad no es este número sino el encabezado del cuerpo: se
 * para antes del prefacio. Este tope solo cubre al libro que no tiene
 * ningún encabezado reconocible.
 */
const HOJAS_DE_PORTADA = 8;

/** Hasta dónde se busca la página legal. Más allá ya es cuerpo del libro. */
const HOJAS_A_MIRAR = 25;

/**
 * Cuántas hojas se miran siempre, aunque el cuerpo empiece antes.
 *
 * Un libro cuya hoja 2 abre con «Introducción» dejaba de tener página
 * legal aunque estuviera en la hoja 3. Una fuga de encabezado cuesta un
 * prefacio dentro de la portada; un corte falso costaba el pie de
 * imprenta entero.
 */
const HOJAS_MINIMAS_A_MIRAR = 6;

/**
 * Señales de imprenta. Se cuentan: una sola no hace una página legal.
 */
const SENAS_DE_PAGINA_LEGAL = [
    /©/, /copyright/, /derechos reservados/, /reservados todos los derechos/,
    /\bisbn\b/, /printed in/, /impreso en/, /all rights reserved/,
    /library of congress/, /deposito legal/, /cataloging/, /catalogacion/,
    /primera edicion/, /first published/, /queda prohibida/,
];

/**
 * Señales que SOLO aparecen en la página legal propia.
 *
 * La hoja de «otros títulos de esta colección» trae copyright, ciudad,
 * editorial y año de OTROS libros, y con el puntaje a secas le ganaba a
 * la página legal verdadera: volvía a salir la ficha ajena completa. Un
 * catálogo de otros títulos no lleva el bloque de catalogación ni la
 * reserva de derechos del ejemplar que se tiene en la mano.
 */
const SENAS_PROPIAS = [
    /all rights reserved/, /reservados todos los derechos/, /derechos reservados/,
    /library of congress/, /cataloging/, /catalogacion/, /deposito legal/,
    /queda prohibida/, /\bisbn\b/,
];

/**
 * Una página legal escueta es corta.
 *
 * «© 2011 Editorial Portavoz / Grand Rapids, Michigan» es una página
 * legal entera y no trae ninguna seña propia. Exigirle dos señales
 * dejaba sin pie de imprenta a las ediciones hispanoamericanas mínimas.
 * Lo que la distingue de una línea de índice que dice «Copyright and
 * Permissions .... iv» no es cuántas señales trae, sino que la línea de
 * índice vive en una hoja larga y llena de otras cosas.
 */
const HOJA_LEGAL_ESCUETA = 1_500;

/** Una portadilla es corta; un prefacio, no. */
const MAX_LETRAS_DE_PORTADILLA = 1_200;

/** Dónde empieza el cuerpo. Antes de esto está el frente del libro. */
const EMPIEZA_EL_CUERPO = /\b(prefac|preface|introduc|foreword|prologo|proemio|presentac|nota del|al lector|advertencia|chapter|capitulo|parte i)/;

/** Un encabezado es corto. Una frase que hable del prefacio, no. */
const MAX_LETRAS_DE_ENCABEZADO = 60;

/**
 * Cuántas palabras puede haber DESPUÉS de la palabra del encabezado.
 *
 * Un encabezado casi se acaba ahí: «Series Preface», «Nota del autor».
 * Un título no: «An Introduction to Biblical Hebrew Syntax» lleva la
 * palabra dentro y seguía cuatro palabras más, y sin este tope el propio
 * título de Waltke-O'Connor se tomaba por el comienzo del cuerpo.
 */
const PALABRAS_TRAS_EL_ENCABEZADO = 3;

/** Cuántas líneas del principio de una hoja se miran buscando su encabezado. */
const LINEAS_DE_ENCABEZADO = 3;

/** Topes de tamaño, por si una «hoja» resulta ser medio libro. */
const MAX_LETRAS_DE_PORTADA = 8_000;
const MAX_LETRAS_DE_CREDITOS = 6_000;

/** Con menos hojas que esto, el texto no trae marcas útiles. */
const MINIMO_DE_HOJAS = 3;

interface Hoja {
    texto: string;
    /** Si esta hoja abre el cuerpo del libro (prefacio, índice, capítulo). */
    esCuerpo: boolean;
}

/**
 * Los dos únicos tramos que se le muestran al modelo.
 *
 * EL LÍMITE ES LA HOJA, NO LA DISTANCIA. Recortar por cantidad de letras
 * no sirve: en un libro cuya página legal va seguida del prefacio, el
 * prefacio cae dentro de la ventana, y el prefacio cita otros libros con
 * su ciudad, su editorial y su año. Un ejemplar de Ross cuyo prefacio
 * cita a Brueggemann devolvía la ficha de Brueggemann, entera y con el
 * rótulo «del libro». Las hojas, en cambio, son un límite del libro y no
 * un número elegido por nosotros: la página legal es UNA hoja y el
 * prefacio es otra.
 *
 * Cuando el texto no trae marcas de hoja —medido: 13 de 68 recursos— se
 * vuelve al recorte por letras, que es peor y se sabe. `origin` lo dice,
 * para que un cambio de formato del extractor no pase inadvertido.
 */
export function readableRegionsOf(text: string): ReadableRegions {
    const hojas = hojasDe(text);
    if (hojas.length < MINIMO_DE_HOJAS) return porLetras(text);

    const finDelFrente = hojas.findIndex(h => h.esCuerpo);
    const cover = hojas
        .slice(0, finDelFrente < 0 ? HOJAS_DE_PORTADA : Math.min(finDelFrente, HOJAS_DE_PORTADA))
        .map(h => h.texto)
        .join('\n')
        .slice(0, MAX_LETRAS_DE_PORTADA);

    // La página legal se busca por sus propias señas y no por debajo del
    // corte del cuerpo: si el corte se equivoca, que cueste una hoja de
    // más en la portada y no el pie de imprenta entero.
    const hastaDondeMirar = Math.min(
        hojas.length,
        HOJAS_A_MIRAR,
        Math.max(finDelFrente < 0 ? HOJAS_A_MIRAR : finDelFrente, HOJAS_MINIMAS_A_MIRAR),
    );

    return { cover, credits: paginaLegalDe(hojas.slice(0, hastaDondeMirar)), origin: 'hojas' };
}

/**
 * La hoja legal, y con ella la portadilla que la precede.
 *
 * Gana la que trae una seña PROPIA —catalogación, reserva de derechos,
 * ISBN—; si ninguna la trae, una hoja corta con una seña y un año
 * creíble. Entre iguales, la más cercana a la portada. La hoja anterior
 * viaja solo si parece portadilla, porque muchas ediciones parten el
 * dato —Waltke-O'Connor imprime editorial y ciudad en la portadilla y el
 * copyright en la hoja siguiente— y porque una anterior que sea prefacio
 * vuelve a meter los libros que ese prefacio cita.
 */
function paginaLegalDe(frente: ReadonlyArray<Hoja>): string {
    let mejor = -1;
    let mejorRango = 0;
    let mejorSenas = 0;

    frente.forEach((hoja, i) => {
        if (hoja.esCuerpo) return;
        const plegada = foldForSearch(hoja.texto);
        const senas = SENAS_DE_PAGINA_LEGAL.filter(sena => sena.test(plegada)).length;
        if (senas === 0) return;
        const propia = SENAS_PROPIAS.some(sena => sena.test(plegada));
        const escueta = hoja.texto.length <= HOJA_LEGAL_ESCUETA && ANIO_SUELTO.test(plegada);
        const rango = propia ? 2 : (escueta ? 1 : 0);
        if (rango === 0) return;
        // Entre iguales gana la primera: la página legal va delante.
        if (rango > mejorRango || (rango === mejorRango && senas > mejorSenas)) {
            mejor = i;
            mejorRango = rango;
            mejorSenas = senas;
        }
    });
    if (mejor < 0) return '';

    // La anterior viaja solo si es una PORTADILLA: corta, que no abra
    // cuerpo y SIN ninguna seña de imprenta propia. Una hoja de «otros
    // títulos de esta colección» es corta y no es cuerpo, pero trae el
    // copyright de otros libros, y colándose por aquí volvía a producir
    // la ficha ajena completa.
    const previa = mejor > 0 ? frente[mejor - 1]! : null;
    const esPortadilla = !!previa
        && !previa.esCuerpo
        && previa.texto.length <= MAX_LETRAS_DE_PORTADILLA
        && !SENAS_DE_PAGINA_LEGAL.some(sena => sena.test(foldForSearch(previa.texto)));
    const anterior = esPortadilla ? previa!.texto : '';
    return `${anterior}\n${frente[mejor]!.texto}`.trim().slice(0, MAX_LETRAS_DE_CREDITOS);
}

/** Un año de imprenta suelto en la hoja. */
const ANIO_SUELTO = /\b(1[89]\d{2}|20[0-4]\d)\b/;

/**
 * Parte el arranque del libro en hojas por sus marcas «[PAGE n]».
 *
 * El formato lo escribe el extractor (`pagesToMarkedText`, en el paquete
 * de funciones, que no puede importar dominio). Una prueba a cada lado
 * fija el literal: si allá cambia, acá deja de haber hojas y se cae al
 * recorte por letras sin que nadie se entere.
 */
function hojasDe(text: string): Hoja[] {
    const arranque = (text ?? '').slice(0, LETRAS_DE_BUSQUEDA);
    const partes = arranque.split(MARCA_DE_HOJA).map(p => p.trim()).filter(Boolean);
    return partes.map(texto => ({ texto, esCuerpo: abreElCuerpo(texto) }));
}

export const MARCA_DE_HOJA = /\[PAGE \d+\]/;

/**
 * ¿Esta hoja abre el cuerpo?
 *
 * Se miran las primeras líneas y no el primer carácter: la salida del
 * extractor antepone folios («ix»), almohadillas de markdown y
 * encabezados de página, y con el ancla pegada al inicio un «ix\n\nPREFACIO»
 * no se reconocía y el prefacio entraba en la portada.
 */
function abreElCuerpo(texto: string): boolean {
    return foldForSearch(texto)
        .split('\n')
        .map(linea => linea.replace(/^[#\s]+/, '').trim())
        .filter(linea => linea.length > 0 && !/^[ivxlcdm\d.,:()-]+$/.test(linea))
        .slice(0, LINEAS_DE_ENCABEZADO)
        .some(esEncabezadoDeCuerpo);
}

function esEncabezadoDeCuerpo(linea: string): boolean {
    if (linea.length > MAX_LETRAS_DE_ENCABEZADO) return false;
    const donde = linea.match(EMPIEZA_EL_CUERPO);
    if (!donde || donde.index === undefined) return false;
    const despues = linea.slice(donde.index + donde[0].length).trim();
    return despues.split(/\s+/).filter(Boolean).length <= PALABRAS_TRAS_EL_ENCABEZADO;
}

/**
 * El recorte de respaldo, por letras, para el texto sin marcas de hoja.
 *
 * Es el que dejaba pasar el prefacio y por eso no es el camino principal.
 */
function porLetras(text: string): ReadableRegions {
    const frontMatter = frontMatterOf(text);
    return {
        cover: frontMatter.slice(0, LETRAS_DE_PORTADA),
        credits: creditsRegionOf(frontMatter),
        origin: 'letras',
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
    // El separador no puede formar palabra: pegados con un espacio, un
    // valor podría casar a caballo entre el final de uno y el principio
    // del otro.
    for (const campo of CAMPOS_DE_CUALQUIER_TRAMO) aceptar(campo, `${portada}\n—\n${creditos}`);
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
 * ¿«Ross, Allen P.» es «Allen P. Ross» puesto en orden alfabético?
 *
 * Tres comprobaciones, y cada una está por un caso real:
 *
 * 1. Las mismas palabras, cada una las mismas veces. «Ross, Ross Ross»
 *    no pasa.
 * 2. Tiene que haber coma, o ser idéntico al nombre. Sin esto, «Allen P.
 *    Ross» pasaba como forma ordenada de «Ross, Allen P.» —el campo al
 *    revés— y la bibliografía quedaba alfabetizada por el nombre de pila.
 * 3. El apellido —lo que va antes de la primera coma— tiene que cerrar el
 *    nombre. Así «Allen, Ross P.» se rechaza. La excepción son los
 *    nombres coordinados, «Bill T. Arnold and John H. Choi», donde el
 *    apellido del primer autor va por el medio: ahí basta con que esté
 *    entero y seguido.
 */
function esElMismoNombreOrdenado(ordenado: string, autor: string): boolean {
    const nombre = comparable(autor).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const puesto = comparable(ordenado).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (!nombre || !puesto) return false;
    if (puesto === nombre) return true;

    const palabrasDelAutor = nombre.split(' ');
    const palabras = puesto.split(' ');
    if (palabras.length !== palabrasDelAutor.length) return false;
    const restantes = [...palabrasDelAutor];
    for (const palabra of palabras) {
        const donde = restantes.indexOf(palabra);
        if (donde < 0) return false;
        restantes.splice(donde, 1);
    }

    const coma = ordenado.indexOf(',');
    if (coma < 0) return false;
    const apellido = comparable(ordenado.slice(0, coma)).trim();
    if (!apellido) return false;
    if (TIENE_COORDINACION.test(nombre)) return nombre.includes(apellido);
    return nombre.endsWith(apellido);
}

/** Dos autores en un solo campo: «X and Y», «X y Y», «X & Y». */
const TIENE_COORDINACION = /\s(and|y|e|&)\s/;

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
