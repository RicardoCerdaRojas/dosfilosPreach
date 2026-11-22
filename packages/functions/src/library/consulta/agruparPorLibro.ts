import { extractoLegible, type FragmentoRecuperado } from './armarConsulta';

/**
 * Lo que devuelve una búsqueda de temas, agrupado por libro. Aparte del
 * callable para que el servidor MCP (A9) lo use sin cargar `onCall`.
 */

/** Fragmentos que se miran: más que en «Preguntar», porque acá no se leen enteros. */
export const FRAGMENTOS_DE_TEMAS = 30;
/** Largo máximo de una búsqueda de temas. */
export const MAX_CONSULTA = 300;
/** Búsquedas de temas por hora y usuario, compartidas entre la web y el MCP (A9). */
export const POR_HORA = 120;

export interface HojaDelTema {
    hoja: number | null;
    seccion: string;
    extracto: string;
    score: number;
    /** 0–10, del reordenador; `null` si no se pudo reordenar. La pantalla lo muestra en barras. */
    pertinencia: number | null;
}

export interface LibroDelTema {
    resourceId: string;
    titulo: string;
    autor: string;
    hojas: HojaDelTema[];
}

/**
 * Agrupa por libro CONSERVANDO el orden recibido (ya viene de mayor a menor
 * pertinencia): los libros, en el orden de su mejor fragmento; dentro de un
 * libro, en ese mismo orden, y una hoja aparece una sola vez (la primera).
 */
export function agruparPorLibro(fragmentos: ReadonlyArray<FragmentoRecuperado & { pertinencia?: number | null }>): LibroDelTema[] {
    const libros = new Map<string, LibroDelTema>();
    for (const f of fragmentos) {
        let libro = libros.get(f.resourceId);
        if (!libro) {
            libro = { resourceId: f.resourceId, titulo: f.titulo, autor: f.autor, hojas: [] };
            libros.set(f.resourceId, libro);
        }
        if (libro.hojas.some(h => h.hoja === f.hoja && f.hoja !== null)) continue;
        libro.hojas.push({
            hoja: f.hoja,
            seccion: f.seccion,
            extracto: extractoLegible(f.texto),
            score: Math.round(f.score * 1000) / 1000,
            pertinencia: f.pertinencia ?? null,
        });
    }
    return [...libros.values()];
}
