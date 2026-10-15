import { getFirestore } from 'firebase-admin/firestore';
import { embedQuery } from '../retrieveChunks';
import { sanitizeExtractedText } from '../sanitizeExtractedText';
import type { FragmentoRecuperado } from './armarConsulta';

/**
 * Los fragmentos de la biblioteca del usuario que mejor responden una
 * pregunta (fase «biblioteca consultable», U2 y U5).
 *
 * Sólo libros del propio usuario (`userId`): la consulta es de SU biblioteca.
 * No se reutiliza el callable `retrieveChunks` (callable → callable) ni se
 * toca su código, que usan el trabajo exegético, el sermón y Facultad.
 */

export type Alcance =
    | { tipo: 'todo' }
    | { tipo: 'libros'; ids: string[] };

/** Fragmentos que van al asistente: ~2 000 caracteres cada uno, unos 8 000 tokens en total. */
export const FRAGMENTOS_POR_CONSULTA = 14;
/** `in` de Firestore admite hasta 30 valores; con más libros se busca en toda la biblioteca y se filtra. */
const MAX_IN = 30;
const POZO_MAXIMO = 100;

/**
 * Elige del pozo (ya ordenado por similitud): sólo de los libros pedidos, a lo
 * sumo `porLibro` de cada uno (para que un libro denso no tape a los demás) y
 * `total` en todo.
 */
export function elegirDelPozo(
    pozo: ReadonlyArray<FragmentoRecuperado>,
    opciones: { ids?: ReadonlySet<string>; porLibro: number; total: number },
): FragmentoRecuperado[] {
    const porRecurso = new Map<string, number>();
    const elegidos: FragmentoRecuperado[] = [];
    for (const f of pozo) {
        if (elegidos.length >= opciones.total) break;
        if (opciones.ids && !opciones.ids.has(f.resourceId)) continue;
        const ya = porRecurso.get(f.resourceId) ?? 0;
        if (ya >= opciones.porLibro) continue;
        porRecurso.set(f.resourceId, ya + 1);
        elegidos.push(f);
    }
    return elegidos;
}

/** Cuántos de cada libro: con uno solo, todos; con varios, que entren al menos dos por libro. */
export function topePorLibro(alcance: Alcance, total = FRAGMENTOS_POR_CONSULTA): number {
    if (alcance.tipo === 'libros' && alcance.ids.length === 1) return total;
    if (alcance.tipo === 'libros') return Math.max(2, Math.ceil(total / Math.min(alcance.ids.length, 7)));
    return Math.max(3, Math.ceil(total / 3));
}

export async function recuperarFragmentos(
    pregunta: string,
    userId: string,
    alcance: Alcance,
    apiKey: string,
    total = FRAGMENTOS_POR_CONSULTA,
): Promise<FragmentoRecuperado[]> {
    const vector = await embedQuery(pregunta, apiKey);
    const db = getFirestore();
    // Mismo orden de filtros que `retrieveChunks` (userId → resourceId): el
    // índice vectorial que existe es (userId, resourceId, embedding).
    let q: FirebaseFirestore.Query = db.collection('document_chunks').where('userId', '==', userId);
    const ids = alcance.tipo === 'libros' ? [...new Set(alcance.ids)] : [];
    if (ids.length > 0 && ids.length <= MAX_IN) q = q.where('resourceId', 'in', ids);
    const pozo = ids.length > 0 ? POZO_MAXIMO : Math.min(POZO_MAXIMO, total * 4);
    const snap = await q.findNearest({
        vectorField: 'embedding',
        queryVector: vector,
        limit: pozo,
        distanceMeasure: 'COSINE',
        distanceResultField: '_distance',
    }).get();

    const fragmentos: FragmentoRecuperado[] = snap.docs.map(d => {
        const data = d.data();
        const sectionPath = (data.metadata?.sectionPath as string[] | undefined) ?? [];
        return {
            resourceId: String(data.resourceId ?? ''),
            titulo: String(data.resourceTitle ?? 'Documento sin título'),
            autor: String(data.resourceAuthor ?? ''),
            hoja: typeof data.metadata?.page === 'number' ? data.metadata.page : null,
            seccion: sectionPath.length > 0 ? sectionPath.join(' › ') : String(data.metadata?.section ?? ''),
            texto: sanitizeExtractedText(String(data.text ?? '')).text,
            score: Math.max(0, 1 - Number(data._distance ?? 0) / 2),
        };
    });
    return elegirDelPozo(fragmentos, {
        ids: ids.length > 0 ? new Set(ids) : undefined,
        porLibro: topePorLibro(alcance, total),
        total,
    });
}
