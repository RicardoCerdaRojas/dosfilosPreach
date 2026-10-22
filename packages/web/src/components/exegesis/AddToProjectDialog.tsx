import { useMemo, useState } from 'react';
import { FolderKanban, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { projectSourcesMissingIn, type ExegeticalPaper } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useSetPaperProject } from '@/hooks/exegesis/useSetPaperProject';
import { useAttachLibrarySource } from '@/hooks/exegesis/useAttachLibrarySource';
import { useLibrary } from '@/hooks/library';
import { initialSelectionFor } from '@/components/exegesis/setup/extractionDefaults';

interface AddToProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paper: ExegeticalPaper;
}

/**
 * «Agregar a un proyecto» (ADR-046, etapa 1). Un estudio tiene un proyecto de
 * origen, que define su encargo, y puede colaborar con otros. Al elegir el
 * origen se OFRECEN las fuentes del proyecto que el estudio no tiene; nunca
 * se pisa lo que ya tiene.
 */
export function AddToProjectDialog({ open, onOpenChange, paper }: AddToProjectDialogProps) {
    const { t } = useTranslation('exegesis');
    const { projects } = useFacultyProjects();
    const setProject = useSetPaperProject();
    const attach = useAttachLibrarySource();
    const { resources } = useLibrary();
    const [elegido, setElegido] = useState('');
    const [agregando, setAgregando] = useState(false);

    const activos = useMemo(() => (projects ?? []).filter(p => !p.archivedAt && !p.deletedAt), [projects]);
    const origen = activos.find(p => p.id === paper.projectId) ?? null;
    const vinculados = activos.filter(p => (paper.linkedProjectIds ?? []).includes(p.id));
    const disponibles = activos.filter(p => p.id !== paper.projectId && !(paper.linkedProjectIds ?? []).includes(p.id));
    const faltantes = origen ? projectSourcesMissingIn(origen.sourceIds, paper.sources) : [];

    const cambiar = async (change: Parameters<typeof setProject.mutateAsync>[0]['change']) => {
        try {
            await setProject.mutateAsync({ paperId: paper.id, change });
            setElegido('');
        } catch (err) {
            console.error('[exegesis] set paper project failed:', err);
            toast.error(t('paperProjects.toast.failed'));
        }
    };

    const agregarFuentes = async () => {
        setAgregando(true);
        let n = 0;
        // Una por una: cada alta reescribe el arreglo de fuentes del trabajo.
        for (const id of faltantes) {
            const recurso = resources.find(r => r.id === id);
            if (!recurso) continue;
            const fila = initialSelectionFor(recurso, paper.sources);
            try {
                await attach.attach({
                    paperId: paper.id, libraryResourceId: recurso.id, displayLabel: fila.displayLabel,
                    sourceType: fila.sourceType, chosenRole: fila.chosenRole, citationKey: fila.citationKey || undefined,
                    passage: paper.passage, assignmentBrief: paper.assignmentBrief, language: paper.displayLanguage,
                });
                n++;
            } catch (err) {
                console.warn('[exegesis] could not attach project source', { id, error: (err as Error).message });
            }
        }
        setAgregando(false);
        toast.success(t('paperProjects.toast.sourcesAdded', { count: n }));
    };

    const pendiente = setProject.isPending || agregando;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        {t('paperProjects.title')}
                    </DialogTitle>
                    <DialogDescription>{t('paperProjects.subtitle')}</DialogDescription>
                </DialogHeader>

                <section className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('paperProjects.origin')}</p>
                    {origen ? (
                        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                            <span className="flex-1 text-sm text-foreground">{origen.title}</span>
                            <Button size="sm" variant="ghost" onClick={() => cambiar({ kind: 'origin', projectId: null })} disabled={pendiente} aria-label={t('paperProjects.removeOrigin')}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">{t('paperProjects.noOrigin')}</p>
                    )}
                    {origen && faltantes.length > 0 && (
                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1.5">
                            <p className="text-xs text-foreground">{t('paperProjects.missingSources', { count: faltantes.length })}</p>
                            <Button size="sm" variant="outline" onClick={agregarFuentes} disabled={pendiente}>
                                {agregando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                {t('paperProjects.addSources')}
                            </Button>
                        </div>
                    )}
                </section>

                <section className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('paperProjects.linked')}</p>
                    {vinculados.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('paperProjects.noLinked')}</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {vinculados.map(p => (
                                <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
                                    <span className="flex-1 text-sm text-foreground">{p.title}</span>
                                    <Button size="sm" variant="ghost" onClick={() => cambiar({ kind: 'unlink', projectId: p.id })} disabled={pendiente} aria-label={t('paperProjects.unlink', { title: p.title })}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {disponibles.length > 0 && (
                    <section className="space-y-2 border-t border-border pt-3">
                        <label htmlFor="add-to-project" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('paperProjects.add')}</label>
                        <select
                            id="add-to-project"
                            value={elegido}
                            onChange={e => setElegido(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="">{t('paperProjects.pick')}</option>
                            {disponibles.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                        <div className="flex flex-wrap gap-2">
                            {!origen && (
                                <Button size="sm" onClick={() => cambiar({ kind: 'origin', projectId: elegido })} disabled={!elegido || pendiente}>
                                    {t('paperProjects.asOrigin')}
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => cambiar({ kind: 'link', projectId: elegido })} disabled={!elegido || pendiente}>
                                {t('paperProjects.asLinked')}
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{t('paperProjects.hint')}</p>
                    </section>
                )}
            </DialogContent>
        </Dialog>
    );
}
