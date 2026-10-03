import { MODEL_FAST, type QuestionCandidate } from '@dosfilos/domain';
import {
    buildSuggestBriefQuestionsPrompt,
    parseQuestionCandidates,
    SUGGEST_BRIEF_QUESTIONS_INSTRUCTION,
    type SuggestBriefQuestionsInput,
} from './briefQuestionPrompt';
import { runLlmPrompt } from '../llm/callableLlm';
import { withGeminiRetry } from './geminiRetry';

/**
 * Preguntas CANDIDATAS para el encuadre de un estudio para predicar.
 *
 * El asistente propone; el pastor marca, edita o descarta (decisión del
 * fundador, 2026-10-03). Por eso el prompt pide preguntas y no respuestas,
 * y prohíbe conclusiones: descubrir qué preguntarle al texto es parte del
 * estudio, y una pregunta que trae la respuesta adentro le quita al pastor
 * justamente eso.
 *
 * Lo que vuelve se coteja después contra la morfología real del pasaje
 * (`filterQuestionCandidates`): una pregunta sobre una forma que el texto no
 * tiene se descarta.
 */
export type EjecutarPrompt = (system: string, prompt: string) => Promise<string>;

const pedirleAlModelo: EjecutarPrompt = (system, prompt) => withGeminiRetry(
    () => runLlmPrompt({
        feature: 'exegesis.suggestBriefQuestions',
        model: MODEL_FAST,
        system,
        prompt,
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 4096,
    }),
    { contextLabel: 'BriefQuestionSuggester', maxAttempts: 3 },
);

export async function suggestBriefQuestions(
    input: SuggestBriefQuestionsInput,
    ejecutar: EjecutarPrompt = pedirleAlModelo,
): Promise<QuestionCandidate[]> {
    const raw = await ejecutar(SUGGEST_BRIEF_QUESTIONS_INSTRUCTION, buildSuggestBriefQuestionsPrompt(input));
    return parseQuestionCandidates(raw);
}

export { buildSuggestBriefQuestionsPrompt, parseQuestionCandidates, type SuggestBriefQuestionsInput };
