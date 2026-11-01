import { approvedThesisOf, type ExegeticalPaper } from '../entities/ExegeticalPaper';

/**
 * La unidad anterior del curso: el trabajo del mismo proyecto y del mismo
 * libro cuyo pasaje termina justo antes de que empiece este (para el TI #2,
 * Sal 23:4–6, el TI #1, Sal 23:1–3). Es lo que juzga el criterio «se conecta
 * con la unidad anterior». `null` si no hay proyecto o no hay uno anterior.
 */
export function previousUnitOf(
    paper: Pick<ExegeticalPaper, 'id' | 'passage' | 'projectId' | 'linkedProjectIds'>,
    papers: ReadonlyArray<ExegeticalPaper>,
): ExegeticalPaper | null {
    const proyectos = new Set([paper.projectId, ...(paper.linkedProjectIds ?? [])].filter((p): p is string => !!p));
    if (proyectos.size === 0) return null;
    const inicio = posicion(paper.passage.chapterStart, paper.passage.verseStart ?? 1);
    const candidatos = papers.filter(p =>
        p.id !== paper.id
        && !p.archivedAt
        && p.passage?.bookId === paper.passage.bookId
        && [p.projectId, ...(p.linkedProjectIds ?? [])].some(id => !!id && proyectos.has(id))
        && fin(p) < inicio);
    return candidatos.sort((a, b) => fin(b) - fin(a))[0] ?? null;
}

/**
 * Lo que estableció la unidad anterior: su tesis aprobada, o, si es anterior
 * a la tesis guardada, el comienzo de su conclusión aceptada (donde suele
 * estar). La medición se hizo con la tesis; el respaldo de la conclusión es
 * un supuesto.
 */
export function previousUnitStatement(prev: ExegeticalPaper | null): string | null {
    if (!prev) return null;
    const tesis = approvedThesisOf(prev);
    if (tesis) return tesis;
    const conclusion = prev.steps?.find(s => s.kind === 'conclusion')?.accepted?.markdown?.trim();
    if (!conclusion) return null;
    const cuerpo = conclusion.replace(/^#{1,6}\s+.*$/m, '').trim();
    return cuerpo.split(/\n\s*\n/)[0]?.trim().slice(0, 1200) || null;
}

function posicion(capitulo: number, versiculo: number): number {
    return capitulo * 1000 + versiculo;
}

function fin(p: Pick<ExegeticalPaper, 'passage'>): number {
    return posicion(p.passage.chapterEnd ?? p.passage.chapterStart, p.passage.verseEnd ?? 999);
}
