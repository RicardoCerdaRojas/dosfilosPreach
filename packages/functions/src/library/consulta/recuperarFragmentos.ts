import { getFirestore } from 'firebase-admin/firestore';
import { embedQuery } from '../retrieveChunks';
import { sanitizeExtractedText } from '../sanitizeExtractedText';
import type { FragmentoRecuperado } from './armarConsulta';
import { aplicarReorden, puntuarCandidatos, type FragmentoReordenado } from './reordenar';
import { refsDeConsulta } from '../pasajes/refsDeTexto';

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
    if (ids.length === 0) return cercanos(base, Math.min(POZO_MAXIMO, limite));
    // Con varios libros elegidos, un pozo amplio por tanda y un tope por libro
    // ANTES de reordenar: si no, un comentario denso ocupa casi todos los
    // candidatos y un libro elegido no llega a verse (revisión adversarial, R1).
    const pozo = (await Promise.all(enTandas(ids).map(t => cercanos(base.where('resourceId', 'in', t), POZO_MAXIMO))))
        .flat().sort((a, b) => b.score - a.score);
    const pedidos = new Set(ids);
    return elegirDelPozo(pozo.filter(f => pedidos.has(f.resourceId)), { porLibro: Math.max(4, Math.ceil(limite / ids.length)), total: limite });
}

/** Candidatos que se piden por pasaje cuando la búsqueda nombra uno (etapa 3). */
export const CUPO_POR_PASAJE = 16;
/** U6: en una pregunta sobre un pasaje, los que lo citan pesan más que los vectores. */
export const CUPO_EN_MODO_PASAJE = 24;
/**
 * U6: candidatos de más que admite el reordenador en modo pasaje (40 + 16 =
 * 56). El banco midió con 40; esto es un supuesto a medir contra el plazo.
 */
const EXTRA_EN_MODO_PASAJE = 16;
/** U6: fragmentos por libro en modo pasaje, para que hablen varios autores. */
export const POR_LIBRO_EN_MODO_PASAJE = 3;
/** Candidatos de más que admite el reordenador cuando hay pasaje (40 + 8). */
const EXTRA_POR_PASAJE = 8;
/**
 * Fragmentos que se leen de cada libro. La lectura va SIEMPRE libro por
 * libro: un `limit` sobre toda la biblioteca devuelve en orden de id, y como
 * el id empieza con el del recurso, llenaba el tope con los primeros libros
 * del abecedario (revisión adversarial, etapa 3).
 */
export const LECTURA_POR_LIBRO = 12;

/** Un versículo pedido pesa más que su capítulo («Santiago 5» en el encabezado). */
const PESO_DEL_VERSICULO = 2;

/**
 * Los mejores por pasaje: más peso de lo pedido primero (cada versículo
 * vale 2, cada capítulo 1); a igualdad, la hoja más temprana. Un tope por
 * libro, para que un comentario del libro buscado no ocupe todo el cupo.
 */
export function elegirPorPasaje(
    docs: ReadonlyArray<{ fragmento: FragmentoRecuperado; refs: ReadonlyArray<string> }>,
    refs: ReadonlyArray<string>,
    cupo: number,
): FragmentoRecuperado[] {
    const pedidas = new Set(refs);
    const puntuados = docs
        .map(d => ({
            f: d.fragmento,
            n: d.refs.reduce((n, r) => n + (pedidas.has(r) ? (r.split('.').length === 3 ? PESO_DEL_VERSICULO : 1) : 0), 0),
        }))
        .filter(x => x.n > 0)
        .sort((a, b) => (b.n - a.n) || ((a.f.hoja ?? Infinity) - (b.f.hoja ?? Infinity)));
    return elegirDelPozo(puntuados.map(x => x.f), { porLibro: Math.max(4, Math.ceil(cupo / 3)), total: cupo });
}

/** Los libros del usuario (para leer por pasaje libro por libro). */
async function librosDelUsuario(userId: string): Promise<string[]> {
    const snap = await getFirestore().collection('library_resources').where('userId', '==', userId).select().get();
    return snap.docs.map(d => d.id);
}

/**
 * Los fragmentos que NOMBRAN el pasaje buscado («Santiago 5:14»), por el
 * índice `refs` que deja el indexador. Los vectores no ven la cita: un
 * fragmento que discute Stg 5:14 sin repetir las palabras de la búsqueda
 * quedaba lejos. Si el índice falta (se está construyendo, o el fragmento es
 * anterior al relleno) devuelve vacío: degrada a sólo vectores, no rompe.
 */
export async function recuperarPorPasaje(
    refs: ReadonlyArray<string>,
    userId: string,
    alcance: Alcance,
    cupo = CUPO_POR_PASAJE,
): Promise<FragmentoRecuperado[]> {
    if (refs.length === 0) return [];
    // SIEMPRE por `userId`, también cuando el alcance trae ids: un id ajeno no lee nada.
    const base = getFirestore().collection('document_chunks').where('userId', '==', userId);
    const leer = async (resourceId: string) => (await base
        .where('resourceId', '==', resourceId)
        .where('refs', 'array-contains-any', refs.slice(0, 30))
        .select('resourceId', 'resourceTitle', 'resourceAuthor', 'metadata', 'text', 'refs')
        .limit(LECTURA_POR_LIBRO)
        .get()).docs.map(d => ({ fragmento: { ...aFragmento(d), score: 0 }, refs: (d.get('refs') as string[] | undefined) ?? [] }));
    try {
        const ids = alcance.tipo === 'libros' ? [...new Set(alcance.ids)] : await librosDelUsuario(userId);
        const docs = (await Promise.all(ids.map(leer))).flat();
        return elegirPorPasaje(docs, refs, cupo);
    } catch (err) {
        console.warn(`[recuperarPorPasaje] sin índice de pasajes, sigo con vectores: ${err instanceof Error ? err.message.slice(0, 200) : err}`);
        return [];
    }
}

/** Primero los del pasaje, después los de vectores, sin repetir. */
export function unirCandidatos(
    porPasaje: ReadonlyArray<FragmentoRecuperado>,
    porVector: ReadonlyArray<FragmentoRecuperado>,
): FragmentoRecuperado[] {
    const vistos = new Set<string>();
    const out: FragmentoRecuperado[] = [];
    for (const f of [...porPasaje, ...porVector]) {
        const clave = f.id ?? `${f.resourceId}:${f.hoja}:${f.texto.slice(0, 60)}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        out.push(f);
    }
    return out;
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
    opciones: {
        total: number;
        timeoutSeconds: number;
        candidatos?: number;
        umbral?: number;
        contexto?: string | null;
        /**
         * La pregunta es sobre un pasaje (U6): más lugar para los fragmentos
         * que lo citan y a lo sumo `POR_LIBRO_EN_MODO_PASAJE` por libro, para
         * que hablen varios autores.
         */
        modoPasaje?: boolean;
        /**
         * Claves de un pasaje que la pregunta no nombra pero sigue: en «¿y
         * Moo?», las del turno anterior. Se buscan con el cupo normal.
         */
        refsHeredadas?: readonly string[];
    },
): Promise<{ fragmentos: FragmentoReordenado[]; reordenado: boolean }> {
    // Los vectores buscan con la conversación (para que «¿y el aceite?»
    // encuentre algo); el reordenador puntúa contra la pregunta, con la
    // anterior sólo como contexto.
    const consultaVectorial = opciones.contexto?.trim() ? `${opciones.contexto.trim()}\n${busqueda}` : busqueda;
    // Si la búsqueda nombra un pasaje, una parte del cupo va a los fragmentos
    // que lo citan (etapa 3); el reordenador los puntúa igual que al resto.
    const refs = [...new Set([...refsDeConsulta(busqueda), ...(opciones.refsHeredadas ?? [])])].slice(0, 30);
    const total = opciones.candidatos ?? CANDIDATOS_A_REORDENAR;
    const [porVector, porPasaje] = await Promise.all([
        recuperarCandidatos(consultaVectorial, userId, alcance, apiKey, total),
        recuperarPorPasaje(refs, userId, alcance, opciones.modoPasaje ? CUPO_EN_MODO_PASAJE : CUPO_POR_PASAJE),
    ]);
    // Los del pasaje van primero; suman a lo sumo `EXTRA_POR_PASAJE` al total
    // y el resto del lugar lo ceden los vectores más lejanos.
    const extra = opciones.modoPasaje ? EXTRA_EN_MODO_PASAJE : EXTRA_POR_PASAJE;
    const candidatos = unirCandidatos(porPasaje, porVector).slice(0, total + Math.min(porPasaje.length, extra));
    // En modo pasaje sobre TODA la biblioteca, varios autores antes que
    // muchas páginas de uno. Si el pastor eligió los libros, la variedad ya
    // está: no se recorta (revisión adversarial).
    const porLibro = opciones.modoPasaje && alcance.tipo === 'todo'
        ? Math.min(POR_LIBRO_EN_MODO_PASAJE, topePorLibro(alcance, opciones.total))
        : topePorLibro(alcance, opciones.total);
    const puntajes = await puntuarCandidatos(busqueda, candidatos, userId, opciones.timeoutSeconds, opciones.contexto);
    if (!puntajes) {
        // Sin reordenador nadie juzgó los del pasaje: manda el orden de los
        // vectores, y los del pasaje quedan detrás. Salvo en modo pasaje: la
        // respuesta va por autor SOBRE el pasaje, y los que lo citan son lo
        // más cercano a pertinente que hay.
        const respaldo = opciones.modoPasaje ? unirCandidatos(porPasaje, porVector) : unirCandidatos(porVector, porPasaje);
        return {
            fragmentos: elegirDelPozo(respaldo, { porLibro, total: opciones.total }).map(f => ({ ...f, pertinencia: null })),
            reordenado: false,
        };
    }
    return {
        fragmentos: aplicarReorden(candidatos, puntajes, { umbral: opciones.umbral ?? UMBRAL_DE_PERTINENCIA, porLibro, total: opciones.total }),
        reordenado: true,
    };
}
