import { resolveExegeticalMethod, type ExegeticalMethod, type ExegeticalPaper, type IExegeticalPaperRepository } from '@dosfilos/domain';

export interface UpdatePaperMethodInput {
    ownerId: string;
    paperId: string;
    /** `null` vuelve al análisis de siempre. */
    method: ExegeticalMethod | null;
}

/**
 * Cambia el método de un trabajo ya creado (etapa 2, capa 3). Rige para los
 * análisis que se generen desde ahora; los aceptados no se tocan.
 */
export class UpdatePaperMethodUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdatePaperMethodInput): Promise<ExegeticalPaper> {
        if (!input.ownerId || !input.paperId) throw new Error('UpdatePaperMethodUseCase: ownerId y paperId requeridos');
        return this.paperRepository.updatePaper(input.ownerId, input.paperId, {
            exegeticalMethod: resolveExegeticalMethod(input.method),
        });
    }
}
