import { formatPassageForReader, type AIProject, type ExegesisPaperSummary, type PassageReference } from '@dosfilos/domain';

/**
 * Lo que comparten las piezas del escritorio del Curso: fechas de calendario,
 * pasajes y las rutas que salen del escritorio (siempre con la vuelta al
 * proyecto, `docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §2.8).
 */

export type DeskLang = 'es' | 'en';

export const langOf = (language: string | undefined): DeskLang => (language?.startsWith('en') ? 'en' : 'es');

/**
 * «vie 31 oct» desde `YYYY-MM-DD`. La fecha de entrega es un día del
 * calendario (local), no un instante: armarla con `new Date('2026-10-31')`
 * la leería en UTC y en Chile saldría el día anterior.
 */
export function formatDueDate(day: string | null | undefined, lang: DeskLang): string {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** El pasaje en la numeración de la Biblia del estudiante (lo que él lee). */
export function passageLabel(passage: PassageReference | null | undefined, lang: DeskLang): string {
    return passage ? formatPassageForReader(passage, lang) : '';
}

/** Hoy, `YYYY-MM-DD` local. */
export function todayLocal(now: Date = new Date()): string {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${m}-${d}`;
}

export const projectPath = (projectId: string) => `/dashboard/projects/${projectId}`;

/** El estudio, con la vuelta al proyecto (`?from=`; la página del estudio la respeta). */
export function studyUrl(studyId: string, projectId: string): string {
    return `/dashboard/exegesis/${encodeURIComponent(studyId)}?from=${encodeURIComponent(projectPath(projectId))}`;
}

/**
 * Crear un trabajo desde el escritorio: nace en el curso, con su tipo y su
 * rótulo puestos. Con `scheduleEntryId`, al crearlo se vincula con esa
 * entrega del calendario; sin ella (semana a semana), se crea su entrada.
 */
export function createWorkUrl(input: { projectId: string; workTypeId?: string | null; scheduleEntryId?: string | null; label?: string | null }): string {
    const q = new URLSearchParams({ projectId: input.projectId });
    if (input.workTypeId) q.set('workTypeId', input.workTypeId);
    if (input.scheduleEntryId) q.set('scheduleEntryId', input.scheduleEntryId);
    if (input.label?.trim()) q.set('label', input.label.trim());
    return `/dashboard/exegesis/new?${q.toString()}`;
}

/** Las clases de un control táctil del escritorio: 44 px en el teléfono, compacto desde `sm`. */
export const TOUCH = 'min-h-11 sm:min-h-0';

/** Los campos de los formularios del escritorio, como los de las tarjetas del curso. */
export const FIELD =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-0 sm:py-1.5';

/**
 * Los estudios que se pueden traer: los del usuario sin proyecto, los de
 * otro proyecto (quedarán vinculados) y los de este curso que todavía no
 * tienen entrada en el calendario. Sin archivados ni los que ya cumplen una
 * entrega. Del más viejo al más nuevo: así se leen TP #1, #2…
 */
export function importCandidates(
    papers: ReadonlyArray<ExegesisPaperSummary>,
    project: Pick<AIProject, 'id' | 'courseSchedule'>,
): ExegesisPaperSummary[] {
    const conEntrada = new Set((project.courseSchedule ?? []).map(e => e.paperId).filter(Boolean));
    return papers
        .filter(p => !p.archivedAt && p.phase !== 'archived' && !conEntrada.has(p.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
