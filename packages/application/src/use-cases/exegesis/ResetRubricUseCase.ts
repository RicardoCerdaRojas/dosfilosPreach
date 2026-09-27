import {
    buildDefaultRubric,
    buildPreachingStudyRubric,
    type ExegeticalPaper,
    type IExegeticalPaperRepository,
    type ResetRubricInput,
} from '@dosfilos/domain';

/**
 * Aplica una de las dos rúbricas del sistema, descartando ediciones del
 * alumno o contenido extraído de un documento.
 *
 * Dos, y no una: la académica que este caso de uso restauraba desde siempre, y
 * la de predicación. Los seis sermones de la serie de Jonás corrían con la
 * académica —doce páginas, comentarios críticos como ancla, notas al pie—
 * porque era la única que el sistema sabía aplicar.
 *
 * The setup UI gates this behind a confirmation dialog because the
 * action is destructive. Returning the paper lets React Query
 * refresh the cache without a follow-up read.
 */
export class ResetRubricUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: ResetRubricInput): Promise<ExegeticalPaper> {
        if (!input.ownerId) throw new Error('ResetRubricUseCase: ownerId required');
        if (!input.paperId) throw new Error('ResetRubricUseCase: paperId required');

        const fresh = input.preset === 'preaching'
            ? buildPreachingStudyRubric()
            : buildDefaultRubric();
        return this.paperRepository.setRubric(input.ownerId, input.paperId, fresh);
    }
}
