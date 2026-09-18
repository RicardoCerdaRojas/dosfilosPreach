/**
 * El texto de un PDF, renglón por renglón y en el orden en que está escrito.
 *
 * Reemplaza a `pdf-parse` para leer el texto. `pdf-parse` concatena los
 * fragmentos de la capa de texto sin mirar dónde caen en la página, y en un
 * libro con hebreo eso REVIERTE palabras: los fragmentos de una línea de
 * derecha a izquierda vuelven al revés y se pegan invertidos.
 *
 * Medido sobre el léxico hebreo-español de 807 páginas:
 *
 *   pdf-parse   1.258.947 caracteres · 24.258 palabras hebreas · 9,8 % rotas
 *   este módulo 1.323.571 caracteres · 27.252 palabras hebreas · 0,1 % rotas
 *
 * «Roto» es una palabra que empieza por letra final (ך ם ן ף ץ), que en
 * hebreo sólo pueden cerrar palabra. El PDF estaba sano: lo rompía la
 * lectura. Y el libro es el que un trabajo de exégesis cita por sus lemas
 * hebreos, que eran justo los que salían invertidos.
 *
 * Lee la capa de texto; no hace OCR. Un PDF escaneado sin texto devuelve
 * páginas vacías, y de eso se encarga el piso de `libroVacio`.
 */

/** Diferencia vertical, en puntos, a partir de la cual empieza otro renglón. */
const SALTO_DE_RENGLON = 2;

export interface PaginaDePdf {
    /** Número de página, desde 1. */
    numero: number;
    text: string;
}

interface ItemDeTexto {
    str?: string;
    hasEOL?: boolean;
    transform?: number[];
}

/**
 * Agrupa los fragmentos de una página en renglones por su posición
 * vertical, respetando el orden en que el PDF los declara.
 *
 * El orden DENTRO del renglón es el que trae el documento, que para una
 * línea hebrea ya viene en orden lógico. Lo que se arregla acá es el
 * pegado: separar renglones en vez de encadenarlo todo.
 */
export function renglonesDePagina(items: ReadonlyArray<ItemDeTexto>): string {
    const renglones: string[] = [];
    let actual = '';
    // La referencia es la altura del PRIMER fragmento del renglón, no la del
    // anterior: comparar contra el anterior deja que las vocales y los
    // superíndices arrastren la línea de a poco hasta partirla en dos.
    let base: number | null = null;

    for (const item of items) {
        if (typeof item.str !== 'string') continue;
        const y = item.transform?.[5];
        if (typeof y === 'number' && base !== null && Math.abs(y - base) > SALTO_DE_RENGLON) {
            renglones.push(actual.trim());
            actual = '';
            base = y;
        } else if (typeof y === 'number' && base === null) {
            base = y;
        }
        actual += item.str + (item.hasEOL ? '\n' : ' ');
    }
    renglones.push(actual.trim());

    return renglones.filter(r => r.length > 0).join('\n');
}

/**
 * Todas las páginas de un PDF, con su texto.
 *
 * `pdfjs` descifra por su cuenta los PDF con protección de permisos —los
 * libros comprados—, que es lo que `pdf-lib` no sabe hacer.
 */
export async function leerPaginasDelPdf(buffer: Buffer): Promise<PaginaDePdf[]> {
    // Importación diferida: `pdfjs` es un módulo ES y este paquete compila a
    // CommonJS. Cargarlo al usarlo también evita pagarlo en cada arranque en
    // frío de las funciones que nunca leen un PDF.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        // Sin fuentes del sistema: en una función no hay ninguna, y el texto
        // no las necesita.
        useSystemFonts: false,
    }).promise;

    const paginas: PaginaDePdf[] = [];
    for (let numero = 1; numero <= doc.numPages; numero++) {
        const pagina = await doc.getPage(numero);
        const contenido = await pagina.getTextContent();
        paginas.push({ numero, text: renglonesDePagina(contenido.items as ItemDeTexto[]) });
        pagina.cleanup();
    }
    await doc.destroy();
    return paginas;
}
