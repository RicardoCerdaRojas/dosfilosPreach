import type {
    AcceptStepInput,
    ExegeticalStep,
    IExegeticalPaperRepository,
} from '@dosfilos/domain';
import { UnreviewedCitationsError, unreviewedNotFound } from '@dosfilos/domain';

/**
 * Marks a generated version as the accepted content for a step,
 * transitioning the step to 'accepted' state. The accepted version is
 * what the assembly step will concatenate into the final paper.
 *
 * `versionId` is required (not implicit "current") so the user can race-
 * tolerantly accept a specific version even if a regeneration happened
 * between the click and the request — the explicit id avoids accepting
 * the wrong content.
 *
 * Special case for assembly steps:
 *   When the user accepts the `'assembly'` step, the paper is in its
 *   final form. We additionally:
 *     1. Persist `paper.assembledMarkdown` from the accepted version's
 *        markdown (the gate for "Generar sermón" reads this field, not
 *        the step doc).
 *     2. Transition `paper.phase` to `'assembled'` so the UI knows the
 *        paper is done and downstream actions (sermon generation,
 *        export) can fire.
 *   Without this transition the paper stays stuck in `'in-progress'`
 *   forever, the assembled markdown lives only inside the step doc,
 *   and the "Generar sermón" button stays disabled even though every
 *   step is accepted.
 */
export class AcceptStepUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: AcceptStepInput): Promise<ExegeticalStep> {
        if (!input.ownerId || !input.paperId || !input.stepId || !input.versionId) {
            throw new Error('AcceptStepUseCase: ownerId, paperId, stepId and versionId required');
        }
        // Bloquear lo que está mal, no lo que está incompleto: una cita que
        // el verificador no encontró y nadie revisó no puede aceptarse; una
        // duda o un paso sin verificar, sí.
        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        const version = paper?.steps.find(s => s.id === input.stepId)?.versions.find(v => v.id === input.versionId);
        if (version?.canonicalAnalysis) {
            const blocking = unreviewedNotFound(
                version.canonicalAnalysis,
                version.citationVerdicts ?? [],
                version.citationReviews ?? [],
            );
            if (blocking.length > 0) throw new UnreviewedCitationsError(blocking);
        }

        const acceptedStep = await this.paperRepository.acceptStepVersion(
            input.ownerId,
            input.paperId,
            input.stepId,
            input.versionId
        );

        // Promote the paper when the assembly step lands. Both writes
        // are independent — we update assembledMarkdown first (so the
        // "Generar sermón" gate flips ready before phase even changes),
        // then transition phase as the explicit "done" signal.
        if (acceptedStep.kind === 'assembly' && acceptedStep.accepted) {
            await this.paperRepository.updatePaper(input.ownerId, input.paperId, {
                assembledMarkdown: acceptedStep.accepted.markdown,
            });
            await this.paperRepository.setPhase(input.ownerId, input.paperId, 'assembled');
        }

        return acceptedStep;
    }
}
