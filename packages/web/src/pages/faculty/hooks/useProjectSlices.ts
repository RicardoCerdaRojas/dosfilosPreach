import { useMemo } from 'react';
import { projectsOfPaper, type AIChatSession, type ExegesisPaperSummary } from '@dosfilos/domain';

interface Fuentes<Sermon, Sesion> {
    sessions?: ReadonlyArray<AIChatSession> | null;
    sermons?: ReadonlyArray<Sermon> | null;
    greekSessions?: ReadonlyArray<Sesion> | null;
    hebrewSessions?: ReadonlyArray<Sesion> | null;
    papers?: ReadonlyArray<ExegesisPaperSummary> | null;
}

const porFecha = <T extends { updatedAt: Date | string }>(a: T, b: T) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

/**
 * Lo que pertenece a un proyecto, filtrado de las listas del usuario: las
 * conversaciones, los sermones, las sesiones de griego y hebreo (y las que se
 * pueden vincular) y los estudios, de origen y vinculados (ADR-046).
 */
export function useProjectSlices<
    Sermon extends { projectId?: string | null; updatedAt: Date | string },
    Sesion extends { projectId?: string | null; updatedAt: Date | string },
>(projectId: string | undefined, fuentes: Fuentes<Sermon, Sesion>) {
    const { sessions, sermons, greekSessions, hebrewSessions, papers } = fuentes;
    const projectSessions = useMemo(
        () => (sessions ?? []).filter(s => s.projectId === projectId),
        [sessions, projectId],
    );
    const projectSermons = useMemo(
        () => (sermons ?? []).filter(s => s.projectId === projectId).sort(porFecha),
        [sermons, projectId],
    );
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
    return {
        projectSessions, projectSermons, projectGreekSessions, linkableGreekSessions,
        projectHebrewSessions, linkableHebrewSessions, projectStudies,
    };
}
