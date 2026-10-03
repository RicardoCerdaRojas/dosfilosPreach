import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { ILlmClient } from '../llm/LlmClient';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { GeminiLlmClient } from '../llm/GeminiLlmClient';

/**
 * Pastoral Fidelity Phase 2.5 (ADR-025/026) — Study Companion, Moment 1.
 *
 * Per-step orientation in the eight-step wizard. The companion knows the
 * passage + the step the pastor is on, and returns DATA + SOCRATIC QUESTIONS
 * — never the pastor's answer. It is a VERIFIER-ORIENTER: it may CONFRONT a
 * method error (wrong literary genre, reading rule inconsistent with genre,
 * structural misreading, exegetical leap), per manifesto §7, but never writes
 * the interpretation for the pastor (P1/P2). Pull-first: the pastor invokes
 * it via "Pedir orientación".
 *
 * Silence (ADR-023) is preserved for legitimate `distinctive`/`open` doctrinal
 * interpretation — this callable touches METHOD, not confessional dissent.
 */

const ORIENTABLE_STEPS = [
    'contextGenre',
    'structuralAnalysis',
    'wordStudies',
    'recognition',
    'function',
] as const;
type OrientableStep = (typeof ORIENTABLE_STEPS)[number];

const STEP_FOCUS: Record<OrientableStep, string> = {
    contextGenre:
        'el GÉNERO literario del pasaje y cómo gobierna las reglas de lectura. El género se determina ANTES de la estructura. Si el pastor asume un género equivocado (p. ej. leer un Evangelio como profecía apocalíptica de cumplimiento literal), confróntalo nombrando el género correcto y preguntando cómo cambia su regla de lectura.',
    structuralAnalysis:
        'la ESTRUCTURA / oración principal del pasaje: sujeto, verbo principal, conectores lógicos, subordinación. Si el pastor confunde la cláusula principal con una subordinada, señálalo.',
    wordStudies:
        'las PALABRAS CLAVE del pasaje que cargan peso teológico, con su forma original (transliteración + glosa breve), sin convertir esto en lección de idiomas.',
    recognition:
        'los PARALELOS canónicos que iluminan el pasaje (teología bíblica AT→NT). Privilegia paralelos con peso teológico claro, no solo verbal.',
    function:
        'la FUNCIÓN del texto para su audiencia original: qué hacía el texto (afirmaba, exigía, descartaba) en su contexto antes de aplicarlo hoy.',
};

const SYSTEM_BASE = `Eres un acompañante de estudio pastoral, experto en hermenéutica histórico-gramatical y teología.

El pastor está estudiando un pasaje, paso por paso, ANTES de predicar. Tu rol es ORIENTAR su estudio, NUNCA escribirlo por él.

Reglas inviolables:
- Aportas DATOS (hechos del texto, género, trasfondo con fuente real, paralelos) + PREGUNTAS SOCRÁTICAS que lo hacen pensar.
- NUNCA escribes la respuesta/interpretación del pastor. No redactes su impresión, su idea, su principio ni su conclusión.
- Eres CONFRONTATIVO ante errores de MÉTODO (género equivocado, regla de lectura inconsistente con el género, error estructural, salto exegético): nómbralo con justicia y desmántelalo con el método mismo, en forma de pregunta.
- NO te metes en interpretaciones doctrinales legítimamente abiertas entre tradiciones fieles — eso no es error de método.
- Si no tienes una fuente real para un dato de trasfondo histórico, dilo ("no tengo trasfondo documentado para este libro"); NUNCA inventes una cita.
- Tono pastoral, español neutral latinoamericano, "tú". Breve.`;

const SYSTEM_SIMPLIFIED = `${SYSTEM_BASE}

MODO SIMPLIFICADO (segundo nivel de ayuda, ZPD/scaffolding):
- El pastor pidió que se lo expliques más sencillo. Baja el registro técnico: cero jerga (sin "predicado nominal", "cláusula subordinada", "convergencia canónica" — explica la idea con palabras llanas).
- Mantén las mismas reglas inviolables (verificador, no generador; no escribes la respuesta).
- Agrega UN ejemplo concreto del MÉTODO en otro pasaje conocido (no en el pasaje en estudio, así no le das la respuesta). El ejemplo ilustra CÓMO se hace, no QUÉ debe concluir aquí.
- Si confrontas, hazlo con una analogía cotidiana (no con términos técnicos).`;

interface OrientStudyResult {
    /** Factual data points relevant to the step. */
    data: string[];
    /** Socratic questions the pastor should wrestle with. */
    questions: string[];
    /** Present only when a method error is detected. Phrased as confrontation. */
    confrontation?: string;
    /** e.g. background not available for this book. */
    caution?: string;
    /**
     * Phase 2.5 (ZPD scaffolding) — present only in simplified mode. A
     * concrete example of the METHOD applied to a DIFFERENT passage, so the
     * pastor sees how the method works without being handed the answer to
     * their own passage (P1/P2).
     */
    example?: string;
}

function safeParseJson(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const first = cleaned.search(/[{[]/);
    const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (first === -1 || last === -1) throw new Error('Respuesta sin JSON detectable.');
    return JSON.parse(cleaned.substring(first, last + 1));
}

function toStringArray(value: unknown, max: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((v) => String(v ?? '').trim())
        .filter((s) => s.length > 0)
        .slice(0, max);
}

export const orientStudy = onCall(
    { ...appCheckCallableOptions(), secrets: ['GEMINI_API_KEY'], timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret not configured');
        }

        const data = request.data ?? {};
        const passage = String(data.passage ?? '').trim();
        const stepKey = String(data.stepKey ?? '').trim() as OrientableStep;
        if (!passage) throw new HttpsError('invalid-argument', 'passage es requerido.');
        if (!ORIENTABLE_STEPS.includes(stepKey)) {
            throw new HttpsError('invalid-argument', `stepKey debe ser uno de: ${ORIENTABLE_STEPS.join(', ')}.`);
        }

        const pastorInput = String(data.pastorInput ?? '').trim();
        const genre = String(data.genre ?? '').trim();
        const simplify = Boolean(data.simplify);

        const exampleSchemaLine = simplify
            ? `,\n  "example": "ejemplo concreto del MÉTODO aplicado a OTRO pasaje (no este), 2-4 frases, ilustrando el cómo sin dar la respuesta de este pasaje"`
            : '';
        const simplifyDirective = simplify
            ? `\n\nIMPORTANTE: el pastor pidió que se lo expliques MÁS SENCILLO. Baja el registro técnico, sin jerga. Incluye el campo "example" con un ejemplo del método en otro pasaje conocido.`
            : '';

        const prompt = `Pasaje en estudio: ${passage}
${genre ? `Género ya identificado: ${genre}` : ''}
Paso actual del estudio: enfócate en ${STEP_FOCUS[stepKey]}

Lo que el pastor ha escrito hasta ahora en este paso (puede estar vacío o contener un error de método):
"""
${pastorInput || '(aún no ha escrito nada)'}
"""${simplifyDirective}

Orienta su estudio de este paso. Devuelve SIEMPRE JSON válido (sin Markdown):
{
  "data": ["1-3 datos factuales del texto relevantes a este paso, español"],
  "questions": ["1-3 preguntas socráticas que lo hagan pensar, español"],
  "confrontation": "solo si detectas un ERROR DE MÉTODO en lo que escribió; nómbralo y conviértelo en pregunta; omite el campo si no hay error",
  "caution": "solo si no tienes una fuente real para un dato que correspondería; omite el campo si no aplica"${exampleSchemaLine}
}`;

        try {
            // Swap point (Q7): replace with another ILlmClient adapter to change provider.
            const llm: ILlmClient = new GeminiLlmClient(apiKey);
            const raw = await llm.generate({
                system: simplify ? SYSTEM_SIMPLIFIED : SYSTEM_BASE,
                prompt,
                temperature: 0.3,
                responseMimeType: 'application/json',
            });
            const parsed = safeParseJson(raw);
            const result: OrientStudyResult = {
                data: toStringArray(parsed.data, 3),
                questions: toStringArray(parsed.questions, 3),
            };
            const confrontation = String(parsed.confrontation ?? '').trim();
            if (confrontation) result.confrontation = confrontation;
            const caution = String(parsed.caution ?? '').trim();
            if (caution) result.caution = caution;
            if (simplify) {
                const example = String(parsed.example ?? '').trim();
                if (example) result.example = example;
            }
            return result;
        } catch (err) {
            console.error('[orientStudy] llm failed', err);
            throw new HttpsError('internal', err instanceof Error ? err.message : 'Orientation failed');
        }
    },
);
