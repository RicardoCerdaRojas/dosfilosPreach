import { describe, it, expect, vi } from 'vitest';
import { UpdateProjectUseCase } from '../UpdateProjectUseCase';

describe('UpdateProjectUseCase — datos del curso y tipos de trabajo (etapa 1b)', () => {
    it('guarda los datos del curso limpios, y null los quita', async () => {
        const repo = { updateProject: vi.fn(async (_id: string, u: unknown) => u) };
        const uc = new UpdateProjectUseCase(repo as never);
        await uc.execute('p1', { courseInfo: { styleGuideId: 'g1', course: ' ' } });
        expect(repo.updateProject).toHaveBeenLastCalledWith('p1', { courseInfo: { styleGuideId: 'g1', course: null } });
        await uc.execute('p1', { courseInfo: null });
        expect(repo.updateProject).toHaveBeenLastCalledWith('p1', { courseInfo: null });
    });

    it('guarda los tipos de trabajo sin undefined, y [] los quita', async () => {
        const repo = { updateProject: vi.fn(async (_id: string, u: unknown) => u) };
        const uc = new UpdateProjectUseCase(repo as never);
        await uc.execute('p1', { workTypes: [{ id: 'tp', label: ' TP ', rubricTemplateId: undefined, styleGuideId: 'g1' }] });
        expect(repo.updateProject).toHaveBeenLastCalledWith('p1', { workTypes: [{ id: 'tp', label: 'TP', styleGuideId: 'g1' }] });
        await uc.execute('p1', { workTypes: [] });
        expect(repo.updateProject).toHaveBeenLastCalledWith('p1', { workTypes: [] });
    });
});

describe('UpdateProjectUseCase — bibliografía (etapa 2)', () => {
    const ficha = (over: Record<string, unknown>) => ({ id: 'f', title: 'Obra', weight: 'recommended', decision: 'approved', origins: ['manual'], ...over }) as never;

    it('guardar la bibliografía reescribe sourceIds con las aprobadas en la biblioteca', async () => {
        const repo = { updateProject: vi.fn(async (_id: string, u: unknown) => u) };
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            sourceIds: ['viejo'],
            bibliography: [ficha({ id: 'a', resourceId: 'r1' }), ficha({ id: 'b', resourceId: 'r2', decision: 'candidate' }), ficha({ id: 'c', resourceId: null })],
        });
        const u = repo.updateProject.mock.calls[0]![1] as { sourceIds: string[]; bibliography: unknown[] };
        expect(u.sourceIds).toEqual(['r1']);
        expect(u.bibliography).toHaveLength(3);
    });

    it('sin bibliografía, sourceIds se guarda como antes; los criterios se limpian', async () => {
        const repo = { updateProject: vi.fn(async (_id: string, u: unknown) => u) };
        await new UpdateProjectUseCase(repo as never).execute('p1', { sourceIds: ['a'], bibliographyCriteria: { inclusion: '  ', noRepeatSources: true } });
        expect(repo.updateProject).toHaveBeenLastCalledWith('p1', { sourceIds: ['a'], bibliographyCriteria: { inclusion: null, noRepeatSources: true } });
    });
});
