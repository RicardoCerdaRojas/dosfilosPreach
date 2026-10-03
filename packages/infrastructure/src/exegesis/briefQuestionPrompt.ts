import type { QuestionCandidate } from '@dosfilos/domain';

/**
 * El pedido de «Sugerir preguntas», sin nada de Firebase: lo usan el
 * sugeridor (`BriefQuestionSuggester`) y el banco
 * (`scripts/llm-bakeoff/preguntas.ts`), que así mide el prompt de producción
 * y no una copia.
 */
export interface SuggestBriefQuestionsInput {
    /** «Jonás 4:5-11». */
    passageLabel: string;
    /** Nombre del género, para orientar qué mirar. */
    genre: string;
    /** El texto original, versículo por versículo. */
    verses: ReadonlyArray<{ ref: string; text: string }>;
    /** Los lemas del pasaje: las ÚNICAS formas que puede citar. */
    lemmas: ReadonlyArray<string>;
    /** Las que el encuadre ya tiene, para no repetirlas. */
    existingQuestions: ReadonlyArray<string>;
    language: 'es' | 'en';
}

export const SUGGEST_BRIEF_QUESTIONS_INSTRUCTION = [
    'Eres un profesor de exégesis que ayuda a un pastor a preparar el estudio de un pasaje para predicarlo.',
    'NO haces el estudio: propones PREGUNTAS que el pastor puede hacerle al texto. Él decide cuáles usa.',
    '',
    'REGLAS:',
    '1. Cada pregunta señala una cruz real del texto: una palabra clave, una repetición, una construcción,',
    '   un cambio de sujeto, una tensión que el pasaje no resuelve. Nada de preguntas de aplicación.',
    '2. Cada pregunta nombra la forma hebrea o griega concreta que discute, copiada de la lista de lemas',
    '   o del texto que recibes. NUNCA cites una forma que no esté ahí.',
    '3. Pregunta; no respondas. No incluyas tu interpretación ni la conclusión dentro de la pregunta.',
    '4. Entre 5 y 8 preguntas, distintas de las que el encuadre ya tiene.',
    '5. «why»: una oración sobre qué cruz del texto señala la pregunta (no la respuesta).',
    '',
    'Devuelve SOLO JSON: {"questions":[{"question":"...","why":"...","forms":["..."]}]}',
].join('\n');

export function buildSuggestBriefQuestionsPrompt(input: SuggestBriefQuestionsInput): string {
    const idioma = input.language === 'en' ? 'English' : 'español latinoamericano neutro (tú, no vos)';
    return [
        `Pasaje: ${input.passageLabel} · Género: ${input.genre}`,
        `Idioma de las preguntas: ${idioma}.`,
        '',
        'TEXTO ORIGINAL',
        ...input.verses.map(v => `${v.ref}  ${v.text}`),
        '',
        `LEMAS DEL PASAJE (las únicas formas que puedes citar): ${input.lemmas.join(' · ')}`,
        '',
        input.existingQuestions.length > 0
            ? `YA EN EL ENCUADRE (no las repitas):\n${input.existingQuestions.map(q => `- ${q}`).join('\n')}`
            : 'El encuadre todavía no tiene preguntas.',
    ].join('\n');
}

/** Lo que devolvió el modelo, en la forma esperada; lo demás se descarta. */
export function parseQuestionCandidates(raw: string): QuestionCandidate[] {
    let data: unknown;
    try {
        data = JSON.parse(raw.trim().replace(/^```(?:json)?/, '').replace(/```$/, ''));
    } catch {
        return [];
    }
    const lista = (data as { questions?: unknown })?.questions;
    if (!Array.isArray(lista)) return [];
    return lista.flatMap(item => {
        const q = item as Record<string, unknown>;
        const question = typeof q.question === 'string' ? q.question.trim() : '';
        if (!question) return [];
        return [{
            question,
            why: typeof q.why === 'string' ? q.why.trim() : '',
            forms: Array.isArray(q.forms) ? q.forms.filter((f): f is string => typeof f === 'string') : [],
        }];
    }).slice(0, 8);
}
