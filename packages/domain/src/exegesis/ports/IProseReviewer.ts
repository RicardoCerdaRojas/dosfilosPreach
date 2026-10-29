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
    decisiveCriteria: ReadonlyArray<{
        questionNumber: number;
        text: string;
        whyThisOverThat: string;
        decision: string;
        /** Las notas de revisión manual sobre las citas de esta respuesta (TP #9, B39). */
        reviewNotes?: ReadonlyArray<string>;
    }>;
    /** Las citas de la gramática del curso en el análisis: «Wallace, p. 533». */
    grammarCitations: ReadonlyArray<string>;
    /** Los criterios numerados desde 1 (`proseReviewCriteria`). */
    criteria: ReadonlyArray<string>;
    /**
     * Lo que el estudiante dejó escrito al revisar citas a mano. Pesa más que
     * el análisis: puede apartarse de él a propósito (TP #9, B39).
     */
    reviewNotes?: ReadonlyArray<{ citation: string; note: string }>;
    /** Las únicas citas que el revisor puede nombrar: «Wallace, p. 232» (TP #9, B40). */
    availableCitations?: ReadonlyArray<string>;
}

export interface ProseReviewOutput {
    findings: ProseReviewerFinding[];
    modelId: string;
    tokensUsed: number | null;
}
