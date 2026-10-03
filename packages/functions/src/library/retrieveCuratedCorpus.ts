import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { embedQuery } from './retrieveChunks';
import { sanitizeExtractedTextOnly } from './sanitizeExtractedText';

/**
 * Ranking dentro del corpus curado de un trabajo.
 *
 * La diferencia con `retrieveChunks` no es el algoritmo —es el mismo coseno—
 * sino el ALCANCE: acá sólo participan las hojas que el usuario admitió en
 * cada fuente.
 *
 * Dos caminos para lo mismo, y el orden importa. Cuando quien llama pudo
 * traducir las hojas a índices de fragmento, se leen por clave los fragmentos
 * admitidos y se ordenan acá: la búsqueda ENTRA en lo curado. Cuando no, se le
 * pide al índice vectorial lo más cercano del libro entero y se recorta
 * después, que es como venía.
 *
 * El segundo es un respaldo y no un equivalente. Medido sobre las 43 fuentes
 * con receta de la base, la selección de una fuente es el 5-10% de sus
 * fragmentos y en los peores casos el 0,3% —Tuggy, 4 de 1394; McComiskey, 3 de
 * 959—, así que el recorte posterior puede vaciar una fuente por dónde cayó el
 * corte y no por falta de material.
 *
 * Por qué existe en vez de ampliar `retrieveChunks`: esa callable sirve al
 * tutor, a Faculty y al proponente de tramos, todos con alcance "biblioteca" o
 * "recurso". Meterle un filtro por rangos de hoja la obligaría a hablar del
 * modelo de exégesis, que es justo lo que no sabe.
 *
 * NO trae los tramos fijados. Esos entran completos y sin competir, así que se
 * leen con `getDocumentChunks` —que ya sabe lotear— desde la capa que arma el
 * prompt. Mezclarlos acá volvería esta callable responsable de dos políticas
 * distintas.
 */

const CHUNK_COLLECTION = 'document_chunks';

/**
 * Fuentes por consulta. El `IN` de Firestore corta en 30; el tope real de
 * corpus que se diseñó son doce fuentes, así que hay margen y el error llega
 * como mensaje claro en vez de como fallo de la consulta.
 *
 * El cliente parte el pedido en tandas de este tamaño
 * (`MAX_SOURCES_PER_CALL` en `infrastructure/.../CallableCuratedCorpusRetriever.ts`):
 * si cambia acá, cambia allá.
 */
const MAX_SOURCES = 25;

/**
 * Cuántos candidatos pedirle al índice POR FUENTE.
 *
 * Por fuente y no en una consulta única, aunque una sola sería más barata. Con
 * un pool compartido las fuentes grandes se lo comen: medido sobre tres
 * comentarios reales, un `IN` con topK=200 devolvió 36 fragmentos de Bruce, 38
 * de Sasson y CERO de Stuart — una fuente que el usuario eligió a propósito
 * quedaba muda. Consultando por separado, las tres aportan (16 / 37 / 29) y
 * tarda 2,2 s en paralelo.
 *
 * Es la misma lección que `retrieveChunks` ya había aprendido con
 * `perResourceTopK`, por si hiciera falta una segunda confirmación.
 *
 * En el camino por clave el pool es el tope de lo que la fuente aporta, porque
 * ya no hay recorte posterior que lo baje. En el camino del índice es el
 * número de CANDIDATOS del libro entero, de los que sobrevive sólo lo que la
 * receta admite —la medición de arriba dice cuán poco puede ser eso—.
 */
const DEFAULT_POOL = 60;
const MAX_POOL = 200;

interface SheetRange {
    start: number;
    end: number;
}

interface SourceScope {
    resourceId: string;
    /** Hojas que el usuario admitió para esta fuente. */
    sheetRanges: SheetRange[];
    /**
     * Los MISMOS tramos traducidos a índices de fragmento, cuando quien llama
     * pudo resolverlos con el índice de hojas del recurso.
     *
     * Con ellos la búsqueda entra en lo curado en vez de filtrarlo después.
     * Sin ellos se cae al camino anterior, que sigue siendo correcto —sólo
     * menos fiable— y es lo que corresponde cuando el índice no está.
     */
    chunkRanges?: SheetRange[];
}

interface RetrieveRequest {
    userId: string;
    query: string;
    sources: SourceScope[];
    pool?: number;
}

function withinRanges(sheet: unknown, ranges: SheetRange[]): boolean {
    if (typeof sheet !== 'number') return false;
    return ranges.some(r => sheet >= r.start && sheet <= r.end);
}

/**
 * Tope de fragmentos que se leen de una fuente para ordenarlos acá.
 *
 * Medido sobre las 43 fuentes con receta que hay en la base: la mayor tiene
 * 153 fragmentos dentro de sus tramos. El tope deja holgura y, por encima de
 * él, se vuelve al camino del índice: leer un libro entero por su clave sería
 * más caro que una búsqueda imperfecta.
 *
 * No es el mismo número que `MAX_CHUNKS_PER_REQUEST` de `documentStructure`,
 * que vale 200, y la diferencia no es un descuido: aquel acota lo que CRUZA EL
 * CABLE —y por eso mira el tope de 10 MB del transporte—, y éste lo que se lee
 * en memoria para ordenar. De acá sólo salen los `pool` mejores.
 */
export const MAX_CURATED_CHUNKS = 400;

/**
 * Verifica que el llamador pueda leer un fragmento.
 *
 * La lectura por clave no lleva el `where('userId')` que filtraba en el camino
 * del índice, así que la misma regla se aplica acá: el `userId` del fragmento,
 * o su pertenencia a un store de la biblioteca compartida. Es la misma función
 * que `documentStructure` usa para lo mismo.
 */
function isReadable(data: FirebaseFirestore.DocumentData, uid: string): boolean {
    if (data.userId === uid) return true;
    return Array.isArray(data.stores) && data.stores.length > 0;
}

/** Coseno entre dos vectores. 1 es idéntico. */
function cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        dot += a[i]! * b[i]!;
        na += a[i]! * a[i]!;
        nb += b[i]! * b[i]!;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Los índices que cubren unos tramos, con tope. */
export function indicesOf(ranges: SheetRange[]): number[] | null {
    const out: number[] = [];
    for (const r of ranges) {
        if (!Number.isInteger(r.start) || !Number.isInteger(r.end) || r.start < 0 || r.end < r.start) return null;
        for (let i = r.start; i <= r.end; i++) {
            out.push(i);
            if (out.length > MAX_CURATED_CHUNKS) return null;
        }
    }
    return out.length > 0 ? out : null;
}

export const retrieveCuratedCorpus = onCall<RetrieveRequest>(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '512MiB',
        secrets: ['GEMINI_API_KEY'],
        timeoutSeconds: 120,
    },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret not configured');

        const data = request.data ?? ({} as RetrieveRequest);
        const query = typeof data.query === 'string' ? data.query.trim() : '';
        if (!query) throw new HttpsError('invalid-argument', 'query is required');

        // Mismo criterio que `retrieveChunks`: el userId que llega tiene que ser
        // el del llamador, para que un cliente comprometido no lea la
        // biblioteca de otro.
        if (data.userId && data.userId !== request.auth.uid) {
            throw new HttpsError('permission-denied', 'userId must match authenticated user');
        }
        const uid = request.auth.uid;

        const sources = Array.isArray(data.sources) ? data.sources : [];
        if (sources.length === 0) return { chunks: [], sourcesQueried: 0 };
        if (sources.length > MAX_SOURCES) {
            throw new HttpsError('invalid-argument', `sources excede ${MAX_SOURCES} fuentes`);
        }

        const byResource = new Map<string, { sheetRanges: SheetRange[]; chunkRanges: SheetRange[] }>();
        for (const source of sources) {
            const id = typeof source?.resourceId === 'string' ? source.resourceId : '';
            const ranges = Array.isArray(source?.sheetRanges) ? source.sheetRanges : [];
            if (!id || ranges.length === 0) continue;
            byResource.set(id, {
                sheetRanges: ranges,
                chunkRanges: Array.isArray(source?.chunkRanges) ? source.chunkRanges : [],
            });
        }
        if (byResource.size === 0) return { chunks: [], sourcesQueried: 0 };

        const pool = Math.min(
            MAX_POOL,
            Math.max(1, Number.isFinite(data.pool) ? Number(data.pool) : DEFAULT_POOL),
        );

        const db = getFirestore();
        const vector = await embedQuery(query, apiKey);
        const queryVector = FieldValue.vector(vector);

        // Una consulta por fuente, en paralelo. El orden de las cláusulas NO es
        // cosmético: el índice vectorial se eligió con el prefijo
        // `userId → resourceId` y consultarlo de otra forma falla con
        // "Missing vector index configuration". `retrieveChunks` lo documenta
        // por el mismo motivo.
        const perSource = await Promise.all(
            [...byResource.entries()].map(async ([resourceId, scope]) => {
                const ranges = scope.sheetRanges;
                try {
                    // Buscar DENTRO de lo curado, cuando se puede.
                    //
                    // El camino del índice trae lo más cercano del libro
                    // ENTERO y recorta después. Medido sobre las fuentes con
                    // receta de la base, la selección de una fuente es el 5-10%
                    // de sus fragmentos y en los peores casos el 0,3%: Tuggy,
                    // 4 de 1394; McComiskey, 3 de 959. Con un pool de 60 sobre
                    // 1394, acertar esos 4 es una lotería, y cuando sale mal la
                    // fuente no vuelve vacía por falta de material sino por
                    // dónde cayó el corte. Le pasó a Burt —ancla de un paso, 22
                    // fragmentos en sus hojas, uno de ellos justo sobre la
                    // palabra del versículo— y al contraste del mismo paso.
                    //
                    // Con los índices resueltos se leen por clave los
                    // fragmentos admitidos y se ordenan acá. Es el mismo
                    // coseno, sobre el conjunto correcto.
                    const indices = indicesOf(scope.chunkRanges);
                    if (indices) {
                        const refs = indices.map(i => db.collection(CHUNK_COLLECTION).doc(`${resourceId}_chunk_${i}`));
                        const docs = await db.getAll(...refs, {
                            fieldMask: ['chunkIndex', 'text', 'metadata', 'userId', 'stores', 'embedding'],
                        });
                        const kept = rankCuratedChunks({
                            rows: docs.filter(doc => doc.exists).map(doc => doc.data()!),
                            resourceId, uid, ranges, vector, pool,
                        });
                        return { resourceId, pool: docs.length, kept, failed: false };
                    }
                    const snapshot = await db
                        .collection(CHUNK_COLLECTION)
                        .where('userId', '==', uid)
                        .where('resourceId', '==', resourceId)
                        .findNearest({
                            vectorField: 'embedding',
                            queryVector,
                            limit: pool,
                            distanceMeasure: 'COSINE',
                            distanceResultField: '_distance',
                        })
                        .get();

                    const kept = snapshot.docs
                        .map(doc => doc.data())
                        // Acá manda la curaduría: lo que el usuario no admitió
                        // no entra, por cerca que haya quedado.
                        .filter(d => withinRanges(d.metadata?.page, ranges))
                        .map(d => ({
                            resourceId,
                            chunkIndex: typeof d.chunkIndex === 'number' ? d.chunkIndex : 0,
                            text: sanitizeExtractedTextOnly(typeof d.text === 'string' ? d.text : ''),
                            sheet: typeof d.metadata?.page === 'number' ? d.metadata.page : null,
                            section: typeof d.metadata?.section === 'string' ? d.metadata.section : null,
                            // `COSINE` devuelve DISTANCIA: 0 es idéntico. Se
                            // invierte para que quien reciba esto ordene por
                            // "más grande es mejor", como el resto del sistema.
                            score: Math.max(0, Math.min(1, 1 - (typeof d._distance === 'number' ? d._distance : 1))),
                        }));

                    return { resourceId, pool: snapshot.size, kept, failed: false };
                } catch (err) {
                    // Una fuente rota no puede llevarse puesto el corpus entero:
                    // el paso se genera con las demás y se informa cuál faltó.
                    console.warn('[CuratedCorpus] fuente sin resultados', {
                        resourceId,
                        error: (err as Error).message,
                    });
                    return { resourceId, pool: 0, kept: [], failed: true };
                }
            }),
        );

        const chunks = perSource.flatMap(r => r.kept);
        const failedSources = perSource.filter(r => r.failed).map(r => r.resourceId);
        const emptySources = perSource
            .filter(r => !r.failed && r.kept.length === 0)
            .map(r => r.resourceId);

        console.log('[CuratedCorpus] ranking', {
            sources: byResource.size,
            poolPerSource: pool,
            afterRecipeFilter: chunks.length,
            failed: failedSources.length,
            empty: emptySources.length,
        });

        return {
            chunks,
            sourcesQueried: byResource.size,
            failedSources,
            emptySources,
        };
    },
);

/** Lo que una fila de `document_chunks` aporta al ordenamiento. */
export interface CuratedChunkRow {
    chunkIndex?: unknown;
    text?: unknown;
    userId?: unknown;
    stores?: unknown;
    metadata?: { page?: unknown; section?: unknown };
    embedding?: { toArray?: () => number[] } | number[];
}

export interface RankedCuratedChunk {
    resourceId: string;
    chunkIndex: number;
    text: string;
    sheet: number | null;
    section: string | null;
    score: number;
}

/**
 * Ordena por cercanía los fragmentos leídos de las hojas que el trabajo
 * admitió.
 *
 * Es el mismo coseno que aplica el índice vectorial; lo que cambia es sobre
 * qué conjunto. El índice ordena el libro entero y el recorte por receta viene
 * después, así que una fuente cuya selección es el 0,3% de sus fragmentos
 * puede volver vacía por dónde cayó el corte y no por falta de material.
 *
 * Puro a propósito: es la regla, y la lectura por clave es sólo cómo llegan
 * las filas.
 */
export function rankCuratedChunks(input: {
    rows: ReadonlyArray<CuratedChunkRow>;
    resourceId: string;
    uid: string;
    ranges: SheetRange[];
    vector: number[];
    pool: number;
}): RankedCuratedChunk[] {
    return input.rows
        .filter(row => isReadable(row as FirebaseFirestore.DocumentData, input.uid))
        // La receta sigue mandando: el índice de hojas puede mapear un
        // fragmento de más en el borde de un tramo.
        .filter(row => withinRanges(row.metadata?.page, input.ranges))
        .map(row => ({
            resourceId: input.resourceId,
            chunkIndex: typeof row.chunkIndex === 'number' ? row.chunkIndex : 0,
            text: sanitizeExtractedTextOnly(typeof row.text === 'string' ? row.text : ''),
            sheet: typeof row.metadata?.page === 'number' ? row.metadata.page : null,
            section: typeof row.metadata?.section === 'string' ? row.metadata.section : null,
            score: Math.max(0, Math.min(1, cosine(embeddingOf(row.embedding), input.vector))),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.pool);
}

function embeddingOf(value: CuratedChunkRow['embedding']): number[] {
    if (Array.isArray(value)) return value;
    return value?.toArray?.() ?? [];
}
