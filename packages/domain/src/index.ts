// Teaching Suite (módulo nuevo — núcleo determinista F0)
export * from './teaching-suite';

// Estudio Madre (upstream del markdown — sobre aditivo en extractions/{id})
export * from './estudio-madre';

// Entities
export * from './entities/User';
export * from './entities/citationRights';
export * from './entities/Confession';
export * from './entities/CreditPack';
export * from './entities/ExegesisOperationCatalog';
export * from './services/computeExegesisQuotaState';
export * from './services/aggregateRagSources';
export * from './services/validateCitations';
export * from './services/stripSermonCitationMarkers'; // 🌱 ADR-030/031 — sermon prose: strip junk, keep valid [N] anchors
export * from './services/selectSermonCitationChunks'; // 🌱 ADR-031 — personal>CORE citation chunk selection
export * from './services/injectNarrativeCitationAnchors'; // 🌱 ADR-031 — deterministic [Sn] anchor injection
export * from './services/buildCitationManifest';
export * from './services/aggregateRequiredAttributions';
export * from './services/aggregateLexiconAttributions';
export * from './services/detectIllustrationDuplicates';
export * from './entities/LlamaParseAccount';
export * from './entities/Feature';
export * from './entities/Subscription';
export * from './entities/PlanDefinition';
export * from './entities/UsageCounter';
export * from './entities/Organization';
export * from './entities/Sermon';
export * from './entities/SermonAnnotation'; // 🌱 Púlpito M-05 — preacher marks anchored in the raw section body
export * from './entities/InkNote'; // 🌱 Púlpito F2 — tinta anclada al texto, no a la pantalla
export * from './services/sentenceSegmentation'; // 🌱 Púlpito M-05 — single sentence ruler (shared with the fidelity pass)
export * from './services/sermonReading'; // 🌱 Púlpito M-05 — offset-preserving reading model of a section
export * from './services/planStatus'; // 🌱 Planes — estado deducido, no guardado
export * from './services/movementBudget'; // 🌱 Púlpito F2 — presupuesto de tiempo por movimiento (riel)
export * from './services/pageGrouping'; // 🌱 Púlpito F2 — bloques que no se separan entre páginas
export * from './services/rehearsalReport'; // 🌱 Púlpito F3 — informe del ensayo (tiempo real vs presupuesto)
export * from './entities/SermonSeries';
export * from './entities/LibraryResource';
export * from './entities/LibraryCategory';
export * from './entities/extractionEstimate';
export * from './entities/SermonGenerator';
export * from './entities/PastoralSeed'; // 🌱 Pastoral Fidelity Phase 1/1.6 — eight-step spine seed
export * from './entities/AiAssistLog'; // 🌱 Pastoral Fidelity Phase 1.6 — first-class assist audit (ADR-024)
export * from './entities/StudyDepthAssessment'; // 🌱 Pastoral Fidelity Phase 2.5 — Study Companion coverage model (ADR-025)
export * from './entities/FidelityReport'; // 🌱 Pastoral Fidelity Phase 3 PR 1 — claim/source fidelity pass (ADR-029)
export * from './entities/PassageProfile'; // 🌱 Pastoral Fidelity ADR-035 — passage profile (Capa 1)
export * from './entities/VerifiedMisreading'; // 🌱 Pastoral Fidelity ADR-036 — verified misreading entry (anchor fidelity)
export * from './services/computeFidelitySummary'; // 🌱 Pastoral Fidelity Phase 3 PR 1 — gate policy (ADR-029 Q3/Q6)
export * from './services/evaluatePublishGate'; // 🌱 Pastoral Fidelity Phase 3 PR 2 — publish-gate decision (ADR-029 Q3/Q5)
export * from './services/passageCoverage'; // 🌱 Pastoral Fidelity ADR-035 Capa 2/3 — coverage contract + collector
export * from './services/misreadingTurn'; // 🌱 Pastoral Fidelity ADR-035 CA1/CA3 — pure misreading-turn decision
export * from './services/anchorAdmission'; // 🌱 Pastoral Fidelity ADR-036 — pure anchor admission + citability (fail-closed)
export * from './services/curatedMisreadingMerge'; // 🌱 Pastoral Fidelity ADR-036 PR5 — curated floor merge (precedence)
export * from './services/detectorMisreadingVerification'; // 🌱 Pastoral Fidelity ADR-036 PR6 — detector misreading verify (shadow corte 1 + drop)
export * from './services/computePluralityCheck'; // 🌱 Pastoral Fidelity Phase 3 PR 3 — plurality (no-proof-texting) check (ADR-029 Q4)
export * from './services/computeAttributionCheck'; // 🌱 Pastoral Fidelity Phase 3 PR 5 — attribution check (ADR-006 / ADR-029 Q7)
export * from './entities/ContraScanReport'; // 🌱 Pastoral Fidelity Phase 4 PR 1 — contra-scan confrontation report (ADR-033)
export * from './services/evaluateContraScanGate'; // 🌱 Pastoral Fidelity Phase 4 PR 1 — contra-scan gate decision (ADR-033)
export * from './ports/ILlmClient'; // 🌱 Pastoral Fidelity Phase 2.5 — thin LLM provider port (Q7/ADR-025)
export * from './ports/IFidelityEvaluator'; // 🌱 Pastoral Fidelity Phase 3 PR 1 — claim/source evaluator port (ADR-029)
export * from './ports/ICoverageEngagementJudge'; // 🌱 Pastoral Fidelity ADR-035 CA1 — engagement judge port (D)
export * from './ports/IGenreEngagementJudge'; // 🌱 Pastoral Fidelity Redacción v2 Fase 1 (§4.4) — genre-engagement judge port (A1)
// 🌱 Vara ÚNICA de error de método: la comparten el acompañante socrático del
// chat y el wizard. Observa, no bloquea.
export * from './guided-sermon/methodErrorCatalog';
export * from './guided-sermon/genreDiscernmentCriteria'; // 🌱 Pastoral Fidelity Redacción v2 Fase 1 (§4.4) — structured genre-discernment vara (A3)
export * from './guided-sermon/structuralSufficiency'; // 🌱 Pastoral Fidelity Redacción v2 Fase 1 (§4.5) — deterministic step-3 structural-sufficiency vara (B1)
// 🌱 Redacción v2 Fase 2 (§9) — la vara del juez de fidelidad homilética, como
// DATO editable: catálogos hermanos de FORMA y de GÉNERO (no se fusionan), el
// compositor de las tres capas y la mecánica del veredicto.
export * from './sermon-judge/complianceTypes';
export * from './sermon-judge/approachComplianceCatalog';
export * from './sermon-judge/genreComplianceCatalog';
export * from './sermon-judge/composeJudgeRubric';
export * from './sermon-judge/evaluateCompliance';
// 🌱 Redacción v2 Fase 3 (§6) — mapeo género→estructura del sermón (consume
// PassageProfile, NO re-deriva género) + la vara transversal de cobertura y
// anclaje, que es lo que de verdad se juzga (no el conteo de puntos).
export * from './sermon-judge/genreSermonStructure';
export * from './sermon-judge/pointAnchoring';
// 🌱 Redacción v2 Fase 3 (§4.3) — constructor de proposición: los 8 elementos.
// La proposición es el CONTRATO del que heredan los puntos del bosquejo.
export * from './sermon-judge/propositionContract';
// Puente entre la proposición YA ESCRITA y los 8 elementos que el contrato juzga.
export * from './sermon-judge/parseSustantivada';
export * from './sermon-judge/applyPropositionContract';
// La directiva del pastor por punto: el único campo del bosquejo que el agente no escribe.
export * from './sermon-judge/pastorDirective';
// ¿Las referencias cruzadas cruzan de verdad, o repiten el pasaje predicado?
export * from './sermon-judge/crossReferences';
// El pastor decide CUÁNTAS implicaciones: sus líneas en blanco son estructura.
export * from './sermon-judge/splitApplication';
// La proposición y los puntos del recordatorio se ENSAMBLAN verbatim, no se piden.
export * from './sermon-judge/assembleTransitions';
// ¿La cita está en un idioma que el lector no lee? Decide si ofrecer traducción.
export * from './citations/citationLanguage';
export * from './citations/buildTranslationPrompt';
// ADR-037 — la unidad de decisión de la redacción socrática.
export * from './drafting/SermonElement';
export * from './drafting/buildElementsPrompt';
export * from './drafting/parseProposedElements';
export * from './drafting/splitElementLines';
export * from './drafting/classifyContribution';
export * from './drafting/deriveSectionWalk';
export * from './drafting/sectionReadiness';
export * from './drafting/sermonAuthorship';
export * from './greek-analyzer';
export * from './shared/spanishRegister';
export * from './drafting/sermonManuscriptStyle';
export * from './drafting/attachMainPassageRefs';
export * from './drafting/buildSectionProsePrompt';
export * from './drafting/scriptureLookupRef';
export * from './drafting/pointPassageRef';
export * from './drafting/assembleDraft';
export * from './drafting/sectionCatalog';
export * from './drafting/sermonPointBlocks';
export * from './drafting/buildAuthorityQuotePrompt';
export * from './drafting/parseProposedQuotes';
// ¿El pasaje abre el libro? Decide si la introducción debe orientar al libro entero.
export * from './bible/canon/opensBook';
// 🌱 Pastoral Fidelity Phase 2.5 PR B (ADR-028) — Faculty Socratic Sermon Agent
export * from './guided-sermon/SocraticTurn';
export * from './guided-sermon/GuidedSermonSession';
export * from './guided-sermon/GuidedSermonStateMachine';
export * from './guided-sermon/policies/IStepPolicy';
export * from './guided-sermon/policies/ReadingStepPolicy';
export * from './guided-sermon/policies/ContextGenreStepPolicy';
export * from './guided-sermon/policies/StructuralAnalysisStepPolicy';
export * from './guided-sermon/policies/WordStudiesStepPolicy';
export * from './guided-sermon/policies/RecognitionStepPolicy';
export * from './guided-sermon/policies/FunctionStepPolicy';
export * from './guided-sermon/policies/TimelessPrincipleStepPolicy';
export * from './guided-sermon/policies/InsightStepPolicy';
export * from './guided-sermon/StepPolicyRegistry';
export * from './guided-sermon/doubtRouting';
export * from './repositories/IPastoralSeedRepository';
export * from './entities/PastoralWordAnalysis'; // 🌱 Pastoral Fidelity Phase 1.5 — Pastoral Word Study types
export * from './entities/WitnessValidation'; // 🌱 Pastoral Fidelity Phase 2 — three-witnesses validation
export * from './bible/inferLanguageFromBook'; // 🌱 Phase 1.5 — book → original language heuristic
export * from './bible/bibleBookTable';
export * from './bible/parseBibleReferenceParts';
export * from './bible/searchMatching'; // 🌱 Biblia — búsqueda sin acentos y por términos
export * from './bible/versification/versificationMap'; // 🌱 Versificación — correspondencia TM ↔ lector (UBS)
export * from './bible/versification/mapVersification';
export * from './bible/versification/formatForReader';
export * from './bible/osis/osisBookCodes'; // 🌱 OSIS — códigos de libro de las fuentes abiertas
export * from './bible/inferGenreFromBook'; // 🌱 Phase 1.6 — book → literary genre proposal (ADR-024)
export * from './services/IPastoralWordStudyService'; // 🌱 Phase 1.5 — service port
export * from './repositories/IPastoralWordAnalysisCacheRepository'; // 🌱 Phase 1.5 — analysis cache
export * from './repositories/IContentHistoryRepository'; // Historial de versiones durable (antes sólo localStorage)
export * from './entities/HomileticalApproach';  // 🎯 NEW
export * from './entities/DocumentChunk';
export * from './entities/FileSearchStoreEntity'; // 🎯 File Search Stores
export * from './entities/UserActivity'; // 📊 Analytics: User Activity
export * from './entities/UserActivitySummary'; // 📊 Analytics: User Activity Summary
export * from './entities/DailyMetrics'; // 📊 Analytics: Daily Metrics
export * from './entities/GeoEvent'; // 📊 Geographic Analytics: Events
export type { GreekForm, TrainingUnit, ChatMessage as GreekTutorChatMessage, UserResponse, StudySession, ExegeticalInsight, MorphemeComponent, MorphologyBreakdown, QuizQuestion, QuizAttempt, UnitProgress, SessionProgress, BiblicalPassage, PassageWord, UnitPreview } from './greek-tutor/entities/entities'; // 🏛️ Greek Tutor Entities
export * from './greek-tutor/syntax-analysis'; // 🏛️ Greek Syntax Analysis
export * from './models/Plan'; // 🎯 Plan models (refactored system)
export * from './llm/modelCatalog';
export * from './voice/selectVoiceSamples';
export * from './voice/buildVoiceBlock';
export * from './exegesis/services/exegeticalStrategy';


// Multi-Agent Faculty Entities
export * from './entities/AIAgent';
export * from './entities/AIChatSession';
export * from './entities/AIProject';
export * from './entities/Extraction';
export * from './entities/WordpressIntegration';
export * from './entities/SermonPersonalization';
export * from './services/sermonPersonalizationFormatter';

// Repositories
export * from './repositories/ISermonRepository';
export * from './repositories/ISermonWizardChatRepository';
export * from './repositories/ISeriesRepository';
export * from './repositories/IUserProfileRepository';
export * from './repositories/IPlanRepository';
export * from './repositories/IOrganizationRepository';
export * from './repositories/IAnalyticsRepository'; // 📊 Analytics Repository
export * from './repositories/IUserRepository'; // 📊 Admin User Repository
export * from './repositories/IUserActivityRepository'; // 📊 User Activity Repository
export * from './repositories/IGeoEventRepository'; // 📊 Geographic Event Repository
export * from './repositories/IAIAgentRepository'; // 🎓 Multi-Agent Agent Repository
export * from './repositories/IAIChatRepository'; // 🎓 Multi-Agent Chat Repository
export * from './repositories/IAIProjectRepository'; // 🎓 Multi-Agent Project Repository
export * from './repositories/IExtractionRepository'; // 🎓 Multi-Agent Persisted Extractions
export * from './repositories/IUserIntegrationsRepository'; // 🎓 Per-user 3rd-party integration creds
export * from './repositories/IAuthRepository';
export * from './repositories/IVectorRepository';
export * from './repositories/IConfessionRepository';
export * from './repositories/IVerifiedMisreadingRepository'; // 🌱 Pastoral Fidelity ADR-036 PR4 — verified misreading store (read port)
export * from './repositories/ICrossReferenceRepository';
export * from './bible/cross-references/CrossReference';

// Config
export * from './config/planMetadata';
export * from './config/planIds';

// Services
export * from './services/IAIService';
export * from './services/IStorageService';
export * from './services/IExportService';
export * from './services/ISermonGenerator';
export * from './services/ISermonRepurposer';
export * from './services/IPlanGenerator';
export * from './services/IEmbeddingService';
export * from './services/ITextExtractor';
export * from './services/ICacheService';
export * from './services/PlanService'; // 🎯 Plan Service (refactored system)
export * from './services/IAIGeneratorService'; // 🎓 Multi-Agent Generator Service
export * from './ports/IFileSearchService'; // 🎯 File Search ports
export * from './greek-tutor/ports/IGreekTutorService'; // 🏛️ Greek Tutor Ports
export * from './greek-tutor/ports/IWordCacheRepository'; // 🏛️ Greek Tutor Word Cache
export * from './greek-tutor/ports/IQuizService'; // 🎯 Phase 3A: Quiz Service
export * from './bible'; // 📖 Bible Domain (Multi-version support)
export * from './exegesis'; // ✍️ Exegesis Module (paper-writing wizard)
export * from './library'; // 📚 Library helpers (smart-match book inference)


// Workflow
export { WorkflowPhase } from './entities/SermonWorkflow';
export type { ChatMessage as SermonWorkflowChatMessage, PhaseResult, SermonWorkflow, CreateWorkflowDTO } from './entities/SermonWorkflow';
export * from './entities/WorkflowConfiguration';
export * from './repositories/IWorkflowRepository';
export * from './repositories/IConfigRepository';
export type { ContentType, WorkflowPhase as ContentWorkflowPhase, QuickAction, CanvasChatMessage, ContentAdapter, CanvasChatProps } from './types/content-types';
export * from './types/i18n';

// Strategies
export * from './strategies';

// Hebrew Tutor
export * from './hebrew-tutor/index.js';
