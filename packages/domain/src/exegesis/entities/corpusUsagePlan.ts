import type { ExegeticalPaper } from './ExegeticalPaper';
import type { ProjectSource } from './ProjectSource';

/**
 * v1.7 — Corpus usage planning helpers built on top of the existing
 * `StepSourcePlan.perStep[*].pinnedSources` structure.
 *
 * The planning step itself is implemented as an LLM proposer
 * (infrastructure) + use case (application) that populates
 * `pinnedSources` per generation step. These helpers cover the
 * domain-pure read operations the UI and other use cases need:
 *
 *   - `isStepPlanStale` — has the corpus changed since the planner
 *     last ran? Drives the non-blocking banner.
 *   - `computeCorpusCoverageReport` — post-assembly comparison of
 *     planned vs. actually-cited sources. Drives the coverage
 *     report on the paper detail / assembly view.
 */

/**
 * True when the paper's current corpus differs from the snapshot the
 * planner saw when it last proposed `pinnedSources`. Returns false in
 * either of these cases:
 *   - No snapshot was ever recorded (`proposalCorpusSourceIds` absent)
 *     — the planner never ran, so there's nothing to be stale against.
 *   - The current source-id set matches the snapshot exactly.
 *
 * Order of source ids does NOT matter — we compare as sets.
 */
export function isStepPlanStale(paper: ExegeticalPaper): boolean {
    const snapshot = paper.stepPlan.proposalCorpusSourceIds;
    if (snapshot === undefined) return false;
    const currentIds = new Set(paper.sources.map(s => s.id));
    const snapshotIds = new Set(snapshot);
    if (currentIds.size !== snapshotIds.size) return true;
    for (const id of currentIds) {
        if (!snapshotIds.has(id)) return true;
    }
    return false;
}

/**
 * Per-source row of the coverage report. Surfaced on the paper detail
 * page after the user starts assembling. Covers the four states the
 * v1.7 spec defined.
 */
export interface CorpusCoverageRow {
    sourceId: string;
    /** Display label from the source (`ProjectSource.displayLabel`). */
    label: string;
    /** Step ids the source was assigned to in `pinnedSources`. */
    plannedStepIds: ReadonlyArray<string>;
    /** Step ids whose accepted markdown actually mentions the source's `citationKey`. */
    citedStepIds: ReadonlyArray<string>;
    /**
     * One of:
     *   - `'planned-and-cited'` — green ✓. Plan honored.
     *   - `'planned-not-cited'` — amber ⚠. LLM skipped despite plan;
     *     suggest regenerating the affected step.
     *   - `'cited-not-planned'` — neutral ℹ. LLM adapted; the user can
     *     decide whether to formalize this in a re-plan.
     *   - `'never-cited'` — red 🗑. The source went unused entirely;
     *     candidate for removal from the corpus.
     */
    status: 'planned-and-cited' | 'planned-not-cited' | 'cited-not-planned' | 'never-cited';
}

/**
 * Build the coverage report by comparing what was PLANNED
 * (`paper.stepPlan.perStep[*].pinnedSources`) against what was
 * actually CITED in the accepted step markdown.
 *
 * Citation detection is heuristic: we look for the source's
 * `citationKey` (when present) or `displayLabel` as a substring of
 * the step's accepted markdown. False positives are possible (the
 * label "Wallace" might appear in a verse text unrelated to citation),
 * but for the report's purpose — a coverage SIGNAL, not a
 * verification — that level of fidelity is acceptable. The user's
 * judgment closes the loop.
 *
 * Returns one row per source in `paper.sources`, in the source's
 * natural `order`. Empty paper.sources returns an empty array.
 */
export function computeCorpusCoverageReport(paper: ExegeticalPaper): ReadonlyArray<CorpusCoverageRow> {
    const sortedSources = [...paper.sources].sort((a, b) => a.order - b.order);
    return sortedSources.map(source => buildCoverageRow(source, paper));
}

function buildCoverageRow(source: ProjectSource, paper: ExegeticalPaper): CorpusCoverageRow {
    const plannedStepIds: string[] = [];
    for (const [stepId, entry] of Object.entries(paper.stepPlan.perStep)) {
        if (entry.pinnedSources.includes(source.id)) {
            plannedStepIds.push(stepId);
        }
    }

    // Citation detection: substring-match the source's citationKey or
    // displayLabel against each accepted step's content. Two haystacks
    // are unioned so canonical-pipeline verses (whose citations live in
    // the structured `canonicalAnalysis` payload — sourceKey fields
    // inside commentatorEngagement, lexicalAnalyses, translationCruxes,
    // footnoteSeeds, etc.) count as cited even when the legacy
    // `markdown` is empty (the academic prose composer hasn't run yet).
    // Cheap and good enough for the report's SIGNAL purpose; the user
    // closes the loop.
    const citedStepIds: string[] = [];
    const needles = [source.citationKey, source.displayLabel]
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map(s => s.toLowerCase());
    for (const step of paper.steps) {
        const accepted = step.accepted;
        if (!accepted) continue;
        const haystacks: string[] = [];
        if (accepted.markdown) {
            haystacks.push(accepted.markdown.toLowerCase());
        }
        if (accepted.canonicalAnalysis) {
            // JSON-serialize the structured payload — `sourceKey`
            // strings inside any nested array land in the haystack
            // verbatim, so substring-matching still works.
            haystacks.push(JSON.stringify(accepted.canonicalAnalysis).toLowerCase());
        }
        if (haystacks.length === 0) continue;
        if (needles.some(n => haystacks.some(h => h.includes(n)))) {
            citedStepIds.push(step.id);
        }
    }

    const status = classifyCoverageStatus(plannedStepIds, citedStepIds);
    return {
        sourceId: source.id,
        label: source.displayLabel,
        plannedStepIds,
        citedStepIds,
        status,
    };
}

function classifyCoverageStatus(
    plannedStepIds: ReadonlyArray<string>,
    citedStepIds: ReadonlyArray<string>,
): CorpusCoverageRow['status'] {
    const planned = plannedStepIds.length > 0;
    const cited = citedStepIds.length > 0;
    if (planned && cited) return 'planned-and-cited';
    if (planned && !cited) return 'planned-not-cited';
    if (!planned && cited) return 'cited-not-planned';
    return 'never-cited';
}

/**
 * El plan de cada paso sin una fuente que salió del corpus.
 *
 * Quitar una fuente del corpus dejaba su id en el plan: el selector la
 * mostraba como un id crudo («64a71b9d-…», TP #6) y cualquier edición de esa
 * fila fallaba, porque el caso de uso rechaza ids que no están en el corpus.
 * Genérico sobre la entrada: corre igual sobre el documento crudo de
 * Firestore que sobre la entidad.
 */
export function stepPlanWithoutSource<E extends {
    pinnedSources?: ReadonlyArray<string>;
    suppressedSources?: ReadonlyArray<string>;
    pinnedSourceRoles?: Readonly<Record<string, string>>;
}>(perStep: Readonly<Record<string, E>>, sourceId: string): Record<string, E> {
    const out: Record<string, E> = {};
    for (const [stepId, entry] of Object.entries(perStep)) {
        const roles = entry.pinnedSourceRoles ? { ...entry.pinnedSourceRoles } : undefined;
        if (roles) delete roles[sourceId];
        out[stepId] = {
            ...entry,
            ...(entry.pinnedSources ? { pinnedSources: entry.pinnedSources.filter(id => id !== sourceId) } : {}),
            ...(entry.suppressedSources ? { suppressedSources: entry.suppressedSources.filter(id => id !== sourceId) } : {}),
            ...(roles ? { pinnedSourceRoles: roles } : {}),
        };
    }
    return out;
}

/** Las fuentes fijadas a un paso que siguen en el corpus (sin fantasmas). */
export function pinnedSourcesInCorpus(
    pinned: ReadonlyArray<string> | undefined,
    sources: ReadonlyArray<Pick<ProjectSource, 'id'>>,
): string[] {
    const vigentes = new Set(sources.map(s => s.id));
    return (pinned ?? []).filter(id => vigentes.has(id));
}
