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

/**
 * Los libros del proyecto que el estudio todavía no tiene en su corpus: lo
 * que se le OFRECE al asociarlo, sin pisar lo que ya tiene (ADR-046). Una
 * fuente cuenta como presente por su recurso de biblioteca o por su corpus
 * (las de la ruta vieja solo tienen el segundo).
 */
export function projectSourcesMissingIn(
    projectSourceIds: ReadonlyArray<string> | null | undefined,
    sources: ReadonlyArray<{ sourceLibraryResourceId?: string | null; corpusId?: string | null }>,
): string[] {
    const tiene = new Set<string>();
    for (const s of sources) {
        if (s.sourceLibraryResourceId) tiene.add(s.sourceLibraryResourceId);
        if (s.corpusId) tiene.add(s.corpusId);
    }
    return [...new Set(projectSourceIds ?? [])].filter(id => id && !tiene.has(id));
}

/**
 * El filtro por proyecto de la lista de estudios: `'all'`, `'none'` (los
 * sueltos) o el id de un proyecto (de origen o vinculado).
 */
export function matchesProjectFilter(paper: ConProyectos, filter: string): boolean {
    if (filter === 'all') return true;
    const suyos = projectsOfPaper(paper);
    return filter === 'none' ? suyos.length === 0 : suyos.includes(filter);
}

/**
 * Qué libros busca una conversación con los tutores que pertenece a un
 * proyecto (ADR-046). Si la conversación es de un estudio, son los del
 * proyecto MÁS los del estudio: acotar solo a los del proyecto dejaba al
 * tutor sin los comentarios que el estudio usa (revisión de la etapa 1).
 * Sin fuentes del proyecto no se acota (toda la biblioteca, como siempre).
 */
export function conversationSourceScope(
    projectSourceIds: ReadonlyArray<string> | null | undefined,
    studySources: ReadonlyArray<{ sourceLibraryResourceId?: string | null; corpusId?: string | null }> | null | undefined,
): string[] | undefined {
    if (!projectSourceIds || projectSourceIds.length === 0) return undefined;
    const ids = new Set(projectSourceIds.filter(Boolean));
    for (const s of studySources ?? []) {
        const id = s.sourceLibraryResourceId || s.corpusId;
        if (id) ids.add(id);
    }
    return [...ids];
}
