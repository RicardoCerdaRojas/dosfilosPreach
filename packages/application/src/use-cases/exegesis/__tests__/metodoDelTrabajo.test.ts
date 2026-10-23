import { describe, it, expect, vi } from 'vitest';
import { UpdatePaperMethodUseCase } from '../UpdatePaperMethodUseCase';
import { CreateExegeticalPaperUseCase } from '../CreateExegeticalPaperUseCase';

/** Etapa 2, capa 3: el método se guarda al crear y se puede cambiar después. */
describe('el método del trabajo', () => {
    it('se cambia en un trabajo creado, normalizado', async () => {
        const repo = { updatePaper: vi.fn(async () => ({})) };
        const uc = new UpdatePaperMethodUseCase(repo as never);
        await uc.execute({ ownerId: 'u', paperId: 'p', method: 'mixed' });
        expect(repo.updatePaper).toHaveBeenLastCalledWith('u', 'p', { exegeticalMethod: 'mixed' });
        await uc.execute({ ownerId: 'u', paperId: 'p', method: 'basura' as never });
        expect(repo.updatePaper).toHaveBeenLastCalledWith('u', 'p', { exegeticalMethod: null });
    });

    it('nace con el método elegido; sin elegir, con null (el análisis de siempre)', async () => {
        const repo = { createPaper: vi.fn(async (d: Record<string, unknown>) => ({ id: 'p1', sources: [], ...d })), setRubric: vi.fn(async () => ({ id: 'p1' })), getPaper: vi.fn(), addSource: vi.fn() };
        const uc = new CreateExegeticalPaperUseCase(repo as never);
        const base = { ownerId: 'u', passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 }, displayLanguage: 'es', styleGuideId: null } as const;
        await uc.execute({ ...base, exegeticalMethod: 'mixed' } as never);
        expect(repo.createPaper.mock.calls[0]![0]).toMatchObject({ exegeticalMethod: 'mixed' });
        await uc.execute(base as never);
        expect(repo.createPaper.mock.calls[1]![0]).toMatchObject({ exegeticalMethod: null });
    });
});
