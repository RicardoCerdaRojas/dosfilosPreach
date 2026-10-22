import { describe, it, expect, vi } from 'vitest';
import { UpdateProjectUseCase } from '../UpdateProjectUseCase';

describe('UpdateProjectUseCase — encargo', () => {
    it('guarda el encargo limpio, y null lo quita', async () => {
        const repo = { updateProject: vi.fn(async (_id: string, u: unknown) => u) };
        const uc = new UpdateProjectUseCase(repo as never);
        await uc.execute('p1', { charge: { styleGuideId: 'g1', rubricTemplateId: undefined, course: ' ' } });
        expect(repo.updateProject).toHaveBeenLastCalledWith('p1', { charge: { styleGuideId: 'g1', course: null } });
        await uc.execute('p1', { charge: null });
        expect(repo.updateProject).toHaveBeenLastCalledWith('p1', { charge: null });
    });
});
