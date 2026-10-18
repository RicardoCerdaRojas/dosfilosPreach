import type { Firestore } from 'firebase-admin/firestore';
import { PDFDocument } from 'pdf-lib';
import type { GeminiPage } from './geminiExtraction';
import type { GeminiDelLote } from './geminiDelLote';
import { descifrarPdf, puedeEstarCifrado, TOPE_PARA_DESCIFRAR_EN_LA_NUBE } from './descifrarPdf';
import { leerPaginasDelPdf } from './textoDelPdf';
import { parseFirebaseStorageLocation } from './storageLocation';
import { planearTramos, PAGINAS_POR_TRAMO } from './loteDeExtraccion';
import {
    abandonarLibro, aplicarLectura, archivosParaBorrar, cancelar, COLECCION_DE_LOTES, fallaAlCrearJob, ID_DE_RECURSO, latir,
    leerRonda, librosDeRonda, marcarArchivosBorrados, marcarGastoRegistrado, marcarRevisada, MAX_LIBROS_POR_LOTE,
    MAX_TRAMOS_POR_LOTE, NOMBRE_DE_LOTE, nombreDeJob, nuevoLote, pedidosDeRonda, planearReintento, prefijoDePaginas,
    reclamarRonda, registrarJob, registrarLibro, registrarSubida, revisarTramosOk, rondasSinGasto, rondasSinRevisar,
    rutaDeCapa, rutaDePaginas, soltarCandado, tomarCandado, tramosDeRonda, vigilarTareas, JOB_BIEN, JOB_MAL, type Lote,
    type LibroDelLote,
} from './estadoDelLote';

/**
 * La orquestación del reproceso en lote en el servidor (fase «lote desde el
 * panel», PR 2). La lógica vive en `estadoDelLote` (pura); acá se baja, se
 * sube y se guarda. Cada cambio del lote pasa por `actualizar`: una
 * transacción que relee el documento y le aplica una función pura, así que
 * una tarea repetida o dos ejecuciones a la vez no duplican nada.
 */

/** Lo que la orquestación usa de afuera: inyectado para probarla sin red. */
export interface Almacen {
    bajar(ruta: { bucket: string; path: string }): Promise<Buffer>;
    /** La generación del objeto: cambia si el archivo se reemplaza. */
    generacion(ruta: { bucket: string; path: string }): Promise<string | null>;
    /** Escribe en el bucket por defecto; `sinPisar` falla si el archivo ya existe. */
    escribir(path: string, contenido: string, opciones: { contentType: string; sinPisar?: boolean; metadata?: Record<string, string> }): Promise<void>;
    borrar(path: string): Promise<void>;
    guardar(path: string, contenido: string): Promise<void>;
    leer(path: string): Promise<string | null>;
    listar(prefijo: string): Promise<string[]>;
}

export interface Dependencias {
    db: Firestore;
    almacen: Almacen;
    bucketPorDefecto: string;
    gemini: GeminiDelLote;
    ahora: () => number;
    /** Lo que cuesta una ronda, con el descuento de lote. */
    usdDeLote: (entrada: number, salida: number) => number;
    /** Anota el gasto de una ronda leída en el panel de costos (`recordLlmUsage`). */
    registrarGasto: (uso: { entrada: number; salida: number }) => Promise<void>;
    encolar: (carga: CargaDeLote) => Promise<void>;
}

/** La tarea de un libro en una ronda: preparar (ronda 1) o subir lo que se reintenta. */
export interface CargaDeLote { loteId: string; rid: string; ronda: number }

export class ErrorDelLote extends Error {
    constructor(readonly codigo: 'invalid-argument' | 'already-exists' | 'not-found' | 'failed-precondition', mensaje: string) {
        super(mensaje);
    }
}

const ref = (d: Dependencias, id: string) => d.db.collection(COLECCION_DE_LOTES).doc(id);
/** Firestore rechaza `undefined`: el lote se guarda como JSON plano. */
const plano = (l: Lote) => JSON.parse(JSON.stringify(l)) as Record<string, unknown>;

export async function leerLote(d: Dependencias, id: string): Promise<Lote | null> {
    const s = await ref(d, id).get();
    return s.exists ? (s.data() as Lote) : null;
}

/** Relee el lote dentro de una transacción, le aplica `fn` y lo guarda si cambió. */
export async function actualizar<T>(d: Dependencias, id: string, fn: (l: Lote) => T): Promise<T> {
    return d.db.runTransaction(async tx => {
        const s = await tx.get(ref(d, id));
        if (!s.exists) throw new ErrorDelLote('not-found', 'El lote no existe');
        const l = s.data() as Lote;
        const antes = JSON.stringify(l);
        const r = fn(l);
        const despues = JSON.stringify(l);
        if (despues !== antes) {
            // Un documento pasa de 1 MiB y la escritura falla en cada intento:
            // mejor un error que diga por qué (los topes de tramos y de motivos lo evitan).
            if (despues.length > 950_000) throw new Error(`el lote ${id} ya no entra en un documento (${despues.length} bytes)`);
            tx.set(ref(d, id), plano(l));
        }
        return r;
    });
}

// ── Lanzar ──────────────────────────────────────────────────────────────────

/** Versiones que no salen de un PDF: no se reprocesan (igual que el panel). */
const VERSIONES_EXCLUIDAS = new Set(['6.0-thml-public-domain']);

export async function lanzarLote(d: Dependencias, p: {
    nombre: string; dueno: string; ids: string[]; estimadoUsd: number; por: string; email: string | null;
}): Promise<{ id: string; libros: number }> {
    if (!NOMBRE_DE_LOTE.test(p.nombre)) throw new ErrorDelLote('invalid-argument', 'El nombre del lote sólo lleva minúsculas, cifras y guiones (hasta 40).');
    const ids = [...new Set(p.ids)];
    if (ids.length === 0) throw new ErrorDelLote('invalid-argument', 'Elige al menos un libro.');
    if (ids.length > MAX_LIBROS_POR_LOTE) throw new ErrorDelLote('invalid-argument', `Un lote lleva hasta ${MAX_LIBROS_POR_LOTE} libros.`);
    if (ids.some(i => !ID_DE_RECURSO.test(i))) throw new ErrorDelLote('invalid-argument', 'Hay un libro con un identificador inválido.');

    const docs = await d.db.getAll(...ids.map(i => d.db.collection('library_resources').doc(i)));
    const problemas: string[] = [];
    const libros = docs.map(s => {
        const r = s.data();
        const titulo = String(r?.title ?? s.id).slice(0, 120);
        if (!r) problemas.push(`${s.id}: no existe`);
        else if (r.userId !== p.dueno) problemas.push(`${titulo}: es de otra biblioteca`);
        else if (typeof r.mimeType === 'string' && !r.mimeType.includes('pdf')) problemas.push(`${titulo}: no es un PDF`);
        else if (r.textExtractionStatus === 'processing') problemas.push(`${titulo}: se está extrayendo`);
        else if (VERSIONES_EXCLUIDAS.has(r.extractionVersion)) problemas.push(`${titulo}: es texto de dominio público`);
        else if (!r.storageUrl) problemas.push(`${titulo}: no tiene el PDF`);
        return { rid: s.id, titulo, uid: String(r?.userId ?? '') };
    });
    if (problemas.length > 0) throw new ErrorDelLote('failed-precondition', `No entran en un lote: ${problemas.slice(0, 5).join('; ')}`);

    const lote = nuevoLote({
        id: p.nombre, dueno: p.dueno, creadoPor: p.por, creadoPorEmail: p.email, libros,
        estimadoUsd: p.estimadoUsd, porTramo: PAGINAS_POR_TRAMO, ahora: d.ahora(),
    });
    try {
        await ref(d, p.nombre).create(plano(lote));
    } catch (err) {
        if ((err as { code?: number }).code === 6) throw new ErrorDelLote('already-exists', `Ya existe un lote «${p.nombre}». Elige otro nombre.`);
        throw err;
    }
    // Un encolado que falla no deja el lote colgado: el sondeo vuelve a encolar
    // lo que no dio señales a los 30 min (con id fijo: nunca dos tareas iguales).
    for (const b of libros) await d.encolar({ loteId: p.nombre, rid: b.rid, ronda: 1 }).catch(err => console.warn(`[lote] ${p.nombre}: no se pudo encolar ${b.rid}`, err));
    return { id: p.nombre, libros: libros.length };
}

// ── La tarea de un libro ────────────────────────────────────────────────────

/** El PDF abierto, descifrado si hace falta; o por qué no se puede usar. */
async function abrirPdf(d: Dependencias, rid: string): Promise<{ pdf: PDFDocument; bytes: Buffer; origen: NonNullable<LibroDelLote['pdf']> } | { saltado: string }> {
    const recurso = (await d.db.collection('library_resources').doc(rid).get()).data();
    if (!recurso) return { saltado: 'el libro ya no existe' };
    const ubicacion = parseFirebaseStorageLocation(String(recurso.storageUrl ?? ''), d.bucketPorDefecto);
    if (!ubicacion.path) return { saltado: 'el libro no tiene el PDF' };
    const generacion = await d.almacen.generacion(ubicacion);
    const original = await d.almacen.bajar(ubicacion);
    const origen = { ruta: `${ubicacion.bucket}/${ubicacion.path}`, generacion };
    // Igual que la subida: qpdf necesita ~12 veces el archivo en memoria.
    if (original.length > TOPE_PARA_DESCIFRAR_EN_LA_NUBE && puedeEstarCifrado(original)) {
        return { saltado: 'está cifrado y pesa más de 60 MB: sólo se descifra en la terminal' };
    }
    const descifrado = await descifrarPdf(original);
    if (descifrado.estado === 'pide-contrasena') return { saltado: 'el PDF pide contraseña para abrirse' };
    const bytes = descifrado.estado === 'descifrado' ? descifrado.bytes : original;
    try {
        return { pdf: await PDFDocument.load(bytes), bytes, origen };
    } catch (err) {
        return { saltado: `el PDF no se pudo abrir (${err instanceof Error ? err.message.slice(0, 80) : 'error'})` };
    }
}

async function subirTramos(d: Dependencias, pdf: PDFDocument, tramos: ReadonlyArray<{ desde: number; hasta: number }>) {
    const subidos = [];
    for (const t of tramos) {
        const recorte = await PDFDocument.create();
        const paginas = await recorte.copyPages(pdf, Array.from({ length: t.hasta - t.desde + 1 }, (_, i) => t.desde - 1 + i));
        for (const pg of paginas) recorte.addPage(pg);
        subidos.push({ ...t, archivo: await d.gemini.subirPdf(await recorte.save()) });
    }
    return subidos;
}

/**
 * La capa de texto del PDF por página, guardada con el lote: «Reintentar» la
 * usa para no pedir páginas en blanco de verdad, y «Aplicar» (PR 3) para
 * rellenar las que el modelo no lee. pdfjs puede tardar minutos: si vence, se
 * sigue sin ella, y la tarea de un reintento la vuelve a intentar.
 */
async function guardarCapa(d: Dependencias, lote: Lote, rid: string, bytes: Buffer, vence: number): Promise<void> {
    const ruta = rutaDeCapa(lote, rid);
    if (await d.almacen.leer(ruta) !== null) return;
    try {
        const textos = (await leerPaginasDelPdf(bytes, vence)).map(p => p.text);
        await d.almacen.guardar(ruta, JSON.stringify(textos));
    } catch (err) {
        console.warn(`[lote] ${lote.id}/${rid}: sin capa de texto`, err instanceof Error ? err.message : err);
    }
}

/**
 * Prepara un libro (ronda 1: lo corta en tramos y los sube) o sube los
 * tramos de un reintento. La última tarea de la ronda crea el job. Da una
 * señal al empezar: el sondeo abandona la que calla (murió por memoria o
 * tiempo sin poder avisar).
 */
export async function procesarLibro(d: Dependencias, c: CargaDeLote, /** En `Date.now()`. */ plazo: number): Promise<void> {
    const lote = await leerLote(d, c.loteId);
    if (!lote || lote.estado === 'cancelado' || lote.estado === 'fallido') return;
    const libro = lote.libros.find(b => b.rid === c.rid);
    const porSubir = tramosDeRonda(lote, c.ronda).filter(t => t.rid === c.rid && t.estado === 'pendiente' && !t.archivo);
    const hayTrabajo = c.ronda === 1 ? libro?.estado === 'por-preparar' : porSubir.length > 0;
    if (hayTrabajo) {
        await actualizar(d, c.loteId, l => latir(l, c.rid, c.ronda, d.ahora()));
        const abierto = await abrirPdf(d, c.rid);
        // Reloj real, no `d.ahora`: pdfjs vence contra `Date.now()`.
        const venceCapa = () => Math.min(Date.now() + 300_000, plazo);
        if ('saltado' in abierto) {
            await actualizar(d, c.loteId, l => abandonarLibro(l, c.rid, c.ronda, abierto.saltado, d.ahora()));
        } else if (c.ronda === 1) {
            const total = abierto.pdf.getPageCount();
            const tramos = planearTramos(total, lote.porTramo);
            if (lote.tramos.length + tramos.length > MAX_TRAMOS_POR_LOTE) {
                // Atajo para no subir de balde; el tope de verdad se mira en `registrarLibro`.
                await actualizar(d, c.loteId, l => abandonarLibro(l, c.rid, 1, 'el lote ya no tiene lugar para este libro: va en otro', d.ahora()));
            } else {
                const subidos = await subirTramos(d, abierto.pdf, tramos);
                await guardarCapa(d, lote, c.rid, abierto.bytes, venceCapa());
                await actualizar(d, c.loteId, l => registrarLibro(l, c.rid, { totalPaginas: total, tramos: subidos, pdf: abierto.origen }, d.ahora()));
            }
        } else {
            const subidos = await subirTramos(d, abierto.pdf, porSubir);
            await actualizar(d, c.loteId, l => registrarSubida(l, c.ronda, subidos.map((s, i) => ({ indice: porSubir[i]!.indice, archivo: s.archivo })), d.ahora()));
            await guardarCapa(d, lote, c.rid, abierto.bytes, venceCapa());
        }
    }
    await crearJobSiToca(d, c.loteId, c.ronda);
}

/** El último intento de la tarea falló: el libro se salta (o sus tramos quedan en «fallo») y la ronda sigue sin él. */
export async function abandonarLibroEnTarea(d: Dependencias, c: CargaDeLote, motivo: string): Promise<void> {
    await actualizar(d, c.loteId, l => abandonarLibro(l, c.rid, c.ronda, motivo, d.ahora()));
    await crearJobSiToca(d, c.loteId, c.ronda);
}

/** Si la ronda tiene todo subido y nadie la reclamó, crea su job (o encuentra el que quedó huérfano). */
export async function crearJobSiToca(d: Dependencias, loteId: string, ronda: number): Promise<string | null> {
    const reclamo = await actualizar(d, loteId, l => (reclamarRonda(l, ronda, d.ahora()) ? { lote: l, pedidos: pedidosDeRonda(l, ronda) } : null));
    if (!reclamo) return null;
    const nombre = nombreDeJob(reclamo.lote, ronda);
    const enviados = reclamo.pedidos.map(t => t.indice);
    let job: string;
    try {
        job = await d.gemini.buscarJob(nombre)
            ?? await d.gemini.crearJob(nombre, reclamo.pedidos.map(t => ({ indice: t.indice, uri: t.archivo!.uri })));
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[lote] ${loteId}: no se pudo crear la ronda ${ronda}`, error);
        await actualizar(d, loteId, l => fallaAlCrearJob(l, ronda, error, d.ahora()));
        await borrarRecortes(d, loteId);
        return null;
    }
    const anotado = await actualizar(d, loteId, l => registrarJob(l, ronda, job, enviados, d.ahora()));
    if (!anotado) {
        // Otra ejecución anotó otro job para la misma ronda (un reclamo vencido),
        // o el lote se canceló mientras se creaba: el nuestro sobra y se
        // cancela, para no pagar una ronda que nadie va a leer.
        const fresco = await leerLote(d, loteId);
        const vigente = fresco?.rondas.find(r => r.numero === ronda)?.job;
        if (vigente !== job) await d.gemini.cancelarJob(job).catch(() => undefined);
    }
    return job;
}

// ── El sondeo ───────────────────────────────────────────────────────────────

export async function paginasDelLibro(d: Dependencias, lote: Lote, rid: string): Promise<GeminiPage[]> {
    const rutas = await d.almacen.listar(prefijoDePaginas(lote, rid));
    const todas: GeminiPage[] = [];
    // En orden de ronda: si dos rondas traen la misma página, gana la última (`unirPaginas`).
    const ronda = (r: string) => Number(r.match(/\.r(\d+)\.json$/)?.[1] ?? 0);
    for (const ruta of rutas.sort((a, b) => ronda(a) - ronda(b))) {
        const texto = await d.almacen.leer(ruta);
        if (texto) todas.push(...(JSON.parse(texto) as GeminiPage[]));
    }
    return todas;
}

/**
 * Recoge lo que terminó: guarda las páginas (un archivo por libro y ronda),
 * registra el gasto con el descuento de lote, revisa los tramos contra todas
 * las páginas y borra los recortes subidos. También rescata lo que quedó a
 * medias: tareas que murieron sin avisar, jobs sin anotar, gasto sin anotar
 * y rondas sin revisar (cada paso deja su marca en el lote, así que un sondeo
 * que muere a mitad lo retoma el siguiente).
 */
export async function sondearLote(d: Dependencias, loteId: string, por: string): Promise<'ocupado' | 'hecho'> {
    const tomado = await actualizar(d, loteId, l => tomarCandado(l, por, d.ahora()));
    if (!tomado) return 'ocupado';
    try {
        const vigilancia = vigilarTareas((await leerLote(d, loteId))!, d.ahora());
        for (const a of vigilancia.abandonar) await abandonarLibroEnTarea(d, { loteId, rid: a.rid, ronda: a.ronda }, a.motivo);
        for (const r of vigilancia.reencolar) await d.encolar({ loteId, rid: r.rid, ronda: r.ronda }).catch(err => console.warn(`[lote] ${loteId}: no se pudo reencolar ${r.rid}`, err));

        for (const r of (await leerLote(d, loteId))!.rondas.filter(x => !x.job && !x.leida)) await crearJobSiToca(d, loteId, r.numero);

        let lote = (await leerLote(d, loteId))!;
        for (const r of lote.rondas.filter(x => x.job && !x.leida)) {
            const visto = await d.gemini.verJob(r.job!);
            if (visto.estado !== JOB_BIEN && !JOB_MAL.has(visto.estado)) continue;
            const lectura = leerRonda(lote, r.numero, visto.estado, visto.respuestas);
            for (const [rid, paginas] of lectura.paginas) {
                await d.almacen.guardar(rutaDePaginas(lote, rid, r.numero), JSON.stringify(paginas));
            }
            await actualizar(d, loteId, l => aplicarLectura(l, r.numero, lectura, d.usdDeLote(lectura.entrada, lectura.salida), d.ahora()));
        }

        lote = (await leerLote(d, loteId))!;
        for (const r of rondasSinGasto(lote)) {
            // Se marca ANTES de anotar: si otra ejecución la marcó, ésta no la
            // anota otra vez. Morir justo entre las dos pierde una anotación;
            // anotar dos veces inflaría el panel de costos.
            if (await actualizar(d, loteId, l => marcarGastoRegistrado(l, r.numero))) {
                await d.registrarGasto({ entrada: r.uso.entrada, salida: r.uso.salida });
            }
        }
        for (const r of rondasSinRevisar(lote)) {
            for (const rid of librosDeRonda(lote, r.numero)) {
                const paginas = await paginasDelLibro(d, lote, rid);
                await actualizar(d, loteId, l => revisarTramosOk(l, rid, paginas));
            }
            await actualizar(d, loteId, l => marcarRevisada(l, r.numero));
        }
        await borrarRecortes(d, loteId);
        return 'hecho';
    } finally {
        await actualizar(d, loteId, l => soltarCandado(l, por));
    }
}

async function borrarRecortes(d: Dependencias, loteId: string): Promise<void> {
    const lote = await leerLote(d, loteId);
    if (!lote) return;
    const porBorrar = archivosParaBorrar(lote);
    if (porBorrar.length === 0) return;
    for (const r of porBorrar) await Promise.all(r.nombres.map(n => d.gemini.borrarArchivo(n)));
    await actualizar(d, loteId, l => marcarArchivosBorrados(l, porBorrar.map(r => r.ronda)));
}

// ── Los botones ─────────────────────────────────────────────────────────────

/** Caracteres (sin espacios) de la capa por página, como mide producción. */
async function capaDelLibro(d: Dependencias, lote: Lote, rid: string): Promise<number[] | null> {
    const texto = await d.almacen.leer(rutaDeCapa(lote, rid));
    return texto ? (JSON.parse(texto) as string[]).map(t => t.replace(/\s/g, '').length) : null;
}

export async function reintentarLote(d: Dependencias, loteId: string, por: string): Promise<{ ronda: number | null; libros: number; abandonadas: number }> {
    const lote = await leerLote(d, loteId);
    if (!lote) throw new ErrorDelLote('not-found', 'El lote no existe');
    const rids = [...new Set(lote.tramos.filter(t => t.estado === 'incompleto').map(t => t.rid))];
    const capas = new Map<string, number[] | null>();
    for (const rid of rids) capas.set(rid, await capaDelLibro(d, lote, rid));
    const plan = await actualizar(d, loteId, l => {
        if (!tomarCandado(l, por, d.ahora())) throw new ErrorDelLote('failed-precondition', 'El lote se está revisando ahora: prueba en un minuto.');
        try {
            return planearReintento(l, capas, d.ahora());
        } catch (err) {
            throw new ErrorDelLote('failed-precondition', err instanceof Error ? err.message : String(err));
        } finally {
            soltarCandado(l, por);
        }
    });
    // Un encolado que falla no se pierde: el sondeo vuelve a encolar lo que no dio señales.
    if (plan.ronda !== null) {
        for (const rid of plan.libros) await d.encolar({ loteId, rid, ronda: plan.ronda }).catch(err => console.warn(`[lote] ${loteId}: no se pudo encolar ${rid}`, err));
    }
    return { ronda: plan.ronda, libros: plan.libros.length, abandonadas: plan.abandonadas };
}

export async function cancelarLote(d: Dependencias, loteId: string): Promise<void> {
    const { jobs } = await actualizar(d, loteId, l => cancelar(l, d.ahora()));
    for (const job of jobs) await d.gemini.cancelarJob(job).catch(err => console.warn(`[lote] no se pudo cancelar ${job}`, err));
    await borrarRecortes(d, loteId);
}
