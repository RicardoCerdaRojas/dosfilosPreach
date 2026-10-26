import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProjectOutput, ProjectOutputKind, plannerBookForProject, projectWorkTypes, type DeskNote, type DeskNow, type DeskTarget } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { useFirebase } from '@/context/firebase-context';
import { useAuthorization } from '@/hooks/useAuthorization';
import type { RoadmapCtaKind } from '@/pages/projects/projectRoadmaps';

import { ProjectHeader } from './components/project/ProjectHeader';
import { ProjectDashboardSkeleton } from './components/project/ProjectDashboardSkeleton';
import { ProjectRoadmap } from './components/project/ProjectRoadmap';
import { ProjectSetupCards, type ProjectSetupChange } from './components/project/ProjectSetupCards';
import { ProjectStudiesSection } from './components/project/ProjectStudiesSection';
import { ProjectSeriesSection, planSeriesUrl } from './components/project/ProjectSeriesSection';
import { ProjectFramingDialog } from './components/project/ProjectFramingDialog';
import { ProjectFramingConsolidateDialog } from './components/project/ProjectFramingConsolidateDialog';
import type { MaterialItem } from './components/project/ProjectMaterialList';
import { ProjectSourcePickerModal } from './components/project/ProjectSourcePickerModal';
import { ProjectOutputEditorDialog } from './components/project/ProjectOutputEditorDialog';
import { ProjectLinkSessionDialog } from './components/project/ProjectLinkSessionDialog';
import { DeskJourney } from './components/project/desk/DeskJourney';
import { DeskTools } from './components/project/desk/DeskTools';
import { ExegeticalDeskSections } from './components/project/desk/ExegeticalDeskSections';
import { CourseDeskSections } from './components/project/desk/CourseDeskSections';
import { scrollToDeskSection } from './components/project/desk/primitives';
import { createWorkUrl, studyUrl } from './components/project/desk/course/courseDeskFormat';
import { useProjectDesk } from './hooks/useProjectDesk';
import { useLinkProjectSession } from './hooks/useLinkProjectSession';
import { useSaveProjectSources } from './hooks/useSaveProjectSources';
import { useProjectFramingActions } from './hooks/useProjectFramingActions';

/**
 * El escritorio del proyecto (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`).
 * Compositor puro: la página es el recorrido.
 *
 *   1. Recorrido + «Ahora» (el único botón lleno) + notas + andamiaje.
 *   2. Las secciones del tipo, una por fase y en el orden del trabajo
 *      (Exegético y Curso: `desk/*DeskSections`). Los tipos sin escritorio
 *      propio (Investigación, Consejería, Sermón, Serie) conservan su
 *      recorrido y sus tarjetas de hoy; General, «Ahora» sin fases.
 *   3. Al final: herramientas (según los libros) y material.
 *
 * Los datos vienen de `useProjectDesk` (selector sobre lo que ya está en
 * caché, con estado por bloque); lo que muestra cada tipo, de
 * `ProjectTypeMeta.capabilities`.
 */
export function ProjectDashboard() {
    const { t } = useTranslation('projects');
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { user } = useFirebase();
    const { isAdmin } = useAuthorization();

    const {
        project, projects, isLoadingProject, updateProject, typeMeta, desk, legacyRoadmap,
        blocks, journey, retrySeries, papers, sermons, slices, attached, workspace,
    } = useProjectDesk(projectId);
    const caps = typeMeta.capabilities;
    const {
        projectSessions, projectSermons, projectGreekSessions, linkableGreekSessions,
        projectHebrewSessions, linkableHebrewSessions, projectStudies, projectSeries, seriesStudyIds,
    } = slices;
    const { outputs, isLoadingOutputs, createOutput, updateOutput, deleteOutput } = workspace;

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
    // «Revisar tu idea central» desde «Ahora» o una nota (la síntesis tiene el suyo).
    const [consolidando, setConsolidando] = useState(false);
    // La entrega cuya devolución se registra desde «Ahora» o una nota (Curso).
    const [feedbackEntryId, setFeedbackEntryId] = useState<string | null>(null);
    // El encuadre del Exegético: su diálogo (también desde «Cambiar en el encuadre») y sus escrituras.
    const { framingOpen, setFramingOpen, guardarEncuadre, consolidarEncuadre } =
        useProjectFramingActions({ projectId, projects, project, updateProject });

    // El material, sin los sermones de la serie: ya se ven en su fila de la mesa.
    const materialItems = useMemo<MaterialItem[]>(() => {
        const deLaSerie = new Set(projectSeries.map(s => s.id));
        const fromOutputs: MaterialItem[] = (outputs ?? []).map(o => ({
            source: 'output',
            id: o.id,
            title: o.title,
            updatedAt: new Date(o.updatedAt),
            kind: o.kind,
            output: o,
        }));
        const fromSermons: MaterialItem[] = projectSermons
            .filter(s => !(s.seriesId && deLaSerie.has(s.seriesId)) && !(s.sourcePaperId && seriesStudyIds.has(s.sourcePaperId)))
            .map(s => ({
                source: 'sermon',
                id: s.id,
                title: s.title,
                updatedAt: new Date(s.updatedAt),
                status: s.status,
            }));
        return [...fromOutputs, ...fromSermons].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );
    }, [outputs, projectSermons, projectSeries, seriesStudyIds]);

    // ── Project not found ─────────────────────────────────────────────────
    // En una carga en frío la lista todavía no llegó: no es «no encontrado».
    if (isLoadingProject) return <ProjectDashboardSkeleton />;
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

    const conEscritorio = caps.desk === 'exegetical' || caps.desk === 'course';
    const pid = encodeURIComponent(project.id);
    const nuevoEstudio = () => navigate(`/dashboard/exegesis/new?projectId=${pid}`);
    const planificar = () => navigate(planSeriesUrl(project.id, plannerBookForProject(project, projectStudies)));
    const estadoDelArte = () => navigate(`/dashboard/projects/${pid}/estado-del-arte`);

    /**
     * Adónde lleva un destino del escritorio (el botón «Ahora» o una nota).
     * Lo que vive en una sección (la entrega, la devolución, la fase) salta a
     * ella; lo que tiene página propia navega, con la vuelta al proyecto.
     */
    const irA = (target: DeskTarget) => {
        switch (target.type) {
            case 'study': return target.id ? navigate(studyUrl(target.id, project.id)) : undefined;
            case 'createScheduled':
                return navigate(createWorkUrl({ projectId: project.id, workTypeId: target.workTypeId, scheduleEntryId: target.id, label: target.label }));
            case 'scheduleEntry': return void scrollToDeskSection('works');
            case 'recordFeedback':
                // El diálogo de la devolución es de la sección del Curso: se le pide abrir esa entrega.
                scrollToDeskSection('feedback');
                return setFeedbackEntryId(target.id ?? null);
            case 'phase': return void scrollToDeskSection(target.phaseId ?? desk?.activePhaseId ?? '');
            case 'framing':
                // Con nota de antes, «Pasar tu nota al encuadre» está en la sección de la fase 1: la precarga allí.
                if (desk?.exegetical?.framing.oldNote && scrollToDeskSection('passage')) return;
                return setFramingOpen(true);
            case 'stateOfArt': return estadoDelArte();
            case 'planSeries': return planificar();
            case 'reviseIdea': return setConsolidando(true);
            case 'output': {
                const o = (outputs ?? []).find(x => x.id === target.id);
                return o ? setOutputEditor({ mode: 'edit', output: o }) : undefined;
            }
            default: {
                // Exhaustivo: un destino nuevo sin su caso no compila.
                const sinCaso: never = target.type;
                return sinCaso;
            }
        }
    };
    const onNow = (now: DeskNow) => irA(now.target);
    const onNote = (note: DeskNote) => irA(note.target);

    /** Guarda los datos del curso o los tipos de trabajo, con aviso (tipos que conservan las tarjetas). */
    const guardar = async (cambio: ProjectSetupChange) => {
        try {
            await updateProject.mutateAsync({ projectId: project.id, ...cambio });
            toast.success(t('workTypes.saved'));
        } catch (err) {
            console.error('[projects] save course data / work types failed:', err);
            toast.error(t('workTypes.saveFailed'));
        }
    };

    /** El botón del recorrido de los tipos viejos. */
    const handleRoadmapCta = (kind: RoadmapCtaKind) => {
        switch (kind) {
            case 'study': return nuevoEstudio();
            case 'newSession': return navigate(`/dashboard/faculty?projectId=${pid}`);
            case 'greek': return navigate(`/dashboard/greek-tutor?projectId=${pid}`);
            case 'hebrew': return navigate(`/dashboard/hebrew-tutor?projectId=${pid}`);
            case 'sermon': return navigate(`/dashboard/faculty?projectId=${pid}`);
            case 'output': return setOutputEditor({ mode: 'create' });
            case 'sources': return setSourcePickerOpen(true);
            case 'stateOfArt': return estadoDelArte();
            case 'planSeries': return planificar();
            // Los de Exegético y Curso: sus recorridos viven en el escritorio.
            case 'frame': return setFramingOpen(true);
            case 'charge':
            case 'openSeries':
                return undefined;
            default: {
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
            console.error('[projects] create output failed:', err);
            toast.error(t('outputEditor.toastCreateError'));
        }
    };

    const handleUpdateOutput = async (input: { outputId: string; title?: string; content?: string; kind?: ProjectOutputKind }) => {
        try {
            await updateOutput.mutateAsync(input);
            toast.success(t('outputEditor.toastUpdated'));
            setOutputEditor(null);
        } catch (err) {
            console.error('[projects] update output failed:', err);
            toast.error(t('outputEditor.toastUpdateError'));
        }
    };

    const handleDeleteOutput = async () => {
        if (!outputToDelete) return;
        try {
            await deleteOutput.mutateAsync(outputToDelete.id);
            toast.success(t('deleteOutput.toastSuccess'));
        } catch (err) {
            console.error('[projects] delete output failed:', err);
            toast.error(t('deleteOutput.toastError'));
        }
        setOutputToDelete(null);
    };

    const handleSaveSources = async (ids: string[]) => {
        try {
            await fuentesDelProyecto.save(ids);
            toast.success(t('sourcePicker.toastSuccess', { count: ids.length }));
            setSourcePickerOpen(false);
        } catch (err) {
            console.error('[projects] save sources failed:', err);
            toast.error(t('sourcePicker.toastError'));
        }
    };

    const findProjectTitle = (id: string) => projects?.find(p => p.id === id)?.title ?? null;
    const verSerie = !conEscritorio && (caps.seriesCard === 'always' || projectSeries.length > 0);

    return (
        <div className="flex-1 overflow-y-auto bg-background text-foreground antialiased">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-5 lg:py-6 space-y-6">
                <ProjectHeader
                    title={project.title}
                    contextNote={project.contextNote}
                    typeLabel={typeMeta.label}
                    TypeIcon={typeMeta.icon}
                />

                {journey === 'error' ? (
                    // Sin saber si hay serie, el escritorio ofrecería «Planificar la serie»
                    // aunque ya exista: se dice que falló y se ofrece reintentar.
                    <div role="alert" data-testid="project-roadmap-error" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                        <p className="text-sm text-foreground">{t('roadmap.loadError')}</p>
                        <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={retrySeries}>{t('seriesSection.retry')}</Button>
                    </div>
                ) : journey === 'loading' ? (
                    // Mientras carga, «sin serie», «sin estudios» o «sin fuentes» serían falsos.
                    <div
                        role="status"
                        aria-label={t('roadmap.loading')}
                        data-testid="project-roadmap-loading"
                        className="h-[132px] rounded-xl border border-border/60 bg-muted/40 animate-pulse"
                    />
                ) : caps.desk === 'legacy' ? (
                    legacyRoadmap && <ProjectRoadmap roadmap={legacyRoadmap} typeLabel={typeMeta.label} onPhaseCta={handleRoadmapCta} />
                ) : desk ? (
                    <DeskJourney desk={desk} onNow={onNow} onNote={onNote} />
                ) : null}

                {/* Las secciones de cada fase, en el orden del trabajo. */}
                {journey === 'ready' && desk && caps.desk === 'exegetical' && (
                    <ExegeticalDeskSections project={project} desk={desk} onOpenFraming={() => setFramingOpen(true)} sermons={sermons} />
                )}
                {journey === 'ready' && desk && caps.desk === 'course' && (
                    <CourseDeskSections project={project} desk={desk} feedbackEntryId={feedbackEntryId} onFeedbackEntryChange={setFeedbackEntryId} />
                )}

                {/* Los tipos sin escritorio propio: sus tarjetas de hoy. */}
                {caps.courseSetup !== 'none' && (
                    <ProjectSetupCards project={project} onSave={guardar} collapsible={caps.courseSetup === 'collapsible'} />
                )}

                {verSerie && (
                    <ProjectSeriesSection
                        project={project}
                        series={projectSeries}
                        papers={papers}
                        sermons={sermons}
                        onPlanSeries={planificar}
                        status={blocks.series}
                        onRetry={retrySeries}
                    />
                )}

                {caps.studies && (
                    <ProjectStudiesSection
                        projectId={project.id}
                        studies={projectStudies}
                        excludeIds={seriesStudyIds}
                        loading={blocks.work === 'loading'}
                        workTypes={projectWorkTypes(project)}
                        onNewStudy={nuevoEstudio}
                    />
                )}

                <DeskTools
                    projectId={project.id}
                    languages={caps.languages ? (desk?.languages ?? []) : null}
                    conversations={projectSessions}
                    greek={{ sessions: projectGreekSessions, canLink: linkableGreekSessions.length > 0, onLink: () => setGreekLinkOpen(true) }}
                    hebrew={{ sessions: projectHebrewSessions, canLink: linkableHebrewSessions.length > 0, onLink: () => setHebrewLinkOpen(true) }}
                    sources={caps.sources === 'stateOfArt' ? null : {
                        attached: attached.sources,
                        isAdmin,
                        reprocessing: attached.reprocessing ?? {},
                        onReprocess: attached.reprocessSource,
                        onOpenPicker: () => setSourcePickerOpen(true),
                        onOpenStateOfArt: caps.sources === 'both' ? estadoDelArte : undefined,
                    }}
                    material={{
                        items: materialItems,
                        isLoading: isLoadingOutputs,
                        onCreate: () => setOutputEditor({ mode: 'create' }),
                        onEdit: (o) => setOutputEditor({ mode: 'edit', output: o }),
                        onDelete: (o) => setOutputToDelete(o),
                    }}
                    onNavigate={(path) => navigate(path)}
                />
            </div>

            <ProjectLinkSessionDialog
                open={hebrewLinkOpen}
                onOpenChange={setHebrewLinkOpen}
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

            {project.type === 'exegetical' && (
                <>
                    <ProjectFramingDialog
                        project={project}
                        open={framingOpen}
                        onOpenChange={setFramingOpen}
                        onSave={guardarEncuadre}
                        saving={updateProject.isPending}
                    />
                    <ProjectFramingConsolidateDialog
                        open={consolidando}
                        onOpenChange={setConsolidando}
                        framing={project.framing}
                        studies={projectStudies}
                        onSave={async (input) => { await consolidarEncuadre(input); setConsolidando(false); }}
                        saving={updateProject.isPending}
                    />
                </>
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
