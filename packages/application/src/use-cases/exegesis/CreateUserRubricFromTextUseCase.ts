import {
    buildDefaultRubric,
    type IPaperRubricExtractor,
    type IUserRubricRepository,
    type PaperRubric,
    type UserRubric,
} from '@dosfilos/domain';

/**
 * Standalone "create rubric from pasted text" flow that lands a
 * `UserRubric` directly in the user's library, bypassing any
 * specific paper.
 *
 * Two modes:
 *   - `rawText` provided → run the Gemini extractor → save its
 *     result as a UserRubric.
 *   - `rawText` omitted → seed with the system default rubric;
 *     the user can edit later via UpdateUserRubric.
 *
 * Why this exists alongside `ExtractRubricFromTextUseCase`:
 *   The latter persists onto a specific paper's `paper.rubric`
 *   field. Library-bound creation is a different concern (no
 *   paper context), so we expose a parallel use case rather than
 *   overloading the paper-bound one.
 */
export class CreateUserRubricFromTextUseCase {
    constructor(
        private rubricRepository: IUserRubricRepository,
        private rubricExtractor: IPaperRubricExtractor,
    ) { }

    async execute(input: {
        ownerId: string;
        displayName: string;
        rawText?: string;
        language?: 'es' | 'en';
        markAsDefault?: boolean;
    }): Promise<UserRubric> {
        if (!input.ownerId) throw new Error('CreateUserRubricFromTextUseCase: ownerId required');
        if (!input.displayName?.trim()) {
            throw new Error('CreateUserRubricFromTextUseCase: displayName required');
        }

        let rubric: PaperRubric;
        if (input.rawText && input.rawText.trim().length >= 30) {
            // Gratis: va por una etiqueta del proxy que no cobra (el cobro de
            // exégesis vive en el servidor y exige reserva para `extractRubric`).
            const extracted = await this.rubricExtractor.extract({
                rawText: input.rawText.trim(),
                source: 'text',
                sourceCorpusId: null,
                language: input.language ?? 'es',
                gratuita: true,
            });
            const now = new Date();
            rubric = {
                ...extracted.rubric,
                createdAt: now,
                updatedAt: now,
            };
        } else {
            rubric = buildDefaultRubric();
        }

        // First template the user creates auto-defaults so the next
        // paper picks it up; subsequent templates need explicit
        // markAsDefault.
        let isDefault = !!input.markAsDefault;
        if (input.markAsDefault === undefined) {
            const existing = await this.rubricRepository.listRubrics(input.ownerId);
            isDefault = existing.length === 0;
        }

        return this.rubricRepository.createRubric({
            ownerId: input.ownerId,
            displayName: input.displayName.trim(),
            isDefault,
            rubric,
        });
    }
}
