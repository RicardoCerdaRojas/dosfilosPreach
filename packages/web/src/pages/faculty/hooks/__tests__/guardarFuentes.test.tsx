import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/** Etapa 2: el selector de fuentes del tablero pasa por la bibliografía. */
const updateProject = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [{ id: 'bdag', title: 'BDAG', exegeticalType: 'lexicon-technical' }] }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ updateProject: { mutateAsync: updateProject, isPending: false } }) }));
const { useSaveProjectSources } = await import('../useSaveProjectSources');

describe('useSaveProjectSources', () => {
    it('lo marcado queda aprobado en la bibliografía y lo desmarcado vuelve a candidata', async () => {
        const proyecto = { id: 'p', userId: 'u', title: 'T', color: 'amber', sourceIds: ['viejo'] } as never;
        const { result } = renderHook(() => useSaveProjectSources(proyecto));
        await result.current.save(['bdag']);
        const { projectId, bibliography } = updateProject.mock.calls[0]![0];
        expect(projectId).toBe('p');
        expect(bibliography.map((e: { resourceId: string; decision: string }) => [e.resourceId, e.decision])).toEqual([['viejo', 'candidate'], ['bdag', 'approved']]);
        expect(updateProject.mock.calls[0]![0]).not.toHaveProperty('sourceIds');
    });
});
