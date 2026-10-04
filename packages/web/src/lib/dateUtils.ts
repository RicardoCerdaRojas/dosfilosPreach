/**
 * Parses a date string from a `<input type="date">` (always in
 * `YYYY-MM-DD` format) into a Date at LOCAL midnight, never UTC
 * midnight. Critical for any negative-offset timezone (Chile UTC-3/-4,
 * all of the Americas) where `new Date('2026-05-03')` parses as UTC
 * midnight and becomes the previous calendar day in local time.
 *
 * Use this helper for ANY date-input → Date conversion; the bug is
 * silent and easy to reintroduce.
 */
export function parseLocalDate(yyyymmdd: string | null | undefined): Date | undefined {
    if (!yyyymmdd) return undefined;
    const parts = yyyymmdd.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return undefined;
    const [year, month, day] = parts as [number, number, number];
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Returns whole-day difference between two Dates (b - a), regardless of
 * the time component. Negative if `a` is later than `b`.
 *
 * Used by the SeriesForm "shift planned sermons when start date
 * changes" logic to compute how many days to shift each scheduled
 * date by when the pastor edits the series start date.
 */
export function daysBetween(a: Date, b: Date): number {
    const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((bMid - aMid) / (24 * 60 * 60 * 1000));
}

/**
 * Returns a new Date shifted by `days` days from `date`, NORMALIZED
 * to local midnight (drops the time component).
 *
 * Why drop the time: legacy series-startDates persisted with the
 * earlier UTC-midnight bug carry a time component when read back
 * locally (e.g. "May 3 00:00 UTC" displays as "May 2 21:00 Chile").
 * If we preserved that 21:00 time across an `addDays(date, 1)`
 * shift, we'd get "May 3 21:00 Chile = May 4 01:00 UTC" which
 * `toDateString()` then displays as Monday — not the Sunday the
 * pastor expects. Building a fresh local-midnight Date sidesteps
 * the timezone-offset compounding entirely; the result is the
 * intended calendar day in any browser zone.
 */
export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

/**
 * Una fecha GUARDADA, llevada a la medianoche local de SU día.
 *
 * Las fechas viejas se guardaron a medianoche UTC (`new Date('2026-10-04')`):
 * en Chile eso es el sábado 3 a las 21:00, y pasarlas por `addDays(_, 0)`
 * las «curaba» a la medianoche del sábado. Cada guardado del formulario de
 * series corría el domingo al sábado, y la app del púlpito leía esa semana
 * como ya pasada. Una fecha a medianoche UTC exacta es una fecha SIN hora:
 * se toma su día UTC. Cualquier otra conserva su día local.
 */
export function fromStoredDate(date: Date): Date {
    const dateOnly = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    return dateOnly
        ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
        : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

