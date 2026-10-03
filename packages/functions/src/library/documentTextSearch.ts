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

/** Tope de lemas por pedido en modo `'lemas'`: los de un pasaje largo. */
const MAX_TERMS = 150;

/** Hojas que se devuelven por lema en modo `'lemas'`; el cliente muestra tres. */
const SHEETS_PER_TERM = 10;

interface SearchRequest {
    resourceId: string;
    term: string;
    /**
     * `'texto'` busca la secuencia donde aparezca; `'lema'` exige PALABRA
     * ENTERA y compara sólo consonantes.
     *
     * La diferencia no es de matiz. Buscando «שוב» como secuencia, sus tres
     * letras caen dentro de decenas de palabras y la entrada del léxico
     * queda sepultada: sobre los siete lemas de un trabajo real, la página
     * correcta salía en 4. Exigiendo palabra entera, en 7. Y sin vocales
     * porque el análisis escribe «שׁוּב» y el léxico encabeza «שוב»: son la
     * misma entrada y ninguna de las dos grafías encuentra a la otra.
     */
    mode?: 'texto' | 'lema' | 'lemas' | 'referencia';

    /**
     * Sólo en modo `'lemas'`: todos los lemas a buscar, en UNA lectura del
     * libro (`lemmaSheetsIn`). Devuelve `byTerm` en vez de `hits`.
     */
    terms?: string[];

    /**
     * Sólo en modo `'referencia'`: el pasaje que hay que buscar nombrado
     * dentro del libro.
     *
     * Llega desagregado y NO como una expresión regular. La forma de la
     * búsqueda la arma esta función, con lo que el cliente le pasa escapado;
     * aceptar un patrón de afuera sería dejar que quien llama decida cuánto
     * texto recorre el servidor.
     *
     * Las grafías vienen del canon, que ya guarda cómo se escribe cada libro
     * en los dos idiomas y abreviado: «Santiago», «James», «Stg», «Jas».
     */
    reference?: {
        names: string[];
        chapterStart: number;
        chapterEnd: number;
        verseStart: number | null;
        verseEnd: number | null;
    };
}

interface SheetHit {
    sheet: number;
    /** Apariciones en esa hoja, sumando todos sus fragmentos. */
    count: number;
    /** Renglón donde cae la primera, para reconocer la hoja sin abrirla. */
    snippet: string;
    section: string | null;
    /**
     * Sólo en modo `'referencia'`: qué versículos del pasaje nombra la hoja.
     *
     * Es lo que separa una hoja que DISCUTE el pasaje de una que lo usa de
     * ejemplo: la primera nombra varios versículos, la segunda repite uno.
     */
    verses?: number[];
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
/** Consonantes hebreas, sin vocales ni cantilación. */
export function soloConsonantes(text: string): string {
    return (text.match(/[\u05D0-\u05EA]/g) ?? []).join('');
}

/** Una palabra griega sin acentos, espíritus ni mayúsculas, con sigma única. */
export function griegoPlegado(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        // Sigma final y sigma lunada (ϲ, la de muchas ediciones críticas) son σ.
        .replace(/[ςϲ]/g, 'σ')
        .replace(/[^\u03B1-\u03C9]/g, '');
}

/**
 * La clave con que se compara un lema: consonantes si es hebreo, la palabra
 * plegada si es griego.
 *
 * Sólo existía la hebrea, así que un lema griego quedaba en cadena vacía y
 * «Páginas por lema» no encontraba nada en BDAG (Jonás 4:5-11, 2026-10-03).
 * Debe plegar IGUAL que `lemmaKey` de `@dosfilos/domain`: hay una prueba de
 * paridad.
 */
export function lemmaKey(text: string): string {
    const hebreo = soloConsonantes(text);
    return hebreo || griegoPlegado(text);
}

/**
 * Dónde aparece un lema como PALABRA ENTERA, comparando su clave
 * (`lemmaKey`).
 *
 * Devuelve posiciones aproximadas —la del comienzo de la palabra en el
 * texto original— que bastan para el renglón de contexto.
 */
export function lemmaOccurrencesIn(text: string, clave: string): number[] {
    if (!clave || !text) return [];
    return wordKeysIn(text).get(clave)?.at ?? [];
}

/**
 * Cada palabra hebrea o griega del texto con su clave (`lemmaKey`), y dónde
 * aparece. En NFC: un léxico guardado en NFD partía cada palabra griega en sus
 * acentos y no encontraba ningún lema (revisión adversarial de B2).
 */
function wordKeysIn(text: string): Map<string, { at: number[] }> {
    const out = new Map<string, { at: number[] }>();
    const nfc = text.normalize('NFC');
    for (const m of nfc.matchAll(/[\u0590-\u05FF]+|[\u0370-\u03FF\u1F00-\u1FFF\u0300-\u036F]+/g)) {
        const clave = /[\u05D0-\u05EA]/.test(m[0]) ? soloConsonantes(m[0]) : griegoPlegado(m[0]);
        if (!clave) continue;
        const hit = out.get(clave);
        if (hit) hit.at.push(m.index ?? 0);
        else out.set(clave, { at: [m.index ?? 0] });
    }
    return out;
}

/**
 * Las hojas de cada lema, recorriendo el libro UNA vez.
 *
 * «Páginas por lema» pedía una búsqueda por lema, y cada una lee todos los
 * fragmentos del léxico. Con los lemas del pasaje entero —decenas— eso era
 * leer el libro decenas de veces por cada apertura del selector. Y cada
 * fragmento se parte en palabras una sola vez, no una por lema: 150 lemas
 * sobre 3.000 fragmentos tardaban 12 s (revisión adversarial de B2).
 */
export function lemmaSheetsIn(
    chunks: ReadonlyArray<{ text: string; sheet: number; section: string | null }>,
    claves: ReadonlyArray<string>,
    perTerm: number,
): Record<string, Array<{ sheet: number; count: number; snippet: string; section: string | null }>> {
    const porClave = new Map<string, Map<number, { sheet: number; count: number; snippet: string; section: string | null }>>();
    for (const c of claves) if (c) porClave.set(c, new Map());
    for (const chunk of chunks) {
        const palabras = wordKeysIn(chunk.text);
        for (const [clave, hojas] of porClave) {
            const at = palabras.get(clave)?.at;
            if (!at) continue;
            const hoja = hojas.get(chunk.sheet);
            if (hoja) hoja.count += at.length;
            else hojas.set(chunk.sheet, { sheet: chunk.sheet, count: at.length, snippet: snippetAround(chunk.text.normalize('NFC'), at[0]!), section: chunk.section });
        }
    }
    const out: Record<string, Array<{ sheet: number; count: number; snippet: string; section: string | null }>> = {};
    for (const [clave, hojas] of porClave) {
        out[clave] = [...hojas.values()]
            .sort((a, b) => (b.count - a.count) || (a.sheet - b.sheet))
            .slice(0, perTerm);
    }
    return out;
}

/** Un texto suelto, listo para meterse dentro de una expresión regular. */
function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * La forma que reconoce «Santiago 2:9», «Stg. 2.9» o «Jas 2:9».
 *
 * El separador admite dos puntos Y punto porque los dos se usan —Metzger
 * escribe «2.9», Wallace «2:9»— y entre las partes se tolera el espacio que
 * el corte de renglón deja.
 */
export function referenceRegExp(names: ReadonlyArray<string>): RegExp {
    // Las grafías se ordenan de más larga a más corta, y eso NO es cosmético.
    // La alternancia de JavaScript prueba de izquierda a derecha y se queda
    // con la PRIMERA que entra: con «jas» antes que «james», el motor consume
    // «jas» de «james 2:9», falla al pedir la cifra contra la «e», y la cita
    // se pierde. Con la más larga primero eso no puede pasar.
    const grafias = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
    return new RegExp(`(?:${grafias})\\.?\\s*(\\d{1,3})\\s*[:.]\\s*(\\d{1,3})`, 'gi');
}

/**
 * Qué versículos del pasaje nombra un texto, y dónde cae el primero.
 *
 * Devuelve las posiciones en el texto ORIGINAL para poder recortar el renglón
 * de contexto, igual que las otras dos búsquedas.
 */
export function referenceOccurrencesIn(
    text: string,
    re: RegExp,
    enElPasaje: (chapter: number, verse: number) => boolean,
): { at: number[]; verses: number[] } {
    const at: number[] = [];
    const verses = new Set<number>();
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
        const chapter = Number(m[1]);
        const verse = Number(m[2]);
        if (!Number.isFinite(chapter) || !Number.isFinite(verse)) continue;
        if (!enElPasaje(chapter, verse)) continue;
        at.push(m.index ?? 0);
        verses.add(verse);
    }
    return { at, verses: [...verses].sort((a, b) => a - b) };
}

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

        const pedido = request.data?.mode;
        const modo: 'texto' | 'lema' | 'lemas' | 'referencia' =
            pedido === 'lema' || pedido === 'lemas' || pedido === 'referencia' ? pedido : 'texto';

        if (modo === 'lemas') {
            const terms = Array.isArray(request.data?.terms)
                ? request.data!.terms!.filter((x): x is string => typeof x === 'string').slice(0, MAX_TERMS)
                : [];
            const claves = terms.map(lemmaKey);
            if (claves.every(c => c.length < MIN_TERM_LENGTH)) return { byTerm: {}, scannedChunks: 0 };
            const snapshot = await getFirestore()
                .collection(CHUNK_COLLECTION)
                .where('resourceId', '==', resourceId)
                .select('text', 'metadata', 'userId', 'stores')
                .get();
            const readable = snapshot.docs.map(d => d.data()).filter(data => isReadable(data, uid));
            if (!snapshot.empty && readable.length === 0) {
                throw new HttpsError('permission-denied', 'Resource not readable by this user');
            }
            const chunks = readable.flatMap(data => {
                const text = typeof data.text === 'string' ? data.text : '';
                const sheet = typeof data.metadata?.page === 'number' ? data.metadata.page : null;
                const section = typeof data.metadata?.section === 'string' ? data.metadata.section : null;
                return text && sheet !== null ? [{ text, sheet, section }] : [];
            });
            const porClave = lemmaSheetsIn(chunks, claves.filter(c => c.length >= MIN_TERM_LENGTH), SHEETS_PER_TERM);
            const byTerm: Record<string, unknown> = {};
            terms.forEach((t, i) => { byTerm[t] = porClave[claves[i]!] ?? []; });
            console.log(`[DocumentTextSearch] ${resourceId} lemas: ${terms.length} términos, ${readable.length} chunks, una lectura`);
            return { byTerm, scannedChunks: readable.length };
        }

        // En modo referencia la aguja es el pasaje, no un término escrito.
        const ref = modo === 'referencia' ? request.data?.reference : undefined;
        const names = Array.isArray(ref?.names)
            ? ref!.names.filter((n): n is string => typeof n === 'string' && n.trim().length >= MIN_TERM_LENGTH)
            : [];
        if (modo === 'referencia' && names.length === 0) {
            throw new HttpsError('invalid-argument', 'reference.names is required in mode "referencia"');
        }
        const referencia = modo === 'referencia' ? referenceRegExp(names) : null;
        const enElPasaje = (chapter: number, verse: number): boolean => {
            const r = ref!;
            if (chapter < r.chapterStart || chapter > r.chapterEnd) return false;
            if (chapter === r.chapterStart && r.verseStart !== null && verse < r.verseStart) return false;
            if (chapter === r.chapterEnd && r.verseEnd !== null && verse > r.verseEnd) return false;
            return true;
        };

        const aguja = modo === 'lema' ? lemmaKey(term)
            : modo === 'texto' ? foldForSearch(term).text
            : '';
        if (modo !== 'referencia' && aguja.length < MIN_TERM_LENGTH) {
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
            const encontrado = modo === 'referencia'
                ? referenceOccurrencesIn(text, referencia!, enElPasaje)
                : { at: modo === 'lema' ? lemmaOccurrencesIn(text, aguja) : occurrencesIn(text, aguja), verses: [] };
            const at = encontrado.at;
            if (at.length === 0) continue;

            const existing = bySheet.get(sheet);
            if (existing) {
                existing.count += at.length;
                // Una hoja tiene varios fragmentos y el pasaje puede repartirse
                // entre ellos: los versículos se acumulan sin repetir.
                if (existing.verses) {
                    existing.verses = [...new Set([...existing.verses, ...encontrado.verses])].sort((a, b) => a - b);
                }
            } else {
                bySheet.set(sheet, {
                    sheet,
                    count: at.length,
                    snippet: snippetAround(text, at[0]!),
                    section: typeof data.metadata?.section === 'string' ? data.metadata.section : null,
                    ...(modo === 'referencia' ? { verses: encontrado.verses } : {}),
                });
            }
        }

        const all = [...bySheet.values()].sort((a, b) => a.sheet - b.sheet);
        // En modo lema se recorta por APARICIONES y no por número de hoja: la
        // entrada de un verbo común (אמר, λέγω) puede caer después de la hoja
        // 80 y quedaba afuera antes de ordenarse por cantidad.
        const hits = modo === 'lema'
            ? [...all].sort((a, b) => (b.count - a.count) || (a.sheet - b.sheet)).slice(0, MAX_SHEETS).sort((a, b) => a.sheet - b.sheet)
            : all.slice(0, MAX_SHEETS);
        const etiqueta = modo === 'referencia' ? `referencia ${names[0]} ${ref!.chapterStart}` : `«${term}»`;
        console.log(`[DocumentTextSearch] ${resourceId} ${etiqueta} (${modo}): ${readable.length} chunks → ${all.length} hojas`);
        return { hits, truncated: all.length > hits.length, scannedChunks: readable.length };
    },
);
