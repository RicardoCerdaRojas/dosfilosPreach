/**
 * Qué sermón ofrece el inicio como «este domingo» (fase «Atril: tinta y lectura»).
 *
 * EN ESTE ORDEN:
 * 1. El que el pastor ELIGIÓ a mano («Cambiar»). Manda sobre todo, porque la
 *    app no siempre puede saberlo: un plan sin fechas, o semanas predicadas
 *    sin registrarlas. Vale para el domingo para el que se eligió: vence esa
 *    noche, o antes si se registra que se predicó.
 * 2. Si hay plan con algo por delante, ESO: escrito, el sermón; sin
 *    escribir, se dice que falta escribirlo. Antes caía al «más viejo sin
 *    predicar» y ofrecía la semana 2 de una serie que iba por la 5.
 * 3. Sin plan: el más viejo sin predicar, sin contar lo que el plan dejó
 *    atrás; si ya se predicaron todos, el más reciente.
 */
export interface NextCandidate {
    id: string;
    timesPreached: number;
    publishedAt?: Date | null;
    versionOf?: string;
    sourceSermonId?: string;
}

export interface PinnedNext {
    sermonId: string;
    /** Cuántas veces estaba predicado al elegirlo: si sube, ya se predicó. */
    preachedAtPin: number;
    pinnedAt: number;
    /** Hasta cuándo vale: el final del domingo para el que se eligió. */
    until?: number;
}

/**
 * El final del domingo para el que se elige. Un domingo, ese mismo día; otro
 * día, el domingo que viene. Así una elección del jueves no sobrevive al
 * domingo siguiente (revisión adversarial: con 10 días, sí).
 */
export function pinExpiry(now: Date): number {
    const daysToSunday = (7 - now.getDay()) % 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday, 23, 59, 59, 999).getTime();
}

/** Dos documentos del mismo sermón: el mismo, una versión, o la copia publicada de un borrador. */
export function sameSermon(a: NextCandidate, b: NextCandidate): boolean {
    const root = (s: NextCandidate) => s.versionOf ?? s.sourceSermonId ?? s.id;
    return a.id === b.id || root(a) === root(b) || root(a) === b.id || root(b) === a.id;
}

export function pinnedStillValid<T extends NextCandidate>(pin: PinnedNext | null, sermons: readonly T[], now: number): T | null {
    if (!pin) return null;
    const until = pin.until ?? pinExpiry(new Date(pin.pinnedAt));
    if (now > until) return null;
    const sermon = sermons.find((s) => s.id === pin.sermonId);
    if (!sermon || sermon.timesPreached > pin.preachedAtPin) return null;
    return sermon;
}

export type NextChoice<T> =
    | { kind: 'sermon'; sermon: T; pinned: boolean }
    /** El plan dice qué toca, pero todavía no está escrito. */
    | { kind: 'unwritten' }
    | null;

export function pickNextSermon<T extends NextCandidate>(
    sermons: readonly T[],
    /** Lo que toca en el plan, si hay plan con algo por delante. */
    plan: { sermon?: T } | null,
    pin: PinnedNext | null,
    now: number,
    /** Sermones de semanas del plan que ya pasaron: no son «lo que viene». */
    planPast: readonly T[] = [],
): NextChoice<T> {
    const pinned = pinnedStillValid(pin, sermons, now);
    if (pinned) return { kind: 'sermon', sermon: pinned, pinned: true };
    if (plan) return plan.sermon ? { kind: 'sermon', sermon: plan.sermon, pinned: false } : { kind: 'unwritten' };
    const candidates = sermons.filter((s) => !planPast.some((p) => sameSermon(p, s)));
    const byAge = [...candidates].sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));
    const sermon = byAge.find((s) => s.timesPreached === 0) ?? byAge[byAge.length - 1];
    return sermon ? { kind: 'sermon', sermon, pinned: false } : null;
}
