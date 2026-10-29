import { Link } from 'react-router-dom';
import { Archive, BookOpen, Check, Pencil, Plus } from 'lucide-react';
import {
    nextLabelFor,
    type AIProject,
    type CourseDesk,
    type DeskDelivery,
    type DeskScheduleRow,
    type DeskStudyCell,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { FOCUS_RING, WRAP_LABEL } from '../primitives';
import { TOUCH, createWorkUrl, formatDueDate, langOf, passageLabel, studyUrl } from './courseDeskFormat';

interface CourseWorksTableProps {
    project: AIProject;
    course: CourseDesk;
    onMarkDelivered: (row: DeskScheduleRow, delivered: boolean) => void;
    onRecordFeedback: (row: DeskScheduleRow) => void;
    onImport: () => void;
    /** Abre la entrada del calendario de esa fila (fecha, tipo, rótulo, pasaje): TP #9, B2. */
    onEditEntry?: (row: DeskScheduleRow) => void;
    saving: boolean;
}

const ENTREGA: Record<DeskDelivery, string> = {
    notDelivered: 'border-border text-muted-foreground',
    delivered: 'border-primary/40 text-primary-text',
    returned: 'border-success/30 bg-success-subtle text-success-subtle-foreground',
    noFeedback: 'border-border text-muted-foreground',
};

/**
 * Fase 4 · La mesa del curso (§9.1), agrupada por tipo de trabajo. Columnas:
 * trabajo (con la fecha de entrega) · avance (sin empezar / k de n pasos /
 * ensamblado) · fuentes («sin repetir de TP #8» o «repite …», sobre lo que
 * el trabajo citó) · entrega (listo → entregado → devuelto). En el teléfono,
 * una tarjeta por fila. «Entregado» se marca aparte del avance: ninguna
 * acción de una fase completa otra.
 */
export function CourseWorksTable({ project, course, onMarkDelivered, onRecordFeedback, onImport, onEditEntry, saving }: CourseWorksTableProps) {
    const { t, i18n } = useTranslation('projectDeskCourse');
    const lang = langOf(i18n.language);
    const libre = course.schedule.mode === 'free';
    const schedule = project.courseSchedule ?? [];
    // El estudio que cumple cada entrega, aunque el escritorio no lo traiga
    // (archivado): una entrega con estudio no ofrece «Crear» otra vez.
    const paperDe = new Map(schedule.map(e => [e.id, e.paperId ?? null]));
    const COLS = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)]';

    // Un grupo por tipo de trabajo (en el orden del curso), aunque no tenga
    // filas todavía; luego las entregas cuyo tipo ya no existe.
    const grupos = [
        ...course.workTypes.map(w => ({ workTypeId: w.id, label: w.label, known: true, rows: course.schedule.rows.filter(r => r.workTypeId === w.id) })),
        ...course.schedule.groups.filter(g => !course.workTypes.some(w => w.id === g.workTypeId)).map(g => ({ ...g, known: false })),
    ].filter(g => g.rows.length > 0 || libre);

    const avance = (s: DeskStudyCell) => {
        switch (s.state) {
            case 'assembled': return t('works.study.assembled');
            case 'inProgress': return t('works.study.progress', { done: s.accepted, total: s.total });
            case 'notStarted': return t('works.study.notStarted');
            default: return t('works.study.none');
        }
    };
    const fuentes = (r: DeskScheduleRow) => {
        if (r.sources === 'repeats') return { text: t('works.sources.repeats', { sources: r.repeated.join(', ') }), warn: true };
        if (r.sources === 'noRepeat') return { text: r.comparedWith ? t('works.sources.noRepeatFrom', { label: r.comparedWith }) : t('works.sources.first'), warn: false };
        // A un lado le faltan las fuentes citadas: no se puede afirmar «sin repetir».
        if (r.sources === 'unknown') return { text: r.comparedWith ? t('works.sources.unknownFrom', { label: r.comparedWith }) : t('works.sources.unknown'), warn: false };
        return null;
    };

    return (
        <div className="space-y-5">
            {grupos.length === 0 && (
                <p className="text-sm text-muted-foreground">{t(course.workTypes.length === 0 ? 'works.noWorkTypes' : 'works.empty')}</p>
            )}

            {grupos.map(g => {
                const siguiente = nextLabelFor(g.workTypeId, schedule);
                return (
                    <section key={g.workTypeId || 'sin-tipo'} aria-label={g.label || t('works.unknownType')} data-testid="course-works-group" className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{g.label || t('works.unknownType')}</h3>
                            <span className="text-xs text-muted-foreground">{t('works.groupCount', { count: g.rows.length })}</span>
                            {libre && g.known && (
                                // Semana a semana: el trabajo nace con su entrada (sin fecha) para que entregado y devolución tengan dónde vivir.
                                <Button asChild size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL, 'sm:ml-auto')}>
                                    <Link to={createWorkUrl({ projectId: project.id, workTypeId: g.workTypeId, label: siguiente ?? '' })}>
                                        <Plus className="h-3.5 w-3.5" aria-hidden />
                                        {siguiente ? t('works.createNamed', { label: siguiente }) : t('works.createOfType', { type: g.label })}
                                    </Link>
                                </Button>
                            )}
                        </div>

                        {g.rows.length > 0 && (
                            <div className="rounded-lg border border-border">
                                {/* La cabecera, fuera de la lista: un `<li>` oculto contaba como entrega para el lector. */}
                                <div aria-hidden className={cn('hidden gap-3 border-b border-border/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid', COLS)}>
                                    <span>{t('works.col.work')}</span>
                                    <span>{t('works.col.progress')}</span>
                                    <span>{t('works.col.sources')}</span>
                                    <span>{t('works.col.delivery')}</span>
                                </div>
                            <ol className="divide-y divide-border/60">
                                {g.rows.map(r => {
                                    const f = fuentes(r);
                                    const urgente = r.delivery === 'notDelivered' && r.hoursLeft !== null && r.hoursLeft >= 0 && r.hoursLeft <= 72;
                                    const archivado = !r.study.id ? paperDe.get(r.entryId) ?? null : null;
                                    return (
                                        <li
                                            key={r.entryId}
                                            data-testid="course-works-row"
                                            className={cn('grid gap-2 px-3 py-2.5 lg:items-center lg:gap-3', COLS)}
                                        >
                                            <div className="min-w-0">
                                                {r.study.id ? (
                                                    <Link to={studyUrl(r.study.id, project.id)} className={cn('inline-flex max-w-full items-center rounded-sm text-sm font-medium text-foreground underline-offset-2 hover:text-primary-text hover:underline', TOUCH, FOCUS_RING)}>
                                                        <span className="break-words">{r.label || t('calendar.noLabel')}</span>
                                                    </Link>
                                                ) : (
                                                    <span className="break-words text-sm font-medium text-foreground">{r.label || t('calendar.noLabel')}</span>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    {[r.passage ? passageLabel(r.passage, lang) : null, r.dueDate ? t('calendar.due', { date: formatDueDate(r.dueDate, lang) }) : t('calendar.noDate')].filter(Boolean).join(' · ')}
                                                    {r.overdue && <span className="font-medium text-warning-subtle-foreground"> · {t('works.overdue')}</span>}
                                                    {urgente && !r.overdue && <span className="font-medium text-warning-subtle-foreground"> · {t('works.dueSoon', { hours: r.hoursLeft })}</span>}
                                                </p>
                                            </div>
                                            <p className="text-xs text-foreground">
                                                <span className="text-muted-foreground lg:hidden">{t('works.col.progress')}: </span>
                                                {avance(r.study)}
                                            </p>
                                            <p className={cn('text-xs', f?.warn ? 'text-warning-subtle-foreground' : 'text-muted-foreground')}>
                                                {f && <><span className="lg:hidden">{t('works.col.sources')}: </span>{f.text}</>}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]', ENTREGA[r.delivery])}>
                                                    {r.delivery === 'returned' && <Check className="h-3 w-3" aria-hidden />}
                                                    {t(`works.delivery.${r.delivery}`)}
                                                </span>
                                                {archivado ? (
                                                    // Su estudio está archivado: se abre ese, no se crea otro para la misma entrega.
                                                    <Link
                                                        to={studyUrl(archivado, project.id)}
                                                        data-testid="course-works-archived"
                                                        className={cn('inline-flex items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:py-1', TOUCH, FOCUS_RING)}
                                                    >
                                                        <Archive className="h-3.5 w-3.5" aria-hidden />
                                                        {t('works.archived')}
                                                    </Link>
                                                ) : !r.study.id && (
                                                    <Button asChild size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL)}>
                                                        <Link to={createWorkUrl({ projectId: project.id, workTypeId: r.workTypeKnown ? r.workTypeId : null, scheduleEntryId: r.entryId, label: r.label })}>
                                                            {t('works.create', { label: r.label })}
                                                        </Link>
                                                    </Button>
                                                )}
                                                {r.delivery === 'notDelivered' ? (
                                                    <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={() => onMarkDelivered(r, true)}>
                                                        {t('works.markDelivered')}
                                                    </Button>
                                                ) : r.delivery === 'delivered' ? (
                                                    <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={() => onMarkDelivered(r, false)} aria-label={t('works.unmarkDeliveredLabel', { label: r.label })}>
                                                        {t('works.unmarkDelivered')}
                                                    </Button>
                                                ) : null}
                                                {r.delivery !== 'notDelivered' && (
                                                    <Button size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL)} onClick={() => onRecordFeedback(r)}>
                                                        {t(r.delivery === 'delivered' ? 'works.recordFeedback' : 'works.editFeedback')}
                                                    </Button>
                                                )}
                                                {/* La fecha o el pasaje se corrigen aquí mismo, sin bajar al calendario (B2). */}
                                                {onEditEntry && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={TOUCH}
                                                        onClick={() => onEditEntry(r)}
                                                        aria-label={t('works.editEntryLabel', { label: r.label || t('calendar.noLabel') })}
                                                        data-testid="course-works-edit-entry"
                                                    >
                                                        <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                                        {t('works.editEntry')}
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                            </div>
                        )}
                    </section>
                );
            })}

            {course.directedReading.length > 0 && (
                <section aria-label={t('works.reading.title')} className="space-y-2" data-testid="course-directed-reading">
                    <h3 className="text-sm font-semibold text-foreground">{t('works.reading.title')}</h3>
                    <ul className="divide-y divide-border/60 rounded-lg border border-border">
                        {course.directedReading.map(d => (
                            <li key={d.requirementId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                                <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 flex-1 text-sm text-foreground">{d.text}</span>
                                <span className="text-xs text-muted-foreground">
                                    {t('works.reading.pages', { pages: d.pages, target: d.target })}
                                    {d.pending > 0 && <> · {t('works.reading.pending', { count: d.pending })}</>}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                {course.offCalendar.length > 0 && (
                    <>
                        <p className="text-sm text-foreground">{t('works.offCalendar', { count: course.offCalendar.length })}</p>
                        <ul className="flex flex-wrap gap-2">
                            {course.offCalendar.map(s => (
                                <li key={s.id}>
                                    <Link to={studyUrl(s.id, project.id)} className={cn('inline-flex max-w-full items-center rounded-md border border-border px-2 text-left text-xs text-foreground hover:bg-accent sm:py-1', TOUCH, FOCUS_RING)}>
                                        {s.title || passageLabel(s.passage, lang)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t('works.importHint')}</p>
                    <Button size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL)} onClick={onImport} disabled={course.workTypes.length === 0}>
                        {t('works.import')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
