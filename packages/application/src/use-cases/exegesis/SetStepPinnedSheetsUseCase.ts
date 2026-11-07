import type { IExegeticalPaperRepository, StepSourcePlanEntry } from '@dosfilos/domain';
import { exclusionFor, isCitableSourceType } from '@dosfilos/domain';

export interface SetStepPinnedSheetsInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    sourceId: string;
    /** Las hojas que se fijan o se sueltan. */
    sheets: ReadonlyArray<number>;
    /** `true` fija; `false` suelta. */
    pin: boolean;
}

/**
 * Fija hojas de una fuente para UN paso (fase «Del corpus al texto», PR 2).
 * Llegan con espacio reservado a ese paso y a ningún otro (`effectiveScope`).
 *
 * Las tres listas tienen una regla: lo suprimido en el paso y lo vetado en el
 * trabajo mandan, y sus hojas no se fijan. Una fuente no citable (la guía de
 * estilo) tampoco: no se cita, y fijarla solo le quitaría lugar al corpus.
 */
export class SetStepPinnedSheetsUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: SetStepPinnedSheetsInput): Promise<StepSourcePlanEntry> {
        if (!input.ownerId || !input.paperId || !input.stepId || !input.sourceId) {
            throw new Error('SetStepPinnedSheetsUseCase: ownerId, paperId, stepId y sourceId requeridos');
        }
        // Soltar no pide validar: una fuente que salió o se vetó también se suelta.
        if (input.pin) {
            const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
            if (!paper) throw new Error(`Paper ${input.paperId} not found`);
            const fuente = paper.sources.find(s => s.id === input.sourceId);
            if (!fuente) throw new Error(`Source ${input.sourceId} not in paper ${input.paperId}`);
            if (!isCitableSourceType(fuente.sourceType)) throw new Error(`Source ${input.sourceId} is not citable`);
            if (paper.stepPlan.perStep[input.stepId]?.suppressedSources?.includes(input.sourceId)) {
                throw new Error(`Source ${input.sourceId} is suppressed in step ${input.stepId}`);
            }
            if (exclusionFor({ author: null, citationKey: fuente.citationKey ?? fuente.displayLabel }, paper.excludedSources)) {
                throw new Error(`Source ${input.sourceId} is excluded from paper ${input.paperId}`);
            }
        }
        const sheets = [...new Set(input.sheets)].filter(h => Number.isInteger(h) && h > 0);
        return this.paperRepository.changeStepPinnedSheets(input.ownerId, input.paperId, input.stepId, input.sourceId, { pin: input.pin, sheets });
    }
}
