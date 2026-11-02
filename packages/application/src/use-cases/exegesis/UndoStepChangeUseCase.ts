import {
    canonicalizeQuestionHeadings,
    parseBriefQuestions,
    questionsOfStep,
    pertenceAlDocumento,
    sameDocumentText,
    stepHistoryMoves,
    type ExegeticalPaper,
    type ExegeticalStep,
    type IExegeticalPaperRepository,
    type StepHistoryMove,
} from '@dosfilos/domain';
import { assemblyWithVerse } from '../../services/exegesis/spliceVerseIntoAssembly';

export interface UndoStepChangeInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    action: 'undo' | 'redo';
    /** El movimiento que la pantalla ofrecía: si ya es otro, no se aplica. */
    expected: StepHistoryMove;
}

export interface UndoStepChangeOutput {
    step: ExegeticalStep;
    /** La prosa del paso cambió y el documento ensamblado no pudo seguirla. */
    documentBehind: boolean;
}

/** El paso cambió desde que la pantalla ofreció deshacer. */
export const STEP_HISTORY_STALE = 'UndoStepChangeUseCase: el paso cambió; recarga e intenta otra vez';

const destino = (m: StepHistoryMove) => `${m.kind}:${m.versionId}:${m.kind === 'version' ? m.targetVersionId : ''}`;

/**
 * Deshacer o rehacer «Regenerar» (decisión del fundador, 2026-11-02): que
 * regenerar no sea irreversible. Regenerar la introducción, la conclusión o un
 * análisis ya deja la versión anterior en el historial; recomponer un versículo
 * guarda la prosa anterior en la misma versión (`previousProse`). No llama a
 * ningún modelo y no cobra.
 *
 * Volver a otra versión no acepta nada ni toca el documento: queda en revisión
 * (`stepAfterVersionMove`). Lo único que escribe es la prosa recompuesta, porque
 * al recomponer entró sola: vuelve a salir, si la sección es EXACTAMENTE lo que
 * entró. Si trae otra cosa es una corrección a mano, y deshacer no puede pisarla:
 * se deja como está y se avisa.
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
        const move = stepHistoryMoves(before)[input.action];
        if (!move) throw new Error('UndoStepChangeUseCase: no hay nada que deshacer o rehacer');
        // La versión no basta: tras deshacer la prosa la versión es la misma, y
        // un segundo clic con la pantalla vieja retrocedería un paso de más.
        if (destino(move) !== destino(input.expected)) throw new Error(STEP_HISTORY_STALE);

        if (move.kind === 'version') {
            const step = await this.paperRepository.moveToStepVersion(input.ownerId, input.paperId, input.stepId, move.targetVersionId);
            return { step, documentBehind: false };
        }
        const step = await this.paperRepository.swapStepVersionProse(input.ownerId, input.paperId, input.stepId, move.versionId);
        return { step, documentBehind: await this.followProse(input, paper, before, step) };
    }

    /** Lleva la prosa al documento si se puede. Devuelve si quedó atrás. */
    private async followProse(
        input: UndoStepChangeInput,
        paper: ExegeticalPaper,
        before: ExegeticalStep,
        step: ExegeticalStep,
    ): Promise<boolean> {
        const entra = step.accepted;
        const sale = before.accepted;
        // Un texto en revisión nunca entra.
        if (!paper.assembledMarkdown?.trim() || step.state !== 'accepted' || !pertenceAlDocumento(step)) return false;
        if (!entra?.canonicalAnalysis || !sale) return false;

        const propias = questionsOfStep(step, parseBriefQuestions(paper.assignmentBrief, paper.passage));
        const textos = propias.map(q => q.text);
        const prosa = canonicalizeQuestionHeadings(entra.markdown, textos);
        // Una prosa sin los títulos de sus preguntas se los llevaría del documento.
        if (textos.length > 1 && !textos.every(t => prosa.includes(`## ${t}`))) return true;
        const conLoQueEntra = assemblyWithVerse(paper, entra.canonicalAnalysis, prosa, propias, true);
        if (conLoQueEntra === null) return true;
        if (sameDocumentText(conLoQueEntra, paper.assembledMarkdown)) return false;
        // Si poner lo que sale no cambia nada, la sección es exactamente eso.
        const conLoQueSale = assemblyWithVerse(paper, entra.canonicalAnalysis, sale.markdown, propias, true);
        if (conLoQueSale === null || !sameDocumentText(conLoQueSale, paper.assembledMarkdown)) return true;
        await this.paperRepository.updatePaper(input.ownerId, input.paperId, { assembledMarkdown: conLoQueEntra });
        return false;
    }
}
