import {
    cleanAcquisitionMarks,
    cleanIgnoredGrammarCategories,
    type AcquisitionMark,
    cleanManualRequirements,
    cleanPaperInputMarks,
    cleanRequirementMarks,
    type ExegeticalPaper,
    type IExegeticalPaperRepository,
    type ManualRequirement,
    type PaperInputMarks,
    type RequirementMark,
} from '@dosfilos/domain';

export interface UpdatePaperInputsInput {
    ownerId: string;
    paperId: string;
    /** Cada campo es opcional: ausente = no se toca. Se guarda entero, ya limpio. */
    inputMarks?: PaperInputMarks;
    requirementMarks?: Record<string, RequirementMark>;
    manualRequirements?: ManualRequirement[];
    ignoredGrammarCategories?: string[];
    /** Qué conseguir (A6). */
    acquisitionMarks?: Record<string, AcquisitionMark>;
}

/**
 * Guarda lo que el autor decide en «Entradas y requisitos» (A5): las marcas
 * de cada entrada, dónde se cumple cada requisito, los requisitos propios y
 * las categorías que el curso no acepta. Todo se limpia antes de guardar: el
 * documento del trabajo tiene tope (1 MB) y estos campos van dentro.
 */
export class UpdatePaperInputsUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdatePaperInputsInput): Promise<ExegeticalPaper> {
        if (!input.ownerId || !input.paperId) throw new Error('UpdatePaperInputsUseCase: ownerId y paperId requeridos');
        const patch: Partial<Pick<ExegeticalPaper, 'inputMarks' | 'requirementMarks' | 'manualRequirements' | 'ignoredGrammarCategories' | 'acquisitionMarks'>> = {};
        if (input.inputMarks !== undefined) patch.inputMarks = cleanPaperInputMarks(input.inputMarks);
        if (input.requirementMarks !== undefined) patch.requirementMarks = cleanRequirementMarks(input.requirementMarks);
        if (input.manualRequirements !== undefined) patch.manualRequirements = cleanManualRequirements(input.manualRequirements);
        if (input.ignoredGrammarCategories !== undefined) patch.ignoredGrammarCategories = cleanIgnoredGrammarCategories(input.ignoredGrammarCategories);
        if (input.acquisitionMarks !== undefined) patch.acquisitionMarks = cleanAcquisitionMarks(input.acquisitionMarks);
        if (Object.keys(patch).length === 0) throw new Error('UpdatePaperInputsUseCase: nada que guardar');
        return this.paperRepository.updatePaper(input.ownerId, input.paperId, patch);
    }
}
