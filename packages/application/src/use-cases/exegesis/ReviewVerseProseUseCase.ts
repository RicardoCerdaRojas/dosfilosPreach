import {
    applyPageLabelStyle,
    formatPassageReference,
    grammarCitationsOf,
    parseBriefQuestions,
    proseReviewCriteria,
    questionsOfStep,
    type IExegeticalPaperRepository,
    type IProseReviewer,
    type IUserStyleGuideRepository,
    type ProseReviewerFinding,
} from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';
import { loadCourseStyleRules } from '../../services/exegesis/courseStyleRules';

export interface ReviewVerseProseInput {
    ownerId: string;
    paperId: string;
    stepId: string;
}

export interface ReviewVerseProseOutput {
    findings: ProseReviewerFinding[];
    /** Los criterios con que se leyó, numerados desde 1 como `criterion`. */
    criteria: string[];
    /**
     * La prosa que se revisó. La tarjeta compara con la vigente: si el autor
     * editó o recompuso después, los hallazgos ya no señalan ese texto.
     */
    reviewedMarkdown: string;
}

/**
 * «Revisión antes de entregar», la parte con modelo (TP #8, fase 8b, E3).
 *
 * Lee la prosa del versículo como se ENTREGA contra los criterios del
 * profesor más las reglas de la guía del curso, y contra lo que su análisis
 * ya decidió. No guarda nada: es un aviso sobre un texto que el autor va a
 * seguir tocando, y un informe guardado mentiría en cuanto lo toque (la
 * misma razón que `RunCoherencePassUseCase`). No bloquea el Word.
 */
export class ReviewVerseProseUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private reviewer: IProseReviewer,
    ) { }

    async execute(input: ReviewVerseProseInput): Promise<ReviewVerseProseOutput> {
        if (!input.ownerId || !input.paperId || !input.stepId) {
            throw new Error('ReviewVerseProseUseCase: ownerId, paperId, stepId required');
        }
        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);
        const step = paper.steps.find(s => s.id === input.stepId);
        if (!step) throw new Error(`Step ${input.stepId} not found`);
        if (step.kind !== 'verse') throw new Error('ReviewVerseProseUseCase: step kind must be "verse"');
        // La versión que la tarjeta muestra: en revisión, la nueva.
        const version = step.state === 'awaiting-review'
            ? step.current ?? step.accepted
            : step.accepted ?? step.current;
        const reviewedMarkdown = applyPageLabelStyle(version?.markdown ?? '', paper.rubric?.formatting ?? null);
        if (!version || !reviewedMarkdown.trim()) {
            throw new Error('ReviewVerseProseUseCase: el versículo no tiene prosa compuesta');
        }

        const language = paper.displayLanguage;
        const analysis = version.canonicalAnalysis ?? null;
        const grammarKeys = paper.sources
            .filter(s => s.sourceType === 'grammar-syntax' && s.citationKey?.trim())
            .map(s => s.citationKey!.trim());
        const rules = await loadCourseStyleRules(this.styleGuideRepository, input.ownerId, paper, 'ReviewVerseProse');
        const criteria = proseReviewCriteria(language, rules);
        const questions = questionsOfStep(step, parseBriefQuestions(paper.assignmentBrief, paper.passage))
            .map(q => ({ number: q.number, text: q.text }));

        const reservation = await ExegesisCreditReservation.open(input.ownerId, 'reviewVerseProse');
        try {
            reservation.markLlmContacted();
            const { findings } = await this.reviewer.review({
                prose: reviewedMarkdown,
                verseLabel: step.verseRef ? formatPassageReference(step.verseRef, language) : '',
                language,
                questions,
                decisiveCriteria: (analysis?.questionAnswers ?? [])
                    .filter(qa => qa.decisiveCriterion?.text?.trim())
                    .map(qa => ({
                        questionNumber: qa.questionNumber,
                        text: qa.decisiveCriterion.text,
                        whyThisOverThat: qa.decisiveCriterion.whyThisOverThat ?? '',
                        decision: qa.decision ?? '',
                    })),
                grammarCitations: grammarCitationsOf(analysis, grammarKeys).map(g => `${g.key}, p. ${g.page}`),
                criteria,
            });
            return { findings, criteria, reviewedMarkdown };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}
