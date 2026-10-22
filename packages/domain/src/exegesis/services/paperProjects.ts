import type { ExegeticalPaper } from '../entities/ExegeticalPaper';

/**
 * Cómo se relaciona un estudio con los proyectos (ADR-046): un proyecto de
 * origen, que define su encargo, y varios vinculados, que lo usan sin
 * cambiarle las reglas.
 */
export type PaperProjectRole = 'origin' | 'linked';

type ConProyectos = Pick<ExegeticalPaper, 'projectId' | 'linkedProjectIds'>;

/** El papel del estudio en un proyecto, o `null` si no pertenece. */
export function paperRoleInProject(paper: ConProyectos, projectId: string): PaperProjectRole | null {
    if (!projectId) return null;
    if (paper.projectId === projectId) return 'origin';
    return (paper.linkedProjectIds ?? []).includes(projectId) ? 'linked' : null;
}

/** Todos los proyectos del estudio, el de origen primero. */
export function projectsOfPaper(paper: ConProyectos): string[] {
    const out = paper.projectId ? [paper.projectId] : [];
    for (const id of paper.linkedProjectIds ?? []) if (id && !out.includes(id)) out.push(id);
    return out;
}
