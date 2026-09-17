import type { ExegeticalStepVersion, IExegeticalPaperRepository } from '@dosfilos/domain';

export interface ReviewCitationInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    versionId: string;
    /** Ruta de la cita en el análisis, p. ej. `commentatorEngagement[2]`. */
    path: string;
    /** Qué encontró quien revisó. Vacía = quitar la marca. */
    note: string;
}

/**
 * Registra que alguien miró la página detrás de una cita «no encontrada».
 *
 * No cambia el veredicto del verificador —ese sigue diciendo lo que vio— ni
 * corrige la cita. Solo deja constancia, con motivo, de que un humano
 * decidió, y con eso la cita deja de bloquear la aceptación del paso.
 */
export class ReviewCitationUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: ReviewCitationInput): Promise<ExegeticalStepVersion> {
        if (!input.ownerId || !input.paperId || !input.stepId || !input.versionId || !input.path) {
            throw new Error('ReviewCitationUseCase: ownerId, paperId, stepId, versionId and path required');
        }
        return this.paperRepository.setCitationReview(
            input.ownerId,
            input.paperId,
            input.stepId,
            input.versionId,
            { path: input.path, note: input.note ?? '', reviewedAt: new Date() },
        );
    }
}
