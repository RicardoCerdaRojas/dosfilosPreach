import * as admin from 'firebase-admin';

/**
 * Segmento de la cuenta, derivado SERVER-SIDE (no client-passed) para que sea
 * confiable. Permite leer deltas de telemetría solo sobre `real` (el input de
 * superadmin/embajador/equipo no representa la población).
 *
 * A esta escala usamos allowlists de uids en vez de un campo en el doc del
 * usuario (sobre-ingeniería); migrar a campo real cuando crezca a cientos.
 *
 * Precedencia: super_admin (role) → ambassador (allowlist) → team (allowlist) → real.
 *
 * SSOT de la segmentación de shadow/telemetría (grieta doxológica + perfil del
 * pasaje + futuros). No dupliques los uids: importa de aquí.
 */
export type AccountSegment = 'super_admin' | 'ambassador' | 'team' | 'real';

// 3 embajadores activos (personas distintas). El uid del fundador NO va aquí:
// su segment sale de role==='super_admin'.
const AMBASSADOR_UIDS: ReadonlySet<string> = new Set<string>([
    'VdXKk1KdKQcV1lxwYMJ8u2IsQ1V2',
    '8K4l0BTAp9MRbmOrYws5gvDedpD2',
    'dgPRVkueyShc3nJvs50f3UYv6oa2',
]);
const TEAM_UIDS: ReadonlySet<string> = new Set<string>([]);

/**
 * Flags que CAMBIAN LO QUE EL PASTOR VIVE durante el estudio, y que por eso
 * cambian lo que la sombra mide.
 *
 * Criterio para agregar uno aquí: ¿altera lo que el pastor ve, se le pide o se le
 * confronta mientras produce el dato? Si sí, va. Los flags que solo encienden
 * medición NO van: no mueven la conducta, y listarlos haría ruido.
 *
 * POR QUÉ EXISTE ESTO. Sin este registro, dos poblaciones distintas caen en la
 * misma colección sin forma de separarlas después: un pastor con nudges y
 * confrontación activos no escribe lo mismo que uno sin ellos. Se descubrió el
 * 2026-08-21, cuando las ÚNICAS filas `userConfirmed` de toda la base resultaron
 * venir de dos cuentas que corrían con `passage_profile_enforce` encendido — o
 * sea, el dato con el que se iba a decidir el flip a enforce estaba generado
 * bajo enforce. Retroactivamente no hay forma de separarlas; desde aquí sí.
 */
export const BEHAVIOR_FLAGS = [
    'passage_profile_enforce',
    'genre_override_enforce',
    'step3_genre_help',
] as const;

export type BehaviorFlagName = (typeof BEHAVIOR_FLAGS)[number];

export interface ShadowContext {
    segment: AccountSegment;
    /** Estado de los flags que mueven la conducta, al momento de producir la fila. */
    behaviorFlags: Record<BehaviorFlagName, boolean>;
}

/**
 * Segmento + flags de conducta en UNA sola lectura del doc del usuario.
 *
 * Server-side a propósito, igual que el segmento: si el cliente los mandara,
 * la fila diría lo que el cliente cree, no lo que el servidor aplica.
 */
export async function deriveShadowContext(uid: string): Promise<ShadowContext> {
    let segment: AccountSegment | null = null;
    const behaviorFlags = Object.fromEntries(
        BEHAVIOR_FLAGS.map((f) => [f, false]),
    ) as Record<BehaviorFlagName, boolean>;

    try {
        const snap = await admin.firestore().collection('users').doc(uid).get();
        const data = snap.exists ? snap.data() : undefined;
        if (data?.role === 'super_admin') segment = 'super_admin';
        const flags = (data?.featureFlags ?? {}) as Record<string, unknown>;
        for (const f of BEHAVIOR_FLAGS) behaviorFlags[f] = flags[f] === true;
    } catch {
        // Lectura fallida: se cae a la clasificación por allowlist y a flags en
        // false. Un `false` por error de lectura es indistinguible de un false
        // real, así que esto es una limitación conocida — pero preferible a no
        // registrar la fila.
    }

    if (!segment) {
        if (AMBASSADOR_UIDS.has(uid)) segment = 'ambassador';
        else if (TEAM_UIDS.has(uid)) segment = 'team';
        else segment = 'real';
    }
    return { segment, behaviorFlags };
}

export async function deriveSegment(uid: string): Promise<AccountSegment> {
    return (await deriveShadowContext(uid)).segment;
}
