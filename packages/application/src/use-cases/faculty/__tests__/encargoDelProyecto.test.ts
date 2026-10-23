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
