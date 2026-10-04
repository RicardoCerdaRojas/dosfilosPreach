/**
 * Qué sermón ofrece el inicio como «este domingo» (fase «Atril: tinta y lectura»).
 *
 * EN ESTE ORDEN:
 * 1. El que el pastor ELIGIÓ a mano («Cambiar»). Manda sobre todo, porque la
 *    app no siempre puede saberlo: un plan sin fechas, o semanas predicadas
 *    sin registrarlas. Deja de mandar cuando ese sermón se predica (se
 *    registra), o a los 10 días: para entonces ya es otro domingo.
 * 2. El que toca en el plan, por calendario.
 * 3. El más viejo sin predicar; si ya se predicaron todos, el más reciente.
 */
export interface NextCandidate {
    id: string;
    timesPreached: number;
    publishedAt?: Date | null;
}

export interface PinnedNext {
    sermonId: string;
    /** Cuántas veces estaba predicado al elegirlo: si sube, ya se predicó. */
    preachedAtPin: number;
    pinnedAt: number;
}

export const PIN_TTL_MS = 10 * 24 * 60 * 60 * 1000;

export function pinnedStillValid<T extends NextCandidate>(pin: PinnedNext | null, sermons: readonly T[], now: number): T | null {
    if (!pin || now - pin.pinnedAt > PIN_TTL_MS) return null;
    const sermon = sermons.find((s) => s.id === pin.sermonId);
    if (!sermon || sermon.timesPreached > pin.preachedAtPin) return null;
    return sermon;
}

export function pickNextSermon<T extends NextCandidate>(
    sermons: readonly T[],
    planned: T | undefined,
    pin: PinnedNext | null,
    now: number,
): T | undefined {
    const pinned = pinnedStillValid(pin, sermons, now);
    if (pinned) return pinned;
    if (planned) return planned;
    const byAge = [...sermons].sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));
    return byAge.find((s) => s.timesPreached === 0) ?? byAge[byAge.length - 1];
}
