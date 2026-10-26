import { useEffect, useMemo, useState } from 'react';
import { defaultWorkTypeId, projectWorkTypes, type AIProject, type ExegesisPaperSummary } from '@dosfilos/domain';
import type { PreviousWorkInput, PreviousWorkStatus } from '@dosfilos/application';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useCourseRecordActions } from '@/hooks/faculty/useCourseRecordActions';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { FIELD, TOUCH, importCandidates, langOf, passageLabel } from './courseDeskFormat';

/** Tope por llamada del caso de uso (`IMPORT_PREVIOUS_WORKS_MAX`). */
const MAX = 50;

interface Choice {
    selected: boolean;
    workTypeId: string;
    label: string;
    delivered: boolean;
}

interface CourseImportDialogProps {
    project: AIProject;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * «Traer los trabajos anteriores» (§9.1, NT785): cada TP suelto se vincula al
 * curso con su tipo de trabajo y queda en el calendario, SIN volver a
 * aplicarle el encargo (un trabajo entregado no cambia de reglas). Un estudio
 * que ya es de otro proyecto no se mueve: queda vinculado, y se avisa.
 */
export function CourseImportDialog({ project, open, onOpenChange }: CourseImportDialogProps) {
    const { t, i18n } = useTranslation('projectDeskCourse');
    const lang = langOf(i18n.language);
    const { papers } = useExegesisPapers();
    const { projects } = useFacultyProjects();
    const { importPreviousWorks } = useCourseRecordActions();
    const tipos = projectWorkTypes(project);
    const porDefecto = defaultWorkTypeId(project) ?? tipos[0]?.id ?? '';
    const candidatos = useMemo(() => importCandidates(papers ?? [], project), [papers, project]);
    const [choices, setChoices] = useState<Record<string, Choice>>({});
    const [avisos, setAvisos] = useState<Array<{ paperId: string; status: PreviousWorkStatus }> | null>(null);

    useEffect(() => {
        if (open) { setChoices({}); setAvisos(null); }
    }, [open]);

    const titulo = (p: ExegesisPaperSummary) => p.title?.trim() || passageLabel(p.passage, lang);
    const proyectoDe = (p: ExegesisPaperSummary) => {
        if (p.projectId === project.id) return t('import.thisCourse');
        if (!p.projectId) return t('import.loose');
        return t('import.otherProject', { title: projects?.find(x => x.id === p.projectId)?.title ?? t('import.unknownProject') });
    };
    const eleccion = (p: ExegesisPaperSummary): Choice => choices[p.id] ?? {
        selected: false,
        workTypeId: p.projectId === project.id && p.projectWorkTypeId && tipos.some(x => x.id === p.projectWorkTypeId) ? p.projectWorkTypeId : porDefecto,
        label: titulo(p),
        delivered: true,
    };
    const cambiar = (p: ExegesisPaperSummary, patch: Partial<Choice>) => setChoices(c => ({ ...c, [p.id]: { ...eleccion(p), ...patch } }));
    const elegidos = candidatos.filter(p => eleccion(p).selected);
    const demasiados = elegidos.length > MAX;

    const traer = async () => {
        const ahora = new Date().toISOString();
        const works: PreviousWorkInput[] = elegidos.map(p => {
            const c = eleccion(p);
            return {
                paperId: p.id,
                workTypeId: c.workTypeId,
                label: c.label.trim(),
                passage: p.passage ?? null,
                ...(c.delivered ? { deliveredAt: ahora } : {}),
            };
        });
        try {
            const r = await importPreviousWorks.mutateAsync({ projectId: project.id, works });
            const raros = r.results.filter(x => x.status === 'linked' || x.status === 'not-found');
            toast.success(t('import.done', { count: r.results.filter(x => x.entryId).length }));
            // Si alguno quedó solo vinculado (tiene otro origen) o no se encontró, se dice antes de cerrar.
            if (raros.length > 0) setAvisos(raros);
            else onOpenChange(false);
        } catch (err) {
            console.error('[projects] import previous works failed:', err);
            toast.error(t('import.failed'));
        }
    };

    const tituloPorId = (id: string) => { const p = (papers ?? []).find(x => x.id === id); return p ? titulo(p) : id; };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-reading">{t('import.title')}</DialogTitle>
                    <DialogDescription>{t('import.hint')}</DialogDescription>
                </DialogHeader>

                {avisos ? (
                    <div role="status" className="space-y-2">
                        <p className="text-sm text-foreground">{t('import.warningsTitle')}</p>
                        <ul className="space-y-1">
                            {avisos.map(a => (
                                <li key={a.paperId} data-testid="import-warning" className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
                                    {t(a.status === 'linked' ? 'import.warnLinked' : 'import.warnNotFound', { title: tituloPorId(a.paperId) })}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : candidatos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('import.empty')}</p>
                ) : (
                    <ul className="space-y-2">
                        {candidatos.map(p => {
                            const c = eleccion(p);
                            const id = `import-${p.id}`;
                            return (
                                <li key={p.id} data-testid="import-candidate" className="rounded-lg border border-border p-3">
                                    <div className="flex items-start gap-3">
                                        <input
                                            id={id}
                                            type="checkbox"
                                            className="mt-1 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            checked={c.selected}
                                            onChange={e => cambiar(p, { selected: e.target.checked })}
                                        />
                                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                                            <span className="block text-sm font-medium text-foreground">{titulo(p)}</span>
                                            <span className="block text-xs text-muted-foreground">{passageLabel(p.passage, lang)} · {proyectoDe(p)}</span>
                                        </label>
                                    </div>
                                    {c.selected && (
                                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                                            <label className="block space-y-1">
                                                <span className="text-xs text-muted-foreground">{t('calendar.workType')}</span>
                                                <select className={FIELD} value={c.workTypeId} onChange={e => cambiar(p, { workTypeId: e.target.value })}>
                                                    {tipos.map(x => <option key={x.id} value={x.id}>{x.label || t('charge.untitled')}</option>)}
                                                </select>
                                            </label>
                                            <label className="block space-y-1">
                                                <span className="text-xs text-muted-foreground">{t('calendar.label')}</span>
                                                <input className={FIELD} value={c.label} maxLength={120} onChange={e => cambiar(p, { label: e.target.value })} />
                                            </label>
                                            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground sm:min-h-0 sm:pb-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-5 w-5 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    checked={c.delivered}
                                                    onChange={e => cambiar(p, { delivered: e.target.checked })}
                                                />
                                                {t('import.delivered')}
                                            </label>
                                            {p.projectId && p.projectId !== project.id && (
                                                <p className="text-[11px] text-muted-foreground sm:col-span-3">{t('import.willLink')}</p>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                <DialogFooter>
                    {avisos ? (
                        <Button className={TOUCH} onClick={() => onOpenChange(false)}>{t('import.close')}</Button>
                    ) : (
                        <>
                            <Button variant="ghost" className={TOUCH} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                            <Button
                                className={TOUCH}
                                onClick={() => void traer()}
                                disabled={elegidos.length === 0 || demasiados || importPreviousWorks.isPending || tipos.length === 0}
                            >
                                {t('import.confirm', { count: elegidos.length })}
                            </Button>
                        </>
                    )}
                </DialogFooter>
                {demasiados && <p className="text-xs text-warning-subtle-foreground">{t('import.tooMany', { max: MAX })}</p>}
            </DialogContent>
        </Dialog>
    );
}
