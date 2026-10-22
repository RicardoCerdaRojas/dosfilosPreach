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

describe('projectSourcesMissingIn y matchesProjectFilter (ADR-046)', () => {
    it('ofrece solo los libros del proyecto que el estudio no tiene (por recurso o por corpus)', async () => {
        const { projectSourcesMissingIn } = await import('../paperProjects');
        expect(projectSourcesMissingIn(['mayor', 'wallace', 'tuggy', 'mayor'], [
            { sourceLibraryResourceId: 'mayor', corpusId: 'mayor' },
            { sourceLibraryResourceId: null, corpusId: 'tuggy' },
        ])).toEqual(['wallace']);
        expect(projectSourcesMissingIn(undefined, [])).toEqual([]);
    });

    it('el filtro de la lista: todos, sueltos, o los de un proyecto (origen o vínculo)', async () => {
        const { matchesProjectFilter } = await import('../paperProjects');
        const suelto = {};
        const deCurso = { projectId: 'curso' };
        const colabora = { projectId: 'otro', linkedProjectIds: ['curso'] };
        expect([suelto, deCurso, colabora].map(p => matchesProjectFilter(p, 'all'))).toEqual([true, true, true]);
        expect([suelto, deCurso, colabora].map(p => matchesProjectFilter(p, 'none'))).toEqual([true, false, false]);
        expect([suelto, deCurso, colabora].map(p => matchesProjectFilter(p, 'curso'))).toEqual([false, true, true]);
    });
});
