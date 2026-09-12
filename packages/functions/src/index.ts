import { initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
initializeApp();

// Export library functions
export { extractPdfWithGemini } from './library/extractPdfWithGemini';
export { reprocessWithLlamaParse } from './library/reprocessWithLlamaParse';
export { cancelExtraction } from './library/cancelExtraction';
export { processWithGemini } from './library/processWithGemini';
export { resetLlamaParseCounters } from './library/resetLlamaParseCounters';
export { alertLlamaParseUsage } from './library/alertLlamaParseUsage';
export { indexStructuredDocument } from './library/indexStructuredDocument';
export { autoIndexOnExtractionReady } from './library/autoIndexOnExtractionReady';
export { indexResourceTask } from './library/indexResourceTask';
export { extractRangeTask } from './library/extractRangeTask';
export { alertFailedIndexing } from './library/alertFailedIndexing';
export { sweepStalledExtractions } from './library/sweepStalledExtractions';
export { incrementUsage } from './usage/incrementUsage';
export { getGreekDashboardSessions } from './greek-tutor/getGreekDashboardSessions';
export { getFacultyDashboardSessions } from './faculty/getFacultyDashboardSessions';
export { getUserExtractionsSummary } from './faculty/getUserExtractionsSummary';
export { seedTeachingDemo } from './teaching-suite/seedTeachingDemo';
export { saveTeachingBrand } from './teaching-suite/saveTeachingBrand';
export { deleteTeachingBrand } from './teaching-suite/deleteTeachingBrand';
export { encolarPlanSesion } from './teaching-suite/encolarPlanSesion';
export { generarPlanJob } from './teaching-suite/generarPlanJob';
export { proponerOutlineCurso } from './teaching-suite/proponerOutlineCurso';
export { crearClaseDesdePlan } from './teaching-suite/crearClaseDesdePlan';
export { promoteCanvasForm } from './teaching-suite/promoteCanvasForm';
export { deleteCanvasComponent } from './teaching-suite/deleteCanvasComponent';
export { getExegesisPapersSummary } from './exegesis/getExegesisPapersSummary';
export { getSermonsListSummary } from './sermon/getSermonsListSummary';
export { retrieveChunks } from './library/retrieveChunks';
// Lectura estructural del índice: tabla de contenidos y texto por tramo.
// Complementan a `retrieveChunks` — responden "qué parte de este libro
// trata este pasaje" en vez de "qué se parece a esta consulta".
export { getDocumentOutline, getDocumentChunks } from './library/documentStructure';
// Selector de páginas: índice de hojas del documento y URL firmada del PDF.
export { getDocumentPageIndex, getDocumentPdfUrl } from './library/documentPageIndex';
// Corpus consultable: ranking dentro de las hojas que el trabajo admitió.
export { retrieveCuratedCorpus } from './library/retrieveCuratedCorpus';
export { auditIndexing } from './library/auditIndexing';
export { createCoreLibraryStore } from './library/createCoreLibraryStore';
export { updateCoreLibraryStore } from './library/updateCoreLibraryStore';
export { deleteCoreLibraryStore } from './library/deleteCoreLibraryStore';
export { removeFileFromStore } from './library/removeFileFromStore';
export { uploadTextToGemini } from './library/uploadTextToGemini';
export { createLibraryCache } from './library/createLibraryCache';

// Export Stripe functions
export { createCheckoutSession } from './stripe/createCheckoutSession';
export { stripeWebhook } from './stripe/webhook';

// Export Auth functions
export { completeRegistration } from './auth/completeRegistration';
export { resendVerificationEmail } from './auth/resendVerificationEmail';
// NOTE: the legacy `sendVerificationEmail` (separate transactional verification
// email) is kept at packages/functions/src/auth/sendVerificationEmail.ts but
// not exported. The verification link now travels inside the branded welcome
// email (see emails/sendWelcomeEmail.ts), and `resendVerificationEmail` reuses
// the same template — so a second function is no longer needed.

// Custom portal functions
export { updatePaymentMethod } from './stripe/updatePaymentMethod';
export { changePlan } from './stripe/changePlan';
export { cancelSubscription } from './stripe/cancelSubscription';
export { reactivateSubscription } from './stripe/reactivateSubscription';
export { getInvoices } from './stripe/getInvoices';

// Subscription management functions
export { extendTrial } from './subscription/extendTrial';
export { submitCancellationFeedback } from './subscription/submitCancellationFeedback';

// Export Analytics functions
export { trackUserActivity } from './analytics/trackUserActivity';
export { trackFunnelEvent } from './analytics/trackFunnelEvent';

// Lead-magnet capture (Fase B funnel)
export { captureLead } from './leads/captureLead';
export { resendLeadMagnet } from './leads/resendLeadMagnet';
// Daily nurture sequence for magnet downloaders pre-signup (Fase 2.3).
export { sendLeadMagnetNurture } from './leads/sendLeadMagnetNurture';
// Super-admin callable to render any nurture template with sample inputs.
export { previewLeadMagnetNurture } from './leads/previewLeadMagnetNurture';
// Super-admin callable to render the ShareEmail (extraction share) template.
export { previewExtractionShareEmail } from './leads/previewExtractionShareEmail';
// Super-admin callable to render the welcome email (free + paid flows).
export { previewWelcomeEmail } from './auth/previewWelcomeEmail';
// Pastor-initiated email send for any persisted extraction (Fase 3.3).
export { sendExtractionByEmail } from './leads/sendExtractionByEmail';
// WordPress draft publish for any persisted extraction (Fase 3.3.b).
export { publishExtractionToWordpress } from './leads/publishExtractionToWordpress';
// Diagnostic: probes the user's WP integration and returns roles/caps.
export { testWordpressConnection } from './leads/testWordpressConnection';
export { onUserLogin } from './analytics/onUserLogin';
export { aggregateDailyMetrics } from './analytics/aggregateDailyMetrics';
export { recalculateAnalytics, recalculateAnalyticsHttp, recalculateAnalyticsCallable } from './analytics/recalculateAnalytics';


// Export Event-Driven Analytics functions
export {
    onSermonCreated,
    onSermonPublished,
    onSermonDeleted,
} from './analytics/sermonAnalytics';

export {
    onGreekSessionCreated,
    onGreekSessionCompleted,
    onGreekSessionDeleted,
} from './analytics/greekSessionAnalytics';

export {
    onUserCreated,
    onUserActivity,
    onUserDeleted,
    onSubscriptionChanged,
} from './analytics/userAnalytics';

// Export Email functions
export { sendWelcomeEmail } from './emails/sendWelcomeEmail';
export { sendNurtureEmails } from './emails/sendNurtureEmails';

// Export Geographic Analytics functions
export { trackUserRegistration, trackUserLogin, trackLandingVisit } from './analytics/geoCallableFunctions';

// Export Admin functions
export { deleteUser } from './admin/deleteUser';
export { disableUser } from './admin/disableUser';
export { enableUser } from './admin/enableUser';
export { resendWelcomeEmail } from './admin/resendWelcomeEmail';
export { migratePlanQuotas } from './admin/migratePlanQuotas';
export { backfillPlanQuotas } from './admin/backfillPlanQuotas';
export { backfillExegesisQuotas } from './admin/backfillExegesisQuotas';
export { notifyApproachingQuota } from './billing/notifyApproachingQuota';
export { migrateLegacySermons } from './admin/migrateLegacySermons';
export { changePlanForUser } from './admin/changePlanForUser';
export { bulkUserAction } from './admin/bulkUserAction';
export { impersonateUser } from './admin/impersonateUser';
export { stopImpersonating } from './admin/stopImpersonating';
export { grantUserCredits } from './admin/grantUserCredits';
export { resetUserPlanQuota } from './admin/resetUserPlanQuota';
export { extendUserTrialAdmin } from './admin/extendUserTrialAdmin';
export { setUserFeatureFlags } from './admin/setUserFeatureFlags';
export { ingestCoreLibraryConfessions } from './admin/confessions/ingestCoreLibrary';
export { tagConfessionDoctrineLevels } from './admin/confessions/tagDoctrineLevels';
export { updateSectionDoctrineLevel } from './admin/confessions/updateSectionDoctrineLevel';
export { ingestBibleCrossReferences } from './admin/cross-references/ingestCrossReferences';
export { lookupCrossReferences } from './admin/cross-references/lookupCrossReferences';
export { ingestLibrarySeedSources } from './admin/coreLibrary/ingestLibrarySeed';
// 🌱 Pastoral Fidelity Phase 1.6 — eight-step spine migration (ADR-022)
export { migratePastoralSeedsEightStep } from './admin/migratePastoralSeedsEightStep';

// 🌱 Pastoral Fidelity Phase 1.5 — Pastoral Word Study callables
export { identifyKeyWords } from './pastoral-word-study/identifyKeyWords';
export { analyzeWordPastorally } from './pastoral-word-study/analyzeWordPastorally';
export { suggestCanonicalParallels } from './pastoral-word-study/suggestCanonicalParallels';

// 🌱 Pastoral Fidelity Phase 2 — three-witnesses validation (ADR-011)
export { validateSeedWitnesses } from './three-witnesses/validateSeedWitnesses';
// 🛡️ Grieta doxológica — Capa 1 (modo sombra): telemetría del gate doxológico
export { recordDoxologicalGateShadow } from './three-witnesses/recordDoxologicalGateShadow';
// 🛡️ Grieta doxológica — lectura super_admin de la sombra (vista de monitoreo)
export { listDoxologicalShadow } from './three-witnesses/listDoxologicalShadow';

// 🌱 Gestión de costos — lectura del consumo LLM del servidor (super_admin).
export { getLlmUsageSummary } from './llm/getLlmUsageSummary';
export { checkLlmBudget } from './llm/checkLlmBudget';
export { runLlmPrompt } from './llm/runLlmPrompt';
export { facultyChatStream } from './faculty/facultyChatStream';
export { embedTexts } from './llm/embedTexts';
// ❤️ Examen del corazón — conducción afectiva (manifiesto v1.3 §4)
export { examenCorazon } from './three-witnesses/examenCorazon';
// 🌱 Pastoral Fidelity Phase 1.6 — timeless-principle verifier (ADR-023)
export { verifyTimelessPrinciple } from './three-witnesses/verifyTimelessPrinciple';
// 🌱 Pastoral Fidelity Phase 2.5 — Study Companion step orientation (ADR-026)
export { orientStudy } from './study-companion/orientStudy';
// 🌱 Pastoral Fidelity Phase 2.5 PR B — Faculty Socratic Sermon Agent LLM proxy (ADR-028)
export { runSocraticTurnLlm } from './guided-sermon/runSocraticTurnLlm';
// 🌱 Pastoral Fidelity Phase 2.5 Tier 3 — Structural puzzle builder (proposal `structural-puzzle-tier3.md`)
export { buildStructuralPuzzle } from './study-companion/buildStructuralPuzzle';
// 🌱 Pastoral Fidelity Phase 3 PR1 — Claim ↔ source fidelity evaluator (ADR-029)
export { evaluateClaimSourceFidelity } from './sermon/evaluateClaimSourceFidelity';
// 🧭 Fidelidad de citas en la redacción (opción B) — sanitizado quirúrgico de citas fabricadas
export { sanitizeSermonCitations } from './sermon/sanitizeSermonCitations';
// 🧭 Redacción v2 — recorder de sombra del draft (contrato común, colector determinista + juez)
export { recordSermonDraftShadow } from './sermon/recordSermonDraftShadow';
// 🌱 Pastoral Fidelity Phase 4 PR1 — contra-scan dissent retrieval + classification (ADR-033)
export { findDissentingChunks } from './sermon/findDissentingChunks';
// 🧭 Pastoral Fidelity ADR-035 — passage profile detector (Capa 1) + shadow telemetry
export { profilePassage } from './passage-profile/profilePassage';
export { recordPassageProfileShadow } from './passage-profile/recordPassageProfileShadow';
// 🧭 ADR-035 CA1 — engagement judgment (Sonnet) para el confront de common-misreading
export { evaluateCoverageEngagement } from './passage-profile/evaluateCoverageEngagement';
// 🌱 Redacción v2 Fase 1 (§4.4) A3 — engagement judgment (Sonnet) del override de género
export { evaluateGenreEngagement } from './passage-profile/evaluateGenreEngagement';
// 🧭 ADR-036 PR3 — adjudicación "¿el ancla refuta?" (Sonnet, ingest/revisión)
export { adjudicateAnchorRefutes } from './anchor-fidelity/adjudicateAnchorRefutes';
// 🧭 ADR-036 PR4 — store + ingest + review role-gated del set crítico curado
export { ingestVerifiedMisreading } from './anchor-fidelity/ingestVerifiedMisreading';
export { reviewVerifiedMisreading } from './anchor-fidelity/reviewVerifiedMisreading';
// 🧭 ADR-036 — editar/borrar entradas del set crítico (re-curar; editar resetea a pending)
export { updateVerifiedMisreading } from './anchor-fidelity/updateVerifiedMisreading';
export { deleteVerifiedMisreading } from './anchor-fidelity/deleteVerifiedMisreading';



