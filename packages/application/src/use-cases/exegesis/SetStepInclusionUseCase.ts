import type { ExegeticalStep, IExegeticalPaperRepository } from '@dosfilos/domain';

export interface SetStepInclusionInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    include: boolean;
}

/**
 * Marca si un paso pertenece al documento que se va a entregar.
 *
 * Antes la pertenencia se DEDUCÍA de tener prosa compuesta, y eso usa una
 * acción tomada con otro propósito como si fuera una declaración: componer
 * para ver cómo queda metía el versículo al documento sin remedio, y dejar uno
 * como análisis a propósito no se podía decir.
 *
 * La marca gobierna dos cosas a la vez, y por eso es una sola: qué entra al
 * ensamble, y entre cuántas secciones se reparte la extensión que exige la
 * rúbrica. Sacar la introducción y la conclusión devuelve su parte del
 * presupuesto a los versículos.
 */
export class SetStepInclusionUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: SetStepInclusionInput): Promise<ExegeticalStep> {
        if (!input.ownerId || !input.paperId || !input.stepId) {
            throw new Error('SetStepInclusionUseCase: ownerId, paperId y stepId son obligatorios');
        }
        return this.paperRepository.setStepInclusion(
            input.ownerId,
            input.paperId,
            input.stepId,
            input.include,
        );
    }
}
