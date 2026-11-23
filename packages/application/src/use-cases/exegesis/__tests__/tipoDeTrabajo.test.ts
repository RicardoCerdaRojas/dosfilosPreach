import { describe, expect, it, vi } from 'vitest';
import { UpdatePaperProfileKindUseCase } from '../UpdatePaperProfileKindUseCase';

describe('UpdatePaperProfileKindUseCase', () => {
    it('guarda el tipo elegido o confirmado', async () => {
        const repo = { updatePaper: vi.fn().mockResolvedValue({ id: 'p1' }) };
        await new UpdatePaperProfileKindUseCase(repo as never).execute({ ownerId: 'o1', paperId: 'p1', profileKind: 'sintesis-sermon' });
        expect(repo.updatePaper).toHaveBeenCalledWith('o1', 'p1', { profileKind: 'sintesis-sermon' });
    });
    it('un tipo desconocido no se guarda', async () => {
        const repo = { updatePaper: vi.fn() };
        await expect(new UpdatePaperProfileKindUseCase(repo as never).execute({ ownerId: 'o1', paperId: 'p1', profileKind: 'sermon' as never })).rejects.toThrow(/desconocido/);
        expect(repo.updatePaper).not.toHaveBeenCalled();
    });
});
