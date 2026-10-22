import { describe, it, expect, vi } from 'vitest';
import { DeleteProjectUseCase } from '../DeleteProjectUseCase';

/** ADR-046: borrar un proyecto no deja estudios apuntando a él. */
describe('DeleteProjectUseCase', () => {
    it('suelta los estudios (origen y vínculos) antes de borrar el proyecto', async () => {
        const orden: string[] = [];
        const projects = { deleteProject: vi.fn(async () => { orden.push('borrar'); }) };
        const chats = { clearProjectFromSessions: vi.fn(async () => { orden.push('chats'); }) };
        const extracciones = { orphanByProject: vi.fn(async () => { orden.push('extracciones'); }) };
        const papers = { detachProject: vi.fn(async () => { orden.push('estudios'); return 2; }) };
        await new DeleteProjectUseCase(projects as never, chats as never, extracciones as never, papers).execute('u1', 'curso');
        expect(papers.detachProject).toHaveBeenCalledWith('u1', 'curso');
        expect(orden.at(-1)).toBe('borrar');
    });
});
