import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProjectOutput, ProjectOutputKind, plannerBookForProject, projectWorkTypes } from '@dosfilos/domain';
import { seriesService } from '@dosfilos/application';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { useFirebase } from '@/context/firebase-context';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useFacultySessions } from '@/hooks/faculty/useFacultySessions';
import { useProjectWorkspace } from '@/hooks/faculty/useProjectWorkspace';
import { useSermons } from '@/hooks/use-sermons';
import { useGreekSessions } from '@/hooks/useGreekSessions';
import { useHebrewSessions } from '@/hooks/useHebrewSessions';
import { computeRoadmapState, getProjectTypeMeta, type RoadmapCtaKind } from '@/pages/projects/projectRoadmaps';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

import { ProjectHeader } from './components/project/ProjectHeader';
import { ProjectRoadmap, RoadmapState } from './components/project/ProjectRoadmap';
import { ProjectSetupCards, type ProjectSetupChange } from './components/project/ProjectSetupCards';
import { ProjectStudiesSection } from './components/project/ProjectStudiesSection';
import { ProjectSeriesSection, planSeriesUrl, seriesWorkUrl } from './components/project/ProjectSeriesSection';
import { ProjectResourceGrid } from './components/project/ProjectResourceGrid';
import { ProjectMaterialList, MaterialItem } from './components/project/ProjectMaterialList';
import { ProjectSourcePickerModal } from './components/project/ProjectSourcePickerModal';
import { ProjectOutputEditorDialog } from './components/project/ProjectOutputEditorDialog';
import { ProjectLinkSessionDialog } from './components/project/ProjectLinkSessionDialog';
import { useProjectAttachedSources } from './hooks/useProjectAttachedSources';
import { useLinkProjectSession } from './hooks/useLinkProjectSession';
import { useProjectSlices } from './hooks/useProjectSlices';
import { useSaveProjectSources } from './hooks/useSaveProjectSources';

/**
 * Project workspace page. Pure composer — orchestrates the project header,
 * roadmap, resource grid (Sources / Conversations / Greek / Hebrew), and
 * material list, plus three modals (source picker, output editor, link
 * session) and one delete dialog.
 *
 * All business logic lives in dedicated hooks under `./hooks/`. UI assembly
 * lives in `./components/project/`.
 */
export function ProjectDashboard() {
    const { t } = useTranslation('projects');
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { user } = useFirebase();
    const { isAdmin } = useAuthorization();

    // ── Data sources ────────────────────────────────────────────────────────
    const { projects, updateProject } = useFacultyProjects();
    const { sessions } = useFacultySessions();
    const { sermons } = useSermons();
    const { sessions: greekSessions } = useGreekSessions();
    const { sessions: hebrewSessions } = useHebrewSessions();
    const { papers, isLoading: cargandoEstudios } = useExegesisPapers();
    // La misma clave que ExegesisPage: comparten caché y la invalidación
    // ['series'] de useExegesisPapers también la refresca.
    const { data: series, isLoading: cargandoSeries, isError: seriesFallaron, refetch: reintentarSeries } = useQuery({
        queryKey: ['series', 'forExegesisPapers', user?.uid],
        queryFn: async () => (user?.uid ? seriesService.getUserSeries(user.uid) : []),
        enabled: !!user?.uid,
    });
    const { outputs, isLoadingOutputs, createOutput, updateOutput, deleteOutput } =
        useProjectWorkspace(projectId);

    const project = useMemo(
        () => projects?.find(p => p.id === projectId),
        [projects, projectId]
    );

    // ── Lo que pertenece a este proyecto ───────────────────────────────────
    const {
        projectSessions, projectSermons, projectSermonsAll, projectGreekSessions, linkableGreekSessions,
        projectHebrewSessions, linkableHebrewSessions, projectStudies, projectSeries, seriesStudyIds,
    } = useProjectSlices(projectId, { sessions, sermons, greekSessions, hebrewSessions, papers, series });

    // ── Hooks: attached sources + link sessions ────────────────────────────
    const { sources: attachedSources, reprocessing, reprocessSource } = useProjectAttachedSources({
        userId: user?.uid,
        sourceIds: project?.sourceIds,
    });
    const fuentesDelProyecto = useSaveProjectSources(project);
    const greekLinker = useLinkProjectSession({ projectId, domain: 'greek' });
    const hebrewLinker = useLinkProjectSession({ projectId, domain: 'hebrew' });

    // ── Modal state ────────────────────────────────────────────────────────
    const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
    const [greekLinkOpen, setGreekLinkOpen] = useState(false);
    const [hebrewLinkOpen, setHebrewLinkOpen] = useState(false);
    const [outputEditor, setOutputEditor] = useState<
        { mode: 'create' } | { mode: 'edit'; output: ProjectOutput } | null
    >(null);
    const [outputToDelete, setOutputToDelete] = useState<ProjectOutput | null>(null);

    const materialItems = useMemo<MaterialItem[]>(() => {
        const fromOutputs: MaterialItem[] = (outputs ?? []).map(o => ({
            source: 'output',
            id: o.id,
            title: o.title,
            updatedAt: new Date(o.updatedAt),
            kind: o.kind,
            output: o,
        }));
        const fromSermons: MaterialItem[] = projectSermons.map(s => ({
            source: 'sermon',
            id: s.id,
            title: s.title,
            updatedAt: new Date(s.updatedAt),
            status: s.status,
        }));
        return [...fromOutputs, ...fromSermons].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );
    }, [outputs, projectSermons]);

    // ── Project not found ─────────────────────────────────────────────────
    if (!project) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="text-muted-foreground mb-4">{t('notFound.title')}</div>
                    <Button variant="outline" onClick={() => navigate('/dashboard/projects')}>
                        {t('notFound.back')}
                    </Button>
                </div>
            </div>
        );
    }

    // Mientras cargan, «sin series» y «sin estudios» serían falsos: el
    // recorrido ofrecería planificar otra serie y la lista no separaría los
    // estudios de la serie. Con datos en caché, un fallo no los borra.
    const cargandoTrabajo = cargandoEstudios || cargandoSeries;
    const estadoSeries = cargandoSeries ? 'loading' : seriesFallaron && !series ? 'error' : 'ready';

    // ── Roadmap computation ────────────────────────────────────────────────
    const typeMeta = getProjectTypeMeta(project.type);
    const roadmap = computeRoadmapState(typeMeta, {
        project,
        studyCount: projectStudies.length,
        deliveredCount: projectStudies.filter(p => p.phase === 'assembled').length,
        workedStudyCount: projectStudies.filter(p => p.phase !== 'configuring').length,
        seriesCount: projectSeries.length,
        sourceCount: attachedSources.length,
        greekCount: projectGreekSessions.length,
        hebrewCount: projectHebrewSessions.length,
        sessionCount: projectSessions.length,
        outputs: outputs ?? [],
        // Cada versión: el recorrido de Serie cuenta como antes, sin agrupar.
        sermons: projectSermonsAll,
        sessions: projectSessions,
    }) as unknown as RoadmapState;

    /** Guarda los datos del curso o los tipos de trabajo, con aviso. */
    const guardar = async (cambio: ProjectSetupChange) => {
        try {
            await updateProject.mutateAsync({ projectId: project.id, ...cambio });
            toast.success(t('workTypes.saved'));
        } catch (err) {
            console.error('[projects] save course data / work types failed:', err);
            toast.error(t('workTypes.saveFailed'));
        }
    };

    const handleRoadmapCta = (kind: RoadmapCtaKind) => {
        switch (kind) {
            case 'study': return navigate(`/dashboard/exegesis/new?projectId=${projectId}`);
            case 'charge': return document.getElementById('project-charge-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            case 'newSession': return navigate(`/dashboard/faculty?projectId=${projectId}`);
            case 'greek': return navigate(`/dashboard/greek-tutor?projectId=${projectId}`);
            case 'hebrew': return navigate(`/dashboard/hebrew-tutor?projectId=${projectId}`);
            case 'sermon': return navigate(`/dashboard/faculty?projectId=${projectId}`);
            case 'output': return setOutputEditor({ mode: 'create' });
            case 'sources': return setSourcePickerOpen(true);
            case 'stateOfArt': return navigate(`/dashboard/projects/${projectId}/estado-del-arte`);
            case 'planSeries': return navigate(planSeriesUrl(project.id, plannerBookForProject(project, projectStudies)));
            case 'openSeries': {
                // La serie más nueva: su primer estudio sin empezar o su plan.
                const serie = projectSeries[0];
                if (!serie) return navigate(`/dashboard/exegesis/new?projectId=${projectId}`);
                const faseDe = new Map((papers ?? []).map(p => [p.id, p.phase]));
                return navigate(seriesWorkUrl(serie, id => faseDe.get(id)));
            }
            default: {
                // Exhaustivo: un botón nuevo sin su caso no compila.
                const sinCaso: never = kind;
                return sinCaso;
            }
        }
    };


    // ── Output mutation handlers ───────────────────────────────────────────
    const handleCreateOutput = async (input: { kind: ProjectOutputKind; title: string; content: string }) => {
        try {
            await createOutput.mutateAsync(input);
            toast.success(t('outputEditor.toastCreated'));
            setOutputEditor(null);
        } catch (err) {
            toast.error(`${t('outputEditor.toastCreated')}: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleUpdateOutput = async (input: { outputId: string; title?: string; content?: string; kind?: ProjectOutputKind }) => {
        try {
            await updateOutput.mutateAsync(input);
            toast.success(t('outputEditor.toastUpdated'));
            setOutputEditor(null);
        } catch (err) {
            toast.error(`${t('outputEditor.toastUpdated')}: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleDeleteOutput = async () => {
        if (!outputToDelete) return;
        try {
            await deleteOutput.mutateAsync(outputToDelete.id);
            toast.success(t('deleteOutput.toastSuccess'));
        } catch (err) {
            toast.error(`${t('deleteOutput.toastError')}: ${err instanceof Error ? err.message : String(err)}`);
        }
        setOutputToDelete(null);
    };

    const handleSaveSources = async (ids: string[]) => {
        try {
            await fuentesDelProyecto.save(ids);
            toast.success(t('sourcePicker.toastSuccess', { count: ids.length }));
            setSourcePickerOpen(false);
        } catch (err) {
            toast.error(`${t('sourcePicker.toastError')}: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const findProjectTitle = (id: string) => projects?.find(p => p.id === id)?.title ?? null;

    return (
        <div className="flex-1 overflow-y-auto bg-background text-foreground antialiased">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-5 lg:py-6 space-y-6">
                <ProjectHeader
                    title={project.title}
                    contextNote={project.contextNote}
                    typeLabel={typeMeta.label}
                    TypeIcon={typeMeta.icon}
                />

                {estadoSeries === 'error' ? (
                    // Sin saber si hay serie, el recorrido ofrecería «Planificar la serie»
                    // aunque ya exista: se dice que falló y se ofrece reintentar.
                    <div role="alert" data-testid="project-roadmap-error" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                        <p className="text-sm text-foreground">{t('roadmap.loadError')}</p>
                        <Button size="sm" variant="outline" onClick={() => void reintentarSeries()}>{t('seriesSection.retry')}</Button>
                    </div>
                ) : cargandoTrabajo ? (
                    <div
                        role="status"
                        aria-label={t('roadmap.loading')}
                        data-testid="project-roadmap-loading"
                        className="h-[132px] rounded-xl border border-border/60 bg-muted/40 animate-pulse"
                    />
                ) : (
                    <ProjectRoadmap
                        roadmap={roadmap}
                        typeLabel={typeMeta.label}
                        onPhaseCta={handleRoadmapCta}
                    />
                )}

                {/* Los datos del curso y sus tipos de trabajo (ADR-046, etapa
                    1b): no aplican a los proyectos de predicación ni de
                    consejería. */}
                {!['sermon', 'series', 'counseling'].includes(project.type ?? 'general') && (
                    <ProjectSetupCards project={project} onSave={guardar} />
                )}

                {/* Las series de predicación del proyecto (etapa 3 de ADR-046). */}
                {(['exegetical', 'series', 'sermon'].includes(project.type ?? 'general') || projectSeries.length > 0) && (
                    <ProjectSeriesSection
                        project={project}
                        series={projectSeries}
                        papers={papers ?? []}
                        sermons={sermons ?? []}
                        onPlanSeries={() => handleRoadmapCta('planSeries')}
                        status={estadoSeries}
                        onRetry={() => { void reintentarSeries(); }}
                    />
                )}

                <ProjectStudiesSection
                    projectId={project.id}
                    studies={projectStudies}
                    excludeIds={seriesStudyIds}
                    loading={cargandoTrabajo}
                    workTypes={projectWorkTypes(project)}
                    onNewStudy={() => navigate(`/dashboard/exegesis/new?projectId=${project.id}`)}
                />

                <ProjectResourceGrid
                    projectId={projectId!}
                    isAdmin={isAdmin}
                    attachedSources={attachedSources}
                    reprocessing={reprocessing}
                    onReprocessSource={reprocessSource}
                    onOpenSourcePicker={() => setSourcePickerOpen(true)}
                    onOpenStateOfArt={typeMeta.roadmap.some(f => f.cta.kind === 'stateOfArt') ? () => handleRoadmapCta('stateOfArt') : undefined}
                    projectSessions={projectSessions}
                    projectGreekSessions={projectGreekSessions}
                    hasLinkableGreekSessions={linkableGreekSessions.length > 0}
                    onOpenGreekLinker={() => setGreekLinkOpen(true)}
                    projectHebrewSessions={projectHebrewSessions}
                    hasLinkableHebrewSessions={linkableHebrewSessions.length > 0}
                    onOpenHebrewLinker={() => setHebrewLinkOpen(true)}
                    onNavigate={(path) => navigate(path)}
                />

                <ProjectMaterialList
                    items={materialItems}
                    isLoading={isLoadingOutputs}
                    onCreateOutput={() => setOutputEditor({ mode: 'create' })}
                    onEditOutput={(o) => setOutputEditor({ mode: 'edit', output: o })}
                    onDeleteOutput={(o) => setOutputToDelete(o)}
                />
            </div>

            <ProjectLinkSessionDialog
                open={hebrewLinkOpen}
                onOpenChange={async (o) => {
                    setHebrewLinkOpen(o);
                }}
                domain="hebrew"
                sessions={linkableHebrewSessions}
                projects={{ findProjectTitle }}
                linkingId={hebrewLinker.linkingId}
                onLink={async (id) => {
                    await hebrewLinker.link(id);
                    setHebrewLinkOpen(false);
                }}
            />

            <ProjectLinkSessionDialog
                open={greekLinkOpen}
                onOpenChange={setGreekLinkOpen}
                domain="greek"
                sessions={linkableGreekSessions}
                projects={{ findProjectTitle }}
                linkingId={greekLinker.linkingId}
                onLink={async (id) => {
                    await greekLinker.link(id);
                    setGreekLinkOpen(false);
                }}
            />

            {sourcePickerOpen && user && (
                <ProjectSourcePickerModal
                    open={sourcePickerOpen}
                    onOpenChange={setSourcePickerOpen}
                    currentSourceIds={project.sourceIds ?? []}
                    onSave={handleSaveSources}
                    saving={fuentesDelProyecto.saving}
                />
            )}

            {outputEditor && (
                <ProjectOutputEditorDialog
                    mode={outputEditor.mode}
                    output={outputEditor.mode === 'edit' ? outputEditor.output : undefined}
                    onClose={() => setOutputEditor(null)}
                    onCreate={handleCreateOutput}
                    onUpdate={handleUpdateOutput}
                    saving={createOutput.isPending || updateOutput.isPending}
                />
            )}

            <AlertDialog open={!!outputToDelete} onOpenChange={(o) => !o && setOutputToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('deleteOutput.title', { title: outputToDelete?.title ?? '' })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteOutput.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteOutput.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteOutput}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {t('deleteOutput.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
