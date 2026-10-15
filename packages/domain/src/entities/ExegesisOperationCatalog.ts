/**
 * Per-operation cost catalog for the exegesis module's LLM-backed
 * actions. The reserve/refund use cases (Fase 2) read these constants
 * to charge the user's `processingBalance.exegesis*` bucket BEFORE
 * dispatching the call to Gemini.
 *
 * Costs are conservative estimates based on Gemini 2.5 Pro pricing
 * (input $1.25 / 1M tok, output $5.00 / 1M tok) and observed token
 * volumes from PR #103-#111 staging runs:
 *
 *   - Canonical analysis per verse: ~25-40K input + ~8-15K output =
 *     ~$0.10 mid-range. Conservative cap at $0.10.
 *   - Per-verse academic prose: ~10K + ~2K = ~$0.02.
 *   - Section composers (intro, conclusion): ~30K + ~4K = ~$0.06.
 *   - Whole-paper academic composer: ~50K + ~25K = ~$0.20.
 *   - Ministry composers (sermon / devotional / study guide): ~30K +
 *     ~3K = ~$0.05 each.
 *   - Citation verification per step: ~8 cites × (3K + 0.5K) +
 *     embedding queries = ~$0.05.
 *   - Coherence pass (whole paper): ~80K + ~3K = ~$0.12.
 *   - Setup / classification operations: <$0.05 each.
 *
 * The display unit "estudio" is approximately $2 USD — picked so a
 * Pro plan's $10 monthly allowance maps cleanly to "5 estudios", and
 * a paper that runs the full pipeline (analysis + per-verse prose +
 * intro/conclusion + verify + coherence) lands at roughly 1 estudio.
 *
 * To add a new operation: append a key here, set the conservative
 * cost, then call the reserve use case from the operation's UC. The
 * UI's "this will cost ~$X" pre-warn reads from this same catalog so
 * the friction layer stays consistent.
 */
export type ExegesisOperationKey =
    | 'analyzeVerseCanonically'
    | 'composeVerseAcademicProse'
    | 'composeConclusionFromAnalyses'
    | 'composeIntroductionFromAnalyses'
    | 'composeAcademicPaper'
    | 'composeSermonFromAnalyses'
    | 'composeDevotionalFromAnalyses'
    | 'composeStudyGuideFromAnalyses'
    | 'verifyStepCitations'
    // «Agregar una idea a esta sección»: una o dos oraciones, no la sección.
    | 'placeIdeaInSection'
    | 'runCoherencePass'
    | 'extractRubricFromText'
    | 'extractRubricFromDocument'
    | 'extractRubricFromImage'
    | 'extractRubricPreviewFromImage'
    | 'extractStyleGuideManifest'
    | 'classifySourceType'
    // `generateSermonFromPaper` cerraba esta unión. Se retiró con el
    // transformador paper→sermón: el paper ahora alimenta el estudio de
    // 8 pasos leyendo los análisis que el pastor ya aceptó, sin contactar
    // ningún modelo, así que no hay operación que tarifar. Los registros
    // históricos con esa clave siguen resolviendo a costo 0 vía
    // `getExegesisOperationCostUsd`, que no tira ante claves desconocidas.
    | 'generateStep';

export interface ExegesisOperationDefinition {
    key: ExegesisOperationKey;
    /** Estimated USD cost. Reserve uses this to pre-charge the bucket. */
    estimatedCostUsd: number;
    /**
     * When `true`, the UI pre-confirms the cost before dispatching
     * the operation. Threshold: ≥ $0.10 OR operations the user can
     * accidentally retrigger (re-analysis, recompose academic).
     */
    requiresPreConfirm: boolean;
    /**
     * i18n key for the operation's display name (used in the
     * confirmation modal + cost breakdown drawer). Lives under
     * `studies.operations.<key>` — not duplicated here.
     */
    displayKeyI18n: string;
}

/** USD value of one "estudio" — display-only conversion for the UI. */
export const STUDY_UNIT_USD = 2;

export const EXEGESIS_OPERATION_CATALOG: Readonly<Record<ExegesisOperationKey, ExegesisOperationDefinition>> = {
    analyzeVerseCanonically: {
        key: 'analyzeVerseCanonically',
        estimatedCostUsd: 0.10,
        // Verse-level op: user runs this 7-15× per paper (one per
        // verse). A pre-confirm modal on every click adds friction
        // out of proportion to the cost (0.05 estudios). Telemetry
        // + the always-visible balance tile already give cost
        // transparency; reserve the modal for one-shot batch ops
        // (composeAcademicPaper, runCoherencePass).
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.analyzeVerseCanonically',
    },
    composeVerseAcademicProse: {
        key: 'composeVerseAcademicProse',
        estimatedCostUsd: 0.02,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.composeVerseAcademicProse',
    },
    composeConclusionFromAnalyses: {
        key: 'composeConclusionFromAnalyses',
        estimatedCostUsd: 0.06,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.composeConclusionFromAnalyses',
    },
    composeIntroductionFromAnalyses: {
        key: 'composeIntroductionFromAnalyses',
        estimatedCostUsd: 0.06,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.composeIntroductionFromAnalyses',
    },
    composeAcademicPaper: {
        key: 'composeAcademicPaper',
        estimatedCostUsd: 0.20,
        requiresPreConfirm: true,
        displayKeyI18n: 'studies.operations.composeAcademicPaper',
    },
    composeSermonFromAnalyses: {
        key: 'composeSermonFromAnalyses',
        estimatedCostUsd: 0.05,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.composeSermonFromAnalyses',
    },
    composeDevotionalFromAnalyses: {
        key: 'composeDevotionalFromAnalyses',
        estimatedCostUsd: 0.05,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.composeDevotionalFromAnalyses',
    },
    composeStudyGuideFromAnalyses: {
        key: 'composeStudyGuideFromAnalyses',
        estimatedCostUsd: 0.05,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.composeStudyGuideFromAnalyses',
    },
    verifyStepCitations: {
        key: 'verifyStepCitations',
        estimatedCostUsd: 0.05,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.verifyStepCitations',
    },
    placeIdeaInSection: {
        key: 'placeIdeaInSection',
        estimatedCostUsd: 0.02,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.placeIdeaInSection',
    },
    runCoherencePass: {
        key: 'runCoherencePass',
        estimatedCostUsd: 0.12,
        requiresPreConfirm: true,
        displayKeyI18n: 'studies.operations.runCoherencePass',
    },
    extractRubricFromText: {
        key: 'extractRubricFromText',
        estimatedCostUsd: 0.02,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.extractRubricFromText',
    },
    extractRubricFromDocument: {
        key: 'extractRubricFromDocument',
        estimatedCostUsd: 0.03,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.extractRubricFromDocument',
    },
    extractRubricFromImage: {
        key: 'extractRubricFromImage',
        estimatedCostUsd: 0.02,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.extractRubricFromImage',
    },
    extractRubricPreviewFromImage: {
        key: 'extractRubricPreviewFromImage',
        // Same Gemini Vision call as `extractRubricFromImage` — the
        // only difference is whether we persist the result. Cost is
        // identical so the operation costs the same credits.
        estimatedCostUsd: 0.02,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.extractRubricPreviewFromImage',
    },
    extractStyleGuideManifest: {
        key: 'extractStyleGuideManifest',
        estimatedCostUsd: 0.03,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.extractStyleGuideManifest',
    },
    classifySourceType: {
        key: 'classifySourceType',
        estimatedCostUsd: 0.001,
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.classifySourceType',
    },
    generateStep: {
        key: 'generateStep',
        estimatedCostUsd: 0.08,
        // Same rationale as `analyzeVerseCanonically`: legacy verse
        // generation runs many times per paper; a modal on every
        // click is friction. Reserve pre-confirm for one-shot batch
        // ops (composeAcademicPaper, runCoherencePass).
        requiresPreConfirm: false,
        displayKeyI18n: 'studies.operations.generateStep',
    },
};

/**
 * Helper: cost in USD for a single operation. Returns 0 when the key
 * isn't recognized — the reserve UC interprets that as "free" rather
 * than throwing, so adding new exegesis operations without updating
 * the catalog never accidentally charges users.
 */
export function getExegesisOperationCostUsd(key: string): number {
    const def = (EXEGESIS_OPERATION_CATALOG as Record<string, ExegesisOperationDefinition | undefined>)[key];
    return def?.estimatedCostUsd ?? 0;
}

/**
 * Helper: should the UI pre-confirm before dispatching this operation?
 * Returns false for unknown keys (graceful default).
 */
export function operationRequiresPreConfirm(key: string): boolean {
    const def = (EXEGESIS_OPERATION_CATALOG as Record<string, ExegesisOperationDefinition | undefined>)[key];
    return def?.requiresPreConfirm ?? false;
}

/**
 * Display conversion: USD → studies. Round to 1 decimal so the UI
 * doesn't show "0.05 estudios" — instead it renders as "<0.1
 * estudios" (the consumer can choose a copy variant when the
 * resulting value is < 0.1).
 */
export function usdToStudies(usd: number): number {
    return usd / STUDY_UNIT_USD;
}
