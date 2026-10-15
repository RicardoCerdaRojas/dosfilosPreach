import { describe, expect, it, vi } from 'vitest';
import { UpdateStepPlanUseCase } from '../UpdateStepPlanUseCase';
import type { ExegeticalPaper, IExegeticalPaperRepository, StepSourcePlan } from '@dosfilos/domain';

/**
 * TP #7 (#25): guardar el plan estructural («Versos: comentario expositivo»)
 * hacía desaparecer el plan de uso de la vista. El caso de uso armaba el plan
 * nuevo sin `proposedAt` ni `proposalCorpusSourceIds`, la marca de que ya hay
 * una propuesta.
 */
const PROPUESTO = new Date('2026-10-14T16:00:00Z');

describe('guardar el plan estructural conserva la propuesta del plan de uso', () => {
    it('proposedAt y las fuentes de la propuesta siguen ahí', async () => {
        const setStepPlan = vi.fn(async (_o: string, _p: string, plan: StepSourcePlan) => plan as never);
        const repo = {
            getPaper: async () => ({
                id: 'p1',
                stepPlan: {
                    perStep: { s1: { stepId: 's1' } },
                    defaults: { verse: null, conclusion: null, introduction: null },
                    updatedAt: PROPUESTO,
                    proposedAt: PROPUESTO,
                    proposalCorpusSourceIds: ['mccartney', 'ropes'],
                },
            }) as unknown as ExegeticalPaper,
            setStepPlan,
        } as unknown as IExegeticalPaperRepository;

        await new UpdateStepPlanUseCase(repo).execute({
            ownerId: 'o', paperId: 'p1',
            verse: { emphasizedTypes: ['commentary-expository'], deemphasizedTypes: [], citationOverrides: [] },
        } as never);

        const plan = setStepPlan.mock.calls[0]![2] as StepSourcePlan;
        expect(plan.proposedAt).toBe(PROPUESTO);
        expect(plan.proposalCorpusSourceIds).toEqual(['mccartney', 'ropes']);
        expect(plan.perStep.s1).toBeDefined();
        expect(plan.defaults.verse?.emphasizedTypes).toEqual(['commentary-expository']);
    });
});

/**
 * TP #7 (#18): la rúbrica pedía «Comentario expositivo ≥1» y la sugerencia
 * para «Versos» no lo traía; el ancla quedó en 0.
 */
describe('la sugerencia de los versos trae lo que la rúbrica exige', () => {
    const conRubrica = (sourceRequirements: unknown[]) => ({
        structuralExpectations: [{ section: 'verse', emphasizedTypes: ['commentary-critical', 'grammar-syntax'], justification: '' }],
        rubric: { sourceRequirements },
    }) as unknown as ExegeticalPaper;

    it('agrega al final el tipo exigido que falta', () => {
        const s = UpdateStepPlanUseCase.rubricDefaultEmphasis(conRubrica([
            { sourceType: 'commentary-expository', minimum: 1 },
            { sourceType: 'grammar-syntax', minimum: 1 },
        ]), 'verse');
        // El primero no cambia: decide el modo del trabajo.
        expect(s.emphasizedTypes).toEqual(['commentary-critical', 'grammar-syntax', 'commentary-expository']);
    });

    it('lo opcional y lo que no se cita en un verso no entran', () => {
        const s = UpdateStepPlanUseCase.rubricDefaultEmphasis(conRubrica([
            { sourceType: 'commentary-expository', minimum: 0 },
            { sourceType: 'historical-background', minimum: 1 },
        ]), 'verse');
        expect(s.emphasizedTypes).toEqual(['commentary-critical', 'grammar-syntax']);
    });

    it('la introducción no cambia', () => {
        const paper = {
            structuralExpectations: [{ section: 'introduction', emphasizedTypes: ['historical-background'], justification: '' }],
            rubric: { sourceRequirements: [{ sourceType: 'commentary-expository', minimum: 1 }] },
        } as unknown as ExegeticalPaper;
        expect(UpdateStepPlanUseCase.rubricDefaultEmphasis(paper, 'introduction').emphasizedTypes).toEqual(['historical-background']);
    });
});
