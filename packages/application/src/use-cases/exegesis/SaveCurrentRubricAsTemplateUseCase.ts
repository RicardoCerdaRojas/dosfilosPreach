import type {
    IExegeticalPaperRepository,
    IUserRubricRepository,
    UserRubric,
} from '@dosfilos/domain';

/**
 * Snapshots the paper's current `paper.rubric` into a NEW
 * `UserRubric` template at the user level. The template name is
 * provided by the caller (the UI should suggest a default like
 * the paper's title).
 *
 * The paper itself is NOT modified — its embedded rubric stays
 * exactly as it was. The student now has a reusable copy in
 * their library.
 *
 * Idempotent only by name: re-saving a paper's rubric creates
 * ANOTHER template entry. The UI should warn / dedupe before
 * calling if it wants to prevent duplicates.
 */
export class SaveCurrentRubricAsTemplateUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private rubricRepository: IUserRubricRepository,
    ) { }

    async execute(input: {
        ownerId: string;
        paperId: string;
        displayName: string;
        markAsDefault?: boolean;
    }): Promise<UserRubric> {
        if (!input.ownerId) throw new Error('SaveCurrentRubricAsTemplateUseCase: ownerId required');
        if (!input.paperId) throw new Error('SaveCurrentRubricAsTemplateUseCase: paperId required');
        if (!input.displayName?.trim()) {
            throw new Error('SaveCurrentRubricAsTemplateUseCase: displayName required');
        }

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);
        if (!paper.rubric) {
            throw new Error(`Paper ${input.paperId} has no rubric to save as template`);
        }

        const created = await this.rubricRepository.createRubric({
            ownerId: input.ownerId,
            displayName: input.displayName.trim(),
            isDefault: !!input.markAsDefault,
            rubric: paper.rubric,
        });

        // Stamp the new template's id on the paper's rubric so the
        // template picker pre-selects it on the next render — without
        // this, the user just saved "Trabajo Exegético TMS" but the
        // dropdown still shows "— elige una plantilla —", which reads
        // as if nothing happened.
        await this.paperRepository.setRubric(input.ownerId, input.paperId, {
            ...paper.rubric,
            sourceTemplateId: created.id,
            updatedAt: new Date(),
        });

        return created;
    }
}
