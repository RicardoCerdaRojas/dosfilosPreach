import {
    FirestoreExegeticalPaperRepository,
    FirestoreUserRubricRepository,
    FirestoreUserStyleGuideRepository,
    FirestoreUserAssignmentBriefRepository,
    FirebaseLibraryRepository,
    FirebaseSermonRepository,
    FirebaseSeriesRepository,
    FirestoreExtractionRepository,
    FirestoreAIChatRepository,
    GeminiAcademicComposer,
    GeminiCanonicalVerseAnalyzer,
    GeminiConclusionComposer,
    GeminiDevotionalComposer,
    GeminiIntroductionComposer,
    GeminiVerseAcademicComposer,
    GeminiExegesisOrchestrator,
    GeminiSermonComposer,
    GeminiStudyGuideComposer,
    GeminiPaperRubricExtractor,
    GeminiStyleGuideManifestExtractor,
    DeterministicStyleFormatter,
    FuzzyCitationVerifier,
    GeminiLlmCitationVerifier,
    RetrieveChunksRelevantChunkRetriever,
    GeminiCoherenceReviewer,
    GeminiSourceTypeClassifier,
    RetrieveChunksExcerptExtractor,
    StructuralExcerptExtractor,
    CallableDocumentChunkReader,
    CallableCuratedCorpusRetriever,
    CallableCuratedCorpusReader,
    RetrieveChunksResourceRanker,
    GeminiStepCorpusPlanner,
    MorphhbOriginalLanguageProvider,
    SBLGNTBibleProvider,
    TestamentDispatcherOriginalLanguageProvider,
    extractFootnoteAnchorsFromFormattedMarkdown,
    DocumentPageNumberingReader,
} from '@dosfilos/infrastructure';
import type {
    IResourceContentReader,
    IResourceIndexProbe,
} from '@dosfilos/domain';
import { LibraryService } from './LibraryService';

import {
    CreateExegeticalPaperUseCase,
    ListExegeticalPapersUseCase,
    ListExegesisPaperSummariesUseCase,
    GetExegeticalPaperUseCase,
    ArchiveExegeticalPaperUseCase,
    SetPaperStyleGuideUseCase,
    UpdatePaperBriefUseCase,
    SaveAssembledPaperUseCase,
    UpdateStepPlanUseCase,
    UpdateRubricUseCase,
    ResetRubricUseCase,
    ExtractRubricFromTextUseCase,
    ExtractRubricFromDocumentUseCase,
    ExtractRubricFromImageUseCase,
    ExtractRubricPreviewFromImageUseCase,
    ExtractStyleGuideManifestUseCase,
    ListUserRubricsUseCase,
    CreateUserRubricUseCase,
    UpdateUserRubricUseCase,
    DeleteUserRubricUseCase,
    SetDefaultUserRubricUseCase,
    ListUserAssignmentBriefsUseCase,
    CreateUserAssignmentBriefUseCase,
    UpdateUserAssignmentBriefUseCase,
    DeleteUserAssignmentBriefUseCase,
    SetDefaultUserAssignmentBriefUseCase,
    ApplyRubricTemplateToPaperUseCase,
    ApplyStrategyOnlyRubricToPaperUseCase,
    SaveCurrentRubricAsTemplateUseCase,
    CreateUserRubricFromTextUseCase,
    ListUserStyleGuidesUseCase,
    GetActiveStyleGuideUseCase,
    CreateUserStyleGuideUseCase,
    SetActiveStyleGuideUseCase,
    UpdateUserStyleGuideUseCase,
    UpdateUserStyleGuideManifestUseCase,
    DeleteUserStyleGuideUseCase,
    AddProjectSourceUseCase,
    UpdateProjectSourceUseCase,
    RemoveProjectSourceUseCase,
    ExtractExcerptsForPaperUseCase,
    SelectSourcePagesUseCase,
    ReopenStepUseCase,
    RankLibraryResourcesForPaperUseCase,
    ProposeStepCorpusAllocationsUseCase,
    UpdateStepCorpusAllocationUseCase,
    SeedStepsForPassageUseCase,
    AnalyzeVerseCanonicallyUseCase,
    ComposeAcademicPaperUseCase,
    ComposeConclusionFromAnalysesUseCase,
    ComposeDevotionalFromAnalysesUseCase,
    ComposeIntroductionFromAnalysesUseCase,
    ComposeVerseAcademicProseUseCase,
    ComposeSermonFromAnalysesUseCase,
    ComposeStudyGuideFromAnalysesUseCase,
    GenerateStepUseCase,
    AcceptStepUseCase,
    SaveStepEditUseCase,
    VerifyStepCitationsUseCase,
    RunCoherencePassUseCase,
    ClassifySourceTypeUseCase,
    StartStudyFromPaperUseCase,
    SaveExegesisArtifactExtractionUseCase,
    ListPaperDerivedArtifactsUseCase,
    VerifySermonCitationsUseCase,
} from '../use-cases/exegesis';

/**
 * Composition root for the Exegesis module.
 *
 * Mirrors the pattern of `FacultyService`: exposes use cases as public
 * fields so React Query hooks can invoke them directly without knowing
 * how the dependency graph is wired. The singleton is fine for v1
 * because all dependencies are stateless (the repositories hold no
 * connection state — Firestore SDK manages that globally).
 *
 * Use cases tied to step generation and project sources land here as
 * we build them; v1 currently wires paper CRUD + user-level style guide
 * management.
 */
class ExegesisService {
    // Papers
    public createPaper: CreateExegeticalPaperUseCase;
    public listPapers: ListExegeticalPapersUseCase;
    public listPaperSummaries: ListExegesisPaperSummariesUseCase;
    public getPaper: GetExegeticalPaperUseCase;
    public archivePaper: ArchiveExegeticalPaperUseCase;
    public updatePaperBrief: UpdatePaperBriefUseCase;
    /**
     * Adjunta una guía de estilo al trabajo COPIÁNDOLA. Volver a
     * llamarlo es lo que significa «actualizar a la versión actual»:
     * un acto deliberado, nunca automático.
     */
    public setPaperStyleGuide: SetPaperStyleGuideUseCase;
    public saveAssembledPaper: SaveAssembledPaperUseCase;
    public updateStepPlan: UpdateStepPlanUseCase;
    public updateRubric: UpdateRubricUseCase;
    public resetRubric: ResetRubricUseCase;
    public extractRubricFromText: ExtractRubricFromTextUseCase;
    public extractRubricFromDocument: ExtractRubricFromDocumentUseCase;
    public extractRubricFromImage: ExtractRubricFromImageUseCase;
    public extractRubricPreviewFromImage: ExtractRubricPreviewFromImageUseCase;
    public extractStyleGuideManifest: ExtractStyleGuideManifestUseCase;

    // User-level rubric templates
    public listUserRubrics: ListUserRubricsUseCase;
    public createUserRubric: CreateUserRubricUseCase;
    public updateUserRubric: UpdateUserRubricUseCase;
    public deleteUserRubric: DeleteUserRubricUseCase;
    public setDefaultUserRubric: SetDefaultUserRubricUseCase;
    public applyRubricTemplateToPaper: ApplyRubricTemplateToPaperUseCase;
    public applyStrategyOnlyRubricToPaper: ApplyStrategyOnlyRubricToPaperUseCase;
    public saveCurrentRubricAsTemplate: SaveCurrentRubricAsTemplateUseCase;
    public createUserRubricFromText: CreateUserRubricFromTextUseCase;

    // User-level assignment-brief templates
    public listUserAssignmentBriefs: ListUserAssignmentBriefsUseCase;
    public createUserAssignmentBrief: CreateUserAssignmentBriefUseCase;
    public updateUserAssignmentBrief: UpdateUserAssignmentBriefUseCase;
    public deleteUserAssignmentBrief: DeleteUserAssignmentBriefUseCase;
    public setDefaultUserAssignmentBrief: SetDefaultUserAssignmentBriefUseCase;

    // User style guides
    public listStyleGuides: ListUserStyleGuidesUseCase;
    public getActiveStyleGuide: GetActiveStyleGuideUseCase;
    public createStyleGuide: CreateUserStyleGuideUseCase;
    public setActiveStyleGuide: SetActiveStyleGuideUseCase;
    public updateStyleGuide: UpdateUserStyleGuideUseCase;
    public updateStyleGuideManifest: UpdateUserStyleGuideManifestUseCase;
    public deleteStyleGuide: DeleteUserStyleGuideUseCase;

    // Project sources
    public addSource: AddProjectSourceUseCase;
    public updateSource: UpdateProjectSourceUseCase;
    public removeSource: RemoveProjectSourceUseCase;
    public extractExcerpts: ExtractExcerptsForPaperUseCase;
    public selectSourcePages: SelectSourcePagesUseCase;
    public reopenStep: ReopenStepUseCase;
    public rankLibraryForPaper: RankLibraryResourcesForPaperUseCase;
    public proposeStepCorpusAllocations: ProposeStepCorpusAllocationsUseCase;
    public updateStepCorpusAllocation: UpdateStepCorpusAllocationUseCase;

    // Steps
    public seedSteps: SeedStepsForPassageUseCase;
    public generateStep: GenerateStepUseCase;
    public acceptStep: AcceptStepUseCase;
    public saveStepEdit: SaveStepEditUseCase;
    // Programmatic citation verification (v1.5 differentiator vs
    // NotebookLM). Runs over a step version's accepted markdown,
    // matches cited sources against the paper's project-source list,
    // and persists a per-status summary on the version.
    public verifyStepCitations: VerifyStepCitationsUseCase;
    // Cross-section coherence reviewer — single Gemini pass over the
    // accepted intro + verses + conclusion to surface inconsistencies
    // the per-step prompts cannot see (they only get one step at a time).
    public runCoherencePass: RunCoherencePassUseCase;
    // Source-type auto-classification — pre-fills the SourceType
    // dropdown when the user attaches a corpus item, removing the
    // friction of scrolling 13 categories per upload.
    public classifySourceType: ClassifySourceTypeUseCase;

    // Canonical analysis pipeline (target architecture — see docs/exegesis/METODOLOGIA.md).
    // Coexists with `generateStep` during the migration; produces a
    // structured `CanonicalVerseAnalysis` artifact that downstream
    // composers (academic / sermon / devotional) consume.
    public analyzeVerseCanonically: AnalyzeVerseCanonicallyUseCase;

    // Academic-paper composer over the canonical analyses. Enforces
    // the configured style guide at two layers (prompt + deterministic
    // post-formatter). See `ComposeAcademicPaperUseCase` and
    // `IAcademicComposer` for the contract.
    public composeAcademicPaper: ComposeAcademicPaperUseCase;

    // Granular section composers — written in academic order:
    // conclusion FROM the body's verse analyses, then introduction
    // FROM verse analyses + the accepted conclusion. Both persist
    // their output as new versions of their respective steps so the
    // user reviews + accepts the same way as legacy generation.
    public composeConclusionFromAnalyses: ComposeConclusionFromAnalysesUseCase;
    public composeIntroductionFromAnalyses: ComposeIntroductionFromAnalysesUseCase;
    // Per-verse academic prose composer. Reads ONE verse's accepted
    // canonical analysis, produces 1-3 paragraphs of TMS-style prose,
    // PERSISTS on that version's `markdown` field so re-renders are
    // free until the analysis changes.
    public composeVerseAcademicProse: ComposeVerseAcademicProseUseCase;

    // Ministry composers (Phase 6) — sermon / devotional / study
    // guide composed from the same `CanonicalVerseAnalysis` artifact.
    // No persistence layer in the use cases themselves: caller
    // surfaces the markdown via copy / download / handoff to the
    // existing sermon module.
    public composeSermonFromAnalyses: ComposeSermonFromAnalysesUseCase;
    public composeDevotionalFromAnalyses: ComposeDevotionalFromAnalysesUseCase;
    public composeStudyGuideFromAnalyses: ComposeStudyGuideFromAnalysesUseCase;

    // Bridge: paper → sermon
    public startStudyFromPaper: StartStudyFromPaperUseCase;

    // Persist composition outputs (academic / ministry) as Extractions
    // so they show up in Mis Recursos and the per-paper "Artefactos
    // derivados" panel. See `SaveExegesisArtifactExtractionUseCase`.
    public saveExegesisArtifactExtraction: SaveExegesisArtifactExtractionUseCase;

    // Unified read for the paper detail "Artefactos derivados" panel —
    // sermons (sourcePaperId) + extractions (externalRef → paper)
    // merged into one sorted list.
    public listPaperDerivedArtifacts: ListPaperDerivedArtifactsUseCase;

    // Sermon citation verifier (PR #218 — Tier 2 of audit). Scans
    // generated sermon for author-attributed quotes and checks each
    // against the originating paper / Faculty conversation. Catches
    // fabricated quotes that slipped past the PR #217 prompt-level
    // anti-hallucination rule.
    public verifySermonCitations: VerifySermonCitationsUseCase;

    constructor() {
        // Reuse the vision model env var — both surfaces want Pro 2.5.
        // A dedicated `VITE_GEMINI_EXEGESIS_MODEL_ID` can split them later
        // if exegesis ends up needing a different tier.
        const exegesisModelId = (import.meta as any).env?.VITE_GEMINI_VISION_MODEL_ID || 'gemini-2.5-pro';

        // Ya no se mira la clave de Gemini del bundle: los 18 adapters salen por el
        // proxy del servidor y la exégesis funciona sin clave en el navegador.
        // El aviso que vivía acá pasó a ser mentira — y peor, un INTERRUPTOR:
        // el día que se borre la variable, un gate así apaga la feature en
        // silencio en vez de fallar.

        const paperRepository = new FirestoreExegeticalPaperRepository();
        const styleGuideRepository = new FirestoreUserStyleGuideRepository();
        const userRubricRepository = new FirestoreUserRubricRepository();
        const userAssignmentBriefRepository = new FirestoreUserAssignmentBriefRepository();
        const libraryRepository = new FirebaseLibraryRepository();
        const orchestrator = new GeminiExegesisOrchestrator(exegesisModelId);
        const rubricExtractor = new GeminiPaperRubricExtractor(exegesisModelId);
        const manifestExtractor = new GeminiStyleGuideManifestExtractor(exegesisModelId);
        const styleFormatter = new DeterministicStyleFormatter();

        // Adapt the broader library repository to the narrow content-reader
        // port the use case depends on. Keeps the use case free of any
        // direct knowledge of how resources are stored or extracted.
        const contentReader: IResourceContentReader = {
            async getTextContent(resourceId: string) {
                const resource = await libraryRepository.findById(resourceId);
                return resource?.textContent ?? null;
            },
        };

        // Papers
        this.createPaper = new CreateExegeticalPaperUseCase(paperRepository, userRubricRepository);
        this.listPapers = new ListExegeticalPapersUseCase(paperRepository);
        this.listPaperSummaries = new ListExegesisPaperSummariesUseCase(paperRepository);
        this.getPaper = new GetExegeticalPaperUseCase(paperRepository);
        this.archivePaper = new ArchiveExegeticalPaperUseCase(paperRepository);
        this.updatePaperBrief = new UpdatePaperBriefUseCase(paperRepository);
        this.setPaperStyleGuide = new SetPaperStyleGuideUseCase(paperRepository, styleGuideRepository);
        // Guardar NO compone: la composición ya está hecha y revisada.
        this.saveAssembledPaper = new SaveAssembledPaperUseCase(paperRepository);
        this.updateStepPlan = new UpdateStepPlanUseCase(paperRepository);
        this.updateRubric = new UpdateRubricUseCase(paperRepository);
        this.resetRubric = new ResetRubricUseCase(paperRepository);
        this.extractRubricFromText = new ExtractRubricFromTextUseCase(paperRepository, rubricExtractor);
        this.extractRubricFromDocument = new ExtractRubricFromDocumentUseCase(
            paperRepository,
            contentReader,
            rubricExtractor,
        );
        this.extractRubricFromImage = new ExtractRubricFromImageUseCase(
            paperRepository,
            rubricExtractor,
        );
        this.extractRubricPreviewFromImage = new ExtractRubricPreviewFromImageUseCase(
            paperRepository,
            rubricExtractor,
        );
        this.extractStyleGuideManifest = new ExtractStyleGuideManifestUseCase(
            styleGuideRepository,
            contentReader,
            manifestExtractor,
        );

        // User-level rubric templates
        this.listUserRubrics = new ListUserRubricsUseCase(userRubricRepository);
        this.createUserRubric = new CreateUserRubricUseCase(userRubricRepository);
        this.updateUserRubric = new UpdateUserRubricUseCase(userRubricRepository);
        this.deleteUserRubric = new DeleteUserRubricUseCase(userRubricRepository);
        this.setDefaultUserRubric = new SetDefaultUserRubricUseCase(userRubricRepository);

        this.listUserAssignmentBriefs = new ListUserAssignmentBriefsUseCase(userAssignmentBriefRepository);
        this.createUserAssignmentBrief = new CreateUserAssignmentBriefUseCase(userAssignmentBriefRepository);
        this.updateUserAssignmentBrief = new UpdateUserAssignmentBriefUseCase(userAssignmentBriefRepository);
        this.deleteUserAssignmentBrief = new DeleteUserAssignmentBriefUseCase(userAssignmentBriefRepository);
        this.setDefaultUserAssignmentBrief = new SetDefaultUserAssignmentBriefUseCase(userAssignmentBriefRepository);
        this.applyRubricTemplateToPaper = new ApplyRubricTemplateToPaperUseCase(
            paperRepository,
            userRubricRepository,
        );
        this.applyStrategyOnlyRubricToPaper = new ApplyStrategyOnlyRubricToPaperUseCase(
            paperRepository,
        );
        this.saveCurrentRubricAsTemplate = new SaveCurrentRubricAsTemplateUseCase(
            paperRepository,
            userRubricRepository,
        );
        this.createUserRubricFromText = new CreateUserRubricFromTextUseCase(
            userRubricRepository,
            rubricExtractor,
        );

        // User style guides
        this.listStyleGuides = new ListUserStyleGuidesUseCase(styleGuideRepository);
        this.getActiveStyleGuide = new GetActiveStyleGuideUseCase(styleGuideRepository);
        this.createStyleGuide = new CreateUserStyleGuideUseCase(styleGuideRepository);
        this.setActiveStyleGuide = new SetActiveStyleGuideUseCase(styleGuideRepository);
        this.updateStyleGuide = new UpdateUserStyleGuideUseCase(styleGuideRepository);
        this.updateStyleGuideManifest = new UpdateUserStyleGuideManifestUseCase(styleGuideRepository);
        this.deleteStyleGuide = new DeleteUserStyleGuideUseCase(styleGuideRepository);

        // Project sources (operate on the paper repo since sources live inline)
        this.addSource = new AddProjectSourceUseCase(paperRepository);
        this.updateSource = new UpdateProjectSourceUseCase(paperRepository);
        this.removeSource = new RemoveProjectSourceUseCase(paperRepository);

        // v1.5: excerpt extraction. Adapt LibraryService's
        // `getResourceIndexStatus` into the narrow `IResourceIndexProbe`
        // port the extractor expects — keeps the extractor unaware of
        // how readiness is computed, and avoids a backward dep from
        // infrastructure → application. Single LibraryService instance
        // here matches the lazy singleton pattern other consumers use.
        const libraryService = new LibraryService();
        const indexProbe: IResourceIndexProbe = {
            async isReady(resourceId: string) {
                const resource = await libraryRepository.findById(resourceId);
                if (!resource) return false;
                return libraryService.getResourceIndexStatus(resource) === 'indexed';
            },
        };
        // El extractor estructural elige la SECCIÓN del comentario que trata
        // el pasaje leyendo la tabla de contenidos que el indexador ya
        // guardó; el semántico queda debajo como degradación por recurso,
        // para los documentos que se extrajeron sin encabezados.
        const semanticExtractor = new RetrieveChunksExcerptExtractor(indexProbe);
        const excerptExtractor = new StructuralExcerptExtractor(indexProbe, semanticExtractor);
        this.extractExcerpts = new ExtractExcerptsForPaperUseCase(paperRepository, excerptExtractor);

        // Selector de páginas: el usuario elige hojas sobre el PDF y acá se
        // traducen a los fragmentos que van al prompt.
        this.selectSourcePages = new SelectSourcePagesUseCase(
            paperRepository,
            new CallableDocumentChunkReader(),
        );

        // v1.7 smart-match: ranks the user's library against a paper
        // before they pick what to extract from. Same retrieveChunks
        // pipeline as the extractor, just scoped to userId only.
        const resourceRanker = new RetrieveChunksResourceRanker();
        this.rankLibraryForPaper = new RankLibraryResourcesForPaperUseCase(
            paperRepository,
            resourceRanker,
        );

        // v1.7 corpus-usage planning: LLM proposes which sources go
        // to which generation step, populating
        // `paper.stepPlan.perStep[*].pinnedSources`. The orchestrator
        // then prioritizes those at generation time (flexible mode).
        const stepCorpusPlanner = new GeminiStepCorpusPlanner(exegesisModelId);
        this.proposeStepCorpusAllocations = new ProposeStepCorpusAllocationsUseCase(
            paperRepository,
            stepCorpusPlanner,
        );
        this.updateStepCorpusAllocation = new UpdateStepCorpusAllocationUseCase(paperRepository);

        // Steps (D.2: live Gemini generation with style guide + sources injected;
        // Phase 3c adds deterministic style formatter + cross-step ibid anchors)
        // Un solo lector para todos los casos de uso: cachea por recurso, y
        // compartirlo evita que cada uno vuelva a resolver la misma
        // numeración.
        const pageNumberingReader = new DocumentPageNumberingReader();
        this.seedSteps = new SeedStepsForPassageUseCase(paperRepository);
        this.generateStep = new GenerateStepUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            orchestrator,
            styleFormatter,
            extractFootnoteAnchorsFromFormattedMarkdown,
            new CallableCuratedCorpusRetriever(),
            // Mismo motivo que en el analizador: sin esto las anclas rotulan
            // la hoja del PDF como «p. N» y el modelo copia ese número.
            pageNumberingReader,
        );
        this.acceptStep = new AcceptStepUseCase(paperRepository);
        this.reopenStep = new ReopenStepUseCase(paperRepository);
        this.saveStepEdit = new SaveStepEditUseCase(paperRepository);

        // Citation verifier — defaults to the LLM-based adapter so
        // cross-language papers (Spanish prose paraphrasing English
        // commentary) verify correctly. The token-set Jaccard adapter
        // (`FuzzyCitationVerifier`) returns zero overlap in that
        // realistic scenario; the LLM verifier judges meaning, not
        // lexical match.
        //
        // The Fuzzy adapter stays exported (and instantiated as a
        // void reference here for type-checked tree-shake reachability)
        // so test suites or telemetry comparisons can re-wire it
        // without touching the use case.
        void FuzzyCitationVerifier;
        // Per-citation embedding retrieval — solves the long-book
        // problem (`textContent` is capped at the Firestore 1MB doc
        // limit; for 700-page commentaries the cited deep-pages live
        // exclusively in `document_chunks`). The verifier queries
        // top-K chunks scoped to the cited resource using the
        // citation's evidence sentence as the embedding query.
        const relevantChunkRetriever = new RetrieveChunksRelevantChunkRetriever();
        const citationVerifier = new GeminiLlmCitationVerifier({
            modelName: exegesisModelId,
            relevantChunkRetriever,
            retrievalTopK: 5,
        });
        this.verifyStepCitations = new VerifyStepCitationsUseCase(
            paperRepository,
            contentReader,
            citationVerifier,
            // Evidencia con página para las fuentes con receta: sin esto la
            // detección de página equivocada se apaga en silencio.
            new CallableCuratedCorpusReader(),
            // Y con la numeración, esa detección compara en la misma unidad
            // que la cita en vez de cotejar hojas contra páginas impresas.
            pageNumberingReader,
        );

        // Coherence reviewer — single Gemini call over the entire
        // accepted paper. Adversarial: returns issues, not praise.
        const coherenceReviewer = new GeminiCoherenceReviewer(exegesisModelId);
        this.runCoherencePass = new RunCoherencePassUseCase(
            paperRepository,
            coherenceReviewer,
        );

        // Source-type classifier — Gemini Pro 2.5 with enum-locked
        // schema. Stateless: caller reads the resource text + metadata
        // upstream and feeds the slice in.
        const sourceTypeClassifier = new GeminiSourceTypeClassifier(exegesisModelId);
        this.classifySourceType = new ClassifySourceTypeUseCase(sourceTypeClassifier);

        // Canonical analysis pipeline. Wired in parallel to `generateStep`
        // so the legacy markdown path keeps working while the structured
        // pipeline is exercised on opt-in surfaces.
        //
        // Original-language base text for the analyzer:
        //   - NT verses → SBL GNT (Greek) via MorphGNT CDN.
        //   - OT verses → Westminster Leningrad Codex (Hebrew) via the
        //     morphhb provider used by the Hebrew tutor.
        // The dispatcher wraps both providers behind a single port so
        // the use case stays unaware of testament dispatch. Per-session
        // in-memory cache lives inside each underlying provider — the
        // dispatcher itself is stateless.
        const canonicalAnalyzer = new GeminiCanonicalVerseAnalyzer(exegesisModelId);
        const greekProvider = new SBLGNTBibleProvider();
        const hebrewProvider = new MorphhbOriginalLanguageProvider();
        const originalLanguageProvider = new TestamentDispatcherOriginalLanguageProvider(
            greekProvider,
            hebrewProvider,
        );
        this.analyzeVerseCanonically = new AnalyzeVerseCanonicallyUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            canonicalAnalyzer,
            originalLanguageProvider,
            // Con esto, las fuentes con receta piden material por versículo
            // en vez de inlinear su corpus entero en cada paso.
            new CallableCuratedCorpusRetriever(),
            // Sin esto las anclas del corpus rotulan la hoja del PDF como
            // «p. N» y el modelo copia ese número al citar.
            pageNumberingReader,
        );

        // Academic-paper composer. Reuses the existing
        // `DeterministicStyleFormatter` for the post-process layer so
        // citations get rewritten per the manifest's templates after
        // the LLM composes prose. Style guide enforcement is mandatory
        // when configured; falls back to TMS / Turabian otherwise.
        const academicComposer = new GeminiAcademicComposer(exegesisModelId);
        this.composeAcademicPaper = new ComposeAcademicPaperUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            academicComposer,
            styleFormatter,
            // El paper cita la página impresa donde se pudo medir la
            // numeración, y la hoja —dicha como hoja— donde no.
            pageNumberingReader,
        );

        // Section-level composers. Same style-guide enforcement as
        // `composeAcademicPaper`. Introduction is written LAST per
        // academic methodology — the use case enforces this by
        // requiring an accepted conclusion before composing.
        const conclusionComposer = new GeminiConclusionComposer(exegesisModelId);
        this.composeConclusionFromAnalyses = new ComposeConclusionFromAnalysesUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            conclusionComposer,
            styleFormatter,
        );
        const introductionComposer = new GeminiIntroductionComposer(exegesisModelId);
        this.composeIntroductionFromAnalyses = new ComposeIntroductionFromAnalysesUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            introductionComposer,
            styleFormatter,
        );
        const verseAcademicComposer = new GeminiVerseAcademicComposer(exegesisModelId);
        this.composeVerseAcademicProse = new ComposeVerseAcademicProseUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            verseAcademicComposer,
            styleFormatter,
            // Rescata las hojas de los análisis previos a la calibración al
            // recomponer la prosa, sin volver a analizar verso por verso.
            pageNumberingReader,
        );

        // Ministry composers (sermon / devotional / study guide).
        // Each uses the canonical verse analyses + theologicalHooks
        // bridge to produce format-appropriate markdown. No
        // deterministic style formatter — ministry registers diverge
        // from academic citation conventions, and citation post-
        // processing would harm the homiletic feel.
        const sermonComposer = new GeminiSermonComposer(exegesisModelId);
        this.composeSermonFromAnalyses = new ComposeSermonFromAnalysesUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            sermonComposer,
        );
        const devotionalComposer = new GeminiDevotionalComposer(exegesisModelId);
        this.composeDevotionalFromAnalyses = new ComposeDevotionalFromAnalysesUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            devotionalComposer,
        );
        const studyGuideComposer = new GeminiStudyGuideComposer(exegesisModelId);
        this.composeStudyGuideFromAnalyses = new ComposeStudyGuideFromAnalysesUseCase(
            paperRepository,
            styleGuideRepository,
            contentReader,
            studyGuideComposer,
        );

        // Bridge: paper → sermon (Phase 2). Sermon repo is shared with the
        // legacy sermon module; the use case persists a draft with
        // sourcePaperId set so the sermon detail view can deep-link back.
        const sermonRepository = new FirebaseSermonRepository();
        // Series repo is wired so the use case can patch the
        // originating series' planned-sermon entry (draftId + status)
        // when the paper came from a pericope. Without this the
        // planner shows "Iniciar borrador" indefinitely and clicking
        // creates a duplicate empty sermon — the bug Phase A fixes.
        const seriesRepository = new FirebaseSeriesRepository();
        this.startStudyFromPaper = new StartStudyFromPaperUseCase(
            paperRepository,
            sermonRepository,
            seriesRepository,
        );

        const extractionRepository = new FirestoreExtractionRepository();
        this.saveExegesisArtifactExtraction = new SaveExegesisArtifactExtractionUseCase(
            paperRepository,
            extractionRepository,
        );

        this.listPaperDerivedArtifacts = new ListPaperDerivedArtifactsUseCase(
            paperRepository,
            extractionRepository,
            sermonRepository,
        );

        // Sermon citation verifier. Uses the AI chat repo for Faculty-
        // derived sermons (source = conversation messages) and the
        // paper repo for paper-derived sermons (source = paper
        // assembled markdown + project sources). Deterministic
        // substring + Jaccard check — no LLM calls per quote.
        const chatRepositoryForVerifier = new FirestoreAIChatRepository();
        this.verifySermonCitations = new VerifySermonCitationsUseCase(
            sermonRepository,
            paperRepository,
            chatRepositoryForVerifier,
        );
    }
}

export const exegesisService = new ExegesisService();
