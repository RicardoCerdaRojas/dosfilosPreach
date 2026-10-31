/**
 * Proponer y revisar la tesis de un trabajo con el modelo (fase «Lecciones
 * del TI #2», etapa 3.3; B63).
 *
 * La tesis se formula después de aceptar los análisis: se propone desde los
 * análisis aceptados y cualquier tesis, también la del estudiante, se revisa
 * con los seis criterios del curso. Calibrado contra el TI #1 y el TI #2
 * (docs/FASE_LECCIONES_TI2_2026-11.md, etapa 3).
 */
export const THESIS_CRITERIA = ['interpretive', 'covers', 'supported', 'distinguishes', 'connects', 'answers'] as const;
export type ThesisCriterion = (typeof THESIS_CRITERIA)[number];
export type ThesisVerdict = 'cumple' | 'no-cumple' | 'no-aplica';

export interface ThesisCriterionResult {
    criterion: ThesisCriterion;
    verdict: ThesisVerdict;
    /** Por qué, en una o dos oraciones llanas. */
    reason: string;
}

export interface ThesisReview {
    criteria: ThesisCriterionResult[];
    /** Una tesis corregida si algún criterio no se cumple; `null` si cumple todos. */
    suggestion: string | null;
}

export interface ThesisProposal {
    thesis: string;
    /** El respaldo, versículo por versículo. */
    support: Array<{ verse: string; evidence: string }>;
}

export interface ThesisAdvisorInput {
    /** «Salmo 23:4–6». */
    passageLabel: string;
    language: 'es' | 'en';
    assignmentBrief: string | null;
    /** Los análisis aceptados, serializados (`serializeAnalysis`). */
    briefings: string;
    /** Lo que estableció la unidad anterior del curso (`previousUnitStatement`), si la hay. */
    previousUnitThesis: string | null;
}

export interface IThesisAdvisor {
    propose(input: ThesisAdvisorInput): Promise<{ proposals: ThesisProposal[]; modelId: string; tokensUsed: number | null }>;
    review(input: ThesisAdvisorInput & { thesis: string }): Promise<ThesisReview & { modelId: string; tokensUsed: number | null }>;
}
