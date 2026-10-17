/**
 * Lo que cuesta cada operación de exégesis y qué llamadas al modelo cubre
 * (fase «el cobro de la exégesis pasa al servidor», 2026-10-17).
 *
 * El costo es una COPIA de `EXEGESIS_OPERATION_CATALOG` del dominio
 * (`packages/domain/src/entities/ExegesisOperationCatalog.ts`), porque
 * `functions` no importa `@dosfilos/domain`. La prueba de paridad
 * (`__tests__/catalogoDeCobro.test.ts`) lo compara con el dominio.
 *
 * El navegador sólo dice QUÉ operación hace: el costo sale siempre de acá.
 */

export interface OperacionCobrada {
    costoUsd: number;
    /** Las etiquetas (`feature`) de `runLlmPrompt` que la operación usa. */
    etiquetas: readonly string[];
    /**
     * Llamadas al modelo que cubre una reserva. Una operación puede ser
     * varias llamadas: el cliente reintenta hasta 5 veces ante un 503
     * (`withGeminiRetry`), los compositores repiten una vez si faltan claves,
     * y la verificación hace una por cada cita que no coincide textualmente.
     */
    maxLlamadas: number;
}

/** 1 llamada × 5 intentos del cliente + 1 por el reintento de sesión. */
const UNA = 6;
/** Los compositores que repiten una vez. */
const DOS = 12;

export const CATALOGO_DE_COBRO: Readonly<Record<string, OperacionCobrada>> = {
    analyzeVerseCanonically: { costoUsd: 0.10, etiquetas: ['exegesis.analyzeVerse'], maxLlamadas: UNA },
    composeVerseAcademicProse: { costoUsd: 0.02, etiquetas: ['exegesis.composeVerse'], maxLlamadas: UNA },
    composeConclusionFromAnalyses: { costoUsd: 0.06, etiquetas: ['exegesis.composeConclusion'], maxLlamadas: DOS },
    composeIntroductionFromAnalyses: { costoUsd: 0.06, etiquetas: ['exegesis.composeIntroduction'], maxLlamadas: DOS },
    composeAcademicPaper: { costoUsd: 0.20, etiquetas: ['exegesis.composeAcademicPaper'], maxLlamadas: DOS },
    composeSermonFromAnalyses: { costoUsd: 0.05, etiquetas: ['exegesis.composeSermon'], maxLlamadas: UNA },
    composeDevotionalFromAnalyses: { costoUsd: 0.05, etiquetas: ['exegesis.composeDevotional'], maxLlamadas: UNA },
    composeStudyGuideFromAnalyses: { costoUsd: 0.05, etiquetas: ['exegesis.composeStudyGuide'], maxLlamadas: UNA },
    // Una llamada por cita que no coincide textualmente, en dos pasadas.
    verifyStepCitations: { costoUsd: 0.05, etiquetas: ['exegesis.verifyCitation'], maxLlamadas: 100 },
    placeIdeaInSection: { costoUsd: 0.02, etiquetas: ['exegesis.placeIdea'], maxLlamadas: UNA },
    runCoherencePass: { costoUsd: 0.12, etiquetas: ['exegesis.reviewCoherence'], maxLlamadas: UNA },
    extractRubricFromText: { costoUsd: 0.02, etiquetas: ['exegesis.extractRubric'], maxLlamadas: UNA },
    extractRubricFromDocument: { costoUsd: 0.03, etiquetas: ['exegesis.extractRubric'], maxLlamadas: UNA },
    extractRubricFromImage: { costoUsd: 0.02, etiquetas: ['exegesis.extractRubric'], maxLlamadas: UNA },
    extractRubricPreviewFromImage: { costoUsd: 0.02, etiquetas: ['exegesis.extractRubric'], maxLlamadas: UNA },
    extractStyleGuideManifest: { costoUsd: 0.03, etiquetas: ['exegesis.extractStyleManifest'], maxLlamadas: UNA },
    // Sin uso todavía (`ClassifySourceTypeUseCase` tiene un TODO): su etiqueta
    // no cobra, así que no se le asigna ninguna.
    classifySourceType: { costoUsd: 0.001, etiquetas: [], maxLlamadas: UNA },
    generateStep: { costoUsd: 0.08, etiquetas: ['exegesis.generateStep'], maxLlamadas: UNA },
};

/** Las etiquetas de `runLlmPrompt` que sólo pasan con una reserva. */
export const ETIQUETAS_QUE_COBRAN: ReadonlySet<string> = new Set(
    Object.values(CATALOGO_DE_COBRO).flatMap(o => o.etiquetas),
);

/**
 * Hasta cuándo una reserva cubre llamadas: la verificación de muchas citas o
 * el paper académico pueden tardar varios minutos.
 */
export const VIGENCIA_DE_RESERVA_MS = 60 * 60 * 1000;
/** Una reserva que nunca llegó al modelo se devuelve pasado este tiempo (la pestaña se cerró). */
export const ESPERA_PARA_DEVOLVER_MS = 15 * 60 * 1000;
