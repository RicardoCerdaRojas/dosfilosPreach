import { getFirestore } from 'firebase-admin/firestore';

/**
 * La biblioteca compartida (`userId: '__system__'`) en las búsquedas del
 * servidor (fase «Asistente del corpus», A8c).
 *
 * Hasta acá toda búsqueda filtraba `userId == uid`, y los libros del sistema
 * —hoy JFB 1871, 20 577 fragmentos— aparecían en la lista de la biblioteca de
 * cada usuario pero ninguna búsqueda los encontraba.
 *
 * La regla de derechos (diseño §3.6 y §8.1): el TEXTO de un libro compartido
 * solo sale si la obra se puede citar públicamente (`publiclyCitable`, que la
 * ingesta pone en `true` solo para dominio público y licencias abiertas). Un
 * libro compartido sin ese permiso no entra en ninguna búsqueda de texto: ni
 * se le piden fragmentos. La lista de referencias sin texto llega con el MCP
 * (A9), que es donde el diseño la pone.
 */

export const DUENO_COMPARTIDO = '__system__';

export interface RecursoCompartido {
    id: string;
    /** Se puede leer su texto: dominio público o licencia abierta. */
    textoLegible: boolean;
    /**
     * Se cita por su sección («GEN 1:1»): sin páginas impresas resueltas Y sin
     * hojas (`pageCount` 0 o 1, un texto convertido, no un PDF). Los fragmentos
     * de JFB dicen todos hoja 1, y «hoja 1» no le sirve a nadie; un PDF sin
     * calibrar sí conserva su hoja, que es lo único que lo ubica.
     */
    citaPorSeccion: boolean;
}

/**
 * Un libro sin hojas: ni páginas impresas resueltas ni más de una hoja (un
 * texto convertido, como JFB). Se cita por sección y no tiene mapa por hojas.
 */
export function esLibroSinHojas(data: FirebaseFirestore.DocumentData): boolean {
    return !numeracionResuelta(data.pageNumbering) && !(Number(data.pageCount) > 1);
}

/** Resuelve alguna página impresa: un tramo con desfase o páginas marcadas en el texto. */
function numeracionResuelta(n: { segments?: Array<{ offset?: unknown }>; sheetPages?: Record<string, unknown> } | null | undefined): boolean {
    if (!n) return false;
    return (n.segments ?? []).some(s => s.offset !== null && s.offset !== undefined)
        || Object.keys(n.sheetPages ?? {}).length > 0;
}

/** Lo que dice el registro de un libro compartido. Exportada para las pruebas. */
export function aRecursoCompartido(id: string, data: FirebaseFirestore.DocumentData): RecursoCompartido {
    return {
        id,
        textoLegible: data.publiclyCitable === true,
        citaPorSeccion: esLibroSinHojas(data),
    };
}

/** Pocos libros y casi nunca cambian: se leen una vez cada diez minutos por instancia. */
const VIGENCIA_MS = 10 * 60 * 1000;
let cache: { at: number; recursos: Map<string, RecursoCompartido> } | null = null;
/** La lectura en curso: dos búsquedas en paralelo con la caché fría leen una sola vez. */
let enCurso: Promise<Map<string, RecursoCompartido>> | null = null;

/**
 * Los libros de la biblioteca compartida, por id. Si no se pueden leer, la
 * búsqueda sigue con la biblioteca propia (degrada, no rompe) y se avisa.
 */
export async function recursosCompartidos(): Promise<Map<string, RecursoCompartido>> {
    if (cache && Date.now() - cache.at < VIGENCIA_MS) return cache.recursos;
    enCurso ??= leerRecursosCompartidos().finally(() => { enCurso = null; });
    return enCurso;
}

async function leerRecursosCompartidos(): Promise<Map<string, RecursoCompartido>> {
    try {
        const snap = await getFirestore().collection('library_resources')
            .where('userId', '==', DUENO_COMPARTIDO)
            .select('publiclyCitable', 'pageNumbering', 'pageCount')
            .get();
        const recursos = new Map(snap.docs.map(d => [d.id, aRecursoCompartido(d.id, d.data())] as const));
        cache = { at: Date.now(), recursos };
        return recursos;
    } catch (err) {
        console.warn(`[bibliotecaCompartida] no se pudo leer, sigo sin ella: ${err instanceof Error ? err.message.slice(0, 200) : err}`);
        return new Map();
    }
}

/** Los ids de los libros compartidos cuyo texto se puede leer. */
export function legibles(recursos: ReadonlyMap<string, RecursoCompartido>): string[] {
    return [...recursos.values()].filter(r => r.textoLegible).map(r => r.id);
}

/**
 * Quién es dueño de cada libro pedido: el usuario, o la biblioteca compartida
 * si es un libro compartido legible. Un compartido sin permiso de texto no se
 * pide (null). Un id de otro usuario se pide con el `userId` de quien pregunta,
 * y no trae nada.
 */
export function duenoDe(resourceId: string, userId: string, compartidos: ReadonlyMap<string, RecursoCompartido>): string | null {
    const compartido = compartidos.get(resourceId);
    if (!compartido) return userId;
    return compartido.textoLegible ? DUENO_COMPARTIDO : null;
}

/** Solo para las pruebas. */
export function olvidarRecursosCompartidos(): void {
    cache = null;
    enCurso = null;
}
