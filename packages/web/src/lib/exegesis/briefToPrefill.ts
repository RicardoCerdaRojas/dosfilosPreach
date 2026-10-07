import type { UserAssignmentBrief } from '@dosfilos/domain';

/**
 * Qué encuadre se precarga al crear un trabajo: el del perfil elegido, y si
 * el perfil no trae ninguno, el encuadre por defecto.
 *
 * Si el perfil apunta a uno que todavía no llegó (la lista carga aparte), no
 * se pone el de defecto en su lugar: se espera, para no mostrar un encuadre
 * y cambiarlo un instante después.
 */
export function briefToPrefill(
    briefs: ReadonlyArray<UserAssignmentBrief>,
    profileBriefId: string | null,
    defaultBrief: UserAssignmentBrief | null,
): UserAssignmentBrief | null {
    if (profileBriefId) return briefs.find(b => b.id === profileBriefId) ?? null;
    return defaultBrief;
}
