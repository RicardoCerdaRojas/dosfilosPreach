/**
 * Heuristic time estimate for the library extraction pipeline.
 *
 * The user-facing UI (ExtractionStepper) shows
 *   "Procesando hace 4m 23s · ~12 min estimado"
 * so they can decide "is this stuck or just slow?" at a glance.
 *
 * Para la ruta de una sola pasada ningún motor expone progreso real, así que
 * aquí sólo cabe un coeficiente por tamaño. La extracción EN COLA sí lo expone
 * —cada rango escribe `extractionProgress`— y para ella existe
 * `estimateRemainingFromProgressMs`, que mide en vez de adivinar. Este
 * coeficiente queda como último recurso.
 *
 * Calibration sources (real runs from the v1.6 launch period):
 *   - Premium / LlamaParse fast (Carson/Moo NT Intro): 50.30 MB,
 *     790 págs → 11m 28s ≈ 13.7 s/MB, 0.87 s/page
 *   - Premium / LlamaParse fast (NTG28): 10.54 MB, 1020 págs → 3m 3s
 *     ≈ 17.4 s/MB, 0.18 s/page  (cached vs cold accounts for the spread)
 *   - Standard / Gemini (small Hebreo lesson): 0.13 MB, 4 págs → 13s
 *     ≈ 100 s/MB but dominated by a fixed ~5s overhead
 *   - pdf-parse fallback (WBC zombie run): 19 MB, 378 págs → ~5m 46s
 *     ≈ 18.2 s/MB
 *
 * Coefficients err on the SLOW side: better to over-estimate ETA so
 * the user is pleasantly surprised, than to promise something we
 * can't deliver and look stuck. Numbers are intentionally rough —
 * we round display to the nearest minute anyway.
 *
 * Returns total estimated wall-clock duration in MILLISECONDS,
 * including a baseline indexing-overhead allowance. Callers diff
 * against `processingStartedAt` to compute "remaining" if they want
 * (UI currently just shows the total estimate, not remaining).
 */
export function estimateExtractionDurationMs(input: {
    sizeBytes: number;
    mode?: 'standard' | 'premium' | undefined;
}): number {
    const sizeMB = Math.max(0, input.sizeBytes) / (1024 * 1024);

    // Per-MB extraction coefficient by mode. The user picked the mode
    // upfront so we know which engine is the planned primary; we don't
    // try to predict cascade fallbacks.
    //
    // Default to premium when mode is undefined (legacy uploads or
    // missing field) — over-estimates harmlessly since premium is the
    // slower path.
    const SECONDS_PER_MB: Record<'standard' | 'premium', number> = {
        standard: 12,  // Gemini average, including pdf-parse fallback bias
        premium: 16,   // LlamaParse fast — generous so cached vs cold doesn't surprise
    };
    const sPerMB = SECONDS_PER_MB[input.mode ?? 'premium'];

    // Fixed overhead per extraction: storage download + cascade
    // setup + final write. ~30s observed across runs.
    const SETUP_OVERHEAD_S = 30;

    // Indexing overhead: chunking + embedding + Firestore writes.
    // Scales loosely with content; for the rough display we use a
    // flat 60s baseline (covers ~500 chunks). Big lexicons skew higher
    // but the elapsed text already gives the user the truth in real time.
    const INDEXING_OVERHEAD_S = 60;

    const totalSeconds = SETUP_OVERHEAD_S + INDEXING_OVERHEAD_S + sPerMB * sizeMB;
    return Math.round(totalSeconds * 1000);
}

/**
 * Render an estimate as "~Nm" (whole minutes) or "~30s" if under a minute.
 * Returns the i18n-key value, not a translated string — caller wraps
 * it in `t('stepper.estimated', { duration })`.
 */
export function formatEstimateShort(estimateMs: number): string {
    const totalSeconds = Math.round(estimateMs / 1000);
    if (totalSeconds < 60) return `~${totalSeconds}s`;
    const minutes = Math.round(totalSeconds / 60);
    if (minutes < 60) return `~${minutes} min`;
    const horas = Math.floor(minutes / 60);
    const resto = minutes % 60;
    return resto === 0 ? `~${horas} h` : `~${horas} h ${resto} min`;
}

/**
 * Cuánto falta, medido sobre el avance REAL de una extracción en cola.
 *
 * Existe porque la tarjeta mostraba «Procesando hace 165m 49s · ~11 min
 * estimado»: el estimado salía del tamaño del archivo, se calculaba una vez y
 * no se movía nunca, así que tres horas después seguía prometiendo once
 * minutos. Ante un usuario, un número que contradice al reloj de al lado es
 * peor que no poner número.
 *
 * Se proyecta con el ritmo observado desde el arranque (páginas hechas por
 * tiempo transcurrido). Incluye las esperas —una pausa por saldo agotado lo
 * vuelve pesimista—, y se acepta: sobreestimar un poco se corrige solo a
 * medida que avanza, y subestimar hace parecer trancado lo que no lo está.
 *
 * Devuelve `null` cuando no hay base honesta para proyectar: sin arranque, sin
 * páginas hechas todavía, o ya completo.
 */
export function estimateRemainingFromProgressMs(input: {
    startedAt: Date | undefined;
    now: Date;
    paginasHechas: number;
    totalPaginas: number;
}): number | null {
    const { startedAt, now, paginasHechas, totalPaginas } = input;
    if (!startedAt) return null;
    if (!Number.isFinite(paginasHechas) || !Number.isFinite(totalPaginas)) return null;
    if (totalPaginas <= 0 || paginasHechas <= 0 || paginasHechas >= totalPaginas) return null;
    const transcurridoMs = now.getTime() - startedAt.getTime();
    if (transcurridoMs <= 0) return null;
    const msPorPagina = transcurridoMs / paginasHechas;
    return Math.round(msPorPagina * (totalPaginas - paginasHechas));
}

/**
 * «Procesando hace …» legible también para trabajos largos: «2 h 45 min» en
 * vez de «165m 49s». Bajo la hora conserva los segundos, que ahí sí informan
 * de que algo se mueve.
 */
export function formatElapsedShort(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    const horas = Math.floor(minutes / 60);
    const resto = minutes % 60;
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
