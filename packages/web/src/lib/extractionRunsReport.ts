import { assessHebrewDirection, type PdfVerdict } from '@dosfilos/domain';

/**
 * Agregación del panel de extracción, sobre las fichas crudas que devuelve
 * `getExtractionRuns`. Pura: el callable no opina y el panel no calcula.
 *
 * Contesta las cuatro preguntas de la ficha (docs/FASE_CIERRE_DE_BRECHAS_2026-09.md,
 * ítem 7): qué motor resuelve los libros y a qué costo, cuándo sale roto el
 * texto, dónde se cae, y si el informe previo predijo el resultado.
 */

export type RunOutcome = 'running' | 'ready' | 'failed' | 'stalled' | 'cancelled' | 'superseded';
export type EngineKey = 'llamaparse' | 'gemini' | 'gemini-queue' | 'pdfjs' | 'unknown';

export interface RunFidelity {
    totalChars: number;
    greekLetters: number;
    greekDiacriticRatio: number;
    hebrewConsonants: number;
    niqqudRatio: number;
    cantillationRatio: number;
    replacementChars: number;
    orphanCombining: number;
    /** Ausente en fichas anteriores al 2026-09-30. */
    mixedScriptWords?: number;
    hebrewWords: number;
    hebrewFinalAtStart: number;
}

export interface EngineAttempt {
    engine: Exclude<EngineKey, 'unknown'>;
    outcome: 'ok' | 'error' | 'skipped' | 'queued';
    ms: number;
    reason?: string;
    account?: string;
}

export interface ExtractionRun {
    runId: string;
    resourceId: string;
    userId: string;
    path: 'upload' | 'reprocess-premium' | 'reprocess-vision';
    outcome: RunOutcome;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs?: number | null;
    fileBytes?: number;
    requestedMode?: 'standard' | 'premium';
    queued?: boolean;
    preflight?: { verdict: PdfVerdict };
    engines?: EngineAttempt[];
    extractionVersion?: string;
    pages?: { expected?: number; emitted?: number; missing?: number };
    llm?: { calls: number; usd: number };
    llamaParseCredits?: number;
    fidelity?: RunFidelity;
    queue?: { ranges: number; retries: number };
    reason?: string;
}

export type FidelityAlert =
    | 'reversed-hebrew'
    | 'greek-without-marks'
    | 'replacement-chars'
    | 'orphan-marks'
    | 'mixed-scripts'
    | 'missing-pages';

/**
 * Umbrales de las alertas nuevas. Salen del bakeoff, no de una intuición:
 * el griego politónico corrido mide entre 0,35 y 0,60 de marcas por letra, y
 * cerca de 0 es la firma del motor que reconoció la letra y tiró la marca.
 */
const MIN_GREEK_LETTERS = 200;
const MIN_GREEK_MARK_RATIO = 0.1;
/** Unos pocos U+FFFD pueden ser un glifo raro; decenas son una fuente ilegible. */
const MIN_REPLACEMENT_CHARS = 10;
const MIN_ORPHAN_MARKS = 50;
/**
 * Palabras con letras de dos escrituras. Medido en el bakeoff del 2026-09-30:
 * el motor que metía árabe en el hebreo dio 171 en diez páginas; los sanos, 0.
 */
const MIN_MIXED_SCRIPT_WORDS = 5;
/**
 * Mismo piso de cobertura que `coberturaDePaginas.ts` de functions. Una
 * prueba lee ese fuente y compara: si el piso cambia allá, el panel no puede
 * seguir alertando con el viejo.
 */
export const MIN_PAGE_COVERAGE = 0.95;

/** Qué motor escribe cada `extractionVersion`. Atado por prueba a las versiones que functions escribe. */
export const POR_VERSION: Record<string, Exclude<EngineKey, 'unknown'>> = {
    '3.0-llamaparse': 'llamaparse',
    '4.0-gemini-standard': 'gemini',
    '2.0-gemini': 'gemini',
    '6.0-gemini-cola': 'gemini-queue',
    '7.0-pdfjs-lineas': 'pdfjs',
};

/** El motor que decidió la corrida: el que produjo el texto, o el último que se probó. */
export function finalEngine(run: ExtractionRun): EngineKey {
    const porVersion = run.extractionVersion ? POR_VERSION[run.extractionVersion] : undefined;
    if (porVersion) return porVersion;
    const ultimo = run.engines?.[run.engines.length - 1];
    return ultimo?.engine ?? 'unknown';
}

export function fidelityAlerts(run: ExtractionRun): FidelityAlert[] {
    const alerts: FidelityAlert[] = [];
    const f = run.fidelity;
    if (f) {
        // La misma regla que la tarjeta del recurso: un umbral aparte para el
        // panel terminaría diciendo «sano» donde la tarjeta dice «invertido».
        const direccion = assessHebrewDirection({
            totalChars: f.totalChars,
            hebrew: f.hebrewConsonants,
            greek: f.greekLetters,
            latin: 0,
            hebrewWords: f.hebrewWords,
            hebrewFinalAtStart: f.hebrewFinalAtStart,
        });
        if (direccion) alerts.push('reversed-hebrew');
        if (f.greekLetters >= MIN_GREEK_LETTERS && f.greekDiacriticRatio < MIN_GREEK_MARK_RATIO) {
            alerts.push('greek-without-marks');
        }
        if (f.replacementChars >= MIN_REPLACEMENT_CHARS) alerts.push('replacement-chars');
        if (f.orphanCombining >= MIN_ORPHAN_MARKS) alerts.push('orphan-marks');
        if ((f.mixedScriptWords ?? 0) >= MIN_MIXED_SCRIPT_WORDS) alerts.push('mixed-scripts');
    }
    const p = run.pages;
    if (p && ((p.missing ?? 0) > 0 || (p.expected && p.emitted !== undefined && p.emitted < p.expected * MIN_PAGE_COVERAGE))) {
        alerts.push('missing-pages');
    }
    return alerts;
}

/** Cayó a un motor inferior después de que otro falló. */
export function wasDegraded(run: ExtractionRun): boolean {
    return (run.engines ?? []).some((e) => e.outcome === 'error' || e.outcome === 'skipped');
}

export interface EngineRow {
    engine: EngineKey;
    runs: number;
    ready: number;
    failed: number;
    /** Fallidas sobre terminadas. Las en curso y reemplazadas no cuentan. */
    failRate: number;
    degraded: number;
    withAlerts: number;
    pages: number;
    usd: number;
    usdPerPage: number | null;
    llamaParseCredits: number;
    medianDurationMs: number | null;
}

export interface PreflightRow {
    verdict: PdfVerdict | 'none';
    runs: number;
    ready: number;
    withAlerts: number;
}

export interface ExtractionRunsReport {
    total: number;
    finished: number;
    ready: number;
    failed: number;
    running: number;
    withAlerts: number;
    usd: number;
    engines: EngineRow[];
    preflight: PreflightRow[];
}

const FALLIDAS: ReadonlySet<RunOutcome> = new Set(['failed', 'stalled']);
const TERMINADAS: ReadonlySet<RunOutcome> = new Set(['ready', 'failed', 'stalled']);

function mediana(valores: number[]): number | null {
    if (valores.length === 0) return null;
    const o = [...valores].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
}

export function buildExtractionRunsReport(runs: ExtractionRun[]): ExtractionRunsReport {
    const porMotor = new Map<EngineKey, ExtractionRun[]>();
    const porVeredicto = new Map<PdfVerdict | 'none', ExtractionRun[]>();
    for (const run of runs) {
        const motor = finalEngine(run);
        porMotor.set(motor, [...(porMotor.get(motor) ?? []), run]);
        if (TERMINADAS.has(run.outcome)) {
            const v = run.preflight?.verdict ?? 'none';
            porVeredicto.set(v, [...(porVeredicto.get(v) ?? []), run]);
        }
    }

    const engines: EngineRow[] = [...porMotor.entries()].map(([engine, lista]) => {
        const listas = lista.filter((r) => r.outcome === 'ready');
        const failed = lista.filter((r) => FALLIDAS.has(r.outcome)).length;
        const terminadas = listas.length + failed;
        const pages = listas.reduce((s, r) => s + (r.pages?.emitted ?? 0), 0);
        const usd = lista.reduce((s, r) => s + (r.llm?.usd ?? 0), 0);
        return {
            engine,
            runs: lista.length,
            ready: listas.length,
            failed,
            failRate: terminadas > 0 ? failed / terminadas : 0,
            degraded: lista.filter(wasDegraded).length,
            withAlerts: listas.filter((r) => fidelityAlerts(r).length > 0).length,
            pages,
            usd,
            usdPerPage: pages > 0 && usd > 0 ? usd / pages : null,
            llamaParseCredits: lista.reduce((s, r) => s + (r.llamaParseCredits ?? 0), 0),
            medianDurationMs: mediana(
                listas.map((r) => r.durationMs).filter((d): d is number => typeof d === 'number'),
            ),
        };
    }).sort((a, b) => b.runs - a.runs);

    const preflight: PreflightRow[] = [...porVeredicto.entries()].map(([verdict, lista]) => ({
        verdict,
        runs: lista.length,
        ready: lista.filter((r) => r.outcome === 'ready').length,
        withAlerts: lista.filter((r) => r.outcome === 'ready' && fidelityAlerts(r).length > 0).length,
    })).sort((a, b) => b.runs - a.runs);

    const ready = runs.filter((r) => r.outcome === 'ready');
    return {
        total: runs.length,
        finished: runs.filter((r) => TERMINADAS.has(r.outcome)).length,
        ready: ready.length,
        failed: runs.filter((r) => FALLIDAS.has(r.outcome)).length,
        running: runs.filter((r) => r.outcome === 'running').length,
        withAlerts: ready.filter((r) => fidelityAlerts(r).length > 0).length,
        usd: runs.reduce((s, r) => s + (r.llm?.usd ?? 0), 0),
        engines,
        preflight,
    };
}
