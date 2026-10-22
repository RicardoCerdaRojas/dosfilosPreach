import { describe, it, expect } from 'vitest';
import { paperRoleInProject, projectsOfPaper } from '../paperProjects';

describe('paperProjects (ADR-046)', () => {
    const p = { projectId: 'curso', linkedProjectIds: ['serie', 'curso', 'investigacion'] };
    it('el papel del estudio en cada proyecto', () => {
        expect(paperRoleInProject(p, 'curso')).toBe('origin');
        expect(paperRoleInProject(p, 'serie')).toBe('linked');
        expect(paperRoleInProject(p, 'otro')).toBeNull();
        expect(paperRoleInProject({}, 'curso')).toBeNull();
    });
    it('todos sus proyectos, el de origen primero y sin repetir', () => {
        expect(projectsOfPaper(p)).toEqual(['curso', 'serie', 'investigacion']);
        expect(projectsOfPaper({ linkedProjectIds: ['serie'] })).toEqual(['serie']);
    });
});
