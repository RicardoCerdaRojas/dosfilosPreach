import {
    buildPreachingStudyRubric,
    buildStrategyOnlyRubric,
    STRATEGY_ONLY_RUBRIC_PRESET_ID,
    type CreateExegeticalPaperInput,
    type ExegeticalPaper,
    type IExegeticalPaperRepository,
    type IUserRubricRepository,
    type PaperRubric,
    DEFAULT_STRATEGY_FOR_NEW_PAPER,
} from '@dosfilos/domain';

/**
 * Re-export so older callers (web hooks) that imported the sentinel
 * from the application barrel keep working. The domain is the source
 * of truth — see `PaperRubric.ts`.
 */
export { STRATEGY_ONLY_RUBRIC_PRESET_ID };

/**
 * Creates a new exegetical paper in 'configuring' phase.
 *
 * The use case trusts the caller to have validated the passage with
 * `parsePassageReference` or `buildPassageReference` first — it does NOT
 * re-parse. This keeps the boundary clean: parsing is presentation logic
 * (the UI tries multiple inputs); persistence is the use-case concern.
 *
 * `styleGuideId` is allowed to be null in v1 — the orchestrator will
 * reject generation until a guide is attached, but a paper can exist
 * without one.
 *
 * `assignmentBrief` is optional free text the professor or the student
 * provided to frame the paper. Stored verbatim; the orchestrator
 * threads it into every step's system prompt.
 *
 * `rubricTemplateId` resolution order:
 *   1. Explicit `rubricTemplateId` → copy that template's content.
 *   2. Omitted + user has a default template → copy the default.
 *   3. No default (or no rubricRepository wired) → repo's createPaper
 *      seeds the system default rubric.
 *
 * `initialSources` is accepted but currently ignored — sources are
 * collected later through the dedicated setup flow.
 */

/**
 * Normalizes a brief: trims whitespace, returns null for empty
 * strings. Keeps Firestore docs consistent (null vs. empty string is
 * a needless distinction the rest of the system would have to
 * handle).
 */
function normalizeBrief(brief: string | null | undefined): string | null {
    if (brief === undefined || brief === null) return null;
    const trimmed = brief.trim();
    return trimmed.length === 0 ? null : trimmed;
}

export class CreateExegeticalPaperUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        // Optional — when omitted the use case skips template
        // resolution entirely (paper gets the system default
        // rubric seeded by the repo). Wiring it on adds the
        // "auto-apply user default" behavior.
        private userRubricRepository?: IUserRubricRepository,
    ) { }

    async execute(input: CreateExegeticalPaperInput): Promise<ExegeticalPaper> {
        if (!input.ownerId) {
            throw new Error('CreateExegeticalPaperUseCase: ownerId required');
        }
        if (!input.passage) {
            throw new Error('CreateExegeticalPaperUseCase: passage required');
        }

        const created = await this.paperRepository.createPaper({
            ownerId: input.ownerId,
            passage: input.passage,
            displayLanguage: input.displayLanguage,
            exegeticalStrategy: input.exegeticalStrategy ?? DEFAULT_STRATEGY_FOR_NEW_PAPER,
            title: input.title,
            assignmentBrief: normalizeBrief(input.assignmentBrief),
            styleGuideId: input.styleGuideId,
            sources: [],
            seriesId: input.seriesId ?? null,
            pericopeId: input.pericopeId ?? null,
        });

        // Strategy-only preset short-circuits template resolution.
        // The repo seeded `buildDefaultRubric()` (TMS rigorous); we
        // overwrite with `buildStrategyOnlyRubric()` so the role-
        // coverage card falls back to the strategy's typical counts.
        if (input.rubricTemplateId === STRATEGY_ONLY_RUBRIC_PRESET_ID) {
            return this.paperRepository.setRubric(
                input.ownerId,
                created.id,
                buildStrategyOnlyRubric(),
            );
        }

        // Un trabajo de una serie de predicación es un estudio para predicar:
        // nace con esa rúbrica, no con la académica ni con la plantilla por
        // defecto del usuario (que suele ser la de su curso). Jonás 4:5-11 nació
        // con doce páginas y notas al pie. Una plantilla elegida para la serie
        // (`exegesisDefaults.rubricTemplateId`) sí manda.
        if (input.seriesId && !input.rubricTemplateId) {
            return this.paperRepository.setRubric(input.ownerId, created.id, buildPreachingStudyRubric());
        }

        // Resolve and apply rubric template if needed. The repo
        // already seeded `paper.rubric` with the system default, so
        // this only OVERRIDES when a template is explicitly chosen
        // or the user has a default template.
        const resolved = await this.resolveTemplateRubric(input);
        if (resolved) {
            const now = new Date();
            return this.paperRepository.setRubric(input.ownerId, created.id, {
                ...resolved.rubric,
                // Stamp the template id so the setup picker can
                // pre-select it. Survives manual edits via the same
                // preserve-on-update logic the regular apply flow uses.
                sourceTemplateId: resolved.templateId,
                // Same reasoning as ApplyRubricTemplateToPaperUseCase:
                // overwrite the template's inherited provenance so the
                // paper's badge says "from template" instead of
                // whatever the template was originally classified as.
                provenance: 'from-template',
                createdAt: now,
                updatedAt: now,
            });
        }

        return created;
    }

    private async resolveTemplateRubric(
        input: CreateExegeticalPaperInput,
    ): Promise<{ rubric: PaperRubric; templateId: string } | null> {
        if (!this.userRubricRepository) return null;

        // Strategy-only is handled by the caller before this method
        // — it's not a real template.
        if (input.rubricTemplateId === STRATEGY_ONLY_RUBRIC_PRESET_ID) return null;

        // Explicit template wins.
        if (input.rubricTemplateId) {
            const template = await this.userRubricRepository.getRubric(
                input.ownerId,
                input.rubricTemplateId,
            );
            return template ? { rubric: template.rubric, templateId: template.id } : null;
        }

        // Otherwise, fall back to the user's default if any.
        // Explicit `null` is treated as "skip template, use system
        // default" — the UI sends null when the student picked
        // "Crear nueva sin plantilla".
        if (input.rubricTemplateId === null) return null;

        const defaultTemplate = await this.userRubricRepository.getDefaultRubric(input.ownerId);
        return defaultTemplate ? { rubric: defaultTemplate.rubric, templateId: defaultTemplate.id } : null;
    }
}
