import { useRef, useState, type KeyboardEvent } from 'react';
import { CalendarPlus, Check, Pencil, Trash2 } from 'lucide-react';
import type { AIProject, CourseDesk, CourseEntryInput, CourseOp, CourseScheduleEntry, CourseScheduleMode, DeskScheduleRow, ProjectDeskModel } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CourseEntryDialog } from './CourseEntryDialog';
import { FOCUS_RING } from '../primitives';
import { DESTRUCTIVE, ICON_TOUCH, TOUCH, formatDueDate, langOf, passageLabel } from './courseDeskFormat';

interface CourseCalendarSectionProps {
    project: AIProject;
    course: CourseDesk;
    /** Todos los estudios del proyecto (para nombrar el que cumple una entrega). */
    desk: Pick<ProjectDeskModel, 'studies'>;
    run: (input: { ops?: CourseOp[]; mode?: CourseScheduleMode | null }, successKey?: string) => Promise<boolean>;
    saving: boolean;
}

/**
 * Fase 3 · Calendario de entregas (§9.1). Lo arma el estudiante a mano:
 * tipo, rótulo, pasaje opcional y fecha. O la salida explícita «semana a
 * semana, sin calendario»: entonces cada trabajo creado desde el escritorio
 * crea igual su entrada (sin fecha), para que «entregado» y la devolución
 * tengan dónde vivir.
 */
export function CourseCalendarSection({ project, course, desk, run, saving }: CourseCalendarSectionProps) {
    const { t, i18n } = useTranslation('projectDeskCourse');
    const lang = langOf(i18n.language);
    const [editing, setEditing] = useState<CourseScheduleEntry | null | 'new'>(null);
    const [removing, setRemoving] = useState<DeskScheduleRow | null>(null);
    const mode = course.schedule.mode;
    const rows = course.schedule.rows;
    const tipoDe = new Map(course.workTypes.map(w => [w.id, w.label]));
    const entradaDe = (id: string) => (project.courseSchedule ?? []).find(e => e.id === id) ?? null;

    const elegirModo = (m: CourseScheduleMode) => {
        if (m === mode) return;
        void run({ mode: m }, m === 'free' ? 'toast.modeFree' : 'toast.modeCalendar');
    };
    // Un grupo de radio: Tab entra a la opción elegida (o a la primera) y las
    // flechas mueven el foco. Elegir es Espacio, Intro o el clic: cada
    // elección GUARDA el modo, y recorrer las opciones con las flechas no
    // tiene que escribir dos veces en el proyecto.
    const MODOS = ['calendar', 'free'] as const;
    const botones = useRef<Array<HTMLButtonElement | null>>([]);
    const enfocable = mode ?? 'calendar';
    const mover = (e: KeyboardEvent, i: number) => {
        const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!paso) return;
        e.preventDefault();
        botones.current[(i + paso + MODOS.length) % MODOS.length]?.focus();
    };
    const guardar = (entry: CourseEntryInput) => run({ ops: [{ op: 'upsertEntry', entry }] });
    // Los trabajos del curso sin entrega, y el que ya cumple esta.
    const trabajosPara = (e: CourseScheduleEntry | null) => {
        const actual = e?.paperId ? desk.studies.find(s => s.id === e.paperId) : undefined;
        return [...(actual ? [actual] : []), ...course.offCalendar].map(s => ({ id: s.id, label: s.title || passageLabel(s.passage, lang) }));
    };

    return (
        <div className="space-y-3">
            <div role="radiogroup" aria-label={t('calendar.modeLabel')} className="flex flex-col gap-2 sm:flex-row">
                {MODOS.map((m, i) => (
                    <button
                        key={m}
                        ref={el => { botones.current[i] = el; }}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        tabIndex={enfocable === m ? 0 : -1}
                        aria-disabled={saving || undefined}
                        onClick={() => { if (!saving) elegirModo(m); }}
                        onKeyDown={e => mover(e, i)}
                        className={cn(
                            'min-h-11 rounded-lg border px-3 py-2 text-left text-sm text-foreground transition-colors aria-disabled:opacity-60 sm:flex-1',
                            FOCUS_RING,
                            // La elegida, sobre la tarjeta con el borde de la marca; la otra, sobre el fondo.
                            mode === m ? 'border-primary bg-card shadow-sm' : 'border-border bg-background hover:bg-accent',
                        )}
                    >
                        <span className="flex items-center gap-1.5 font-medium">
                            {mode === m && <Check className="h-3.5 w-3.5 text-primary-text" aria-hidden />}
                            {t(`calendar.mode.${m}`)}
                        </span>
                        <span className="block text-xs text-muted-foreground">{t(`calendar.mode.${m}Hint`)}</span>
                    </button>
                ))}
            </div>

            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(mode === 'free' ? 'calendar.emptyFree' : 'calendar.empty')}</p>
            ) : (
                <ol className="divide-y divide-border/60 rounded-lg border border-border" aria-label={t('calendar.listLabel')}>
                    {rows.map(r => {
                        const faltaTipo = !r.workTypeKnown;
                        // Una traída de antes o ya entregada no necesita fecha (ya no vence).
                        const faltaFecha = !r.dueDate && mode !== 'free' && !r.imported && r.delivery === 'notDelivered';
                        return (
                            <li key={r.entryId} data-testid="course-calendar-row" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm font-medium text-foreground">
                                        {r.label || t('calendar.noLabel')}
                                        {r.passage && <span className="font-normal text-muted-foreground"> · {passageLabel(r.passage, lang)}</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {faltaTipo ? <span className="text-warning-subtle-foreground">{t('calendar.missingType')}</span> : tipoDe.get(r.workTypeId)}
                                        {' · '}
                                        {r.dueDate
                                            ? t('calendar.due', { date: formatDueDate(r.dueDate, lang) })
                                            : <span className={faltaFecha ? 'text-warning-subtle-foreground' : undefined}>{t('calendar.noDate')}</span>}
                                        {r.imported && <> · {t('calendar.imported')}</>}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={ICON_TOUCH}
                                        onClick={() => setEditing(entradaDe(r.entryId))}
                                        aria-label={t('calendar.editEntry', { label: r.label })}
                                    >
                                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                                        <span className="sr-only sm:not-sr-only">{t('common.edit')}</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={ICON_TOUCH}
                                        disabled={saving}
                                        onClick={() => setRemoving(r)}
                                        aria-label={t('calendar.removeEntry', { label: r.label })}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            <Button size="sm" variant="outline" className={TOUCH} onClick={() => setEditing('new')} disabled={course.workTypes.length === 0}>
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t('calendar.add')}
            </Button>
            {course.workTypes.length === 0 && <p className="text-xs text-muted-foreground">{t('calendar.noWorkTypes')}</p>}

            <CourseEntryDialog
                project={project}
                entry={editing === 'new' ? null : editing}
                open={editing !== null}
                onOpenChange={o => { if (!o) setEditing(null); }}
                onSave={guardar}
                saving={saving}
                studies={trabajosPara(editing === 'new' ? null : editing)}
            />

            <AlertDialog open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('calendar.removeTitle', { label: removing?.label ?? '' })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(removing && removing.delivery !== 'notDelivered' ? 'calendar.removeWithRecord' : 'calendar.removeHint')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className={TOUCH}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className={cn(TOUCH, DESTRUCTIVE)}
                            onClick={() => { if (removing) void run({ ops: [{ op: 'removeEntry', entryId: removing.entryId }] }, 'toast.removed'); setRemoving(null); }}
                        >
                            {t('calendar.removeConfirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
