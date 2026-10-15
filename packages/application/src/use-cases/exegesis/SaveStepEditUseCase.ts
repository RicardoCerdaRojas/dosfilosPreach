import type {
    ExegeticalStep,
    IExegeticalPaperRepository,
    SaveManualEditInput,
} from '@dosfilos/domain';

/**
 * Records a manual user edit on a step. Internally creates a version
 * with `origin: 'edited'` parented to whatever was previously accepted
 * (or current as a fallback) and sets that as the new accepted content.
 * State stays 'accepted'.
 *
 * Per the user's product decision, manual edits do NOT auto-re-run
 * citation verification — the resulting version's `verifications`
 * counters reset to zero with `manualPending` semantics. Re-verifying
 * is an explicit action the user takes via a separate "verify" button
 * on the step (button lives in the UI, not in this use case).
 */
export class SaveStepEditUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: SaveManualEditInput): Promise<ExegeticalStep> {
        if (!input.ownerId || !input.paperId || !input.stepId) {
            throw new Error('SaveStepEditUseCase: ownerId, paperId and stepId required');
        }
        if (typeof input.markdown !== 'string') {
            throw new Error('SaveStepEditUseCase: markdown must be a string');
        }
        const step = await this.paperRepository.saveManualEdit(
            input.ownerId,
            input.paperId,
            input.stepId,
            input.markdown
        );
        // Editar el ensamble es lo mismo que aceptarlo con otro texto: el
        // documento que se exporta (`assembledMarkdown`) tiene que ser ESE.
        // Sólo se escribía al aceptar, y en el TP #7 las tres ediciones del
        // fundador quedaron en el paso mientras la exportación seguía con la
        // versión generada (leído en producción, 2026-10-15).
        if (step.kind === 'assembly' && step.accepted) {
            await this.paperRepository.updatePaper(input.ownerId, input.paperId, {
                assembledMarkdown: step.accepted.markdown,
            });
            await this.paperRepository.setPhase(input.ownerId, input.paperId, 'assembled');
        }
        return step;
    }
}
