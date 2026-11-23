import { resolvePaperProfileKind, type ExegeticalPaper, type IExegeticalPaperRepository, type PaperProfileKind } from '@dosfilos/domain';

export interface UpdatePaperProfileKindInput {
    ownerId: string;
    paperId: string;
    profileKind: PaperProfileKind;
}

/**
 * Fija el tipo de un trabajo (TP, investigación, síntesis + sermón). En un
 * trabajo creado antes de A4 es la confirmación del tipo deducido; después,
 * un cambio. Cambia las unidades y los puntos de aprobación desde ahora; los
 * análisis ya hechos no se tocan.
 */
export class UpdatePaperProfileKindUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdatePaperProfileKindInput): Promise<ExegeticalPaper> {
        if (!input.ownerId || !input.paperId) throw new Error('UpdatePaperProfileKindUseCase: ownerId y paperId requeridos');
        const profileKind = resolvePaperProfileKind(input.profileKind);
        // Sin «volver a sin elegir»: una vez confirmado, el tipo se cambia, no se borra.
        if (!profileKind) throw new Error(`UpdatePaperProfileKindUseCase: tipo desconocido «${String(input.profileKind)}»`);
        return this.paperRepository.updatePaper(input.ownerId, input.paperId, { profileKind });
    }
}
