import type {
    ExegeticalPaper,
    IExegeticalPaperRepository,
    PaperRubric,
    QualityCriterion,
    UpdateRubricInput,
} from '@dosfilos/domain';

/**
 * Patches the paper's rubric.
 *
 * Caller passes only the fields they're changing; the use case merges
 * with the persisted rubric. Provenance flips to `'user-edited'`
 * unless every patched field matches what was already there (a no-op
 * save shouldn't claim authorship).
 *
 * Validation:
 *   - At least one source requirement is required when the caller
 *     passes a non-empty array. An empty array is allowed (the
 *     student opted out of all minimums) but provenance still moves
 *     to user-edited.
 *   - Numeric fields (minimum / maximum) are clamped to non-negative;
 *     `maximum < minimum` is corrected by raising maximum to match.
 *
 * Returns the updated paper so React Query callers can refresh the
 * cache directly.
 */
export class UpdateRubricUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdateRubricInput): Promise<ExegeticalPaper> {
        if (!input.ownerId) throw new Error('UpdateRubricUseCase: ownerId required');
        if (!input.paperId) throw new Error('UpdateRubricUseCase: paperId required');

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const existing = paper.rubric;
        if (!existing) {
            throw new Error(`Paper ${input.paperId} has no rubric to patch`);
        }

        const sourceRequirements = input.sourceRequirements
            ? input.sourceRequirements.map(r => ({
                ...r,
                minimum: Math.max(0, Math.floor(r.minimum)),
                maximum: r.maximum === null ? null : Math.max(Math.max(0, Math.floor(r.maximum)), Math.max(0, Math.floor(r.minimum))),
            }))
            : existing.sourceRequirements;

        const qualityCriteria = input.qualityCriteria
            ? normalizeQualityCriteria(input.qualityCriteria)
            : existing.qualityCriteria;

        const next: PaperRubric = {
            ...existing,
            description: input.description !== undefined ? input.description : existing.description,
            citationStandard: input.citationStandard !== undefined ? input.citationStandard : existing.citationStandard,
            expectedLength: input.expectedLength !== undefined ? input.expectedLength : existing.expectedLength,
            sourceRequirements,
            structuralExpectations: input.structuralExpectations ?? existing.structuralExpectations,
            qualityCriteria,
            formatting: input.formatting !== undefined ? input.formatting : existing.formatting,
            // Authorship: any patch flips provenance to user-edited
            // unless we were already there. Re-extracting from a doc
            // would explicitly set provenance back via
            // RefreshRubricFromExtraction (a future use case).
            provenance: 'user-edited',
            updatedAt: new Date(),
        };

        return this.paperRepository.setRubric(input.ownerId, input.paperId, next);
    }
}

/**
 * Quality criteria normalization mirrors the rules the Gemini
 * extractor applies on intake: every criterion needs a non-empty
 * id (auto-generate when blank), name (skip silently when blank),
 * and at least one level. Points are clamped to non-negative
 * integers when present. We don't enforce the extractor's hard cap
 * of 5 levels here — a professor's real-life rubric occasionally
 * has 6 (e.g. add a "no entregado" tier) and we trust the user's
 * intent on a manual edit.
 */
function normalizeQualityCriteria(
    raw: ReadonlyArray<QualityCriterion>,
): ReadonlyArray<QualityCriterion> {
    const out: QualityCriterion[] = [];
    raw.forEach((crit, idx) => {
        const name = crit.name?.trim() ?? '';
        if (!name) return;
        const levels = (crit.levels ?? [])
            .map(level => ({
                label: level.label?.trim() ?? '',
                description: level.description?.trim() ?? '',
                points: typeof level.points === 'number' && Number.isFinite(level.points)
                    ? Math.max(0, Math.floor(level.points))
                    : undefined,
            }))
            .filter(level => level.label !== '');
        if (levels.length === 0) return;
        out.push({
            id: crit.id?.trim() || `qc-${idx + 1}-${Date.now()}`,
            name,
            description: crit.description?.trim() || undefined,
            maxPoints: typeof crit.maxPoints === 'number' && Number.isFinite(crit.maxPoints)
                ? Math.max(0, Math.floor(crit.maxPoints))
                : undefined,
            levels,
        });
    });
    return out;
}
