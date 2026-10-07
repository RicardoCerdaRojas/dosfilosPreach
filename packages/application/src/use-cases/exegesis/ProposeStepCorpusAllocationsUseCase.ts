import {
    formatPassageReference,
    type ExegeticalPaper,
    type ExegeticalStep,
    type IExegeticalPaperRepository,
    type IStepCorpusPlanner,
    type ProposeStepCorpusStepInput,
    type StepSourcePlan,
    type StepSourcePlanEntry,
    briefWithExclusions,
    parseBriefQuestions,
    pertenceAlDocumento,
    questionsOfStep,
} from '@dosfilos/domain';

export interface ProposeStepCorpusAllocationsInput {
    ownerId: string;
    paperId: string;
}

export interface ProposeStepCorpusAllocationsOutput {
    /** The updated paper, with new `pinnedSources` populated per step. */
    paper: ExegeticalPaper;
    /** Number of steps the planner produced an allocation for. */
    allocatedStepCount: number;
    /** Number of steps that ended up with at least one pinned source. */
    nonEmptyAllocationCount: number;
    /** The composed prompt the planner used (for telemetry). */
    promptUsed?: string;
}

/**
 * v1.7 — Asks the LLM planner to propose `pinnedSources` for each
 * generation step in the paper, then folds the result into the
 * existing `paper.stepPlan.perStep` structure.
 *
 * Workflow:
 *   1. Load the paper.
 *   2. Filter to LLM-driven generation steps (verse / conclusion /
 *      introduction). Assembly steps don't need a corpus allocation.
 *   3. Compose the planner input — passage + brief + sources + steps.
 *   4. Call the planner port (returns a Record<stepId, allocation>).
 *   5. Sanitize: drop any `pinnedSources` ids that the planner
 *      hallucinated (don't exist in the current paper sources).
 *   6. Merge into `paper.stepPlan.perStep`. Existing per-step entries
 *      that don't appear in the planner result are PRESERVED — the
 *      planner is additive, not destructive.
 *   7. Stamp `proposedAt` + snapshot the current source-id set into
 *      `proposalCorpusSourceIds` for stale-detection.
 *   8. Persist via `setStepPlan`.
 *
 * The "flexible" prompt mode the user picked means `pinnedSources`
 * is a HINT to the orchestrator (used as priority), not a hard
 * filter. The use case here doesn't enforce that semantic — that's
 * `loadSourceContexts` in `GenerateStepUseCase`.
 *
 * Errors:
 *   - `Error('Paper not found')` when the id doesn't resolve.
 *   - Planner-side errors propagate as-is.
 */
export class ProposeStepCorpusAllocationsUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private planner: IStepCorpusPlanner,
    ) { }

    async execute(input: ProposeStepCorpusAllocationsInput): Promise<ProposeStepCorpusAllocationsOutput> {
        if (!input.ownerId) throw new Error('ProposeStepCorpusAllocationsUseCase: ownerId required');
        if (!input.paperId) throw new Error('ProposeStepCorpusAllocationsUseCase: paperId required');

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        // Filter to steps the planner can actually allocate against —
        // assembly is mechanical concatenation, no corpus needed. Un paso
        // fuera del documento tampoco: en el TP #6 el encuadre dejaba 3:2,
        // 3:6 y 3:7 y el plan repartió fuentes en los doce versículos.
        const plannableSteps = paper.steps.filter(s => s.kind !== 'assembly' && pertenceAlDocumento(s));
        if (plannableSteps.length === 0) {
            return {
                paper,
                allocatedStepCount: 0,
                nonEmptyAllocationCount: 0,
            };
        }

        const preguntas = parseBriefQuestions(paper.assignmentBrief);
        const stepInputs: ReadonlyArray<ProposeStepCorpusStepInput> = plannableSteps.map(step =>
            buildPlannerStepInput(step, paper, questionsOfStep(step, preguntas).map(q => q.text)),
        );

        const result = await this.planner.propose({
            passage: paper.passage,
            assignmentBrief: briefWithExclusions(paper),
            language: paper.displayLanguage,
            paperPhase: paper.phase,
            sources: paper.sources.map(s => ({
                id: s.id,
                sourceType: s.sourceType,
                displayLabel: s.displayLabel,
                citationKey: s.citationKey,
            })),
            steps: stepInputs,
        });

        // Sanitize: drop any pinnedSources that don't reference an
        // actual current source (LLM may hallucinate ids). Keep the
        // rationale even if pinnedSources ends up empty so the user
        // can see why the planner concluded "nothing to pin here".
        const validSourceIds = new Set(paper.sources.map(s => s.id));
        const nextPerStep: Record<string, StepSourcePlanEntry> = { ...paper.stepPlan.perStep };
        let nonEmptyAllocationCount = 0;

        for (const step of plannableSteps) {
            const allocation = result.allocations[step.id];
            if (!allocation) continue;
            const pinned = allocation.pinnedSources.filter(id => validSourceIds.has(id));
            if (pinned.length > 0) nonEmptyAllocationCount++;
            // Filter roles to ids that survived sanitation. Any orphaned
            // role entries (planner referenced an id we just dropped)
            // are silently discarded — the chip would have nowhere to
            // anchor its badge anyway.
            // Un rol que el planificador no devuelve no borra el que ya
            // tenía esa fuente en ese paso: regenerar dejaba «sin rol»
            // fuentes que el estudiante había clasificado (TP #6).
            const existing = nextPerStep[step.id];
            const sanitizedRoles: Record<string, 'anchor' | 'contrast' | 'technical'> = {};
            for (const id of pinned) {
                const role = allocation.pinnedSourceRoles?.[id] ?? existing?.pinnedSourceRoles?.[id];
                if (role) sanitizedRoles[id] = role;
            }
            nextPerStep[step.id] = {
                stepId: step.id,
                kind: step.kind,
                emphasis: existing?.emphasis ?? {
                    emphasizedTypes: [],
                    deemphasizedTypes: [],
                    citationOverrides: [],
                },
                pinnedSources: pinned,
                ...(Object.keys(sanitizedRoles).length > 0 ? { pinnedSourceRoles: sanitizedRoles } : {}),
                suppressedSources: existing?.suppressedSources ?? [],
                note: allocation.rationale.trim() || existing?.note || null,
            };
        }

        const nextPlan: StepSourcePlan = {
            perStep: nextPerStep,
            defaults: paper.stepPlan.defaults,
            updatedAt: new Date(),
            proposedAt: new Date(),
            proposalCorpusSourceIds: paper.sources.map(s => s.id),
        };

        const updatedPaper = await this.paperRepository.setStepPlan(input.ownerId, input.paperId, nextPlan);

        return {
            paper: updatedPaper,
            allocatedStepCount: Object.keys(result.allocations).length,
            nonEmptyAllocationCount,
            ...(result.promptUsed !== undefined && { promptUsed: result.promptUsed }),
        };
    }
}

function buildPlannerStepInput(step: ExegeticalStep, paper: ExegeticalPaper, questions: ReadonlyArray<string>): ProposeStepCorpusStepInput {
    const language = paper.displayLanguage;
    let label: string;
    if (step.kind === 'verse' && step.verseRef) {
        label = formatPassageReference(step.verseRef, language);
    } else if (step.kind === 'introduction') {
        label = language === 'es' ? 'Introducción' : 'Introduction';
    } else if (step.kind === 'conclusion') {
        label = language === 'es' ? 'Conclusión' : 'Conclusion';
    } else {
        label = step.kind;
    }
    return {
        id: step.id,
        kind: step.kind,
        label,
        verseRef: step.verseRef,
        ...(questions.length > 0 ? { questions } : {}),
    };
}
