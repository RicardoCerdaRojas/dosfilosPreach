import type { AIProject, ExegeticalPaper } from '@dosfilos/domain';

/**
 * Si el trabajo ofrece «Comenzar el sermón».
 *
 * Un trabajo de un curso (su proyecto de ORIGEN es un Curso) es un TP que se
 * entrega al profesor, no un estudio para predicar: ofrecer el sermón ahí
 * confunde (TP #9, B24). Un proyecto vinculado no cambia el encargo, así que
 * no cuenta. Mientras los proyectos cargan no se sabe de qué tipo es el
 * origen: no se ofrece todavía, para que el botón no aparezca y se vaya.
 */
export function offersSermonStart(
    paper: Pick<ExegeticalPaper, 'projectId'>,
    projects: ReadonlyArray<Pick<AIProject, 'id' | 'type'>> | null | undefined,
): boolean {
    if (!paper.projectId) return true;
    if (!projects) return false;
    const origen = projects.find(p => p.id === paper.projectId);
    // Un origen que ya no está (borrado) no define nada.
    return origen?.type !== 'course';
}
