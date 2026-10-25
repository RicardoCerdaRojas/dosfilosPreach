import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { seriesService } from '@dosfilos/application';
import { seriesBookId, type AIProject, type SermonSeriesEntity } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useProjectSourcesForBook } from '@/hooks/exegesis/useProjectSourcesForBook';
import { useTranslation } from '@/i18n';

interface Props {
    series: SermonSeriesEntity;
    userId: string;
    /** Recarga la serie después de ligar o desligar. */
    onChanged: () => void | Promise<void>;
}

const k = (key: string) => `detail.project.${key}`;

/**
 * El proyecto de la serie en su cabecera (etapa 3 de ADR-046). El vínculo
 * vive solo en `series.projectId`: aquí se muestra, se liga o se desliga.
 * Desligar no toca los estudios: siguen en el proyecto que tengan.
 */
export function SeriesProjectLink({ series, userId, onChanged }: Props) {
    const { t } = useTranslation('series');
    const queryClient = useQueryClient();
    const { projects, isLoadingProjects } = useFacultyProjects();
    // El mismo criterio que ExegesisCreatePage: archivados y borrados no cuentan.
    const activos = (projects ?? []).filter(p => !p.archivedAt && !p.deletedAt);
    const [linking, setLinking] = useState(false);
    const [saving, setSaving] = useState(false);

    const refrescar = async () => {
        await queryClient.invalidateQueries({ queryKey: ['series'] });
        await onChanged();
    };

    const desligar = async () => {
        setSaving(true);
        try {
            await seriesService.setSeriesProject(series.id, null);
            toast.success(t(k('unlinked')) as string);
            await refrescar();
        } catch (err) {
            console.error('[SeriesProjectLink] unlink failed:', err);
            toast.error(t(k('failed')) as string);
        } finally {
            setSaving(false);
        }
    };

    // Sin saber todavía qué proyectos hay, no se afirma «no disponible».
    if (isLoadingProjects) return null;

    if (series.projectId) {
        const proyecto = activos.find(p => p.id === series.projectId);
        return (
            <div className="flex items-center gap-2 flex-wrap text-[13px]">
                {proyecto ? (
                    <>
                        <Link
                            to={`/dashboard/projects/${proyecto.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[12px] font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <FolderKanban className="h-3.5 w-3.5" aria-hidden />
                            {t(k('chip'), { title: proyecto.title }) as string}
                        </Link>
                        <span className="text-muted-foreground">{t(k('sourcesFromProject'))}</span>
                    </>
                ) : (
                    // Un projectId colgante (proyecto archivado o borrado): se tolera y se ofrece desligar.
                    <span className="text-muted-foreground">{t(k('unavailable'))}</span>
                )}
                <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={desligar} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Unlink className="h-3.5 w-3.5 mr-1" aria-hidden />}
                    {t(k('unlink'))}
                </Button>
            </div>
        );
    }

    // Sin proyectos activos no hay a qué ligarla: la cabecera queda como antes.
    if (activos.length === 0) return null;

    return (
        <>
            <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-muted-foreground" onClick={() => setLinking(true)}>
                <Link2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                {t(k('link'))}
            </Button>
            {linking && (
                <LinkProjectDialog
                    series={series}
                    userId={userId}
                    projects={activos}
                    onDone={refrescar}
                    onClose={() => setLinking(false)}
                />
            )}
        </>
    );
}

interface DialogProps {
    series: SermonSeriesEntity;
    userId: string;
    projects: AIProject[];
    onDone: () => Promise<void>;
    onClose: () => void;
}

/** «Ligar a un proyecto»: la serie, y si se quiere sus estudios con las obras que les faltan. */
function LinkProjectDialog({ series, userId, projects, onDone, onClose }: DialogProps) {
    const { t } = useTranslation('series');
    const [projectId, setProjectId] = useState<string>(() => (projects.length === 1 ? projects[0]!.id : ''));
    const [movePapers, setMovePapers] = useState(true);
    const [addSources, setAddSources] = useState(true);
    const [saving, setSaving] = useState(false);

    const proyecto = projects.find(p => p.id === projectId) ?? null;
    const paperCount = new Set(
        (series.metadata?.plannedSermons ?? []).map(p => p.paperId).filter((id): id is string => !!id),
    ).size;
    const { sources, isLoading } = useProjectSourcesForBook(
        proyecto,
        seriesBookId(series),
        series.metadata?.projectSourceExclusions ?? [],
    );
    const llevar = paperCount > 0 && movePapers;
    const agregar = llevar && addSources;

    const ligar = async () => {
        if (!proyecto) return;
        setSaving(true);
        try {
            const r = await seriesService.linkSeriesToProject(userId, series.id, proyecto.id, {
                movePapers: llevar,
                ...(agregar ? { sourcesToAdd: sources } : {}),
            });
            // Solo las cifras que dicen algo, con su plural: «0 estudios
            // llevados, 0 vinculados…» se leía como si nada hubiera pasado.
            const partes = [
                r.moved > 0 ? (t(k('linkedMoved'), { count: r.moved }) as string) : null,
                r.linked > 0 ? (t(k('linkedLinked'), { count: r.linked }) as string) : null,
                r.sourcesAdded > 0 ? (t(k('linkedSources'), { count: r.sourcesAdded }) as string) : null,
            ].filter((p): p is string => p !== null);
            toast.success(partes.length === 0
                ? (t(k('linkedOnly'), { title: proyecto.title }) as string)
                : (t(k('linked'), { title: proyecto.title, parts: partes.join(', ') }) as string));
            // Un estudio puede haber entrado sin todas sus obras: cuenta en su grupo y en `failed`.
            if (r.failed > 0) toast.warning(t(k('partialFailed'), { count: r.failed }) as string);
            onClose();
            await onDone();
        } catch (err) {
            console.error('[SeriesProjectLink] link failed:', err);
            toast.error(t(k('failed')) as string);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={o => !o && !saving && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t(k('linkTitle'))}</DialogTitle>
                </DialogHeader>

                <div className="space-y-1.5">
                    <Label htmlFor="serie-proyecto">{t(k('pickProject'))}</Label>
                    <select
                        id="serie-proyecto"
                        value={projectId}
                        onChange={e => setProjectId(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="" disabled>—</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                    </select>
                </div>

                {paperCount > 0 && (
                    <div className="space-y-2.5">
                        <div className="flex items-start gap-2.5">
                            <Checkbox
                                id="serie-llevar-estudios"
                                checked={movePapers}
                                onCheckedChange={v => setMovePapers(v === true)}
                                className="mt-0.5"
                            />
                            <Label htmlFor="serie-llevar-estudios" className="font-normal leading-snug">
                                {t(k('movePapers'), { count: paperCount }) as string}
                            </Label>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <Checkbox
                                id="serie-agregar-obras"
                                checked={agregar}
                                disabled={!llevar}
                                onCheckedChange={v => setAddSources(v === true)}
                                className="mt-0.5"
                            />
                            <Label htmlFor="serie-agregar-obras" className="font-normal leading-snug">
                                {t(k('addSources'))}
                            </Label>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                        {t('detail.table.cancel')}
                    </Button>
                    {/* Mientras la biblioteca carga, todavía no se sabe qué obras heredan. */}
                    <Button type="button" onClick={ligar} disabled={!proyecto || isLoading || saving}>
                        {(saving || (isLoading && !!proyecto)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t(k('confirm'))}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
