import { useMemo } from 'react';
import { projectSeriesOf, projectSermonsOf, projectsOfPaper, type AIChatSession, type ExegesisPaperSummary, type SerieLike } from '@dosfilos/domain';

interface Fuentes<Sermon, Sesion, Serie> {
    sessions?: ReadonlyArray<AIChatSession> | null;
    sermons?: ReadonlyArray<Sermon> | null;
    greekSessions?: ReadonlyArray<Sesion> | null;
    hebrewSessions?: ReadonlyArray<Sesion> | null;
    papers?: ReadonlyArray<ExegesisPaperSummary> | null;
    /** Las series del usuario: las del proyecto se deducen de `series.projectId`. */
    series?: ReadonlyArray<Serie> | null;
}

const porFecha = <T extends { updatedAt: Date | string }>(a: T, b: T) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

/**
 * Lo que pertenece a un proyecto, filtrado de las listas del usuario: las
 * conversaciones, los sermones, las sesiones de griego y hebreo (y las que se
 * pueden vincular), los estudios, de origen y vinculados (ADR-046), y las
 * series de predicación ligadas (etapa 3).
 *
 * Los sermones se deducen (`projectSermonsOf`): el `projectId` explícito
 * gana; si no tiene, entra por el estudio de origen o por la serie.
 * `projectSermons` trae uno por cadena borrador → copia (para «Material
 * producido»); `projectSermonsAll`, cada versión (para el recorrido).
 */
export function useProjectSlices<
    Sermon extends {
        id: string;
        projectId?: string | null;
        sourcePaperId?: string | null;
        sourceSermonId?: string | null;
        seriesId?: string | null;
        status?: string;
        updatedAt: Date | string;
    },
    Sesion extends { projectId?: string | null; updatedAt: Date | string },
    Serie extends SerieLike = SerieLike,
>(projectId: string | undefined, fuentes: Fuentes<Sermon, Sesion, Serie>) {
    const { sessions, sermons, greekSessions, hebrewSessions, papers, series } = fuentes;
    const projectSessions = useMemo(
        () => (sessions ?? []).filter(s => s.projectId === projectId),
        [sessions, projectId],
    );
    const projectSeries = useMemo(
        () => (projectId ? projectSeriesOf(series ?? [], projectId) : []),
        [series, projectId],
    );
    const { all: projectSermonsAll, chains: projectSermons } = useMemo(() => {
        if (!projectId) return { all: [] as Sermon[], chains: [] as Sermon[] };
        // El origen se busca en TODOS los estudios, también los archivados:
        // el sermón no deja de ser del proyecto porque su estudio se archive.
        const origenDe = new Map((papers ?? []).map(p => [p.id, p.projectId ?? null]));
        const proyectoDeSerie = new Map((series ?? []).map(s => [s.id, s.projectId ?? null]));
        return projectSermonsOf(sermons ?? [], projectId, id => origenDe.get(id), id => proyectoDeSerie.get(id));
    }, [sermons, papers, series, projectId]);
    const projectGreekSessions = useMemo(
        () => (greekSessions ?? []).filter(s => s.projectId === projectId).sort(porFecha),
        [greekSessions, projectId],
    );
    const linkableGreekSessions = useMemo(
        () => (greekSessions ?? []).filter(s => s.projectId !== projectId).sort(porFecha),
        [greekSessions, projectId],
    );
    const projectHebrewSessions = useMemo(
        () => (hebrewSessions ?? []).filter(s => s.projectId === projectId).sort(porFecha),
        [hebrewSessions, projectId],
    );
    const linkableHebrewSessions = useMemo(
        () => (hebrewSessions ?? []).filter(s => s.projectId !== projectId).sort(porFecha),
        [hebrewSessions, projectId],
    );
    const projectStudies = useMemo(
        () => (papers ?? []).filter(p => !p.archivedAt && !!projectId && projectsOfPaper(p).includes(projectId)),
        [papers, projectId],
    );
    // Los estudios que ya se ven en la tarjeta de su serie.
    const seriesStudyIds = useMemo(() => {
        const ids = new Set<string>();
        for (const s of projectSeries) {
            for (const p of s.metadata?.plannedSermons ?? []) if (p.paperId) ids.add(p.paperId);
        }
        return ids;
    }, [projectSeries]);
    return {
        projectSessions, projectSermons, projectSermonsAll, projectGreekSessions, linkableGreekSessions,
        projectHebrewSessions, linkableHebrewSessions, projectStudies, projectSeries, seriesStudyIds,
    };
}
