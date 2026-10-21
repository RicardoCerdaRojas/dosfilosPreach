/**
 * Lo que pide un otorgamiento de créditos del super admin, ya validado.
 *
 * Pura: sin Firestore, para probarla sin montar `firebase-admin`.
 *
 * TP #8 (2026-10-21, #41): la cuota de exégesis del fundador se agotó en mitad
 * del trabajo y el panel sólo sabía dar PÁGINAS. Los US$ de exégesis los
 * acreditaba únicamente el webhook de Stripe al comprar un pack. Ahora el
 * panel también los da, al mismo balde `pack` que usa el webhook.
 */
export interface GrantUserCreditsInput {
    userId: string;
    standardPages: number;
    premiumPages: number;
    /** US$ al balde `pack` de exégesis, redondeados a centavos. */
    exegesisUsd: number;
    reason: string;
}

/** Tope por otorgamiento: evita que un error de tipeo («2000» por «20») regale el año. */
export const MAX_EXEGESIS_USD_POR_OTORGAMIENTO = 200;

export class GrantInputError extends Error {}

/**
 * Ausente vale 0. Presente y no numérico es un error: si no, `{standardPages:
 * '500', exegesisUsd: 5}` acreditaba sólo los US$ 5 y la auditoría registraba
 * 0 páginas sin avisar (revisión adversarial).
 */
function numero(v: unknown, campo: string): number {
    if (v === undefined || v === null) return 0;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new GrantInputError(`${campo} must be a number`);
    return v;
}

export function parseGrantUserCreditsInput(data: unknown): GrantUserCreditsInput {
    const d = (data ?? {}) as Record<string, unknown>;
    const userId = typeof d.userId === 'string' ? d.userId : '';
    const reason = typeof d.reason === 'string' ? d.reason.trim() : '';
    if (!userId || !reason) throw new GrantInputError('userId and reason are required');

    const standardPages = numero(d.standardPages, 'standardPages');
    const premiumPages = numero(d.premiumPages, 'premiumPages');
    const exegesisUsd = Math.round(numero(d.exegesisUsd, 'exegesisUsd') * 100) / 100;
    if (standardPages < 0 || premiumPages < 0 || exegesisUsd < 0) {
        throw new GrantInputError('Negative grants are not allowed');
    }
    if (!Number.isInteger(standardPages) || !Number.isInteger(premiumPages)) {
        throw new GrantInputError('Pages must be whole numbers');
    }
    if (exegesisUsd > MAX_EXEGESIS_USD_POR_OTORGAMIENTO) {
        throw new GrantInputError(`exegesisUsd above ${MAX_EXEGESIS_USD_POR_OTORGAMIENTO} per grant`);
    }
    if (standardPages === 0 && premiumPages === 0 && exegesisUsd === 0) {
        throw new GrantInputError('At least one of standardPages, premiumPages or exegesisUsd must be > 0');
    }
    return { userId, standardPages, premiumPages, exegesisUsd, reason };
}
