/**
 * Junta los rangos de una corrida en el libro final.
 *
 * Lo hace la tarea del ÚLTIMO rango, no una función aparte ni un vigilante que
 * pregunte cada tanto: quien acaba de ver que no hay rango siguiente es
 * exactamente quien sabe que el libro está completo, y preguntárselo a otro
 * agrega una espera y un punto de fallo por nada.
 */

import { getStorage } from 'firebase-admin/storage';
import { pagesToMarkedText, pagesToMarkdown } from './llamaParseClient';
import { verificarCobertura } from './coberturaDePaginas';
import { carpetaDeRangos, type PaginaGuardada } from './corridaDeExtraccion';

export interface LibroEnsamblado {
    text: string;
    markdown: string;
    pageCount: number;
    rangosLeidos: number;
}

/**
 * Ordena los archivos de rango por su página inicial.
 *
 * Importa para el dedup: dos rangos que se solapan traen la misma página dos
 * veces, y la copia que vale es la del rango POSTERIOR, donde esa página cayó
 * al principio de la ventana en vez de al final. Si se leyeran en el orden
 * alfabético que devuelve Storage —donde «100-142» va antes que «41-83»— el
 * dedup se quedaría con la copia equivocada.
 *
 * PURA y exportada para poder probar justamente ese orden, que no se ve.
 */
export function ordenarPorPaginaInicial(nombres: string[]): string[] {
    const inicio = (n: string): number => {
        const m = n.match(/(\d+)-(\d+)\.json$/);
        return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
    };
    return [...nombres].sort((a, b) => inicio(a) - inicio(b));
}

/**
 * Lee todos los rangos de la corrida y arma el libro.
 *
 * Lanza si la cobertura no alcanza: un libro al que le falta un tramo no se
 * guarda como bueno. El criterio es el mismo que el de la ruta en una sola
 * invocación —proporción Y corte al final—, a propósito, porque dos reglas que
 * deberían coincidir y viven aparte terminan no coincidiendo.
 */
export async function ensamblarDesdeRangos(
    userId: string,
    resourceId: string,
    runId: string,
    totalPaginas: number,
): Promise<LibroEnsamblado> {
    const bucket = getStorage().bucket();
    const prefix = carpetaDeRangos(userId, resourceId, runId);
    const [archivos] = await bucket.getFiles({ prefix });

    const nombres = ordenarPorPaginaInicial(
        archivos.map(f => f.name).filter(n => n.endsWith('.json')),
    );
    if (nombres.length === 0) {
        throw new Error(`No hay rangos guardados en ${prefix}; no se puede ensamblar`);
    }

    // El dedup conserva la ÚLTIMA aparición de cada página, y por eso el orden
    // de lectura de arriba no es cosmético.
    const porPagina = new Map<number, PaginaGuardada>();
    for (const nombre of nombres) {
        const [buf] = await bucket.file(nombre).download();
        const paginas = JSON.parse(buf.toString('utf8')) as PaginaGuardada[];
        for (const p of paginas) porPagina.set(p.page, p);
    }

    const merged = Array.from(porPagina.values()).sort((a, b) => a.page - b.page);

    const cobertura = verificarCobertura(merged, totalPaginas);
    if (!cobertura.ok) {
        throw new Error(`Extracción en cola incompleta: ${cobertura.motivo}`);
    }

    return {
        text: pagesToMarkedText(merged),
        markdown: pagesToMarkdown(merged),
        pageCount: merged.length,
        rangosLeidos: nombres.length,
    };
}

/**
 * Borra los archivos de rango de una corrida terminada.
 *
 * Se hace DESPUÉS de guardar el libro, y un fallo acá no rompe nada: son
 * temporales. Borrarlos antes de guardar sería cambiar un costo de
 * almacenamiento por la posibilidad de perder el trabajo entero.
 */
export async function limpiarRangos(userId: string, resourceId: string, runId: string): Promise<void> {
    try {
        await getStorage().bucket().deleteFiles({ prefix: carpetaDeRangos(userId, resourceId, runId) });
    } catch (err) {
        console.warn(`[Ensamblar] no se pudieron borrar los rangos de ${resourceId}/${runId}:`, err);
    }
}
