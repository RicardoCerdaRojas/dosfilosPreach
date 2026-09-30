import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
    MIN_PAGE_COVERAGE,
    POR_VERSION,
    buildExtractionRunsReport,
    fidelityAlerts,
    finalEngine,
    wasDegraded,
    type ExtractionRun,
    type RunFidelity,
} from '../extractionRunsReport';

const SANO: RunFidelity = {
    totalChars: 500_000,
    greekLetters: 20_000,
    greekDiacriticRatio: 0.45,
    hebrewConsonants: 0,
    niqqudRatio: 0,
    cantillationRatio: 0,
    replacementChars: 0,
    orphanCombining: 0,
    hebrewWords: 0,
    hebrewFinalAtStart: 0,
};

function run(parcial: Partial<ExtractionRun>): ExtractionRun {
    return {
        runId: 'r',
        resourceId: 'res',
        userId: 'u',
        path: 'upload',
        outcome: 'ready',
        startedAt: '2026-09-29T10:00:00Z',
        finishedAt: '2026-09-29T10:05:00Z',
        ...parcial,
    };
}

describe('finalEngine', () => {
    it('manda la versión que produjo el texto', () => {
        expect(finalEngine(run({ extractionVersion: '6.0-gemini-cola' }))).toBe('gemini-queue');
    });

    it('sin versión, el último motor que se probó: ahí se cayó', () => {
        const r = run({
            outcome: 'failed',
            engines: [
                { engine: 'llamaparse', outcome: 'error', ms: 100 },
                { engine: 'gemini', outcome: 'error', ms: 900 },
            ],
        });
        expect(finalEngine(r)).toBe('gemini');
    });

    it('sin nada, desconocido', () => {
        expect(finalEngine(run({ outcome: 'stalled' }))).toBe('unknown');
    });
});

describe('fidelityAlerts', () => {
    it('un libro sano no alerta', () => {
        expect(fidelityAlerts(run({ fidelity: SANO, pages: { expected: 100, emitted: 100 } }))).toEqual([]);
    });

    it('griego con letras y sin marcas: la firma del motor que tiró los acentos', () => {
        expect(fidelityAlerts(run({ fidelity: { ...SANO, greekDiacriticRatio: 0.01 } }))).toContain('greek-without-marks');
    });

    it('un puñado de letras griegas sueltas no alcanza para juzgar', () => {
        expect(fidelityAlerts(run({ fidelity: { ...SANO, greekLetters: 40, greekDiacriticRatio: 0 } }))).toEqual([]);
    });

    it('hebreo invertido con la misma regla que la tarjeta', () => {
        const f = { ...SANO, hebrewWords: 1000, hebrewFinalAtStart: 118 };
        expect(fidelityAlerts(run({ fidelity: f }))).toContain('reversed-hebrew');
    });

    it('letras de dos escrituras en una palabra: árabe dentro del hebreo', () => {
        expect(fidelityAlerts(run({ fidelity: { ...SANO, mixedScriptWords: 171 } }))).toContain('mixed-scripts');
        expect(fidelityAlerts(run({ fidelity: { ...SANO, mixedScriptWords: 0 } }))).toEqual([]);
    });

    it('páginas que faltan, dichas o deducidas', () => {
        expect(fidelityAlerts(run({ pages: { expected: 300, emitted: 300, missing: 4 } }))).toContain('missing-pages');
        expect(fidelityAlerts(run({ pages: { expected: 300, emitted: 40 } }))).toContain('missing-pages');
        expect(fidelityAlerts(run({ pages: { expected: 300, emitted: 290 } }))).toEqual([]);
    });
});

describe('wasDegraded', () => {
    it('cuenta la caída de motor, no el éxito al primer intento', () => {
        expect(wasDegraded(run({ engines: [{ engine: 'llamaparse', outcome: 'ok', ms: 1 }] }))).toBe(false);
        expect(wasDegraded(run({
            engines: [
                { engine: 'llamaparse', outcome: 'skipped', ms: 0 },
                { engine: 'gemini', outcome: 'ok', ms: 1 },
            ],
        }))).toBe(true);
    });
});

describe('buildExtractionRunsReport', () => {
    const runs: ExtractionRun[] = [
        run({ runId: '1', extractionVersion: '4.0-gemini-standard', pages: { emitted: 100 }, llm: { calls: 4, usd: 0.5 }, durationMs: 100_000, fidelity: SANO, preflight: { verdict: 'apto' } }),
        run({ runId: '2', extractionVersion: '4.0-gemini-standard', pages: { emitted: 300 }, llm: { calls: 9, usd: 1.5 }, durationMs: 300_000, fidelity: { ...SANO, greekDiacriticRatio: 0 }, preflight: { verdict: 'escritura-sin-diacriticos' } }),
        run({ runId: '3', outcome: 'failed', engines: [{ engine: 'gemini', outcome: 'error', ms: 5 }], llm: { calls: 1, usd: 0.1 } }),
        run({ runId: '4', outcome: 'running', extractionVersion: undefined, queued: true, engines: [{ engine: 'gemini-queue', outcome: 'queued', ms: 0 }] }),
        run({ runId: '5', outcome: 'superseded' }),
    ];
    const report = buildExtractionRunsReport(runs);

    it('la tasa de fallo es sobre terminadas: las en curso y reemplazadas no inflan ni diluyen', () => {
        const gemini = report.engines.find((e) => e.engine === 'gemini')!;
        expect(gemini.runs).toBe(3);
        expect(gemini.ready).toBe(2);
        expect(gemini.failed).toBe(1);
        expect(gemini.failRate).toBeCloseTo(1 / 3);
    });

    it('el costo por página incluye lo que gastaron los intentos fallidos', () => {
        const gemini = report.engines.find((e) => e.engine === 'gemini')!;
        expect(gemini.usd).toBeCloseTo(2.1);
        expect(gemini.usdPerPage).toBeCloseTo(2.1 / 400);
        expect(gemini.medianDurationMs).toBe(200_000);
    });

    it('cruza el informe previo con el resultado', () => {
        const sinMarcas = report.preflight.find((p) => p.verdict === 'escritura-sin-diacriticos')!;
        expect(sinMarcas).toEqual({ verdict: 'escritura-sin-diacriticos', runs: 1, ready: 1, withAlerts: 1 });
        // Las fichas sin informe (subidas previas, reprocesos) van aparte, no se pierden.
        expect(report.preflight.find((p) => p.verdict === 'none')!.runs).toBe(1);
    });

    it('totales', () => {
        expect(report).toMatchObject({ total: 5, finished: 3, ready: 2, failed: 1, running: 1, withAlerts: 1 });
    });
});

/**
 * El panel repite dos datos que functions gobierna, porque web no importa
 * functions. Se atan leyendo el fuente, mismo patrón que `sanitizeParity`: si
 * functions cambia uno y el panel no, esto falla en vez de mentir en silencio.
 */
describe('el panel y la extracción hablan de los mismos números', () => {
    const FUNCTIONS = join(__dirname, '../../../../functions/src/library');
    const leer = (archivo: string) => readFileSync(join(FUNCTIONS, archivo), 'utf8');

    it('el piso de cobertura es el mismo que decide si un libro sirve', () => {
        const m = /export const MIN_PAGE_COVERAGE = ([0-9.]+);/.exec(leer('coberturaDePaginas.ts'));
        expect(m, 'no se encontró MIN_PAGE_COVERAGE en coberturaDePaginas.ts').not.toBeNull();
        expect(MIN_PAGE_COVERAGE).toBe(Number(m![1]));
    });

    it('toda versión que la extracción escribe tiene su motor en el panel', () => {
        const escritas = new Set<string>();
        for (const archivo of readdirSync(FUNCTIONS).filter((f) => f.endsWith('.ts'))) {
            for (const m of leer(archivo).matchAll(/(?:extractionVersion\s*[=:]|EXTRACTION_VERSION\s*=)\s*'(\d[^']*)'/g)) {
                escritas.add(m[1]!);
            }
        }
        expect(escritas.size).toBeGreaterThanOrEqual(4);
        for (const version of escritas) {
            expect(POR_VERSION[version], `la versión ${version} no tiene motor en POR_VERSION`).toBeDefined();
        }
    });
});
