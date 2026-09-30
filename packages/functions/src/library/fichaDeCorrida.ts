import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { contarDireccionHebrea } from './scriptCensus';
import { fidelidadDeEscritura, type FidelidadDeEscritura } from './fidelidadDeEscritura';
import type { SanitizationReport } from './sanitizeExtractedText';

/**
 * La ficha de una corrida de extracción: qué pasó con UN libro, en números.
 *
 * `scripts/extraction-bakeoff/` mide fidelidad, costo y cobertura por motor,
 * fuera de línea y sobre una muestra. La extracción de producción corre sobre
 * libros reales todos los días y no dejaba ninguna de esas medidas: el costo se
 * sumaba al día sin decir de qué libro, la duración y los reintentos vivían en
 * memoria, y un griego sin acentos pasaba el censo con nota perfecta.
 *
 * Contesta cuatro preguntas (docs/FASE_CIERRE_DE_BRECHAS_2026-09.md, ítem 7):
 * qué motor resuelve los libros reales y a qué costo; cuándo sale roto el texto
 * sin que nadie se entere; dónde se cae; y si el informe previo a subir predice
 * el resultado.
 *
 * DOS REGLAS QUE NO SE NEGOCIAN:
 *
 * - **Sólo números.** Nunca una página ni un fragmento: los libros son material
 *   con derechos. Lo único que se guarda con letras es el motivo de un fallo,
 *   que es un mensaje nuestro o del proveedor, y va recortado.
 * - **Nunca tumba una extracción.** Cada escritura se traga su error y lo
 *   registra. Perder una ficha es aceptable; romperle el libro a alguien por un
 *   registro de telemetría, no.
 */

export const COLECCION_DE_FICHAS = 'extraction_runs';

export function rutaDeFicha(runId: string): string {
    return `${COLECCION_DE_FICHAS}/${runId}`;
}

/** Por dónde entró la corrida. */
export type CaminoDeCorrida = 'upload' | 'reprocess-premium' | 'reprocess-vision';

/**
 * Cómo terminó. `superseded` es la corrida que quedó abierta cuando arrancó
 * otra del mismo libro: su resultado ya no le importa a nadie, pero sin cerrarla
 * quedaría «en curso» para siempre y ensuciaría la tasa de fallos.
 */
export type DesenlaceDeCorrida = 'ready' | 'failed' | 'stalled' | 'cancelled' | 'superseded';

export type Motor = 'llamaparse' | 'gemini' | 'gemini-queue' | 'pdfjs';

export interface IntentoDeMotor {
    engine: Motor;
    outcome: 'ok' | 'error' | 'skipped' | 'queued';
    ms: number;
    /** Por qué falló o se saltó. Recortado. */
    reason?: string;
    /** Cuenta de LlamaParse que se probó, si aplica. */
    account?: string;
}

/**
 * El veredicto del informe previo que la web guardó en el recurso al subir.
 * Se copia a la ficha para poder cruzarlo con el resultado.
 */
export interface PreflightGuardado {
    verdict: string;
    pages?: number;
    fontCount?: number;
    greekLetters?: number;
    hebrewLetters?: number;
    diacriticRatio?: number | null;
    garbledTokenRatio?: number;
}

export interface AperturaDeFicha {
    runId: string;
    resourceId: string;
    userId: string;
    path: CaminoDeCorrida;
    fileBytes?: number;
    requestedMode?: 'standard' | 'premium';
    preflight?: PreflightGuardado;
}

export interface ResumenDeTexto extends FidelidadDeEscritura {
    totalChars: number;
    hebrewWords: number;
    hebrewFinalAtStart: number;
}

export interface CierreDeFicha {
    outcome: DesenlaceDeCorrida;
    extractionVersion?: string;
    pagesExpected?: number;
    pagesEmitted?: number;
    pagesMissing?: number;
    /** Texto COMPLETO, antes de truncar. Se resume acá y no se guarda. */
    text?: string;
    sanitizer?: SanitizationReport;
    llamaParseCredits?: number;
    engines?: IntentoDeMotor[];
    reason?: string;
}

/** Largo máximo de un motivo. Alcanza para un mensaje de error y no para un párrafo de libro. */
export const MOTIVO_MAX = 300;

export function recortarMotivo(motivo: unknown): string {
    const texto = motivo instanceof Error ? motivo.message : String(motivo ?? '');
    return texto.length > MOTIVO_MAX ? `${texto.slice(0, MOTIVO_MAX - 1)}…` : texto;
}

/** Fidelidad y dirección del hebreo, sobre el texto completo. Pura. */
export function resumenDeTexto(text: string): ResumenDeTexto {
    return {
        totalChars: text.length,
        ...fidelidadDeEscritura(text),
        ...contarDireccionHebrea(text),
    };
}

/**
 * El patch del cierre. PURO y exportado: la regla «sólo números» se prueba
 * mirando la FORMA de lo que se escribe, que es donde se colaría un texto.
 */
export function armarCierre(cierre: CierreDeFicha, startedAt: Date | null, ahora: Date): Record<string, unknown> {
    const patch: Record<string, unknown> = {
        outcome: cierre.outcome,
        finishedAt: ahora,
        durationMs: startedAt ? Math.max(0, ahora.getTime() - startedAt.getTime()) : null,
    };
    if (cierre.extractionVersion) patch.extractionVersion = cierre.extractionVersion;
    const pages: Record<string, number> = {};
    if (typeof cierre.pagesExpected === 'number') pages.expected = cierre.pagesExpected;
    if (typeof cierre.pagesEmitted === 'number') pages.emitted = cierre.pagesEmitted;
    if (typeof cierre.pagesMissing === 'number') pages.missing = cierre.pagesMissing;
    if (Object.keys(pages).length > 0) patch.pages = pages;
    if (typeof cierre.text === 'string') patch.fidelity = resumenDeTexto(cierre.text);
    if (cierre.sanitizer) {
        patch.sanitizer = {
            removed: cierre.sanitizer.removed,
            byCategory: cierre.sanitizer.byCategory,
            greekBreathingsComposed: cierre.sanitizer.greekBreathingsComposed,
        };
    }
    if (typeof cierre.llamaParseCredits === 'number') patch.llamaParseCredits = cierre.llamaParseCredits;
    if (cierre.engines && cierre.engines.length > 0) patch.engines = cierre.engines;
    // El motivo se escribe SIEMPRE, vacío incluido. El guardia de plazo cierra
    // la ficha como fallida por tiempo y, si la extracción termina bien después,
    // este cierre la pisa: sin limpiar el motivo quedaba `ready` con «timeout»,
    // el mismo defecto que #595 corrigió en el recurso.
    patch.reason = cierre.reason ? recortarMotivo(cierre.reason) : null;
    return patch;
}

/** Sólo los campos del informe previo que son números o el veredicto. */
export function preflightDe(raw: unknown): PreflightGuardado | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Record<string, unknown>;
    if (typeof r.verdict !== 'string') return undefined;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const limpio: PreflightGuardado = { verdict: r.verdict };
    const campos = ['pages', 'fontCount', 'greekLetters', 'hebrewLetters', 'garbledTokenRatio'] as const;
    for (const campo of campos) {
        const v = num(r[campo]);
        if (v !== undefined) limpio[campo] = v;
    }
    if (r.diacriticRatio === null) limpio.diacriticRatio = null;
    else if (num(r.diacriticRatio) !== undefined) limpio.diacriticRatio = r.diacriticRatio as number;
    return limpio;
}

/**
 * Abre la ficha. Antes cierra como `superseded` cualquier otra del mismo libro
 * que siga abierta: una corrida nueva la dejó sin sentido.
 */
export async function abrirFicha(db: Firestore, apertura: AperturaDeFicha): Promise<void> {
    try {
        await cerrarFichasAbiertas(db, apertura.resourceId, 'superseded', undefined, apertura.runId);
        const doc: Record<string, unknown> = {
            runId: apertura.runId,
            resourceId: apertura.resourceId,
            userId: apertura.userId,
            path: apertura.path,
            outcome: 'running',
            startedAt: new Date(),
        };
        if (typeof apertura.fileBytes === 'number') doc.fileBytes = apertura.fileBytes;
        if (apertura.requestedMode) doc.requestedMode = apertura.requestedMode;
        if (apertura.preflight) doc.preflight = apertura.preflight;
        await db.doc(rutaDeFicha(apertura.runId)).set(doc, { merge: true });
    } catch (err) {
        console.warn(`[Ficha] no se pudo abrir la ficha ${apertura.runId} (no bloqueante)`, err);
    }
}

/** Deja constancia de que la corrida siguió por la cola. */
export async function anotarEncolado(
    db: Firestore,
    runId: string,
    engines: IntentoDeMotor[],
    pagesExpected: number,
): Promise<void> {
    try {
        await db.doc(rutaDeFicha(runId)).set(
            { queued: true, engines, pages: { expected: pagesExpected } },
            { merge: true },
        );
    } catch (err) {
        console.warn(`[Ficha] no se pudo anotar el encolado de ${runId} (no bloqueante)`, err);
    }
}

/** Un rango de la cola terminó; si fue un reintento de Cloud Tasks, también se cuenta. */
export async function anotarRango(db: Firestore, runId: string, fueReintento: boolean): Promise<void> {
    try {
        await db.doc(rutaDeFicha(runId)).set(
            {
                queue: {
                    ranges: FieldValue.increment(1),
                    retries: FieldValue.increment(fueReintento ? 1 : 0),
                },
            },
            { merge: true },
        );
    } catch (err) {
        console.warn(`[Ficha] no se pudo anotar el rango de ${runId} (no bloqueante)`, err);
    }
}

export async function cerrarFicha(db: Firestore, runId: string, cierre: CierreDeFicha): Promise<void> {
    try {
        const ref = db.doc(rutaDeFicha(runId));
        const snap = await ref.get();
        const startedAt = aFecha(snap.data()?.startedAt);
        await ref.set(armarCierre(cierre, startedAt, new Date()), { merge: true });
    } catch (err) {
        console.warn(`[Ficha] no se pudo cerrar la ficha ${runId} (no bloqueante)`, err);
    }
}

/**
 * Cierra las fichas que sigan abiertas para un libro. La usan quienes terminan
 * una corrida sin saber cuál era: el barrido de interrumpidas y la cancelación.
 *
 * Dos igualdades y nada más: Firestore las resuelve con los índices simples, sin
 * pedir uno compuesto.
 */
export async function cerrarFichasAbiertas(
    db: Firestore,
    resourceId: string,
    outcome: DesenlaceDeCorrida,
    reason?: string,
    excepto?: string,
): Promise<void> {
    try {
        const snap = await db
            .collection(COLECCION_DE_FICHAS)
            .where('resourceId', '==', resourceId)
            .where('outcome', '==', 'running')
            .get();
        const ahora = new Date();
        await Promise.all(
            snap.docs
                .filter((d) => d.id !== excepto)
                .map((d) => d.ref.set(armarCierre({ outcome, reason }, aFecha(d.data().startedAt), ahora), { merge: true })),
        );
    } catch (err) {
        console.warn(`[Ficha] no se pudieron cerrar las fichas abiertas de ${resourceId} (no bloqueante)`, err);
    }
}

function aFecha(v: unknown): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    const conToDate = v as { toDate?: () => Date };
    return typeof conToDate.toDate === 'function' ? conToDate.toDate() : null;
}

/**
 * Cronómetro de un intento de motor. Devuelve el intento ya armado, para que el
 * llamador sólo tenga que decir cómo terminó.
 */
export function cronometrar(engine: Motor, account?: string) {
    const inicio = Date.now();
    const armar = (outcome: IntentoDeMotor['outcome'], reason?: unknown): IntentoDeMotor => ({
        engine,
        outcome,
        ms: Date.now() - inicio,
        ...(reason !== undefined ? { reason: recortarMotivo(reason) } : {}),
        ...(account ? { account } : {}),
    });
    return armar;
}
