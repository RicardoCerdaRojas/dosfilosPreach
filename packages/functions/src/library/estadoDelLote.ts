import type { GeminiPage } from './geminiExtraction';
import {
    leerRespuestaDeTramo, listaDePaginas, partirTramo, separarEnBlanco, sinPaginas, tramosQueFaltan, unirPaginas, type Tramo,
} from './loteDeExtraccion';

/**
 * El reproceso en lote desde el panel (fase «lote desde el panel de super
 * admin», PR 2: lanzar y seguir). El estado del lote vive en
 * `admin_lotes/{id}`, y todo lo que lo cambia está acá, en funciones puras:
 * las tareas, el sondeo y los botones leen el documento, hacen su trabajo de
 * red afuera y aplican el resultado con una de estas funciones DENTRO de una
 * transacción. Así, repetir un paso (Cloud Tasks reintenta) no duplica nada:
 * cada función mira si su cambio ya está hecho.
 *
 * Es la misma lógica de `scripts/reprocesar-en-lote.ts` (preparar, recoger,
 * reintentar), sin sus huecos: las respuestas se emparejan por la marca de
 * cada pedido y no por posición, el gasto se registra, y dos ejecuciones no
 * pueden leer la misma ronda dos veces.
 */

export const COLECCION_DE_LOTES = 'admin_lotes';
/** Un lote más grande no entra en un documento (1 MiB) con sus tramos y reintentos. */
export const MAX_LIBROS_POR_LOTE = 60;
export const MAX_TRAMOS_POR_LOTE = 1500;
export const NOMBRE_DE_LOTE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const ID_DE_RECURSO = /^[A-Za-z0-9_-]{1,128}$/;
/** Lo que tarda en vencer un candado o un reclamo abandonado (una tarea que murió a mitad). */
export const VENCE_RECLAMO_MS = 15 * 60_000;
/**
 * Una tarea que dio señales y calla hace más de esto murió sin poder
 * avisar (memoria, el tope de 900 s): un reintento de Cloud Tasks arranca en
 * ~16 min (900 s + la espera) y vuelve a dar señales antes.
 */
export const LATIDO_VENCIDO_MS = 20 * 60_000;
/** Sin ninguna señal: se vuelve a encolar a los 30 min (la cola puede estar llena) y se abandona a las 3 h. */
export const SIN_LATIDO_REENCOLAR_MS = 30 * 60_000;
export const SIN_LATIDO_ABANDONAR_MS = 3 * 3600_000;
/** Veces que se intenta crear el job de una ronda antes de dar el lote por fallido. */
export const MAX_FALLOS_AL_CREAR = 3;
const MAX_MOTIVO = 200;
const recortar = (m: string) => (m.length > MAX_MOTIVO ? `${m.slice(0, MAX_MOTIVO - 1)}…` : m);

export const JOB_BIEN = 'JOB_STATE_SUCCEEDED';
/** Estados finales de un job que no terminó bien: sus tramos pendientes ya no vuelven. */
export const JOB_MAL = new Set(['JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED']);

export type EstadoDeTramo = 'pendiente' | 'ok' | 'fallo' | 'incompleto' | 'reemplazado' | 'abandonado';

export interface ArchivoSubido { name: string; uri: string }

export interface TramoDelLote extends Tramo {
    rid: string;
    ronda: number;
    /** Su posición en `tramos`: no cambia nunca y es la marca del pedido. */
    indice: number;
    estado: EstadoDeTramo;
    motivo?: string;
    faltan?: Tramo[];
    /** Veces seguidas que esta página se pidió sola. */
    intento?: number;
    /** El recorte subido a la Files API (se borra al leer la ronda). */
    archivo?: ArchivoSubido | null;
}

export interface LibroDelLote {
    rid: string;
    titulo: string;
    uid: string;
    totalPaginas: number | null;
    estado: 'por-preparar' | 'preparado' | 'saltado';
    motivo?: string;
    /** El PDF que se cortó: aplicar exige que siga siendo el mismo (PR 3). */
    pdf?: { ruta: string; generacion: string | null } | null;
    /** La última comparación entre el texto actual y el nuevo. */
    comparacion?: ComparacionGuardada | null;
    /** Una aplicación en curso (ms): dos «Aplicar» a la vez no escriben dos veces. */
    aplicando?: number | null;
    aplicado?: { fecha: number; reemplazado: boolean; motivo: string } | null;
}

/** Lo que se muestra de una comparación (sólo números y el motivo, nunca texto del libro). */
export interface ComparacionGuardada {
    reemplazar: boolean;
    motivo: string;
    actual: { faltantes: number; hebreo: number; griego: number; textoVacio: boolean };
    nueva: { faltantes: number; hebreo: number; griego: number; textoVacio: boolean };
    /** Páginas que se rellenan con la capa de texto del PDF (el modelo no las leyó). */
    rellenadas: number;
    /** Páginas que conservan el texto actual porque el nuevo perdía griego o hebreo (`conservarEscritura`). */
    conservadas?: Array<{ pagina: number; escritura: 'griego' | 'hebreo'; antes: number; despues: number }>;
    /** El total (la lista se guarda con tope de 40). */
    conservadasTotal?: number;
    /** Rondas leídas cuando se comparó: si se lee otra, la comparación quedó vieja. */
    rondasLeidas: number;
    calculada: number;
}

export interface RondaDelLote {
    numero: number;
    /** Cuándo se abrió (ms): mide cuánto lleva esperando un libro sin señales. */
    abierta: number;
    /** Los tramos que se le pidieron al job, en orden: la posición sólo vale contra esto. */
    enviados: number[];
    /** Lo que costó esta ronda, para anotarlo en el panel de costos una sola vez. */
    uso: { entrada: number; salida: number; usd: number };
    gastoRegistrado: boolean;
    /** Cuándo se leyó (ms). */
    leidaEn?: number;
    /** Ya se revisaron sus libros contra todas sus páginas (`revisarTramosOk`). */
    revisada: boolean;
    fallosAlCrear: number;
    /** El job de Gemini; null hasta que se crea. */
    job: string | null;
    /** Cuándo una tarea se adjudicó crear el job (ms); vence a los 15 min. */
    reclamada: number | null;
    estadoJob: string | null;
    leida: boolean;
    archivosBorrados: boolean;
}

export type EstadoDelLote = 'preparando' | 'en-curso' | 'listo' | 'cancelado' | 'fallido';

export interface Lote {
    id: string;
    dueno: string;
    creadoPor: string;
    creadoPorEmail: string | null;
    creado: number;
    actualizado: number;
    estado: EstadoDelLote;
    motivo?: string;
    porTramo: number;
    estimadoUsd: number;
    libros: LibroDelLote[];
    rondas: RondaDelLote[];
    tramos: TramoDelLote[];
    uso: { entrada: number; salida: number; usd: number };
    /** El sondeo y «Reintentar» no corren a la vez (ms en que vence). */
    candado: { hasta: number; por: string } | null;
    /** Última señal de la tarea de cada libro en cada ronda (`rid:ronda` → ms). */
    latidos: Record<string, number>;
}

/**
 * El nombre del job lleva la hora de creación del lote: el script de la
 * terminal llama a los suyos `reproceso-<nombre>-r<n>`, y con el mismo nombre
 * un lote del panel adoptaría el job de uno de la terminal (o de un lote
 * anterior borrado con el mismo nombre) al buscar el huérfano.
 */
export const nombreDeJob = (l: Pick<Lote, 'id' | 'creado'>, ronda: number) => `panel-${l.id}-${l.creado}-r${ronda}`;
/**
 * Las páginas y la capa de texto viven bajo la carpeta del DUEÑO del libro:
 * son su texto, y así el borrado de cuenta (`users/{uid}/`) se las lleva.
 * Las reglas de Storage no abren `lotes/` a ningún cliente.
 */
const carpetaDelLote = (l: Pick<Lote, 'id' | 'dueno'>) => `users/${l.dueno}/lotes/${l.id}`;
export const prefijoDePaginas = (l: Pick<Lote, 'id' | 'dueno'>, rid: string) => `${carpetaDelLote(l)}/${rid}.r`;
export const rutaDePaginas = (l: Pick<Lote, 'id' | 'dueno'>, rid: string, ronda: number) => `${prefijoDePaginas(l, rid)}${ronda}.json`;
export const rutaDeCapa = (l: Pick<Lote, 'id' | 'dueno'>, rid: string) => `${carpetaDelLote(l)}/${rid}.capa.json`;
const claveDeLatido = (rid: string, ronda: number) => `${rid}:${ronda}`;
const rondaNueva = (numero: number, ahora: number): RondaDelLote => ({
    numero, abierta: ahora, job: null, reclamada: null, estadoJob: null, leida: false, archivosBorrados: false,
    enviados: [], uso: { entrada: 0, salida: 0, usd: 0 }, gastoRegistrado: false, revisada: false, fallosAlCrear: 0,
});

export function nuevoLote(p: {
    id: string; dueno: string; creadoPor: string; creadoPorEmail: string | null;
    libros: Array<{ rid: string; titulo: string; uid: string }>;
    estimadoUsd: number; porTramo: number; ahora: number;
}): Lote {
    return {
        id: p.id, dueno: p.dueno, creadoPor: p.creadoPor, creadoPorEmail: p.creadoPorEmail,
        creado: p.ahora, actualizado: p.ahora, estado: 'preparando', porTramo: p.porTramo,
        estimadoUsd: Number.isFinite(p.estimadoUsd) && p.estimadoUsd >= 0 ? p.estimadoUsd : 0,
        libros: p.libros.map(l => ({ ...l, totalPaginas: null, estado: 'por-preparar' })),
        rondas: [], tramos: [], uso: { entrada: 0, salida: 0, usd: 0 }, candado: null, latidos: {},
    };
}

const terminado = (l: Lote) => l.estado === 'cancelado' || l.estado === 'fallido';

/** El estado que corresponde a lo que hay; cancelado y fallido no cambian. */
export function estadoGeneral(l: Lote): EstadoDelLote {
    if (terminado(l)) return l.estado;
    if (l.libros.some(b => b.estado === 'por-preparar')) return 'preparando';
    if (l.rondas.some(r => !r.leida)) return 'en-curso';
    return 'listo';
}

/**
 * Un libro de la ronda 1, preparado (con sus tramos ya subidos) o saltado.
 * Cuando ya no queda ninguno por preparar, abre la ronda 1. Idempotente: un
 * libro que ya no está «por preparar» no se toca.
 */
export function registrarLibro(
    l: Lote,
    rid: string,
    r: { totalPaginas: number; tramos: Array<Tramo & { archivo: ArchivoSubido }>; pdf?: LibroDelLote['pdf'] } | { saltado: string },
    ahora: number,
): boolean {
    const libro = l.libros.find(b => b.rid === rid);
    if (!libro || libro.estado !== 'por-preparar' || terminado(l)) return false;
    // El tope se mira acá, con el lote fresco de la transacción: mirado antes,
    // tres tareas a la vez lo pasaban juntas.
    if (!('saltado' in r) && l.tramos.length + r.tramos.length > MAX_TRAMOS_POR_LOTE) {
        r = { saltado: 'el lote ya no tiene lugar para este libro: va en otro' };
    }
    if ('saltado' in r) {
        libro.estado = 'saltado';
        libro.motivo = recortar(r.saltado);
    } else {
        libro.estado = 'preparado';
        libro.totalPaginas = r.totalPaginas;
        libro.pdf = r.pdf ?? null;
        for (const t of r.tramos) {
            l.tramos.push({ desde: t.desde, hasta: t.hasta, rid, ronda: 1, indice: l.tramos.length, estado: 'pendiente', archivo: t.archivo });
        }
    }
    if (!l.libros.some(b => b.estado === 'por-preparar') && l.rondas.length === 0) {
        if (l.tramos.length === 0) {
            l.estado = 'fallido';
            l.motivo = 'ningún libro se pudo preparar';
        } else {
            l.rondas.push(rondaNueva(1, ahora));
        }
    }
    l.estado = estadoGeneral(l);
    l.actualizado = ahora;
    return true;
}

/** La tarea de un libro da señales al empezar cada intento. */
export function latir(l: Lote, rid: string, ronda: number, ahora: number): boolean {
    if (terminado(l)) return false;
    l.latidos = { ...(l.latidos ?? {}), [claveDeLatido(rid, ronda)]: ahora };
    return true;
}

/** El trabajo que una tarea de libro tiene pendiente: el libro sin preparar, o sus tramos de reintento sin subir. */
export function trabajosPendientes(l: Lote): Array<{ rid: string; ronda: number }> {
    if (terminado(l)) return [];
    const trabajos = l.libros.filter(b => b.estado === 'por-preparar').map(b => ({ rid: b.rid, ronda: 1 }));
    for (const r of l.rondas.filter(x => x.numero > 1 && !x.job)) {
        const rids = new Set(tramosDeRonda(l, r.numero).filter(t => t.estado === 'pendiente' && !t.archivo).map(t => t.rid));
        for (const rid of rids) trabajos.push({ rid, ronda: r.numero });
    }
    return trabajos;
}

/**
 * Lo que hace el sondeo con una tarea que no termina: si dio señales y calla
 * hace 20 min, murió (memoria, tiempo) y se abandona; si nunca dio señales, a
 * los 30 min se vuelve a encolar (el encolado pudo fallar) y a las 3 h se
 * abandona. Sin esto, un libro así dejaba el lote en marcha para siempre.
 */
export function vigilarTareas(l: Lote, ahora: number): { reencolar: Array<{ rid: string; ronda: number }>; abandonar: Array<{ rid: string; ronda: number; motivo: string }> } {
    const reencolar: Array<{ rid: string; ronda: number }> = [];
    const abandonar: Array<{ rid: string; ronda: number; motivo: string }> = [];
    for (const t of trabajosPendientes(l)) {
        const latido = l.latidos?.[claveDeLatido(t.rid, t.ronda)];
        const abierta = t.ronda === 1 ? l.creado : l.rondas.find(r => r.numero === t.ronda)?.abierta ?? l.creado;
        if (latido !== undefined) {
            if (ahora - latido > LATIDO_VENCIDO_MS) abandonar.push({ ...t, motivo: 'la tarea dejó de responder (memoria o tiempo): va por la terminal' });
        } else if (ahora - abierta > SIN_LATIDO_ABANDONAR_MS) {
            abandonar.push({ ...t, motivo: 'la tarea nunca empezó' });
        } else if (ahora - abierta > SIN_LATIDO_REENCOLAR_MS) {
            reencolar.push(t);
        }
    }
    return { reencolar, abandonar };
}

/** Los recortes de una ronda de reintento que una tarea ya subió. Idempotente. */
export function registrarSubida(l: Lote, ronda: number, subidos: ReadonlyArray<{ indice: number; archivo: ArchivoSubido }>, ahora: number): boolean {
    let cambio = false;
    for (const s of subidos) {
        const t = l.tramos[s.indice];
        if (!t || t.ronda !== ronda || t.archivo || t.estado !== 'pendiente') continue;
        t.archivo = s.archivo;
        cambio = true;
    }
    if (cambio) l.actualizado = ahora;
    return cambio;
}

export const tramosDeRonda = (l: Lote, ronda: number) => l.tramos.filter(t => t.ronda === ronda).sort((a, b) => a.indice - b.indice);
/** Lo que se le pide a Gemini en una ronda: los tramos pendientes ya subidos. */
export const pedidosDeRonda = (l: Lote, ronda: number) => tramosDeRonda(l, ronda).filter(t => t.estado === 'pendiente' && t.archivo);

/**
 * La tarea de un libro agotó sus intentos (no pudo bajar, abrir o subir el
 * PDF). En la ronda 1 el libro se salta; en un reintento, sus tramos sin
 * subir quedan en «fallo». Sin esto, el lote esperaría para siempre a un libro
 * que ya no va a llegar. Si la ronda se queda sin nada que pedir, se da por leída.
 */
export function abandonarLibro(l: Lote, rid: string, ronda: number, motivo: string, ahora: number): boolean {
    if (ronda === 1) return registrarLibro(l, rid, { saltado: motivo }, ahora);
    let cambio = false;
    for (const t of tramosDeRonda(l, ronda)) {
        if (t.rid !== rid || t.estado !== 'pendiente' || t.archivo) continue;
        t.estado = 'fallo';
        t.motivo = recortar(motivo);
        cambio = true;
    }
    const r = l.rondas.find(x => x.numero === ronda);
    if (r && !r.job && !tramosDeRonda(l, ronda).some(t => t.estado === 'pendiente')) {
        r.leida = true;
        r.archivosBorrados = true;
        r.estadoJob = 'SIN_PEDIDOS';
        cambio = true;
    }
    if (cambio) { l.estado = estadoGeneral(l); l.actualizado = ahora; }
    return cambio;
}

/**
 * Quien llama se adjudica crear el job de la ronda: existe, no tiene job,
 * todos sus recortes están subidos y nadie la reclamó hace menos de 15 min.
 */
export function reclamarRonda(l: Lote, numero: number, ahora: number): boolean {
    const r = l.rondas.find(x => x.numero === numero);
    if (!r || r.job || terminado(l)) return false;
    const pedidos = pedidosDeRonda(l, numero);
    if (pedidos.length === 0 || tramosDeRonda(l, numero).some(t => t.estado === 'pendiente' && !t.archivo)) return false;
    if (r.reclamada !== null && ahora - r.reclamada < VENCE_RECLAMO_MS) return false;
    r.reclamada = ahora;
    l.actualizado = ahora;
    return true;
}

/**
 * Crear el job falló: se libera el reclamo para intentarlo en el próximo
 * sondeo; al tercer fallo el lote se da por fallido con el error a la vista
 * (antes se reintentaba cada 15 min sin fin, en silencio).
 */
export function fallaAlCrearJob(l: Lote, numero: number, error: string, ahora: number): void {
    const r = l.rondas.find(x => x.numero === numero);
    if (!r || r.job || terminado(l)) return;
    r.reclamada = null;
    r.fallosAlCrear = (r.fallosAlCrear ?? 0) + 1;
    if (r.fallosAlCrear >= MAX_FALLOS_AL_CREAR) {
        l.estado = 'fallido';
        l.motivo = recortar(`no se pudo crear la ronda ${numero}: ${error}`);
    }
    l.actualizado = ahora;
}

export function registrarJob(l: Lote, numero: number, job: string, enviados: ReadonlyArray<number>, ahora: number): boolean {
    const r = l.rondas.find(x => x.numero === numero);
    // Un lote cancelado mientras se creaba el job no lo anota: quien lo creó lo cancela.
    if (!r || r.job || terminado(l)) return false;
    r.job = job;
    r.enviados = [...enviados];
    l.estado = estadoGeneral(l);
    l.actualizado = ahora;
    return true;
}

/** Lo que devuelve Gemini por cada pedido de un job. */
export interface RespuestaCruda {
    metadata?: Record<string, string> | null;
    text: string;
    finishReason: string | null;
    error: unknown;
    entrada: number;
    salida: number;
}

/**
 * Cada respuesta con su tramo. Cada pedido lleva `metadata.tramo` = su
 * índice, y eso manda; la posición sólo vale si ninguna respuesta trae la
 * marca y son tantas como los pedidos (el script emparejaba siempre por
 * posición: un job que reordenara las respuestas cruzaba los libros).
 */
export function emparejarRespuestas(enviados: ReadonlyArray<number>, respuestas: ReadonlyArray<RespuestaCruda>): Map<number, RespuestaCruda> {
    const pares = new Map<number, RespuestaCruda>();
    const conMarca = respuestas.filter(r => r.metadata?.tramo !== undefined);
    if (conMarca.length > 0) {
        const validos = new Set(enviados);
        for (const r of conMarca) {
            const i = Number(r.metadata!.tramo);
            if (Number.isInteger(i) && validos.has(i) && !pares.has(i)) pares.set(i, r);
        }
        return pares;
    }
    // Supuesto (no medido): la API devuelve la marca. Si no la devolviera, la
    // posición vale sólo contra lo que DE VERDAD se envió, en ese orden.
    if (respuestas.length === enviados.length) enviados.forEach((indice, i) => pares.set(indice, respuestas[i]!));
    return pares;
}

export interface LecturaDeRonda {
    estadoJob: string;
    cambios: Array<{ indice: number; estado: EstadoDeTramo; motivo?: string; faltan?: Tramo[] }>;
    paginas: Map<string, GeminiPage[]>;
    entrada: number;
    salida: number;
}

/** Lee lo que volvió de una ronda terminada (bien o mal). No toca el lote. */
export function leerRonda(l: Lote, numero: number, estadoJob: string, respuestas: ReadonlyArray<RespuestaCruda> | null): LecturaDeRonda {
    const lectura: LecturaDeRonda = { estadoJob, cambios: [], paginas: new Map(), entrada: 0, salida: 0 };
    const pendientes = tramosDeRonda(l, numero).filter(t => t.estado === 'pendiente');
    if (JOB_MAL.has(estadoJob)) {
        for (const t of pendientes) lectura.cambios.push({ indice: t.indice, estado: 'fallo', motivo: `el lote terminó en ${estadoJob}` });
        return lectura;
    }
    const ronda = l.rondas.find(x => x.numero === numero);
    const pares = emparejarRespuestas(ronda?.enviados ?? [], respuestas ?? []);
    for (const r of respuestas ?? []) { lectura.entrada += r.entrada; lectura.salida += r.salida; }
    for (const t of pendientes) {
        const r = pares.get(t.indice);
        const leido = leerRespuestaDeTramo(r
            ? { text: r.text, finishReason: r.finishReason, error: r.error }
            : { error: 'sin respuesta para este tramo' }, t);
        if (!leido.ok) { lectura.cambios.push({ indice: t.indice, estado: 'fallo', motivo: recortar(leido.motivo) }); continue; }
        lectura.paginas.set(t.rid, [...(lectura.paginas.get(t.rid) ?? []), ...leido.paginas]);
        const faltan = tramosQueFaltan(t, leido.paginas);
        lectura.cambios.push(faltan.length > 0
            // Qué páginas faltan, no cuántas volvieron: «devolvió 20 de 20» se
            // leía como si no faltara nada cuando algunas volvieron en blanco.
            ? { indice: t.indice, estado: 'incompleto', faltan, motivo: `sin leer: ${listaDePaginas(faltan)}` }
            : { indice: t.indice, estado: 'ok' });
    }
    return lectura;
}

/**
 * Aplica la lectura de una ronda. Devuelve false si la ronda ya estaba leída:
 * quien llama NO registra el gasto otra vez (dos sondeos, o un reintento de la
 * tarea, leyendo el mismo job).
 */
export function aplicarLectura(l: Lote, numero: number, lectura: LecturaDeRonda, usd: number, ahora: number): boolean {
    const r = l.rondas.find(x => x.numero === numero);
    if (!r || r.leida) return false;
    for (const c of lectura.cambios) {
        const t = l.tramos[c.indice];
        if (!t || t.estado !== 'pendiente') continue;
        t.estado = c.estado;
        if (c.motivo !== undefined) t.motivo = c.motivo;
        if (c.faltan !== undefined) t.faltan = c.faltan;
    }
    r.leida = true;
    r.leidaEn = ahora;
    r.estadoJob = lectura.estadoJob;
    r.uso = { entrada: lectura.entrada, salida: lectura.salida, usd };
    // Una ronda sin pedidos leídos (el job terminó mal) no tiene nada que revisar.
    r.revisada = lectura.paginas.size === 0;
    l.uso.entrada += lectura.entrada;
    l.uso.salida += lectura.salida;
    l.uso.usd += usd;
    l.estado = estadoGeneral(l);
    l.actualizado = ahora;
    return true;
}

/**
 * Los tramos «ok» de un libro contra TODAS sus páginas guardadas: una página
 * que volvió en blanco y que ninguna ronda posterior llenó deja el tramo
 * incompleto, para que «Reintentar» la pida otra vez.
 */
/** Rondas leídas cuyo gasto todavía no llegó al panel de costos (el sondeo murió a mitad). */
export const rondasSinGasto = (l: Lote) => l.rondas.filter(r => r.leida && !r.gastoRegistrado && r.estadoJob !== 'SIN_PEDIDOS');
export function marcarGastoRegistrado(l: Lote, numero: number): boolean {
    const r = l.rondas.find(x => x.numero === numero);
    if (!r || r.gastoRegistrado) return false;
    r.gastoRegistrado = true;
    return true;
}
/** Rondas leídas cuyos libros falta revisar contra todas sus páginas. */
export const rondasSinRevisar = (l: Lote) => l.rondas.filter(r => r.leida && !r.revisada);
export function marcarRevisada(l: Lote, numero: number): void {
    const r = l.rondas.find(x => x.numero === numero);
    if (r) r.revisada = true;
}
/** Los libros con páginas en una ronda: los que hay que revisar. */
export const librosDeRonda = (l: Lote, numero: number) => [...new Set(tramosDeRonda(l, numero).filter(t => t.estado !== 'pendiente' && t.estado !== 'fallo').map(t => t.rid))];

export function revisarTramosOk(l: Lote, rid: string, paginas: ReadonlyArray<GeminiPage>): number {
    const unidas = unirPaginas(paginas).paginas;
    const abandonadas = new Set(l.tramos.filter(t => t.rid === rid && t.estado === 'abandonado')
        .flatMap(t => Array.from({ length: t.hasta - t.desde + 1 }, (_, i) => t.desde + i)));
    let cambiados = 0;
    for (const t of l.tramos.filter(x => x.rid === rid && x.estado === 'ok')) {
        const faltan = sinPaginas(tramosQueFaltan(t, unidas.filter(p => p.page >= t.desde && p.page <= t.hasta)), abandonadas);
        if (faltan.length === 0) continue;
        t.estado = 'incompleto';
        t.faltan = faltan;
        t.motivo = recortar(`sin leer: ${listaDePaginas(faltan)}`);
        cambiados++;
    }
    return cambiados;
}

const sola = (t: Tramo) => t.desde === t.hasta;

/**
 * «Reintentar»: lo mismo que `reintentar` del script. Las páginas que
 * volvieron en blanco y en el PDF también lo están se abandonan; una página
 * sola que ya falló sola se abandona; un tramo que falló entero se parte en
 * dos y uno incompleto pide sólo lo que faltó. Abre la ronda siguiente (sin
 * job: la crean las tareas cuando terminan de subir) y dice qué libros subir.
 */
export function planearReintento(
    l: Lote,
    capas: ReadonlyMap<string, ReadonlyArray<number> | null>,
    ahora: number,
): { ronda: number | null; libros: string[]; abandonadas: number } {
    if (terminado(l)) throw new Error('el lote está terminado');
    if (l.rondas.some(r => !r.leida)) throw new Error('hay una ronda en curso: espera a que termine');
    const nada = { ronda: null, libros: [], abandonadas: 0 };
    for (const f of l.tramos.filter(t => t.estado === 'incompleto' && t.faltan?.length)) {
        const { pedir, enBlanco } = separarEnBlanco(f.faltan!, capas.get(f.rid) ?? null);
        if (enBlanco.length === 0) continue;
        for (const n of enBlanco) {
            l.tramos.push({ desde: n, hasta: n, rid: f.rid, ronda: 0, indice: l.tramos.length, estado: 'abandonado', motivo: 'en blanco también en el PDF' });
        }
        f.faltan = pedir;
        if (pedir.length === 0) { f.estado = 'ok'; f.motivo = `páginas en blanco en el PDF: ${enBlanco.join(', ')}`; }
    }
    l.actualizado = ahora;
    // Un libro ya reemplazado no se vuelve a pedir: sus páginas nuevas no se
    // podrían aplicar (se cobrarían de balde).
    const reemplazados = new Set(l.libros.filter(b => b.aplicado?.reemplazado).map(b => b.rid));
    const fallos = l.tramos.filter(t => (t.estado === 'fallo' || t.estado === 'incompleto') && !reemplazados.has(t.rid));
    if (fallos.length === 0) { l.estado = estadoGeneral(l); return nada; }
    const abandonar = fallos.filter(f => (sola(f) && ((f.intento ?? 1) >= 2 || (f.estado === 'incompleto' && f.ronda > 1)))
        || (f.estado === 'fallo' && /RECITATION/.test(f.motivo ?? '') && f.hasta - f.desde < 3));
    for (const f of abandonar) { f.estado = 'abandonado'; f.motivo = recortar(`${f.motivo ?? ''}; se abandona tras ${f.intento ?? 2} intentos`); }
    const reintentables = fallos.filter(f => !abandonar.includes(f));
    if (reintentables.length === 0) { l.estado = estadoGeneral(l); return { ...nada, abandonadas: abandonar.length }; }
    if (l.tramos.length + reintentables.length * 2 > MAX_TRAMOS_POR_LOTE * 1.5) throw new Error('el lote ya tiene demasiados tramos: arma uno nuevo con estos libros');
    const ronda = Math.max(0, ...l.rondas.map(r => r.numero)) + 1;
    const aPedir = (f: TramoDelLote): Tramo[] => {
        const faltan = f.estado === 'incompleto' ? f.faltan ?? [] : [];
        const sinAvance = faltan.length === 0 || (faltan.length === 1 && faltan[0]!.desde === f.desde && faltan[0]!.hasta === f.hasta);
        return sinAvance ? partirTramo(f) : faltan;
    };
    const libros = new Set<string>();
    for (const f of reintentables) {
        for (const t of aPedir(f)) {
            l.tramos.push({ ...t, rid: f.rid, ronda, indice: l.tramos.length, estado: 'pendiente', intento: sola(t) && sola(f) ? (f.intento ?? 1) + 1 : 1 });
            libros.add(f.rid);
        }
        f.estado = 'reemplazado';
        f.motivo = `partido en la ronda ${ronda}`;
    }
    l.rondas.push(rondaNueva(ronda, ahora));
    l.estado = estadoGeneral(l);
    return { ronda, libros: [...libros], abandonadas: abandonar.length };
}

/** «Cancelar»: los jobs sin leer que hay que cancelar en Gemini. */
export function cancelar(l: Lote, ahora: number): { jobs: string[] } {
    if (terminado(l)) return { jobs: [] };
    l.estado = 'cancelado';
    l.motivo = 'cancelado desde el panel';
    l.actualizado = ahora;
    return { jobs: l.rondas.filter(r => !r.leida && r.job).map(r => r.job!) };
}

/** Los recortes subidos de una ronda ya leída (o de un lote cancelado) que todavía ocupan la Files API. */
export function archivosParaBorrar(l: Lote): Array<{ ronda: number; nombres: string[] }> {
    return l.rondas
        .filter(r => !r.archivosBorrados && (r.leida || terminado(l)))
        .map(r => ({ ronda: r.numero, nombres: tramosDeRonda(l, r.numero).map(t => t.archivo?.name).filter((n): n is string => !!n) }));
}

/** Los recortes borrados ya no se guardan: su nombre y su URL sólo ocupaban lugar en el documento. */
export function marcarArchivosBorrados(l: Lote, rondas: ReadonlyArray<number>): void {
    for (const r of l.rondas) if (rondas.includes(r.numero)) r.archivosBorrados = true;
    for (const t of l.tramos) if (rondas.includes(t.ronda) && t.archivo) t.archivo = null;
}

export function tomarCandado(l: Lote, por: string, ahora: number): boolean {
    if (l.candado && l.candado.hasta > ahora && l.candado.por !== por) return false;
    l.candado = { hasta: ahora + VENCE_RECLAMO_MS, por };
    return true;
}

export function soltarCandado(l: Lote, por: string): void {
    if (l.candado?.por === por) l.candado = null;
}

// ── Aplicar (PR 3) ──────────────────────────────────────────────────────────

/** Cuánto vale un reclamo de «Aplicar» (una escritura de libro tarda segundos). */
export const VENCE_APLICACION_MS = 10 * 60_000;

/**
 * Si un libro ya se puede aplicar, igual que el script:
 *  - con tramos pendientes, no (todavía llegan páginas), ni con una ronda
 *    leída sin revisar (sus páginas en blanco aún figuran «ok»);
 *  - con un tramo en «fallo», no: el script tampoco aplicaba (ese tramo no
 *    trajo nada; se reintenta o se abandona);
 *  - con tramos incompletos, sólo si se acepta (`--aceptar-incompletos`):
 *    aplicar ahora y otra vez tras reintentar deja un respaldo de la parcial.
 * Un libro que se aplicó y se quedó como estaba («no mejora») se puede volver
 * a aplicar si llega una ronda nueva; uno ya reemplazado, no.
 */
export function listoParaAplicar(l: Lote, rid: string): { listo: boolean; incompletos: number; motivo: string | null } {
    const no = (motivo: string) => ({ listo: false, incompletos: 0, motivo });
    const libro = l.libros.find(b => b.rid === rid);
    if (!libro || libro.estado !== 'preparado') return no('el libro no se preparó');
    if (libro.aplicado?.reemplazado) return no('ya se aplicó');
    if (l.estado === 'cancelado') return no('el lote está cancelado');
    const tramos = l.tramos.filter(t => t.rid === rid);
    if (tramos.some(t => t.estado === 'pendiente')) return no('todavía hay tramos en curso');
    const rondas = new Set(tramos.map(t => t.ronda));
    if (l.rondas.some(r => rondas.has(r.numero) && (!r.leida || !r.revisada))) return no('la última ronda todavía se está revisando');
    const fallos = tramos.filter(t => t.estado === 'fallo').length;
    if (fallos > 0) return no(`${fallos} tramos fallaron: reintenta primero`);
    if (libro.aplicado && libro.aplicado.fecha >= Math.max(0, ...l.rondas.filter(r => rondas.has(r.numero)).map(r => r.leidaEn ?? 0))) {
        return no('ya se comparó al aplicar y no mejoraba: reintenta para traer más páginas');
    }
    return { listo: true, incompletos: tramos.filter(t => t.estado === 'incompleto').length, motivo: null };
}

export function registrarComparacion(l: Lote, rid: string, c: Omit<ComparacionGuardada, 'rondasLeidas' | 'calculada'>, ahora: number): boolean {
    const libro = l.libros.find(b => b.rid === rid);
    if (!libro) return false;
    libro.comparacion = { ...c, motivo: recortar(c.motivo), rondasLeidas: l.rondas.filter(r => r.leida).length, calculada: ahora };
    return true;
}

/** Quien llama se adjudica aplicar el libro; falla si no está listo o si otro lo está aplicando. */
export function reclamarAplicacion(l: Lote, rid: string, aceptarIncompletos: boolean, ahora: number): string | null {
    const listo = listoParaAplicar(l, rid);
    if (!listo.listo) return listo.motivo;
    if (listo.incompletos > 0 && !aceptarIncompletos) return `faltan ${listo.incompletos} tramos: reintenta o aplica igual`;
    const libro = l.libros.find(b => b.rid === rid)!;
    if (libro.aplicando && ahora - libro.aplicando < VENCE_APLICACION_MS) return 'ya se está aplicando';
    libro.aplicando = ahora;
    return null;
}

export function registrarAplicacion(l: Lote, rid: string, r: { reemplazado: boolean; motivo: string }, ahora: number): void {
    const libro = l.libros.find(b => b.rid === rid);
    if (!libro) return;
    libro.aplicando = null;
    libro.aplicado = { fecha: ahora, reemplazado: r.reemplazado, motivo: recortar(r.motivo) };
    l.actualizado = ahora;
}

export function soltarAplicacion(l: Lote, rid: string): void {
    const libro = l.libros.find(b => b.rid === rid);
    if (libro && !libro.aplicado) libro.aplicando = null;
}

/** Lo que muestra el panel: sin los recortes ni las marcas internas. */
export interface ResumenDeLote {
    id: string;
    estado: EstadoDelLote;
    motivo: string | null;
    creado: number;
    actualizado: number;
    creadoPorEmail: string | null;
    dueno: string;
    estimadoUsd: number;
    usd: number;
    paginas: number;
    rondas: Array<{ numero: number; estadoJob: string | null; leida: boolean; tramos: number }>;
    tramos: Record<EstadoDeTramo, number>;
    /** Páginas que «Reintentar» volvería a pedir, como mucho (para su confirmación). */
    paginasConFallas: number;
    libros: Array<{
        rid: string; titulo: string; estado: LibroDelLote['estado']; motivo: string | null; paginas: number | null;
        tramos: Record<EstadoDeTramo, number>;
        fallas: string[];
        /** Se puede aplicar ya (con `incompletos` > 0, sólo aceptándolo). */
        listo: boolean;
        incompletos: number;
        comparacion: ComparacionGuardada | null;
        /** La comparación es de antes de la última ronda leída: hay que volver a comparar. */
        comparacionVieja: boolean;
        aplicado: LibroDelLote['aplicado'];
    }>;
    puedeReintentar: boolean;
    puedeCancelar: boolean;
}

const contar = (ts: ReadonlyArray<TramoDelLote>): Record<EstadoDeTramo, number> => {
    const c: Record<EstadoDeTramo, number> = { pendiente: 0, ok: 0, fallo: 0, incompleto: 0, reemplazado: 0, abandonado: 0 };
    for (const t of ts) c[t.estado]++;
    return c;
};

export function resumirLote(l: Lote): ResumenDeLote {
    const t = contar(l.tramos);
    return {
        id: l.id, estado: l.estado, motivo: l.motivo ?? null, creado: l.creado, actualizado: l.actualizado,
        creadoPorEmail: l.creadoPorEmail, dueno: l.dueno, estimadoUsd: l.estimadoUsd, usd: l.uso.usd,
        paginas: l.libros.reduce((n, b) => n + (b.totalPaginas ?? 0), 0),
        rondas: l.rondas.map(r => ({ numero: r.numero, estadoJob: r.estadoJob, leida: r.leida, tramos: tramosDeRonda(l, r.numero).length })),
        tramos: t,
        paginasConFallas: l.tramos.filter(x => !l.libros.find(b => b.rid === x.rid)?.aplicado?.reemplazado).reduce((n, x) => n + (x.estado === 'fallo'
            ? x.hasta - x.desde + 1
            : x.estado === 'incompleto' ? (x.faltan ?? []).reduce((m, f) => m + f.hasta - f.desde + 1, 0) : 0), 0),
        libros: l.libros.map(b => {
            const delLibro = l.tramos.filter(x => x.rid === b.rid);
            const listo = listoParaAplicar(l, b.rid);
            return {
                rid: b.rid, titulo: b.titulo, estado: b.estado, motivo: b.motivo ?? null, paginas: b.totalPaginas,
                tramos: contar(delLibro),
                fallas: delLibro.filter(x => x.estado === 'fallo' || x.estado === 'incompleto')
                    .slice(0, 8).map(x => `${x.desde}–${x.hasta}: ${x.motivo ?? x.estado}`),
                listo: listo.listo,
                incompletos: listo.incompletos,
                comparacion: b.comparacion ?? null,
                comparacionVieja: !!b.comparacion && b.comparacion.rondasLeidas !== l.rondas.filter(r => r.leida).length,
                aplicado: b.aplicado ?? null,
            };
        }),
        puedeReintentar: !terminado(l) && l.rondas.length > 0 && l.rondas.every(r => r.leida)
            && l.tramos.some(x => (x.estado === 'fallo' || x.estado === 'incompleto') && !l.libros.find(b => b.rid === x.rid)?.aplicado?.reemplazado),
        puedeCancelar: !terminado(l) && l.estado !== 'listo',
    };
}
