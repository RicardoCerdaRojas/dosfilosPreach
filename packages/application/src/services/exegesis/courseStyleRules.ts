import type { ExegeticalPaper, IUserStyleGuideRepository } from '@dosfilos/domain';

/**
 * Las reglas propias de la guía de estilo del trabajo (`additionalRules`):
 * de la copia que el trabajo se llevó o, en los anteriores a la copia, de la
 * guía viva (TP #8, 8b, E2). La leen el analizador y el revisor de prosa.
 *
 * Un fallo de lectura devuelve lista vacía: sin reglas se trabaja peor; sin
 * análisis no se trabaja.
 */
export async function loadCourseStyleRules(
    styleGuideRepository: IUserStyleGuideRepository,
    ownerId: string,
    paper: Pick<ExegeticalPaper, 'styleGuideId' | 'styleGuideSnapshot'>,
    contextLabel: string,
): Promise<string[]> {
    try {
        const manifest = paper.styleGuideSnapshot?.manifest
            ?? (paper.styleGuideId ? (await styleGuideRepository.getGuide(ownerId, paper.styleGuideId))?.manifest : null);
        return (manifest?.additionalRules ?? []).map(r => r.trim()).filter(Boolean);
    } catch (err) {
        console.warn(`[${contextLabel}] sin reglas de la guía`, (err as Error).message);
        return [];
    }
}
