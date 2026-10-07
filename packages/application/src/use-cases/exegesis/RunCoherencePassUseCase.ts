import type {
    CoherenceReviewOutput,
    CoherenceReviewSection,
    ExegeticalPaper,
    IExegeticalPaperRepository,
    ICoherenceReviewer,
} from '@dosfilos/domain';
import { formatPassageReference, briefWithExclusions } from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

export interface RunCoherencePassInput {
    ownerId: string;
    paperId: string;
    /** Override output language. Defaults to paper.displayLanguage. */
    language?: 'es' | 'en';
}

export type RunCoherencePassOutput = CoherenceReviewOutput;

/**
 * Single-pass cross-section reviewer. Loads the paper, builds the
 * section payload from accepted steps (skipping unfinished ones),
 * runs the `ICoherenceReviewer`, and returns the verdict.
 *
 * The result is NOT persisted on the paper — it's a snapshot the
 * user reviews and addresses by editing the affected steps. Future
 * iterations could store the last-run summary for "what did the
 * reviewer say last time", but v1 keeps it transient to avoid
 * stale-data confusion (the user edits one step → previous report
 * lies about that step's state).
 */
export class RunCoherencePassUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private reviewer: ICoherenceReviewer,
    ) { }

    async execute(input: RunCoherencePassInput): Promise<RunCoherencePassOutput> {
        if (!input.ownerId) throw new Error('RunCoherencePassUseCase: ownerId required');
        if (!input.paperId) throw new Error('RunCoherencePassUseCase: paperId required');

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const sections = buildSections(paper);
        if (sections.length < 2) {
            throw new Error('RunCoherencePassUseCase: at least 2 accepted sections required to review coherence');
        }

        const language = input.language ?? paper.displayLanguage;
        const passageDisplay = formatPassageReference(paper.passage, language);

        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'runCoherencePass',
        );

        try {
            reservation.markLlmContacted();
            return await this.reviewer.review({
                sections,
                passageDisplay,
                assignmentBrief: briefWithExclusions(paper),
                language,
            });
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

function buildSections(paper: ExegeticalPaper): CoherenceReviewSection[] {
    // Canonical paper order: introduction → verses (in order) → conclusion.
    // Assembly steps are skipped — they're mechanical concatenations,
    // not LLM-produced argumentation, so they offer nothing the
    // reviewer can criticize that isn't already in the source steps.
    const ordered = [...paper.steps].sort((a, b) => a.order - b.order);
    const intro = ordered.find(s => s.kind === 'introduction' && s.accepted !== null);
    const conclusion = ordered.find(s => s.kind === 'conclusion' && s.accepted !== null);
    const verses = ordered.filter(s => s.kind === 'verse' && s.accepted !== null);

    const sections: CoherenceReviewSection[] = [];
    if (intro?.accepted) {
        sections.push({
            stepId: intro.id,
            kind: 'introduction',
            label: 'Introducción',
            markdown: intro.accepted.markdown,
        });
    }
    for (const v of verses) {
        if (!v.accepted) continue;
        const num = v.verseRef?.verseStart ?? v.order;
        sections.push({
            stepId: v.id,
            kind: 'verse',
            label: `Versículo ${num}`,
            markdown: v.accepted.markdown,
        });
    }
    if (conclusion?.accepted) {
        sections.push({
            stepId: conclusion.id,
            kind: 'conclusion',
            label: 'Conclusión',
            markdown: conclusion.accepted.markdown,
        });
    }
    return sections;
}
