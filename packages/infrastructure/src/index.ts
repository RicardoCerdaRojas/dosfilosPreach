export * from './config/firebase';
export * from './firebase/FirebaseConfigRepository';
export * from './firebase/FirebaseStorageService';
export * from './firebase/FirebaseAuthRepository';
export * from './firebase/FirebaseSermonRepository';
export * from './firebase/FirebaseSeriesRepository';
export * from './firebase/FirebaseLibraryRepository';
export * from './firebase/FirebaseLibraryCategoryRepository';
export * from './firebase/FirebaseEstudioTipoUsageRepository';
export * from './firebase/FirebaseChunkRepository';
export * from './firebase/FirestoreVectorRepository';
export * from './firebase/FirebaseUserProfileRepository';
export * from './firebase/FirebaseConfessionRepository';
export * from './firebase/FirebaseVerifiedMisreadingRepository'; // 🌱 ADR-036 PR4 — verified misreading store (read)
export * from './firebase/FirebaseCrossReferenceRepository';
export * from './firebase/FirestorePastoralSeedRepository'; // 🌱 Pastoral Fidelity Phase 1 — top-level seed repo
export * from './firebase/FirestorePastoralWordAnalysisCacheRepository'; // 🌱 Phase 1.5 — pastoral word analysis cache
export * from './firebase/FirestoreContentHistoryRepository'; // Historial de versiones durable
export * from './firebase/FirebasePlanRepository';
export * from './firebase/FirebaseAnalyticsRepository'; // 📊 Analytics Repository
export * from './firebase/FirebaseUserRepository'; // 📊 Admin User Repository
export * from './firebase/FirebaseUserActivityRepository'; // 📊 User Activity Repository
export * from './firebase/FirestoreAIChatRepository'; // 🎓 Multi-Agent Chat Repository
export * from './firebase/FirestoreSermonWizardChatRepository'; // 🎙️ Sermon Wizard Chat (PR #219)
export * from './firebase/FirestoreAIProjectRepository'; // 🎓 Multi-Agent Project Repository
export * from './firebase/FirestoreExtractionRepository'; // 🎓 Persisted Faculty Extractions
export * from './firebase/FirestoreUserIntegrationsRepository'; // 🎓 Per-user 3rd-party integration creds
export * from './firebase/FirestoreExegeticalPaperRepository'; // ✍️ Exegesis Module — paper repo
export * from './firebase/FirestoreExpositoryAssistantCacheRepository'; // ✍️ Expository Assistant — server-side cache for Pases 1-3 (v1.6)
export * from './firebase/FirestoreUserRubricRepository'; // ✍️ Exegesis Module — rubric template repo
export * from './firebase/FirestoreUserStyleGuideRepository'; // ✍️ Exegesis Module — style guide repo
export * from './firebase/FirestoreUserAssignmentBriefRepository'; // ✍️ Exegesis Module — assignment brief template repo
export * from './exegesis'; // ✍️ Exegesis Module — Gemini orchestrator
export * from './gemini/GeminiAIService';
export * from './gemini/GeminiSermonGenerator';
export * from './sermon-repurposer/GeminiSermonRepurposer';
export * from './gemini/GeminiPlanGenerator';
export * from './gemini/GeminiEmbeddingService';
export * from './llm/proxyLlmClient'; // 🌱 Puerto ILlmClient sobre el proxy del servidor
// Tope de caracteres del prompt. Lo consume también la interfaz, para que el
// medidor de presupuesto del corpus mida contra el número real y no una copia.
export { MAX_PROMPT_CHARS } from './llm/promptBudget';
// NO va acá ninguna clase que importe `@google/generative-ai`: este barrel lo
// consume el navegador, y un solo `export *` de una clase con el SDK lo
// empaqueta entero aunque nadie la construya. Las llamadas al modelo salen
// por callables desde 2026-08.
export * from './firebase/MockAIAgentRepository'; // 🎓 Catalog of AI faculty agents
export * from './firebase/FirestoreAIAgentRepository'; // 🎓 Live DB of AI faculty agents
export * from './greek-tutor/gemini/GeminiGreekTutorService'; // 🏛️ Greek Tutor Service
export * from './gemini/pastoralWordStudyPrompts'; // 🌱 Phase 1.5 prompt builders
export * from './lexicon'; // 🌱 Phase 1.5 Composite Lexicon (curated + LSJ + BDB)
export * from './greek-tutor/repositories/FirestoreGreekSessionRepository';
export * from './services/DocumentProcessingService';
export * from './services/AnalyticsService'; // 📊 Analytics Tracking Service
export * from './cache/MemoryCacheService';
export * from './export/PdfExportService';
export * from './strategies';
export * from './firebase/FirebaseGeoEventRepository'; // 📊 Geographic Event Repository
export * from './services/GeolocationService'; // 📊 IP Geolocation Service
export * from './bible'; // 📖 Bible Multi-version Repositories

// Hebrew Tutor
export * from './hebrew-tutor/index.js';
export * from './greek-analyzer/GreekInsightService';
export * from './greek-analyzer/FirestoreGreekInsightRepository';
export * from './greek-analyzer/FirestoreGreekFindingsRepository';

export * from './gemini/SseMultiAgentService';
// 🔐 Callables de biblioteca (subida a Files API + caché de contexto). Viven en
// infraestructura para que la capa web no importe Firebase directamente.
export * from './library/callableLibrary';
export { FirestoreWorkProfileRepository } from './firebase/FirestoreWorkProfileRepository';
