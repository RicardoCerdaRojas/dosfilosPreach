import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProjectOutput, ProjectOutputKind, projectsOfPaper } from '@dosfilos/domain';
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
import { ProjectChargeCard } from './components/project/ProjectChargeCard';
import { ProjectResourceGrid } from './components/project/ProjectResourceGrid';
import { ProjectMaterialList, MaterialItem } from './components/project/ProjectMaterialList';
import { ProjectSourcePickerModal } from './components/project/ProjectSourcePickerModal';
import { ProjectOutputEditorDialog } from './components/project/ProjectOutputEditorDialog';
import { ProjectLinkSessionDialog } from './components/project/ProjectLinkSessionDialog';
import { useProjectAttachedSources } from './hooks/useProjectAttachedSources';
import { useLinkProjectSession } from './hooks/useLinkProjectSession';

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
    const { outputs, isLoadingOutputs, createOutput, updateOutput, deleteOutput, updateSources } =
        useProjectWorkspace(projectId);

    const project = useMemo(
        () => projects?.find(p => p.id === projectId),
        [projects, projectId]
    );

    // ── Filtered + sorted slices for this project ──────────────────────────
    const projectSessions = useMemo(
        () => (sessions ?? []).filter(s => s.projectId === projectId),
        [sessions, projectId]
    );
    const projectSermons = useMemo(
        () => (sermons ?? [])
            .filter(s => s.projectId === projectId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [sermons, projectId]
    );
    const projectGreekSessions = useMemo(
        () => (greekSessions ?? [])
            .filter(s => s.projectId === projectId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [greekSessions, projectId]
    );
    const linkableGreekSessions = useMemo(
        () => (greekSessions ?? [])
            .filter(s => s.projectId !== projectId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [greekSessions, projectId]
    );
    const projectHebrewSessions = useMemo(
        () => (hebrewSessions ?? [])
            .filter(s => s.projectId === projectId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [hebrewSessions, projectId]
    );
    const linkableHebrewSessions = useMemo(
        () => (hebrewSessions ?? [])
            .filter(s => s.projectId !== projectId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [hebrewSessions, projectId]
    );

    // ── Hooks: attached sources + link sessions ────────────────────────────
    const { sources: attachedSources, reprocessing, reprocessSource } = useProjectAttachedSources({
        userId: user?.uid,
        sourceIds: project?.sourceIds,
    });
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

    // ── Estudios del proyecto (ADR-046): de origen y vinculados ───────────
    const { papers } = useExegesisPapers();
    const projectStudies = useMemo(
        () => (papers ?? []).filter(p => !p.archivedAt && projectId && projectsOfPaper(p).includes(projectId)),
        [papers, projectId]
    );

    // ── Material list (unified outputs + project sermons) ──────────────────
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

    // ── Roadmap computation ────────────────────────────────────────────────
    const typeMeta = getProjectTypeMeta(project.type);
    const roadmap = computeRoadmapState(typeMeta, {
        project,
        studyCount: projectStudies.length,
        deliveredCount: projectStudies.filter(p => p.phase === 'assembled').length,
        sourceCount: attachedSources.length,
        greekCount: projectGreekSessions.length,
        hebrewCount: projectHebrewSessions.length,
        sessionCount: projectSessions.length,
        outputs: outputs ?? [],
        sermons: projectSermons,
        sessions: projectSessions,
    }) as unknown as RoadmapState;

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
            await updateSources.mutateAsync(ids);
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

                <ProjectRoadmap
                    roadmap={roadmap}
                    typeLabel={typeMeta.label}
                    onPhaseCta={handleRoadmapCta}
                />

                {/* El encargo (ADR-046): no aplica a los proyectos de
                    predicación ni de consejería. */}
                {!['sermon', 'series', 'counseling'].includes(project.type ?? 'general') && (
                    <ProjectChargeCard
                        project={project}
                        saving={updateProject.isPending}
                        onSave={async (charge) => {
                            try {
                                await updateProject.mutateAsync({ projectId: project.id, charge });
                                toast.success(t('charge.saved'));
                            } catch (err) {
                                console.error('[projects] save charge failed:', err);
                                toast.error(t('charge.saveFailed'));
                            }
                        }}
                    />
                )}

                <ProjectResourceGrid
                    projectId={projectId!}
                    isAdmin={isAdmin}
                    attachedSources={attachedSources}
                    reprocessing={reprocessing}
                    onReprocessSource={reprocessSource}
                    onOpenSourcePicker={() => setSourcePickerOpen(true)}
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
                    saving={updateSources.isPending}
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
