// Exegesis module — domain layer barrel.
//
// New types/contracts grouped here so consumers (application, infrastructure,
// web) can import everything from `@dosfilos/domain` without knowing the
// internal folder structure.

export * from './entities/ExegeticalPaper';
export * from './entities/ExegesisPaperSummary';
export * from './entities/ExegeticalStep';
export * from './entities/exportPaperToMarkdown';
export * from './entities/PaperRubric';
export * from './entities/ProjectSource';
export * from './entities/SourceType';
export * from './entities/StepSourcePlan';
export * from './entities/sourceRoleMapping';
export * from './entities/corpusUsagePlan';
export * from './entities/StyleGuideManifest';
export * from './entities/StyleGuideSnapshot';
export * from './entities/UserRubric';
export * from './entities/UserStyleGuide';
export * from './entities/UserAssignmentBrief';
export * from './entities/CanonicalVerseAnalysis';
export * from './entities/CitationVerification';

export * from './repositories/IExegeticalPaperRepository';
export * from './repositories/IUserRubricRepository';
export * from './repositories/IUserStyleGuideRepository';
export * from './repositories/IUserAssignmentBriefRepository';

export * from './use-cases/dtos';

export * from './ports/IAcademicComposer';
export * from './ports/ICanonicalVerseAnalyzer';
export * from './ports/ICitationVerifier';
export * from './ports/ICoherenceReviewer';
export * from './ports/IConclusionComposer';
export * from './ports/IIntroductionComposer';
export * from './ports/IVerseAcademicComposer';
export * from './ports/IMinistryComposers';
export * from './ports/IExcerptExtractor';
export * from './ports/IExegesisOrchestrator';
export * from './ports/IExpositoryAssistant';
export * from './ports/IPaperRubricExtractor';
export * from './ports/IPericopeDetector';
export * from './ports/IResourceContentReader';
export * from './ports/IResourceRanker';
export * from './ports/IRelevantChunkRetriever';
export * from './ports/ISourceTypeClassifier';
export * from './ports/IStepCorpusPlanner';
export * from './ports/IStyleFormatter';
export * from './ports/IStyleGuideManifestExtractor';

// v1.7 corpus source recommendations — curated bibliography indexed
// by (BibleBookId × SourceType). Surfaced under each rubric gap so
// the user knows what to acquire/read for the paper they're building.
export * from './recommendations';

// Expository assistant pipeline (v1.5) — 5-pass methodology for
// dividing a biblical book into preachable units while preserving
// the distinction between exegetical division and preachable division.
export * from './expository/BookPanorama';
export * from './expository/cache';
export * from './expository/ExegeticalUnit';
export * from './expository/ExpositoryAssistantRun';
export * from './expository/FidelityReview';
export * from './expository/MacroSection';
export * from './expository/PreachableUnit';
export * from './expository/SuperMacroSection';

// Deterministic markdown rescue render for canonical-pipeline verses
// whose academic-prose composer hasn't run yet. Used by the assembly
// step so the final output is never just intro + conclusion.
export * from './services/renderCanonicalAnalysisAsMarkdown';
export * from './services/citationAnchoring';
export * from './services/serializeAnalysis';
export * from './services/verseAnalysisCoverage';
export * from './services/renderVerseAnalysisProse';
export * from './services/composedVerseSections';
export * from './services/enforceAnalysisCoverage';
export * from './services/buildPaperStudyContext';
export * from './services/paperStudyReference';
export * from './services/verifyAttributedQuotes';
export * from './services/findUnsupportedWitnessClaims';
export * from './services/getEffectiveStructuralExpectations';

// Selección estructural de fragmentos: lee la tabla de contenidos que el
// indexador ya guardó por chunk (`section` / `sectionPath`) y la convierte
// en un índice por referencia bíblica, para mandarle al modelo la sección
// del comentario que trata el pasaje en vez de los K chunks más parecidos.
export * from './outline/documentOutline';
// Índice de hojas del documento: qué hay en cada hoja física del PDF, y la
// traducción de «las hojas 68 a 71» a los fragmentos que van al prompt.
export * from './outline/documentPageIndex';
// Desfase entre la hoja física y el número que el libro imprime.
export * from './outline/printedPageOffset';
export * from './outline/pageNumbering';
export * from './outline/findQuoteInPageText';
export * from './ports/IPageNumberingReader';
// ¿Los fragmentos guardados de una fuente corresponden a su receta?
export * from './outline/recipeConsistency';

// Corpus consultable: qué parte del corpus curado entra al prompt de un paso.
export * from './corpus/selectCorpusChunks';
// Puerto que le pide al corpus curado el material de un paso.
export * from './ports/ICuratedCorpusRetriever';
