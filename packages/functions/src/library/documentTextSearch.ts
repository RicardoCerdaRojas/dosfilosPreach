import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';

/**
 * Buscar una palabra en TODO un libro indexado, no en la hoja abierta.
 *
 * Nace de una cita mal paginada. El verificador dijo «la p. 440 habla de
 * Hifil, no de Polel» y el lector, con el libro abierto, sólo podía
 * buscar en la hoja que tenía delante: para hallar dónde estaba el Polel
 * habría tenido que pasar 791 hojas a mano. Estaba en la impresa 436, y
 * la afirmación del análisis era correcta —sólo la página estaba mal—.
 * Sin esta búsqueda, ese caso se cierra marcando la cita como dudosa y
 * borrando una afirmación verdadera.
 *
 * Es búsqueda LITERAL, no semántica. `retrieveChunks` responde «qué se
 * parece a esta consulta» y para un término técnico —Polel, Hitpael, un
 * lema hebreo— eso devuelve párrafos afines sin la palabra. Acá se
 * pregunta por la palabra, que es lo que hace el lector cuando ya sabe
 * qué busca.
 */

const CHUNK_COLLECTION = 'document_chunks';

/**
 * Tope de hojas distintas que se devuelven. Una palabra corriente («the»)
 * cae en todas; devolver 800 entradas no ayuda a nadie y sólo engorda el
 * transporte. Se avisa con `truncated` para que la interfaz pueda pedir
 * un término más preciso.
 */
const MAX_SHEETS = 80;

/** Contexto alrededor de la primera aparición en cada hoja, en caracteres. */
const SNIPPET_BEFORE = 120;
const SNIPPET_AFTER = 200;

/**
 * Términos de una sola letra se rechazan: no discriminan nada y obligan a
 * recorrer el libro entero para devolver todas las hojas.
 */
const MIN_TERM_LENGTH = 2;

interface SearchRequest {
    resourceId: string;
    term: string;
}

interface SheetHit {
    sheet: number;
    /** Apariciones en esa hoja, sumando todos sus fragmentos. */
    count: number;
    /** Renglón donde cae la primera, para reconocer la hoja sin abrirla. */
    snippet: string;
    section: string | null;
}

/**
 * La forma comparable de un texto, con el mapa de vuelta a sus posiciones.
 *
 * Copia deliberada de `normalizeForSearch` de `@dosfilos/domain`
 * (`exegesis/outline/findQuoteInPageText.ts`), que es quien busca dentro
 * de la hoja abierta. Se duplica porque `packages/functions` no puede
 * importar domain —corren en runtimes distintos y el paquete no está en
 * sus dependencias—, y las dos tienen que plegar IGUAL: si acá una
 * palabra partida por el guion del renglón contara y allá no, el libro
 * diría «está en la hoja 454» y la hoja 454 diría «sin coincidencias».
 * Hay prueba de paridad con los mismos casos en ambos lados.
 */
function foldForSearch(input: string): { text: string; sourceIndex: number[] } {
    const normalized = input.normalize('NFC');
    const chars: string[] = [];
    const sourceIndex: number[] = [];
    for (let i = 0; i < normalized.length; i++) {
        const folded = fold(normalized[i]!);
        if (folded === '') continue;
        chars.push(folded);
        sourceIndex.push(i);
    }
    return { text: chars.join(''), sourceIndex };
}

/** Un carácter en su forma comparable, o '' cuando no cuenta. */
function fold(char: string): string {
    if (/[\s -]/.test(char)) return '';
    if (/[‐-―−]/.test(char)) return '';
    if (/[‘’‛′]/.test(char)) return "'";
    if (/[“”‟″«»]/.test(char)) return '"';
    return char.toLowerCase();
}

/**
 * Dónde cae cada aparición del término dentro de un fragmento, en
 * posiciones del texto ORIGINAL.
 */
export function occurrencesIn(text: string, foldedTerm: string): number[] {
    if (!foldedTerm || !text) return [];
    const haystack = foldForSearch(text);
    const out: number[] = [];
    let at = haystack.text.indexOf(foldedTerm);
    while (at !== -1) {
        out.push(haystack.sourceIndex[at]!);
        at = haystack.text.indexOf(foldedTerm, at + foldedTerm.length);
    }
    return out;
}

/** Renglón de contexto alrededor de una posición, en una sola línea. */
export function snippetAround(text: string, at: number): string {
    const from = Math.max(0, at - SNIPPET_BEFORE);
    const to = Math.min(text.length, at + SNIPPET_AFTER);
    const body = text.slice(from, to).replace(/\s+/g, ' ').trim();
    return `${from > 0 ? '…' : ''}${body}${to < text.length ? '…' : ''}`;
}

export { foldForSearch };

/**
 * Se valida sobre los CHUNKS, no sobre `library_resources`: son los chunks
 * los que se leen, y son ellos los que llevan el `userId` del dueño y los
 * `stores` de la biblioteca compartida.
 */
function isReadable(data: FirebaseFirestore.DocumentData, uid: string): boolean {
    if (data.userId === uid) return true;
    return Array.isArray(data.stores) && data.stores.length > 0;
}

export const searchDocumentText = onCall<SearchRequest>(
    { ...appCheckCallableOptions(), region: 'us-central1', memory: '1GiB', timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Sign-in required');
        }
        const uid = request.auth.uid;
        const resourceId = typeof request.data?.resourceId === 'string' ? request.data.resourceId.trim() : '';
        const term = typeof request.data?.term === 'string' ? request.data.term.trim() : '';
        if (!resourceId) throw new HttpsError('invalid-argument', 'resourceId is required');

        const foldedTerm = foldForSearch(term).text;
        if (foldedTerm.length < MIN_TERM_LENGTH) {
            return { hits: [], truncated: false, scannedChunks: 0 };
        }

        const db = getFirestore();
        // `select` deja fuera el vector de embeddings de cada chunk, que es
        // lo que pesa: sin él, un libro de 800 páginas son unos pocos MB.
        const snapshot = await db
            .collection(CHUNK_COLLECTION)
            .where('resourceId', '==', resourceId)
            .select('text', 'metadata', 'userId', 'stores')
            .get();

        if (snapshot.empty) return { hits: [], truncated: false, scannedChunks: 0 };

        const readable = snapshot.docs.map(d => d.data()).filter(data => isReadable(data, uid));
        if (readable.length === 0) {
            throw new HttpsError('permission-denied', 'Resource not readable by this user');
        }

        // Un chunk puede cruzar el corte de hoja y una hoja tiene varios
        // chunks, así que las apariciones se suman por hoja y el renglón
        // de contexto es el de la primera.
        const bySheet = new Map<number, SheetHit>();
        for (const data of readable) {
            const text = typeof data.text === 'string' ? data.text : '';
            const sheet = typeof data.metadata?.page === 'number' ? data.metadata.page : null;
            if (!text || sheet === null) continue;
            const at = occurrencesIn(text, foldedTerm);
            if (at.length === 0) continue;

            const existing = bySheet.get(sheet);
            if (existing) {
                existing.count += at.length;
            } else {
                bySheet.set(sheet, {
                    sheet,
                    count: at.length,
                    snippet: snippetAround(text, at[0]!),
                    section: typeof data.metadata?.section === 'string' ? data.metadata.section : null,
                });
            }
        }

        const all = [...bySheet.values()].sort((a, b) => a.sheet - b.sheet);
        const hits = all.slice(0, MAX_SHEETS);
        console.log(`[DocumentTextSearch] ${resourceId} «${term}»: ${readable.length} chunks → ${all.length} hojas`);
        return { hits, truncated: all.length > hits.length, scannedChunks: readable.length };
    },
);
