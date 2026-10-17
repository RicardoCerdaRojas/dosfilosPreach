import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    FolderKanban,
    Loader2,
    Search,
    Trash2,
    LayoutGrid,
    List,
    Calendar,
    MessageSquareQuote,
    FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useFacultySessions } from '@/hooks/faculty/useFacultySessions';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { ProjectEditDialog } from '@/pages/faculty/ProjectEditDialog';
import { UpgradeRequiredModal } from '@/components/upgrade';
import { ProjectsEmptyState } from './components/ProjectsEmptyState';
import { ProjectCard } from './components/ProjectCard';
import { PROJECT_TYPES } from '@/pages/projects/projectRoadmaps';
import { cn } from '@/lib/utils';
import type { AIProject, ProjectType } from '@dosfilos/domain';

type FilterTab = 'active' | 'archived' | 'trash';
type ViewMode = 'grid' | 'list';

const VIEW_STORAGE_KEY = 'dosfilos.projects.viewMode';

/** Static map for the list-view color dot. Tailwind needs literal
 *  class names at build time, so dynamic interpolation can't work. */
const COLOR_DOT_BG: Record<string, string> = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
    slate: 'bg-slate-400',
    orange: 'bg-orange-500',
    teal: 'bg-teal-500',
};

export function ProjectsListPage() {
    const navigate = useNavigate();
    const { projects, isLoadingProjects, archiveProject, softDeleteProject, deleteProject } =
        useFacultyProjects();
    const { sessions } = useFacultySessions();
    const { checkCanCreateProject } = useUsageLimits();
    const [dialogState, setDialogState] = useState<
        | { mode: 'create'; initialType?: ProjectType }
        | { mode: 'edit'; project: AIProject }
        | null
    >(null);
    const [tab, setTab] = useState<FilterTab>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmHardDelete, setConfirmHardDelete] = useState<AIProject | null>(null);
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window === 'undefined') return 'grid';
        try {
            const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
            return stored === 'list' ? 'list' : 'grid';
        } catch {
            return 'grid';
        }
    });

    const setViewModePersisted = (mode: ViewMode) => {
        setViewMode(mode);
        try {
            window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
        } catch {
            // ignore
        }
    };

    /**
     * Pre-checks the plan-level project quota (Hito 5.2). Free tier doesn't
     * include projects → opens the upgrade modal instead of the create dialog.
     */
    const handleOpenCreate = async (initialType?: ProjectType) => {
        const check = await checkCanCreateProject();
        if (!check.allowed) {
            setUpgradeModalOpen(true);
            return;
        }
        setDialogState({ mode: 'create', initialType });
    };

    const filteredProjects = useMemo(() => {
        const all = projects ?? [];
        const byTab = all.filter((p) => {
            if (tab === 'trash') return !!p.deletedAt;
            // active and archived tabs both exclude trashed
            if (p.deletedAt) return false;
            return tab === 'archived' ? !!p.archivedAt : !p.archivedAt;
        });
        const q = searchQuery.trim().toLowerCase();
        const bySearch = q
            ? byTab.filter(
                  (p) =>
                      p.title.toLowerCase().includes(q) ||
                      (p.contextNote ?? '').toLowerCase().includes(q)
              )
            : byTab;
        return [...bySearch].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }, [projects, tab, searchQuery]);

    const counts = useMemo(() => {
        const all = projects ?? [];
        return {
            active: all.filter((p) => !p.archivedAt && !p.deletedAt).length,
            archived: all.filter((p) => !!p.archivedAt && !p.deletedAt).length,
            trash: all.filter((p) => !!p.deletedAt).length,
        };
    }, [projects]);

    // Sessions count per project (client-side aggregation)
    const sessionsByProject = useMemo(() => {
        const map = new Map<string, number>();
        for (const s of sessions ?? []) {
            if (s.projectId) {
                map.set(s.projectId, (map.get(s.projectId) ?? 0) + 1);
            }
        }
        return map;
    }, [sessions]);

    const handleArchive = async (project: AIProject, archive: boolean) => {
        try {
            await archiveProject.mutateAsync({ projectId: project.id, archived: archive });
            toast.success(archive ? `"${project.title}" archivado` : `"${project.title}" restaurado`);
        } catch (err: any) {
            toast.error(err?.message ?? 'Error al archivar');
        }
    };

    const handleSoftDelete = async (project: AIProject, deleted: boolean) => {
        try {
            await softDeleteProject.mutateAsync({ projectId: project.id, deleted });
            toast.success(
                deleted
                    ? `"${project.title}" movido a la papelera`
                    : `"${project.title}" restaurado`
            );
        } catch (err: any) {
            toast.error(err?.message ?? 'Error');
        }
    };

    const handleHardDelete = async () => {
        if (!confirmHardDelete) return;
        try {
            await deleteProject.mutateAsync(confirmHardDelete.id);
            toast.success(`"${confirmHardDelete.title}" eliminado permanentemente`);
            setConfirmHardDelete(null);
        } catch (err: any) {
            toast.error(err?.message ?? 'Error al eliminar');
        }
    };

    const isCompletelyEmpty =
        !isLoadingProjects &&
        counts.active === 0 &&
        counts.archived === 0 &&
        counts.trash === 0;

    if (isCompletelyEmpty) {
        return (
            <div className="min-h-full bg-background text-foreground antialiased">
                <ProjectsEmptyState onCreateProject={handleOpenCreate} />

                {dialogState && (
                    <ProjectEditDialog
                        project={dialogState.mode === 'edit' ? dialogState.project : undefined}
                        initialType={dialogState.mode === 'create' ? dialogState.initialType : undefined}
                        onClose={() => setDialogState(null)}
                    />
                )}

                <UpgradeRequiredModal
                    open={upgradeModalOpen}
                    onOpenChange={setUpgradeModalOpen}
                    reason="module_restricted"
                    module="Proyectos"
                />
            </div>
        );
    }

    return (
        <div className="min-h-full bg-background text-foreground antialiased">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-6 space-y-5">
                {/* Compact header — single line. The descriptive
                    blurb that explains what a project is lives in the
                    empty state; once the user has data, the page is
                    operational, not didactic. */}
                <header className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-baseline gap-2">
                        <h1 className="font-reading text-[22px] md:text-[24px] leading-none tracking-[-0.01em] text-foreground">
                            Tus proyectos
                        </h1>
                        <span className="text-[13px] text-muted-foreground tabular-nums">
                            · {counts.active}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="hidden sm:flex items-center border border-border/60 rounded-md overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setViewModePersisted('grid')}
                                className={cn(
                                    'h-8 w-8 inline-flex items-center justify-center transition-colors',
                                    viewMode === 'grid'
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                                )}
                                aria-label="Vista de cuadrícula"
                                title="Vista de cuadrícula"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewModePersisted('list')}
                                className={cn(
                                    'h-8 w-8 inline-flex items-center justify-center transition-colors',
                                    viewMode === 'list'
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                                )}
                                aria-label="Vista de lista"
                                title="Vista de lista"
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </div>
                        <Button
                            onClick={handleOpenCreate}
                            className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground font-medium gap-1.5 shrink-0"
                            size="sm"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo proyecto
                        </Button>
                    </div>
                </header>

                {/* Filter bar — tabs + search compact */}
                <div className="flex items-center justify-between gap-3 border-b border-border/60">
                    <div className="flex items-center gap-1">
                        {(['active', 'archived', 'trash'] as const).map((t) => {
                            const isActive = tab === t;
                            const count =
                                t === 'active'
                                    ? counts.active
                                    : t === 'archived'
                                      ? counts.archived
                                      : counts.trash;
                            const label =
                                t === 'active' ? 'Activos' : t === 'archived' ? 'Archivados' : 'Papelera';
                            return (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={cn(
                                        'inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                                        isActive
                                            ? 'border-primary text-foreground'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {label}
                                    <span
                                        className={cn(
                                            'text-[11px] font-mono',
                                            isActive ? 'text-muted-foreground' : 'text-muted-foreground/70'
                                        )}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative w-48 sm:w-64 mb-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                        <Input
                            type="text"
                            placeholder="Buscar…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-8 border-border/60 text-[13px]"
                        />
                    </div>
                </div>

                {/* Content */}
                {isLoadingProjects ? (
                    <div className="py-20 flex justify-center">
                        <Loader2 className="h-6 w-6 text-muted-foreground/70 animate-spin" />
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="bg-muted/40 border border-border/60 rounded-xl px-6 py-12 text-center">
                        <FolderKanban className="h-6 w-6 text-muted-foreground/70 mx-auto mb-3" />
                        <p className="text-[14px] text-muted-foreground">
                            {searchQuery
                                ? `Sin coincidencias para "${searchQuery}" en ${tab === 'archived' ? 'archivados' : tab === 'trash' ? 'papelera' : 'activos'}.`
                                : tab === 'archived'
                                  ? 'No tienes proyectos archivados.'
                                  : tab === 'trash'
                                    ? 'La papelera está vacía.'
                                    : 'No tienes proyectos activos.'}
                        </p>
                    </div>
                ) : viewMode === 'list' ? (
                    <section className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/60 bg-card">
                        {filteredProjects.map((project) => {
                            const sessionCount = sessionsByProject.get(project.id) ?? 0;
                            const sourceCount = project.sourceIds?.length ?? 0;
                            const typeMeta = PROJECT_TYPES[project.type] ?? PROJECT_TYPES.general;
                            const TypeIcon = typeMeta.icon;
                            return (
                                <button
                                    key={project.id}
                                    onClick={() => navigate(`/dashboard/projects/${project.id}`)}
                                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                                >
                                    <span className={cn('h-2 w-2 rounded-full shrink-0', COLOR_DOT_BG[project.color] ?? 'bg-slate-400')} />
                                    <span className="inline-flex items-center gap-1 text-[10.5px] uppercase font-semibold tracking-wider text-muted-foreground w-24 shrink-0">
                                        <TypeIcon className="h-3 w-3" />
                                        {typeMeta.label}
                                    </span>
                                    <span className="font-reading text-[15px] text-foreground flex-1 truncate">
                                        {project.title}
                                    </span>
                                    <span className="hidden md:flex items-center gap-3 text-[12px] text-muted-foreground shrink-0">
                                        <span className="inline-flex items-center gap-1" title="Sesiones">
                                            <MessageSquareQuote className="h-3.5 w-3.5" />
                                            {sessionCount}
                                        </span>
                                        <span className="inline-flex items-center gap-1" title="Fuentes">
                                            <FileText className="h-3.5 w-3.5" />
                                            {sourceCount}
                                        </span>
                                        <span className="inline-flex items-center gap-1 w-20 justify-end">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(project.updatedAt).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </section>
                ) : (
                    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {filteredProjects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                sessionCount={sessionsByProject.get(project.id) ?? 0}
                                onEdit={(p) => setDialogState({ mode: 'edit', project: p })}
                                onArchive={handleArchive}
                                onSoftDelete={handleSoftDelete}
                                onHardDeleteRequest={setConfirmHardDelete}
                            />
                        ))}
                    </section>
                )}
            </div>

            {/* Create / Edit dialog */}
            {dialogState && (
                <ProjectEditDialog
                    project={dialogState.mode === 'edit' ? dialogState.project : undefined}
                    initialType={dialogState.mode === 'create' ? dialogState.initialType : undefined}
                    onClose={() => setDialogState(null)}
                />
            )}

            {/* Free-tier gate: shown when a Free user clicks "Nuevo proyecto". */}
            <UpgradeRequiredModal
                open={upgradeModalOpen}
                onOpenChange={setUpgradeModalOpen}
                reason="module_restricted"
                module="Proyectos"
            />

            {/* Permanent delete confirmation (only from trash tab) */}
            <AlertDialog
                open={!!confirmHardDelete}
                onOpenChange={(o) => !o && setConfirmHardDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar permanentemente</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{confirmHardDelete?.title}" se eliminará para siempre. Las sesiones de
                            chat asociadas pasarán a "Sin proyecto" y los sermones quedarán sin
                            vincular. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleHardDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Eliminar permanentemente
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

