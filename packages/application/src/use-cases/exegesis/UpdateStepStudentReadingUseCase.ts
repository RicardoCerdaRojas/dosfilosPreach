import type { ExegeticalPaper, IExegeticalPaperRepository, StepSourcePlan, StepSourcePlanEntry } from '@dosfilos/domain';

export interface UpdateStepStudentReadingInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /** Vacío la quita. */
    studentReading: string;
}

/** Tope de «Mi lectura»: es una observación, no un borrador del paso. */
export const MAX_STUDENT_READING_CHARS = 2000;

/**
 * Guarda «Mi lectura» de un paso (etapa 2, capa 3): la observación propia
 * del estudiante, escrita antes de generar. Vive en la entrada del plan del
 * paso, junto a la nota, y no toca nada más de esa entrada.
 */
export class UpdateStepStudentReadingUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdateStepStudentReadingInput): Promise<ExegeticalPaper> {
        if (!input.ownerId || !input.paperId || !input.stepId) throw new Error('UpdateStepStudentReadingUseCase: ownerId, paperId y stepId requeridos');
        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);
        const step = paper.steps.find(s => s.id === input.stepId);
        if (!step) throw new Error(`Step ${input.stepId} not found on paper ${input.paperId}`);

        const texto = input.studentReading.trim().slice(0, MAX_STUDENT_READING_CHARS);
        const existing = paper.stepPlan.perStep[input.stepId];
        const base: StepSourcePlanEntry = existing ?? {
            stepId: step.id,
            kind: step.kind,
            emphasis: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] },
            pinnedSources: [],
            suppressedSources: [],
            note: null,
        };
        const { studentReading: _antes, ...sinLectura } = base;
        const entry: StepSourcePlanEntry = texto ? { ...sinLectura, studentReading: texto } : sinLectura;
        // Campo por campo, como `UpdateStepCorpusAllocationUseCase`: el plan
        // leído trae `proposalCorpusSourceIds: undefined` cuando no hay
        // propuesta, y Firestore rechaza `undefined` también anidado.
        const plan: StepSourcePlan = {
            perStep: { ...paper.stepPlan.perStep, [input.stepId]: entry },
            defaults: paper.stepPlan.defaults,
            updatedAt: new Date(),
            ...(paper.stepPlan.proposedAt !== undefined && { proposedAt: paper.stepPlan.proposedAt }),
            ...(paper.stepPlan.proposalCorpusSourceIds !== undefined && { proposalCorpusSourceIds: paper.stepPlan.proposalCorpusSourceIds }),
        };
        return this.paperRepository.setStepPlan(input.ownerId, input.paperId, plan);
    }
}
