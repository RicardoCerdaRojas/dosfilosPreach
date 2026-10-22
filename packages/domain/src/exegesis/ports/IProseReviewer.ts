import type { ProseReviewerFinding } from '../services/proseReview';

/**
 * El revisor con modelo de «Revisión antes de entregar» (TP #8, fase 8b, E3).
 *
 * Lee la prosa de UN versículo contra los criterios del profesor y lo que su
 * análisis ya resolvió. Los controles mecánicos los hace `reviewProseFixed`
 * sin modelo; este se queda con los que piden leer el argumento: si el
 * criterio discrimina, si una refutación da razón, si un dato es pertinente.
 * Solo avisa.
 */
export interface IProseReviewer {
    review(input: ProseReviewInput): Promise<ProseReviewOutput>;
}

export interface ProseReviewInput {
    prose: string;
    /** «Santiago 4:5». */
    verseLabel: string;
    language: 'es' | 'en';
    /** Las preguntas del encuadre que responde este versículo. */
    questions: ReadonlyArray<{ number: number; text: string }>;
    /** Lo que el análisis decidió, para ver si la prosa lo conserva. */
    decisiveCriteria: ReadonlyArray<{ questionNumber: number; text: string; whyThisOverThat: string; decision: string }>;
    /** Las citas de la gramática del curso en el análisis: «Wallace, p. 533». */
    grammarCitations: ReadonlyArray<string>;
    /** Los criterios numerados desde 1 (`proseReviewCriteria`). */
    criteria: ReadonlyArray<string>;
}

export interface ProseReviewOutput {
    findings: ProseReviewerFinding[];
    modelId: string;
    tokensUsed: number | null;
}
