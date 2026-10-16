import { getFirestore } from 'firebase-admin/firestore';
import { embedQuery } from '../retrieveChunks';
import { sanitizeExtractedText } from '../sanitizeExtractedText';
import type { FragmentoRecuperado } from './armarConsulta';
import { aplicarReorden, puntuarCandidatos, type FragmentoReordenado } from './reordenar';

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

/** Los ids en tandas que caben en un `in` de Firestore. */
export function enTandas<T>(ids: ReadonlyArray<T>, tam = MAX_IN): T[][] {
    const tandas: T[][] = [];
    for (let i = 0; i < ids.length; i += tam) tandas.push(ids.slice(i, i + tam));
    return tandas;
}

function aFragmento(d: FirebaseFirestore.QueryDocumentSnapshot): FragmentoRecuperado {
    const data = d.data();
    const sectionPath = (data.metadata?.sectionPath as string[] | undefined) ?? [];
    return {
        id: d.id,
        resourceId: String(data.resourceId ?? ''),
        titulo: String(data.resourceTitle ?? 'Documento sin título'),
        autor: String(data.resourceAuthor ?? ''),
        hoja: typeof data.metadata?.page === 'number' ? data.metadata.page : null,
        seccion: sectionPath.length > 0 ? sectionPath.join(' › ') : String(data.metadata?.section ?? ''),
        texto: sanitizeExtractedText(String(data.text ?? '')).text,
        score: Math.max(0, 1 - Number(data._distance ?? 0) / 2),
    };
}

/**
 * Los candidatos por vectores, ordenados por similitud, SIN cortar por libro
 * ni por total: es lo que recibe el reordenador.
 */
export async function recuperarCandidatos(
    pregunta: string,
    userId: string,
    alcance: Alcance,
    apiKey: string,
    limite: number,
): Promise<FragmentoRecuperado[]> {
    const vector = await embedQuery(pregunta, apiKey);
    // SIEMPRE por `userId`: la consulta es de la biblioteca del usuario, y un
    // id de otro usuario en el alcance no puede traer sus fragmentos. Mismo
    // orden de filtros que `retrieveChunks` (userId → resourceId): el índice
    // vectorial que existe es (userId, resourceId, embedding).
    const base = getFirestore().collection('document_chunks').where('userId', '==', userId);
    const cercanos = async (q: FirebaseFirestore.Query, limite: number) => (await q.findNearest({
        vectorField: 'embedding',
        queryVector: vector,
        limit: limite,
        distanceMeasure: 'COSINE',
        distanceResultField: '_distance',
    }).get()).docs.map(aFragmento);

    const ids = alcance.tipo === 'libros' ? [...new Set(alcance.ids)] : [];
    // Con más de 30 libros, una búsqueda por tanda de 30 y se mezclan por
    // similitud: buscar en toda la biblioteca y filtrar dejaba afuera libros
    // elegidos cuando la biblioteca es grande (revisión adversarial, U2).
    const pozo = ids.length > 0
        ? (await Promise.all(enTandas(ids).map(t => cercanos(base.where('resourceId', 'in', t), Math.min(POZO_MAXIMO, limite)))))
            .flat().sort((a, b) => b.score - a.score)
        : await cercanos(base, Math.min(POZO_MAXIMO, limite));
    const pedidos = ids.length > 0 ? new Set(ids) : null;
    return (pedidos ? pozo.filter(f => pedidos.has(f.resourceId)) : pozo).slice(0, limite);
}

/** Sólo vectores, sin reordenar (el camino de antes; queda como respaldo). */
export async function recuperarFragmentos(
    pregunta: string,
    userId: string,
    alcance: Alcance,
    apiKey: string,
    total = FRAGMENTOS_POR_CONSULTA,
): Promise<FragmentoRecuperado[]> {
    const pozo = await recuperarCandidatos(pregunta, userId, alcance, apiKey, total * 4);
    return elegirDelPozo(pozo, { porLibro: topePorLibro(alcance, total), total });
}

/** Candidatos que se reordenan: el banco midió con 40. */
export const CANDIDATOS_A_REORDENAR = 40;
/**
 * Pertinencia mínima (0–10) para mostrar un fragmento. Calibrada con el banco
 * (`scripts/rag-eval/`, 2026-10-16): con ≥7 se muestran ~20 por búsqueda y el
 * 84 % trata el tema, dejando afuera ~3,5 pertinentes de ~20; con ≥6, 81 % y
 * 2,5; con ≥8, 87 % pero se pierden 6. El fundador pidió menos resultados que
 * no tengan que ver: se prefiere la precisión.
 */
export const UMBRAL_DE_PERTINENCIA = 7;

/**
 * Lo pertinente: candidatos por vectores, reordenados por cuán directamente
 * tratan lo buscado, y cortados por el umbral. Si el reordenador falla, queda
 * el orden de los vectores, sin umbral (degrada, no rompe), y `reordenado`
 * lo dice.
 */
export async function buscarPertinentes(
    busqueda: string,
    userId: string,
    alcance: Alcance,
    apiKey: string,
    opciones: { total: number; timeoutSeconds: number; candidatos?: number; umbral?: number },
): Promise<{ fragmentos: FragmentoReordenado[]; reordenado: boolean }> {
    const candidatos = await recuperarCandidatos(busqueda, userId, alcance, apiKey, opciones.candidatos ?? CANDIDATOS_A_REORDENAR);
    const porLibro = topePorLibro(alcance, opciones.total);
    const puntajes = await puntuarCandidatos(busqueda, candidatos, userId, opciones.timeoutSeconds);
    if (!puntajes) {
        return {
            fragmentos: elegirDelPozo(candidatos, { porLibro, total: opciones.total }).map(f => ({ ...f, pertinencia: null })),
            reordenado: false,
        };
    }
    return {
        fragmentos: aplicarReorden(candidatos, puntajes, { umbral: opciones.umbral ?? UMBRAL_DE_PERTINENCIA, porLibro, total: opciones.total }),
        reordenado: true,
    };
}
