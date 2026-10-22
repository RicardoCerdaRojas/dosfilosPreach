import { describe, it, expect, vi } from 'vitest';
import { SetPaperProjectUseCase } from '../SetPaperProjectUseCase';

/**
 * ADR-046, etapa 1: un estudio tiene un proyecto de origen (manda en su
 * encargo) y varios vinculados (lo usan sin cambiarle las reglas).
 */
function montar(paper: Record<string, unknown>, proyectos: Record<string, Record<string, unknown>> = {}) {
    const actual = { id: 'p1', ownerId: 'u1', projectId: null, linkedProjectIds: [], ...paper };
    const repo = {
        getPaper: vi.fn(async () => actual),
        setProjectLinks: vi.fn(async (_o: string, _p: string, change: Record<string, unknown>) => ({ ...actual, ...change })),
    };
    const projects = { getProject: vi.fn(async (id: string) => proyectos[id] ?? null) };
    return { uc: new SetPaperProjectUseCase(repo as never, projects as never), repo };
}
const curso = { id: 'curso', userId: 'u1' };
const serie = { id: 'serie', userId: 'u1' };

describe('SetPaperProjectUseCase', () => {
    it('pone el proyecto de origen', async () => {
        const { uc, repo } = montar({}, { curso });
        await uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'origin', projectId: 'curso' } });
        expect(repo.setProjectLinks).toHaveBeenCalledWith('u1', 'p1', { projectId: 'curso' });
    });

    it('hacer origen a un proyecto vinculado lo saca de los vínculos', async () => {
        const { uc, repo } = montar({ linkedProjectIds: ['curso'] }, { curso });
        await uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'origin', projectId: 'curso' } });
        expect(repo.setProjectLinks).toHaveBeenCalledWith('u1', 'p1', { projectId: 'curso', unlink: 'curso' });
    });

    it('quitar el origen no pide proyecto', async () => {
        const { uc, repo } = montar({ projectId: 'curso' });
        await uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'origin', projectId: null } });
        expect(repo.setProjectLinks).toHaveBeenCalledWith('u1', 'p1', { projectId: null });
    });

    it('vincular agrega; vincular el de origen o uno ya vinculado no hace nada', async () => {
        const a = montar({ projectId: 'curso', linkedProjectIds: ['serie'] }, { curso, serie, otra: { id: 'otra', userId: 'u1' } });
        await a.uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'link', projectId: 'otra' } });
        expect(a.repo.setProjectLinks).toHaveBeenCalledWith('u1', 'p1', { link: 'otra' });
        a.repo.setProjectLinks.mockClear();
        await a.uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'link', projectId: 'curso' } });
        await a.uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'link', projectId: 'serie' } });
        expect(a.repo.setProjectLinks).not.toHaveBeenCalled();
    });

    it('desvincular solo quita vínculos, nunca el origen', async () => {
        const { uc, repo } = montar({ projectId: 'curso', linkedProjectIds: ['serie'] }, { curso, serie });
        await uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'unlink', projectId: 'curso' } });
        expect(repo.setProjectLinks).not.toHaveBeenCalled();
        await uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'unlink', projectId: 'serie' } });
        expect(repo.setProjectLinks).toHaveBeenCalledWith('u1', 'p1', { unlink: 'serie' });
    });

    it('un proyecto ajeno, inexistente o en la papelera se rechaza', async () => {
        const { uc, repo } = montar({}, { ajeno: { id: 'ajeno', userId: 'otro' }, basura: { id: 'basura', userId: 'u1', deletedAt: new Date() } });
        for (const projectId of ['ajeno', 'basura', 'nada']) {
            await expect(uc.execute({ ownerId: 'u1', paperId: 'p1', change: { kind: 'origin', projectId } })).rejects.toThrow(/no disponible/);
        }
        expect(repo.setProjectLinks).not.toHaveBeenCalled();
    });
});
