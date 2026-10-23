import { describe, it, expect, vi } from 'vitest';
import { EMPTY_STEP_SOURCE_PLAN } from '@dosfilos/domain';
import { UpdateStepStudentReadingUseCase } from '../UpdateStepStudentReadingUseCase';
import { UpdateStepCorpusAllocationUseCase } from '../UpdateStepCorpusAllocationUseCase';

/** Etapa 2, capa 3: «Mi lectura» se guarda y nada que edite el corpus la borra. */
const entrada = { stepId: 's1', kind: 'verse', emphasis: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] }, pinnedSources: [], suppressedSources: [], note: 'nota del plan' };
const papel = (perStep: Record<string, unknown> = {}) => ({
    id: 'p', steps: [{ id: 's1', kind: 'verse' }], sources: [{ id: 'src1', sourceType: 'grammar-syntax' }],
    stepPlan: { ...EMPTY_STEP_SOURCE_PLAN, perStep, proposalCorpusSourceIds: undefined },
});
const repo = (paper: unknown) => ({ getPaper: vi.fn(async () => paper), setStepPlan: vi.fn(async (_o: string, _p: string, plan: unknown) => plan) });

describe('Mi lectura', () => {
    it('se guarda recortada en la entrada del paso, sin tocar la nota ni dejar undefined', async () => {
        const r = repo(papel({ s1: entrada }));
        await new UpdateStepStudentReadingUseCase(r as never).execute({ ownerId: 'u', paperId: 'p', stepId: 's1', studentReading: '  μή + presente: dejar de murmurar  ' });
        const plan = r.setStepPlan.mock.calls[0]![2] as { perStep: Record<string, { studentReading?: string; note: string }> };
        expect(plan.perStep.s1).toMatchObject({ studentReading: 'μή + presente: dejar de murmurar', note: 'nota del plan' });
        expect(plan).not.toHaveProperty('proposalCorpusSourceIds');
    });

    it('vacía la quita; un paso sin entrada nace con una', async () => {
        const r = repo(papel({ s1: { ...entrada, studentReading: 'antes' } }));
        await new UpdateStepStudentReadingUseCase(r as never).execute({ ownerId: 'u', paperId: 'p', stepId: 's1', studentReading: '   ' });
        expect((r.setStepPlan.mock.calls[0]![2] as { perStep: Record<string, object> }).perStep.s1).not.toHaveProperty('studentReading');
        const r2 = repo(papel());
        await new UpdateStepStudentReadingUseCase(r2 as never).execute({ ownerId: 'u', paperId: 'p', stepId: 's1', studentReading: 'nueva' });
        expect((r2.setStepPlan.mock.calls[0]![2] as { perStep: Record<string, object> }).perStep.s1).toMatchObject({ stepId: 's1', kind: 'verse', pinnedSources: [], studentReading: 'nueva' });
    });

    it('editar las fuentes del paso no la borra', async () => {
        const r = repo(papel({ s1: { ...entrada, studentReading: 'mi lectura' } }));
        await new UpdateStepCorpusAllocationUseCase(r as never).execute({ ownerId: 'u', paperId: 'p', stepId: 's1', pinnedSources: ['src1'] } as never);
        expect((r.setStepPlan.mock.calls[0]![2] as { perStep: Record<string, object> }).perStep.s1).toMatchObject({ studentReading: 'mi lectura', pinnedSources: ['src1'] });
    });
});
