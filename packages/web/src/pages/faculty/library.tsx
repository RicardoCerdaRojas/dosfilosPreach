import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useUserExtractions, useExtraction, useExtractionMutations } from '@/hooks/faculty';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { FacultyExtractionsList } from '@/components/faculty/FacultyExtractionsList';
import { FacultyDocumentEditor } from '@/components/faculty/FacultyDocumentEditor';
import { ExtractionFilters, filterExtractions, type TypeFilterValue, type TimeFilterValue } from '@/components/faculty/ExtractionFilters';
import { EmailExtractionDialog } from '@/components/faculty/EmailExtractionDialog';
import { PublishToWordpressDialog } from '@/components/faculty/PublishToWordpressDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, MessageSquareQuote, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Extraction } from '@dosfilos/domain';
import { useConfirm } from '@/hooks/useConfirm';
import { useMarkdownAutosave } from './hooks/useMarkdownAutosave';

/**
 * Cross-session library page at /dashboard/faculty/library. Lists every
 * extraction the user has ever generated, with a search filter and a
 * full-width editor for the currently-selected artifact. This is the
 * "all my generated work" view — analog to NotebookLM's notebook list
 * but for derived artifacts rather than source notebooks.
 */
export function FacultyLibraryPage() {
    const { t } = useTranslation('faculty');
    const { confirm, confirmDialog } = useConfirm();
    const navigate = useNavigate();
    const { extractions, isLoading } = useUserExtractions();
    const { projects } = useFacultyProjects();
    const { updateMarkdown, rename, addToProject, removeFromProject, deleteExtraction } = useExtractionMutations();

    const [selectedId, setSelectedId] = useState<string | null>(null);

    // The list comes back trimmed (no `markdown` body); the full document
    // for the selected artifact is fetched on demand here. Seeds the editor
    // draft and serves as the autosave baseline.
    const { extraction: fullSelected } = useExtraction(selectedId ?? undefined);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
    const [timeFilter, setTimeFilter] = useState<TimeFilterValue>('all');
    const [emailDialogExtraction, setEmailDialogExtraction] = useState<Extraction | null>(null);
    const [wpDialogExtraction, setWpDialogExtraction] = useState<Extraction | null>(null);
    const [draftMarkdown, setDraftMarkdown] = useState<string>('');
    const [draftFor, setDraftFor] = useState<string | null>(null);

    /**
     * Selecting only sets the id + clears the draft. The list is trimmed
     * (no `markdown`), so the body can't be seeded synchronously; the seed
     * effect below fills it once `useExtraction` resolves the full doc. The
     * editor stays gated on `draftFor === selectedId` so it never mounts with
     * a stale/empty body (MDXEditor is uncontrolled — it reads `markdown` only
     * on mount).
     */
    const selectExtraction = (extraction: Extraction) => {
        setSelectedId(extraction.id);
        setDraftMarkdown('');
        setDraftFor(null);
    };

    // Seed the editor draft once the full document for the current selection
    // has loaded. Guarded by `draftFor === selectedId` so it seeds exactly
    // once per selection and never clobbers in-progress edits.
    useEffect(() => {
        if (!selectedId) return;
        if (draftFor === selectedId) return;
        if (!fullSelected || fullSelected.id !== selectedId) return;
        setDraftMarkdown(fullSelected.markdown);
        setDraftFor(selectedId);
    }, [selectedId, fullSelected, draftFor]);

    // Autoguardado con acuse: el estado viaja a la barra del editor, y
    // guardar al cerrar es tarea del hook. La comparación es contra el
    // documento cargado, no contra la entrada recortada de la lista,
    // que no trae cuerpo.
    const autosave = useMarkdownAutosave({
        documentId: selectedId,
        draft: draftMarkdown,
        original: fullSelected?.id === selectedId ? fullSelected.markdown : undefined,
        enabled: draftFor === selectedId,
        save: (extractionId, markdown) =>
            updateMarkdown.mutateAsync({ extractionId, markdown }),
    });

    const filtered = useMemo(() => {
        const afterFilters = filterExtractions(extractions, typeFilter, timeFilter);
        const q = query.trim().toLowerCase();
        if (!q) return afterFilters;
        // Search runs over title + type only. The list is trimmed (no
        // `markdown` body crosses the wire), so full-text body search is not
        // available here — opening an artifact loads its body on demand.
        return afterFilters.filter(e =>
            e.title.toLowerCase().includes(q) ||
            e.type.toLowerCase().includes(q),
        );
    }, [extractions, query, typeFilter, timeFilter]);

    const selected = useMemo(
        () => extractions.find(e => e.id === selectedId) ?? null,
        [extractions, selectedId],
    );

    const handleRename = (extraction: Extraction, newTitle: string) => {
        rename.mutate({ extractionId: extraction.id, title: newTitle });
    };

    const handleAddToProject = (extraction: Extraction, projectId: string) => {
        addToProject.mutate({ extractionId: extraction.id, projectId });
        toast.success(t('extractionsList.toast.pinned'));
    };

    const handleRemoveFromProject = (extraction: Extraction, projectId: string) => {
        removeFromProject.mutate({ extractionId: extraction.id, projectId });
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

    // True empty state — user has zero extractions. Render a full-page
    // invitational state instead of the dual-panel layout (which would
    // show two generic placeholders that read like broken UI).
    const isCompletelyEmpty = !isLoading && extractions.length === 0;

    if (isCompletelyEmpty) {
        return (
            <div className="flex flex-col h-[calc(100vh-var(--alto-barra))] bg-background">
                <header className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                        <h1 className="font-semibold text-lg">{t('library.title')}</h1>
                        <p className="text-xs text-muted-foreground">{t('library.subtitle')}</p>
                    </div>
                </header>
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="max-w-md text-center space-y-5">
                        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="font-reading text-[24px] leading-tight text-foreground">
                                {t('library.empty.title')}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {t('library.empty.body')}
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard/faculty')}
                            className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground gap-2"
                        >
                            <MessageSquareQuote className="h-4 w-4" />
                            {t('library.empty.cta')}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-var(--alto-barra))]">
            <header className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
                <div className="flex-1">
                    <h1 className="font-semibold text-lg">{t('library.title')}</h1>
                    <p className="text-xs text-muted-foreground">{t('library.subtitle')}</p>
                </div>
                <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder={t('library.searchPlaceholder')}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="pl-9"
                    />
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
                    {selected && draftFor === selected.id ? (
                        <FacultyDocumentEditor
                            // Remount on artifact change. MDXEditor is
                            // uncontrolled — it only reads the `markdown`
                            // prop on mount, so without a fresh key it
                            // keeps showing whatever was loaded first
                            // (in this case nothing). The Vista previa
                            // path renders independently and was the
                            // only thing showing content before this fix.
                            key={selected.id}
                            title={selected.title}
                            markdown={draftMarkdown}
                            onChange={setDraftMarkdown}
                            onMicroAction={async () => {
                                // Micro-actions require live chat-session
                                // context for the agent retrieval. From
                                // the library view (no session) they're
                                // disabled.
                                toast.info(t('library.microActionsUnavailable'));
                                return '';
                            }}
                            isProcessing={false}
                            saveStatus={autosave.status}
                            onRetrySave={autosave.retry}
                            isZenMode={false}
                        />
                    ) : selected ? (
                        // Selected but the full body is still loading.
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            {t('library.loading')}
                        </div>
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
