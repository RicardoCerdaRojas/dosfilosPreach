import {
    parseBriefQuestions,
    questionsOfStep,
    pertenceAlDocumento,
    stepHistoryMoves,
    unreviewedBlockingCitations,
    versionUnderReview,
    type ExegeticalStep,
    type IExegeticalPaperRepository,
} from '@dosfilos/domain';
import { spliceVerseIntoAssembly } from '../../services/exegesis/spliceVerseIntoAssembly';

export interface UndoStepChangeInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    action: 'undo' | 'redo';
    /** La versión que la pantalla mostraba: si el paso cambió, no se aplica. */
    fromVersionId: string;
}

export interface UndoStepChangeOutput {
    step: ExegeticalStep;
    /** Si la prosa restaurada entró al documento ensamblado. */
    assemblyUpdated: boolean;
}

/** El paso cambió desde que la pantalla ofreció deshacer. */
export const STEP_HISTORY_STALE = 'UndoStepChangeUseCase: el paso cambió; recarga e intenta otra vez';

/**
 * Deshacer o rehacer «Regenerar» (decisión del fundador, 2026-11-02): que
 * regenerar no sea irreversible. Regenerar la introducción, la conclusión o un
 * análisis ya deja la versión anterior en el historial; recomponer un versículo
 * guarda la prosa anterior en la misma versión (`previousProse`). No llama a
 * ningún modelo y no cobra.
 *
 * Lo restaurado vuelve también al documento ensamblado, por el mismo camino
 * que usó la prosa nueva para entrar: si no, el Word seguiría con lo deshecho.
 */
export class UndoStepChangeUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UndoStepChangeInput): Promise<UndoStepChangeOutput> {
        if (!input.ownerId || !input.paperId || !input.stepId) {
            throw new Error('UndoStepChangeUseCase: ownerId, paperId and stepId required');
        }
        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);
        const before = paper.steps.find(s => s.id === input.stepId);
        if (!before) throw new Error(`Step ${input.stepId} not found`);
        if (versionUnderReview(before)?.id !== input.fromVersionId) throw new Error(STEP_HISTORY_STALE);
        const move = stepHistoryMoves(before)[input.action];
        if (!move) throw new Error('UndoStepChangeUseCase: no hay nada que deshacer o rehacer');

        let step: ExegeticalStep;
        if (move.kind === 'prose') {
            step = await this.paperRepository.swapStepVersionProse(input.ownerId, input.paperId, input.stepId, move.versionId);
        } else {
            const target = before.versions.find(v => v.id === move.targetVersionId)!;
            // El mismo control de «Aceptar»: deshacer no puede dejar aceptada
            // una versión con citas que nadie revisó.
            const canAccept = !target.canonicalAnalysis || unreviewedBlockingCitations(
                target.canonicalAnalysis,
                target.citationVerdicts ?? [],
                target.citationReviews ?? [],
            ).length === 0;
            step = await this.paperRepository.moveToStepVersion(
                input.ownerId, input.paperId, input.stepId, move.targetVersionId, input.action, canAccept,
            );
        }

        const shown = versionUnderReview(step);
        let assemblyUpdated = false;
        if (step.kind === 'assembly') {
            // Como al aceptar: el ensamble aceptado ES el documento.
            if (step.state === 'accepted' && step.accepted?.markdown.trim()) {
                await this.paperRepository.updatePaper(input.ownerId, input.paperId, { assembledMarkdown: step.accepted.markdown });
                assemblyUpdated = true;
            }
        } else if (step.kind === 'verse' && shown?.canonicalAnalysis && shown.markdown?.trim()) {
            assemblyUpdated = await spliceVerseIntoAssembly(
                this.paperRepository,
                input.ownerId,
                paper,
                shown.canonicalAnalysis,
                shown.markdown,
                questionsOfStep(step, parseBriefQuestions(paper.assignmentBrief, paper.passage)),
                pertenceAlDocumento(step),
            );
        }
        return { step, assemblyUpdated };
    }
}
