import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useProjectExtractions, useExtractionMutations } from '@/hooks/faculty';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { FacultyExtractionsList } from '@/components/faculty/FacultyExtractionsList';
import { FacultyDocumentEditor } from '@/components/faculty/FacultyDocumentEditor';
import { ExtractionFilters, filterExtractions, type TypeFilterValue, type TimeFilterValue } from '@/components/faculty/ExtractionFilters';
import { EmailExtractionDialog } from '@/components/faculty/EmailExtractionDialog';
import { PublishToWordpressDialog } from '@/components/faculty/PublishToWordpressDialog';
import { FolderOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Extraction } from '@dosfilos/domain';
import { useConfirm } from '@/hooks/useConfirm';
import { useMarkdownAutosave } from './hooks/useMarkdownAutosave';

/**
 * Per-project library page at /dashboard/faculty/projects/:projectId/library.
 * Same shape as the cross-session library but filtered to artifacts
 * pinned to a single project. Useful when the user has accumulated a
 * series of derived documents (devotionals for Advent, sermon outlines
 * for a Romans series, etc.) and wants them grouped.
 */
export function ProjectLibraryPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation('faculty');
    const { confirm, confirmDialog } = useConfirm();
    const { extractions, isLoading } = useProjectExtractions(projectId);
    const { projects } = useFacultyProjects();
    const { updateMarkdown, rename, addToProject, removeFromProject, deleteExtraction } = useExtractionMutations();

    const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draftMarkdown, setDraftMarkdown] = useState<string>('');
    const [draftFor, setDraftFor] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
    const [timeFilter, setTimeFilter] = useState<TimeFilterValue>('all');
    const [emailDialogExtraction, setEmailDialogExtraction] = useState<Extraction | null>(null);
    const [wpDialogExtraction, setWpDialogExtraction] = useState<Extraction | null>(null);
    const filtered = useMemo(
        () => filterExtractions(extractions, typeFilter, timeFilter),
        [extractions, typeFilter, timeFilter],
    );

    const selected = useMemo(
        () => extractions.find(e => e.id === selectedId) ?? null,
        [extractions, selectedId],
    );

    /**
     * Atomic selection setter — see library.tsx for the underlying
     * race the synchronous batch resolves.
     */
    const selectExtraction = (extraction: Extraction) => {
        setSelectedId(extraction.id);
        setDraftMarkdown(extraction.markdown);
        setDraftFor(extraction.id);
    };

    // Fallback re-seed for clicks that landed before the list loaded.
    useEffect(() => {
        if (!selectedId) return;
        if (draftFor === selectedId) return;
        const found = extractions.find(e => e.id === selectedId);
        if (!found) return;
        setDraftMarkdown(found.markdown);
        setDraftFor(selectedId);
    }, [selectedId, extractions, draftFor]);

    // Autoguardado con acuse: el estado viaja a la barra del editor, y
    // guardar al cerrar es tarea del hook.
    const autosave = useMarkdownAutosave({
        documentId: selectedId,
        draft: draftMarkdown,
        original: extractions.find(e => e.id === selectedId)?.markdown,
        enabled: draftFor === selectedId,
        save: (extractionId, markdown) =>
            updateMarkdown.mutateAsync({ extractionId, markdown }),
    });

    const handleRename = (extraction: Extraction, newTitle: string) => {
        rename.mutate({ extractionId: extraction.id, title: newTitle });
    };

    const handleAddToProject = (extraction: Extraction, pid: string) => {
        addToProject.mutate({ extractionId: extraction.id, projectId: pid });
        toast.success(t('extractionsList.toast.pinned'));
    };

    const handleRemoveFromProject = (extraction: Extraction, pid: string) => {
        removeFromProject.mutate({ extractionId: extraction.id, projectId: pid });
        toast.success(t('extractionsList.toast.unpinned'));
    };

    const handleDelete = async (extraction: Extraction) => {
        if (!await confirm({ body: t('extractionsList.confirmDelete') })) return;
        // La fila desaparece al confirmar (borrado optimista en el hook).
        // Si el servidor rechaza, vuelve a su lugar y hay que decirlo:
        // una fila que reaparece sin explicación se lee como un fallo de
        // la pantalla, no del borrado.
        deleteExtraction.mutate(extraction.id, {
            onError: () => toast.error(t('extractionsList.toast.deleteError')),
        });
        if (selectedId === extraction.id) setSelectedId(null);
    };

    const handleJumpToOrigin = (extraction: Extraction) => {
        if (!extraction.sessionId) return;
        const hash = extraction.derivedFromMessageIds.length > 0
            ? `#origin=${extraction.derivedFromMessageIds.slice(-3).join(',')}`
            : '';
        navigate(`/dashboard/faculty/${extraction.sessionId}${hash}`);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-var(--alto-barra))]">
            <header className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/dashboard/faculty')}
                    aria-label="back"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <FolderOpen className="w-5 h-5 text-indigo-500" />
                <div className="flex-1">
                    <h1 className="font-semibold text-lg">
                        {project?.title ?? t('library.projectLibraryFallbackTitle')}
                    </h1>
                    <p className="text-xs text-muted-foreground">{t('library.projectSubtitle')}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                    {t('library.count', { count: extractions.length })}
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <aside className="w-[24rem] border-r flex flex-col shrink-0">
                    <ExtractionFilters
                        typeFilter={typeFilter}
                        timeFilter={timeFilter}
                        onTypeChange={setTypeFilter}
                        onTimeChange={setTimeFilter}
                    />
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                            {t('library.loading')}
                        </div>
                    ) : (
                        <FacultyExtractionsList
                            extractions={filtered}
                            selectedId={selectedId}
                            onSelect={selectExtraction}
                            onDelete={handleDelete}
                            onRename={handleRename}
                            onAddToProject={handleAddToProject}
                            onRemoveFromProject={handleRemoveFromProject}
                            projects={projects}
                            onJumpToOrigin={handleJumpToOrigin}
                            onOpenExternal={(extraction) => {
                                if (extraction.externalRef?.collection === 'sermons') {
                                    navigate(`/dashboard/sermons/${extraction.externalRef.id}`);
                                }
                            }}
                            onShareByEmail={setEmailDialogExtraction}
                            onPublishToWordpress={setWpDialogExtraction}
                        />
                    )}
                </aside>

                <main className="flex-1 overflow-hidden bg-background">
                    {selected ? (
                        <FacultyDocumentEditor
                            // Remount on artifact change — see library.tsx
                            // for the underlying reason (MDXEditor is
                            // uncontrolled past mount).
                            key={selected.id}
                            title={selected.title}
                            markdown={draftMarkdown}
                            onChange={setDraftMarkdown}
                            onMicroAction={async () => {
                                toast.info(t('library.microActionsUnavailable'));
                                return '';
                            }}
                            isProcessing={false}
                            saveStatus={autosave.status}
                            onRetrySave={autosave.retry}
                            isZenMode={false}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            {t('library.emptyState')}
                        </div>
                    )}
                </main>
            </div>

            <EmailExtractionDialog
                extraction={emailDialogExtraction}
                onClose={() => setEmailDialogExtraction(null)}
            />

            <PublishToWordpressDialog
                extraction={wpDialogExtraction}
                onClose={() => setWpDialogExtraction(null)}
            />

            {confirmDialog}
        </div>
    );
}
