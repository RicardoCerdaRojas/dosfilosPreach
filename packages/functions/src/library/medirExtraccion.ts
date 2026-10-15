import { MAX_FALTANTES_LISTADAS, type PaginasFaltantes } from './coberturaDePaginas';
import { isMarkerOnlyMarkdown } from './indexCoverage';
import { readFileSync } from 'node:fs';
import { leerPaginasDelPdf } from './textoDelPdf';

/**
 * Lo que una extracción dejó afuera, medido contra el PDF y no contra lo que
 * el extractor dice haber devuelto.
 *
 * La auditoría de la biblioteca del fundador (2026-10-15, 64 PDF) encontró
 * que nada de esto se veía:
 *  - `pageCount` guarda las páginas que DEVOLVIÓ el extractor, así que un
 *    hueco interno no aparecía en ningún lado (Varner: 17 páginas con texto
 *    en el PDF, entre ellas 189-200, y el recurso decía «244 páginas»);
 *  - `paginasFaltantes` sólo lo escribía la cola;
 *  - una página que el extractor devuelve vacía contaba como presente;
 *  - 13 libros de LlamaParse tienen un `structured.md` con las marcas de
 *    página y ningún texto.
 */
export interface MedicionDeExtraccion {
    /** Páginas del PDF. `null` si no se pudo leer. */
    pdfPageCount: number | null;
    /**
     * Páginas sin texto extraído: ausentes, o vacías cuando el PDF tiene texto
     * en ellas. Sin capa de texto, sólo cuentan las ausentes: una página vacía
     * puede ser una página en blanco de verdad.
     */
    paginasFaltantes: PaginasFaltantes;
    /** El texto estructurado trae las marcas de página y ningún contenido. */
    textoVacio: boolean;
}

/** Menos que esto, sin espacios, es una página sin texto (como `libroVacio`). */
export const MIN_CARACTERES_PAGINA = 40;
/** Más que esto en la capa de texto del PDF es una página con contenido. */
export const CAPA_CON_TEXTO = 300;

const MARCA = /<!--\s*page:\s*(\d+)\s*-->|\[PAGE\s+(\d+)\]/gi;

/** Caracteres (sin espacios) de cada página, según las marcas del texto. */
export function caracteresPorPagina(texto: string): Map<number, number> {
    const porPagina = new Map<number, number>();
    const marcas = [...texto.matchAll(MARCA)];
    marcas.forEach((m, i) => {
        const n = Number(m[1] ?? m[2]);
        const desde = (m.index ?? 0) + m[0].length;
        const hasta = i + 1 < marcas.length ? marcas[i + 1]!.index ?? texto.length : texto.length;
        const chars = texto.slice(desde, hasta).replace(/\s/g, '').length;
        porPagina.set(n, (porPagina.get(n) ?? 0) + chars);
    });
    return porPagina;
}

export function medirExtraccion(
    texto: string,
    pdfPageCount: number | null | undefined,
    /** Caracteres de la capa de texto del PDF, por página (índice 0 = página 1). */
    capaPorPagina?: ReadonlyArray<number> | null,
    /**
     * El otro texto de la misma extracción (`textContent`, con `[PAGE N]`).
     * Por página cuenta el que más trae: con el `structured.md` vacío, el
     * índice sale de éste y la página no está perdida.
     */
    respaldo?: string | null,
): MedicionDeExtraccion {
    const total = typeof pdfPageCount === 'number' && pdfPageCount > 0 ? pdfPageCount : null;
    const textoVacio = isMarkerOnlyMarkdown(texto);
    if (!total) return { pdfPageCount: null, paginasFaltantes: { total: 0, paginas: [] }, textoVacio };

    const porPagina = caracteresPorPagina(texto);
    if (respaldo) {
        for (const [n, chars] of caracteresPorPagina(respaldo)) {
            porPagina.set(n, Math.max(chars, porPagina.get(n) ?? 0));
        }
    }
    // Sin marcas de página no se puede decir cuál falta (los libros viejos de
    // pdf-parse): no se inventa una lista.
    if (porPagina.size === 0) return { pdfPageCount: total, paginasFaltantes: { total: 0, paginas: [] }, textoVacio };

    const paginas: number[] = [];
    let faltan = 0;
    for (let n = 1; n <= total; n++) {
        const extraido = porPagina.get(n);
        const ausente = extraido === undefined;
        const vaciaConTexto = !ausente && extraido < MIN_CARACTERES_PAGINA
            && (capaPorPagina?.[n - 1] ?? 0) > CAPA_CON_TEXTO;
        if (!ausente && !vaciaConTexto) continue;
        faltan++;
        if (paginas.length < MAX_FALTANTES_LISTADAS) paginas.push(n);
    }
    return { pdfPageCount: total, paginasFaltantes: { total: faltan, paginas }, textoVacio };
}

/**
 * Caracteres (sin espacios) de la capa de texto de cada página del PDF, o
 * `null` si no se pudo leer. Un PDF escaneado da ceros: entonces sólo cuentan
 * las páginas ausentes.
 */
export async function capaDeTextoPorPagina(pdf: Buffer | string, esperaMs = 60_000): Promise<number[] | null> {
    try {
        // Con tope que DETIENE la lectura (no sólo deja de esperarla): medir
        // no puede comerse el plazo ni la memoria de la extracción.
        const buffer = typeof pdf === 'string' ? readFileSync(pdf) : pdf;
        const paginas = await leerPaginasDelPdf(buffer, Date.now() + esperaMs);
        return paginas.map(p => p.text.replace(/\s/g, '').length);
    } catch (err) {
        console.warn('[medirExtraccion] no se pudo leer la capa de texto del PDF', err instanceof Error ? err.message : err);
        return null;
    }
}

/** Los campos que la medición escribe en el recurso. */
export function camposDeMedicion(m: MedicionDeExtraccion, borrar: unknown): Record<string, unknown> {
    return {
        // Sin el total del PDF no se sabe qué falta: no se toca lo que ya
        // estaba (no se borra una lista escrita por la cola).
        ...(m.pdfPageCount
            ? { pdfPageCount: m.pdfPageCount, paginasFaltantes: m.paginasFaltantes.total > 0 ? m.paginasFaltantes : borrar }
            : {}),
        textoEstructuradoVacio: m.textoVacio ? true : borrar,
    };
}
