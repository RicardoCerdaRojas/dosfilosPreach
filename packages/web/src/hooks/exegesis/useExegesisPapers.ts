import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService, libraryService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';
import type {
    AddProjectSourceInput,
    CreateExegeticalPaperInput,
    ExtractRubricFromTextInput,
    UpdateProjectSourceInput,
    UpdateRubricInput,
    UpdateStepPlanInput,
} from '@dosfilos/domain';

/**
 * Reads a File's bytes as base64 (no `data:` URI prefix). Used by the
 * image-rubric extraction path that sends the image inline to Gemini
 * Vision instead of routing through the library upload pipeline.
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result ?? '');
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });
}

/**
 * React Query hook for the exegetical papers list + paper-level mutations.
 * Mirrors the cache-key conventions of `useFacultyProjects`:
 * `['exegesis', 'papers', userId]` for the list, and any mutation
 * invalidates that key on success.
 *
 * Source mutations (add/update/remove) live here too — sources are stored
 * inline on the paper document, so changing them invalidates the same
 * cache key as paper updates would.
 */
export function useExegesisPapers() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();

    const papersQuery = useQuery({
        queryKey: ['exegesis', 'papers', user?.uid],
        queryFn: async () => {
            if (!user?.uid) throw new Error('User not authenticated');
            // Trimmed summaries (no steps/assembledMarkdown/sources) — the list
            // only needs headline fields + counts. Full paper loads on open.
            return exegesisService.listPaperSummaries.execute(user.uid);
        },
        enabled: !!user?.uid,
    });

    const createPaper = useMutation({
        mutationFn: async (input: Omit<CreateExegeticalPaperInput, 'ownerId'>) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.createPaper.execute({ ...input, ownerId: user.uid });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const archivePaper = useMutation({
        mutationFn: async ({ paperId, archived }: { paperId: string; archived: boolean }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return archived
                ? exegesisService.archivePaper.archive(user.uid, paperId)
                : exegesisService.archivePaper.unarchive(user.uid, paperId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    /**
     * Adjunta una guía de estilo al trabajo, COPIÁNDOLA. Volver a
     * llamarlo con la misma guía es «actualizar a la versión actual»:
     * la copia sólo cambia cuando el usuario lo pide.
     */
    const setPaperStyleGuide = useMutation({
        mutationFn: async ({ paperId, styleGuideId }: { paperId: string; styleGuideId: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.setPaperStyleGuide.execute({
                ownerId: user.uid,
                paperId,
                styleGuideId,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const updatePaperBrief = useMutation({
        mutationFn: async ({ paperId, assignmentBrief }: { paperId: string; assignmentBrief: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.updatePaperBrief.execute({
                ownerId: user.uid,
                paperId,
                assignmentBrief,
            });
        },
        onSuccess: (paper) => {
            // El trabajo devuelto ya trae el encuadre nuevo: sembrarlo evita que
            // el panel muestre el texto viejo mientras llega la relectura.
            queryClient.setQueryData(['exegesis', 'papers', user?.uid, paper.id], paper);
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const updateStepPlan = useMutation({
        mutationFn: async (input: Omit<UpdateStepPlanInput, 'ownerId'>) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.updateStepPlan.execute({ ...input, ownerId: user.uid });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const updateRubric = useMutation({
        mutationFn: async (input: Omit<UpdateRubricInput, 'ownerId'>) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.updateRubric.execute({ ...input, ownerId: user.uid });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const resetRubric = useMutation({
        mutationFn: async ({ paperId }: { paperId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.resetRubric.execute({ ownerId: user.uid, paperId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const extractRubricFromText = useMutation({
        mutationFn: async (input: Omit<ExtractRubricFromTextInput, 'ownerId'>) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.extractRubricFromText.execute({ ...input, ownerId: user.uid });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Document-backed rubric extraction. Uploads a PDF/image via the
    // library pipeline, waits for the LlamaParse extraction to land,
    // then runs the rubric extractor over the resulting text. The
    // optional `onPhase` callback drives the UI's stepper (uploading
    // → extracting → analyzing) so the user knows where they are
    // during the ~30-90s round trip.
    const extractRubricFromDocument = useMutation({
        mutationFn: async (input: {
            paperId: string;
            file: File;
            language?: 'es' | 'en';
            onUploadProgress?: (percentage: number) => void;
            onPhase?: (phase: 'uploading' | 'extracting' | 'analyzing') => void;
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            input.onPhase?.('uploading');
            const resource = await libraryService.uploadResource(
                user.uid,
                input.file,
                {
                    title: input.file.name.replace(/\.[^.]+$/, ''),
                    author: '',
                    type: 'other',
                },
                input.onUploadProgress,
            );
            input.onPhase?.('extracting');
            await waitForResourceTextReady(resource.id);
            input.onPhase?.('analyzing');
            return exegesisService.extractRubricFromDocument.execute({
                ownerId: user.uid,
                paperId: input.paperId,
                libraryResourceId: resource.id,
                language: input.language,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    /**
     * Image rubric extraction. Bypasses the library upload + extraction
     * pipeline entirely — encodes the file to base64 in the browser and
     * sends it inline to Gemini Vision in a single multimodal call.
     * Used for clipboard pastes and direct image uploads (PNG / JPEG /
     * WEBP screenshots of a syllabus).
     */
    const extractRubricFromImage = useMutation({
        mutationFn: async (input: {
            paperId: string;
            file: File;
            language?: 'es' | 'en';
            onPhase?: (phase: 'encoding' | 'analyzing') => void;
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            input.onPhase?.('encoding');
            const base64 = await fileToBase64(input.file);
            input.onPhase?.('analyzing');
            return exegesisService.extractRubricFromImage.execute({
                ownerId: user.uid,
                paperId: input.paperId,
                mimeType: input.file.type || 'image/png',
                imageBase64: base64,
                language: input.language,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    /**
     * Preview-only image extraction: runs the same Gemini Vision call
     * as `extractRubricFromImage` but returns the extracted rubric
     * to the caller WITHOUT persisting on the paper. Used by the
     * qualitative-criteria editor so the student can append criteria
     * pulled from an image without clobbering the prescriptive
     * sections (source requirements, structural recommendations).
     */
    const extractRubricPreviewFromImage = useMutation({
        mutationFn: async (input: {
            paperId: string;
            file: File;
            language?: 'es' | 'en';
            onPhase?: (phase: 'encoding' | 'analyzing') => void;
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            input.onPhase?.('encoding');
            const base64 = await fileToBase64(input.file);
            input.onPhase?.('analyzing');
            return exegesisService.extractRubricPreviewFromImage.execute({
                ownerId: user.uid,
                paperId: input.paperId,
                mimeType: input.file.type || 'image/png',
                imageBase64: base64,
                language: input.language,
            });
        },
        // No invalidate — this mutation doesn't write to the paper.
    });

    const addSource = useMutation({
        mutationFn: async (input: AddProjectSourceInput & { paperId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.addSource.execute({ ...input, ownerId: user.uid });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const updateSource = useMutation({
        mutationFn: async (input: UpdateProjectSourceInput & { paperId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.updateSource.execute({ ...input, ownerId: user.uid });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const removeSource = useMutation({
        mutationFn: async ({ paperId, sourceId }: { paperId: string; sourceId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.removeSource.execute({ ownerId: user.uid, paperId, sourceId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // ── Step mutations (D.1: state machine + placeholder generation) ──────

    const seedSteps = useMutation({
        mutationFn: async ({ paperId }: { paperId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.seedSteps.execute(user.uid, paperId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const generateStep = useMutation({
        mutationFn: async ({ paperId, stepId, regenerationHint }: { paperId: string; stepId: string; regenerationHint?: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.generateStep.execute({
                ownerId: user.uid,
                paperId,
                stepId,
                regenerationHint,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Canonical analysis pipeline (Phase 2 architecture). Produces a
    // structured `CanonicalVerseAnalysis` for one verse step instead
    // of free-form markdown. Coexists with `generateStep` during the
    // migration — verse cards opt into the new path via a dedicated
    // CTA. The mutation invalidates the same papers cache so the UI
    // re-fetches the step with its new accepted analysis.
    const analyzeVerseCanonically = useMutation({
        mutationFn: async ({ paperId, stepId, regenerationHint }: { paperId: string; stepId: string; regenerationHint?: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.analyzeVerseCanonically.execute({
                ownerId: user.uid,
                paperId,
                stepId,
                regenerationHint: regenerationHint ?? null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Academic-paper composer over accepted verse analyses (Phase 3).
    // Returns the composed markdown + formatter status. The caller
    // surfaces it to the user (export dialog, preview pane, etc.) —
    // we do NOT auto-persist the composition because the same
    // analyses can produce many compositions (academic, sermon,
    // devotional) and persisting wholesale would muddle that.
    // The `persist` flag opts into saving to `paper.assembledMarkdown`.
    const composeAcademicPaper = useMutation({
        mutationFn: async ({ paperId, persist }: { paperId: string; persist?: boolean }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.composeAcademicPaper.execute({
                ownerId: user.uid,
                paperId,
                persist,
            });
        },
        onSuccess: (_data, vars) => {
            // Only invalidate when we persisted — otherwise the
            // papers cache wasn't touched and an invalidation would
            // trigger a needless refetch.
            if (vars.persist) {
                queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
            }
        },
    });

    /**
     * Guarda una composición ya hecha como ensamble del trabajo.
     *
     * Separado de `composeAcademicPaper` porque guardar no debe componer:
     * el botón «Guardar al paper» volvía a llamar al compositor, así que
     * un paper costaba dos llamadas de Gemini Pro y lo archivado no era
     * lo que el usuario había revisado.
     */
    const saveAssembledPaper = useMutation({
        mutationFn: async ({ paperId, markdown }: { paperId: string; markdown: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.saveAssembledPaper.execute({
                ownerId: user.uid,
                paperId,
                markdown,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Section composers (Phase 5). Granular path that lets the user
    // compose conclusion and introduction independently. Both append
    // a new step version that the user reviews + accepts the same
    // way as legacy generation. Introduction enforces academic order:
    // it requires the conclusion to be accepted first.
    const composeConclusionFromAnalyses = useMutation({
        mutationFn: async ({ paperId, regenerationHint }: { paperId: string; regenerationHint?: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.composeConclusionFromAnalyses.execute({
                ownerId: user.uid,
                paperId,
                regenerationHint: regenerationHint ?? null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const composeIntroductionFromAnalyses = useMutation({
        mutationFn: async ({ paperId, regenerationHint }: { paperId: string; regenerationHint?: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.composeIntroductionFromAnalyses.execute({
                ownerId: user.uid,
                paperId,
                regenerationHint: regenerationHint ?? null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Per-verse academic-prose composer. PERSISTS the result on the
    // version's `markdown` field so re-renders are free until the
    // analysis changes (a new analysis version starts with empty
    // markdown again).
    const composeVerseAcademicProse = useMutation({
        mutationFn: async ({ paperId, stepId }: { paperId: string; stepId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.composeVerseAcademicProse.execute({
                ownerId: user.uid,
                paperId,
                stepId,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Ministry composers (Phase 6) — sermon, devotional, study guide.
    // None of them mutate paper state, so no cache invalidation
    // needed. The output goes to the user via copy/download/handoff
    // dialogs.
    const composeSermonFromAnalyses = useMutation({
        mutationFn: async ({ paperId, tone, regenerationHint }: { paperId: string; tone: 'pastoral' | 'expositivo' | 'narrativo'; regenerationHint?: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.composeSermonFromAnalyses.execute({
                ownerId: user.uid,
                paperId,
                tone,
                regenerationHint: regenerationHint ?? null,
            });
        },
    });
    const composeDevotionalFromAnalyses = useMutation({
        mutationFn: async ({ paperId, audience, regenerationHint }: { paperId: string; audience: 'general' | 'small-group' | 'individual'; regenerationHint?: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.composeDevotionalFromAnalyses.execute({
                ownerId: user.uid,
                paperId,
                audience,
                regenerationHint: regenerationHint ?? null,
            });
        },
    });
    const composeStudyGuideFromAnalyses = useMutation({
        mutationFn: async ({ paperId, audience, regenerationHint }: { paperId: string; audience: 'small-group' | 'sunday-school' | 'individual'; regenerationHint?: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.composeStudyGuideFromAnalyses.execute({
                ownerId: user.uid,
                paperId,
                audience,
                regenerationHint: regenerationHint ?? null,
            });
        },
    });

    const acceptStep = useMutation({
        mutationFn: async ({ paperId, stepId, versionId }: { paperId: string; stepId: string; versionId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.acceptStep.execute({
                ownerId: user.uid,
                paperId,
                stepId,
                versionId,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    const saveStepEdit = useMutation({
        mutationFn: async ({ paperId, stepId, markdown }: { paperId: string; stepId: string; markdown: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.saveStepEdit.execute({
                ownerId: user.uid,
                paperId,
                stepId,
                markdown,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Source-type auto-classification — single Gemini call over the
    // first ~5k chars of a resource's extracted text. Used by the
    // corpus-attach UI to pre-select the SourceType dropdown.
    const classifySourceType = useMutation({
        mutationFn: async (input: {
            rawText: string;
            title?: string | null;
            author?: string | null;
            language?: 'es' | 'en';
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.classifySourceType.execute(input);
        },
    });

    // Citation verification (v1.5 — programmatic fuzzy match). Returns
    // the per-citation list AND the persisted summary; the dialog
    // renders the list, the badge in the step header reflects the
    // summary that was written back to the version.
    const verifyStepCitations = useMutation({
        mutationFn: async ({ paperId, stepId, versionId }: {
            paperId: string;
            stepId: string;
            versionId?: string;
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.verifyStepCitations.execute({
                ownerId: user.uid,
                paperId,
                stepId,
                versionId,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });

    // Cross-section coherence pass — single Gemini call across the
    // whole accepted paper. Result is NOT persisted; the dialog
    // renders the snapshot.
    const runCoherencePass = useMutation({
        mutationFn: async ({ paperId, language }: {
            paperId: string;
            language?: 'es' | 'en';
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.runCoherencePass.execute({
                ownerId: user.uid,
                paperId,
                language,
            });
        },
    });

    // Puente: paper → estudio pastoral de 8 pasos. No contacta ningún
    // modelo (arma la referencia desde los análisis ya aceptados), así
    // que responde al instante y no hay estado de "generando". Se
    // invalida el caché de sermones para que "Material reciente" muestre
    // el sermón recién vinculado sin refrescar a mano.
    const startStudyFromPaper = useMutation({
        mutationFn: async ({ paperId }: { paperId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.startStudyFromPaper.execute({
                paperId,
                actorUserId: user.uid,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sermons', user?.uid] });
            // La fila del planificador pasa de "Llevar al estudio" a
            // "Abrir estudio" cuando el caso de uso escribe
            // plannedSermons[].draftId — refrescar el caché de series.
            queryClient.invalidateQueries({ queryKey: ['series'] });
        },
    });

    // Persist a composition output (academic paper or ministry
    // sermon/devotional/study-guide markdown) as an Extraction so it
    // survives dialog close + shows up in Mis Recursos and the
    // per-paper "Artefactos derivados" panel.
    const saveExegesisArtifact = useMutation({
        mutationFn: async (input: {
            paperId: string;
            artifactType: 'academic-paper' | 'sermon-outline' | 'devotional' | 'study-guide';
            title: string;
            markdown: string;
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.saveExegesisArtifactExtraction.execute({
                ownerId: user.uid,
                paperId: input.paperId,
                artifactType: input.artifactType,
                title: input.title,
                markdown: input.markdown,
            });
        },
        onSuccess: () => {
            // Mis Recursos (extractions list) + per-paper artifacts
            // hook (Phase C). Both keys are namespaced by user.
            queryClient.invalidateQueries({ queryKey: ['extractions', user?.uid] });
            queryClient.invalidateQueries({ queryKey: ['paper-artifacts'] });
        },
    });

    return {
        papers: papersQuery.data ?? [],
        isLoading: papersQuery.isLoading,
        error: papersQuery.error,
        createPaper,
        archivePaper,
        updatePaperBrief,
        setPaperStyleGuide,
        updateStepPlan,
        updateRubric,
        resetRubric,
        extractRubricFromText,
        extractRubricFromDocument,
        extractRubricFromImage,
        extractRubricPreviewFromImage,
        addSource,
        updateSource,
        removeSource,
        seedSteps,
        generateStep,
        acceptStep,
        saveStepEdit,
        verifyStepCitations,
        runCoherencePass,
        classifySourceType,
        startStudyFromPaper,
        analyzeVerseCanonically,
        composeAcademicPaper,
        saveAssembledPaper,
        composeConclusionFromAnalyses,
        composeIntroductionFromAnalyses,
        composeVerseAcademicProse,
        composeSermonFromAnalyses,
        composeDevotionalFromAnalyses,
        composeStudyGuideFromAnalyses,
        saveExegesisArtifact,
    };
}

/**
 * Polls `libraryService.getResource` until the resource has extracted
 * text available, or the timeout elapses. Used by the document-backed
 * rubric extractor mutation — the UI uploaded the file via the
 * library pipeline but can't run the rubric extractor until LlamaParse
 * (or the Gemini fallback) lands the text.
 *
 * Resolves with the resource on success, throws otherwise. The 90s
 * window covers typical 1-3 page rubrics; longer documents push
 * latency but rubrics rarely exceed a handful of pages.
 */
async function waitForResourceTextReady(
    resourceId: string,
    options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 90_000;
    const intervalMs = options.intervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const resource = await libraryService.getResource(resourceId);
        if (resource?.textContent && resource.textContent.trim().length > 0) {
            return;
        }
        // textExtractionStatus on the entity tracks failure; bail
        // early instead of waiting for the timeout.
        if (resource?.textExtractionStatus === 'failed') {
            throw new Error('Library resource extraction failed; cannot extract rubric.');
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error('Library resource extraction timed out; please retry.');
}
