import {
    formatPassageReference,
    type ExegeticalPaper,
    type ExegeticalStep,
    type IExegeticalPaperRepository,
    type IStepCorpusPlanner,
    type ProposeStepCorpusEvidence,
    type ProposeStepCorpusStepInput,
    type QuestionSourceEvidence,
    type SourceRole,
    type StepSourcePlan,
    type StepSourcePlanEntry,
    briefWithExclusions,
    exclusionFor,
    isSyntaxQuestion,
    parseBriefQuestions,
    pertenceAlDocumento,
    questionsOfStep,
    resolveSourceRole,
} from '@dosfilos/domain';

export interface ProposeStepCorpusAllocationsInput {
    ownerId: string;
    paperId: string;
    /**
     * Lo que el corpus ya trae para cada pregunta (`evidenceFromReview`, la
     * misma revisión que muestra la tarjeta «¿Qué responde cada pregunta?»).
     * Viaja desde la interfaz porque ya está cargada ahí: buscarla otra vez
     * sería leer cada libro dos veces (TP #8, fase 8a, B1–B2).
     */
    evidence?: ReadonlyArray<QuestionSourceEvidence>;
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

        const preguntas = parseBriefQuestions(paper.assignmentBrief, paper.passage);
        const validSourceIds = new Set(paper.sources.map(s => s.id));
        const evidenciaDe = evidenceOfStep(input.evidence ?? [], preguntas, validSourceIds);
        const stepInputs: ReadonlyArray<ProposeStepCorpusStepInput> = plannableSteps.map(step =>
            buildPlannerStepInput(step, paper, questionsOfStep(step, preguntas).map(q => q.text), evidenciaDe(step)),
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
                ...(s.chosenRole ? { chosenRole: s.chosenRole } : {}),
            })),
            steps: stepInputs,
            questionsMode: preguntas.some(q => q.verses.length > 0),
        });

        // Sanitize: drop any pinnedSources that don't reference an
        // actual current source (LLM may hallucinate ids). Keep the
        // rationale even if pinnedSources ends up empty so the user
        // can see why the planner concluded "nothing to pin here".
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

        conLaEvidencia(nextPerStep, plannableSteps, evidenciaDe, paper);
        conGramaticaEnLaSintaxis(nextPerStep, plannableSteps, preguntas, paper);

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

/**
 * Cada paso con una pregunta de sintaxis lleva una gramática, con rol
 * técnico. El prompt del planificador ya lo pide y en el TP #7 igual dejó a
 * Robertson sólo en 3:13, fuera de 3:18 y de su pregunta sobre el participio
 * (#15). Se valida después, en código: si falta, se agrega la primera
 * gramática del corpus que no esté excluida del trabajo.
 */
function conGramaticaEnLaSintaxis(
    perStep: Record<string, StepSourcePlanEntry>,
    steps: ReadonlyArray<ExegeticalStep>,
    preguntas: ReturnType<typeof parseBriefQuestions>,
    paper: ExegeticalPaper,
): void {
    const gramatica = paper.sources.find(s =>
        s.sourceType === 'grammar-syntax'
        && !exclusionFor({ author: null, citationKey: s.citationKey ?? s.displayLabel }, paper.excludedSources));
    if (!gramatica) return;
    const gramaticas = new Set(paper.sources.filter(s => s.sourceType === 'grammar-syntax').map(s => s.id));
    for (const step of steps) {
        const entrada = perStep[step.id];
        if (!entrada) continue;
        if (!questionsOfStep(step, preguntas).some(q => isSyntaxQuestion(q.text))) continue;
        if (entrada.pinnedSources.some(id => gramaticas.has(id))) continue;
        perStep[step.id] = {
            ...entrada,
            pinnedSources: [...entrada.pinnedSources, gramatica.id],
            pinnedSourceRoles: { ...(entrada.pinnedSourceRoles ?? {}), [gramatica.id]: 'technical' },
        };
    }
}

/** Tope del renglón de evidencia que ve el planificador, por fuente y paso. */
const MAX_EVIDENCE_LINE = 300;

/**
 * La evidencia de cada paso: la de las preguntas que le tocan, agrupada por
 * fuente y forma (versículo o lema). Las fuentes que ya no están en el corpus
 * no cuentan.
 */
function evidenceOfStep(
    evidence: ReadonlyArray<QuestionSourceEvidence>,
    preguntas: ReturnType<typeof parseBriefQuestions>,
    validSourceIds: ReadonlySet<string>,
): (step: ExegeticalStep) => ProposeStepCorpusEvidence[] {
    return step => {
        const numeros = new Set(questionsOfStep(step, preguntas).map(q => q.number));
        const porClave = new Map<string, ProposeStepCorpusEvidence & { sheets: number[] }>();
        for (const e of evidence) {
            if (!numeros.has(e.question) || !validSourceIds.has(e.sourceId)) continue;
            const clave = `${e.sourceId}|${e.via}|${e.term ?? ''}`;
            const actual = porClave.get(clave);
            if (actual) {
                for (const h of e.sheets) if (!actual.sheets.includes(h)) actual.sheets.push(h);
                if (!actual.line && e.snippets[0]) actual.line = e.snippets[0].slice(0, MAX_EVIDENCE_LINE);
                continue;
            }
            porClave.set(clave, {
                sourceId: e.sourceId,
                sheets: [...e.sheets],
                via: e.via,
                ...(e.term ? { term: e.term } : {}),
                ...(e.snippets[0] ? { line: e.snippets[0].slice(0, MAX_EVIDENCE_LINE) } : {}),
            });
        }
        return [...porClave.values()];
    };
}

/**
 * B1 (TP #8, fase 8a): toda fuente con material en el corpus para la pregunta
 * de un paso entra a ese paso, con su rol del corpus, la haya elegido el
 * modelo o no. Es lo que se hizo a mano en el TP #8: Tuggy en los cuatro
 * pasos, Kittel en 4:1, 4:3 y 4:5. El modelo sigue decidiendo los roles de lo
 * que eligió; lo que se agrega aquí lleva el que el corpus le da, y la nota
 * del paso lo dice.
 */
function conLaEvidencia(
    perStep: Record<string, StepSourcePlanEntry>,
    steps: ReadonlyArray<ExegeticalStep>,
    evidenciaDe: (step: ExegeticalStep) => ProposeStepCorpusEvidence[],
    paper: ExegeticalPaper,
): void {
    for (const step of steps) {
        const ids = [...new Set(evidenciaDe(step).map(e => e.sourceId))];
        if (ids.length === 0) continue;
        const entrada: StepSourcePlanEntry = perStep[step.id] ?? {
            stepId: step.id,
            kind: step.kind,
            emphasis: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] },
            pinnedSources: [],
            suppressedSources: [],
            note: null,
        };
        const faltan = ids.filter(id => !entrada.pinnedSources.includes(id));
        if (faltan.length === 0) continue;
        const roles: Record<string, SourceRole> = { ...(entrada.pinnedSourceRoles ?? {}) };
        for (const id of faltan) {
            const fuente = paper.sources.find(s => s.id === id)!;
            roles[id] = resolveSourceRole(fuente).role ?? 'technical';
        }
        const nombres = faltan.map(id => {
            const f = paper.sources.find(s => s.id === id)!;
            return f.citationKey?.trim() || f.displayLabel;
        }).join(', ');
        const aviso = paper.displayLanguage === 'en'
            ? `Also included for its pages on this step's question: ${nombres}.`
            : `También entra${faltan.length > 1 ? 'n' : ''} por sus páginas sobre la pregunta del paso: ${nombres}.`;
        perStep[step.id] = {
            ...entrada,
            pinnedSources: [...entrada.pinnedSources, ...faltan],
            pinnedSourceRoles: roles,
            note: entrada.note ? `${entrada.note} ${aviso}` : aviso,
        };
    }
}

function buildPlannerStepInput(
    step: ExegeticalStep,
    paper: ExegeticalPaper,
    questions: ReadonlyArray<string>,
    evidence: ReadonlyArray<ProposeStepCorpusEvidence> = [],
): ProposeStepCorpusStepInput {
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
        ...(evidence.length > 0 ? { evidence } : {}),
    };
}
