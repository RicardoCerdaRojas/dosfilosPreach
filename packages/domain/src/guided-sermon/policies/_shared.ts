/**
 * Phase 2.5 PR B (ADR-028) — Shared helpers for step policies.
 *
 * DRY between the 8 step policies. Keep this file PURE (no I/O, no
 * domain-extending logic — only common parsers + base prompt fragments
 * + generic helpers).
 */

import type { SocraticTurnOutput, TurnContext } from '../SocraticTurn';
import { featuresForStep, type DetectedFeature, type FeatureTypeKey } from '../../entities/PassageProfile';
import type { PastoralSeedStepKey } from '../../entities/PastoralSeed';

/**
 * ADR-035 — nudge INFORMATIVO genérico de features del perfil ruteadas a este
 * paso. Gated por `enforceCoverage`; sin él (o sin perfil/feature) devuelve ''.
 * Surface el dato; el pastor escribe el aporte (NO da la respuesta). Para
 * confrontaciones (misreading) hay lógica propia; esto es solo "considerá esto".
 */
export function buildInformationalFeatureNudge(
    ctx: TurnContext,
    stepKey: PastoralSeedStepKey,
    typeKey: FeatureTypeKey,
    heading: string,
    render: (f: DetectedFeature) => string,
    instruction: string,
): string {
    if (!ctx.enforceCoverage) return '';
    const fs = featuresForStep(ctx.passageProfile, stepKey).filter((f) => f.typeKey === typeKey);
    if (fs.length === 0) return '';
    const lines = fs.map(render).filter(Boolean).join('\n');
    if (!lines) return '';
    return `\n${heading}\n${lines}\n${instruction}`;
}

/**
 * Core P1/P2/P3 guards every policy injects into its system prompt. The
 * concrete policy appends step-specific instructions on top of this.
 */
export const BASE_SYSTEM_GUARDS = `Eres el Acompañante Socrático de Sermones de Preach. El pastor está construyendo su sermón paso a paso. Tu rol es ORIENTAR + CONFRONTAR — NUNCA escribir su respuesta.

Reglas inviolables:
- Datos + preguntas socráticas. Nada de redactar la idea, el principio, la observación o la conclusión por él.
- Si detectas error de método (género equivocado, regla de lectura inconsistente con el género, error estructural, salto exegético): nómbralo y devuélvelo como pregunta. NUNCA des la respuesta correcta.
- NO te metes en interpretaciones doctrinales legítimamente abiertas entre tradiciones fieles — eso no es error de método.
- Si no tienes una fuente real para un dato de trasfondo, dilo; NUNCA inventes citas.
- Tono pastoral, español neutral latinoamericano, "tú". Breve.

Contrato de feedback (aplica al "agentReply" de CADA turno, tanto "accepted" como "orient"):
1. AFIRMAR un acierto CONCRETO: cita una frase real del pastor y nombra qué hizo bien (máx. 2 frases). Nada de "excelente" o "buen trabajo" pelado. Si el aporte es flojo o genérico, OMITE la afirmación y en su lugar invita a profundizar (nudge).
2. ENRUTAR dudas: si el pastor plantea una pregunta o incertidumbre (doctrinal, de significado, estructural o de aplicación), reconócela en una cláusula y dirígela al PASO que la trabaja — SIN resolverla. NUNCA respondas la duda doctrinal; respeta la pluralidad confesional. Mapa de enrutado:
   - Significado de palabra / doctrina → Paso 4 (estudio de palabras) + Paso 5 (paralelos canónicos).
   - Estructura / argumento del texto → Paso 3 (análisis estructural).
   - Audiencia / aplicación / relevancia hoy → Paso 6 (función) / Paso 7 (principio atemporal) / Paso 8 (insight).
   Frase modelo (en "tú", dirigida al pastor): «Esa duda sobre X la trabajarás en el Paso N — guárdala por ahora.»
3. NUDGE: cuando aceptas pero el aporte queda corto, sugiere UNA forma concreta de enriquecerlo (sin escribirla por él).

Devuelves SIEMPRE JSON válido (sin Markdown) con este esquema:
{
  "kind": "accepted" | "orient" | "confront",
  "agentReply": "mensaje pastoral breve que verá el usuario",
  // si "accepted":
  "pastorTextToPersist": "texto a persistir (VACÍO si el paso es AI-forbidden de generación — usa el del pastor verbatim)",
  // si "orient":
  "reason": "frase breve interna de por qué no aceptaste",
  "data": ["1-3 datos factuales relevantes"],
  "questions": ["1-3 preguntas socráticas"],
  "caution": "opcional",
  // si "confront":
  "errorLabel": "etiqueta corta (ej. genre-mismatch)",
  "data": ["datos que sostienen la confrontación"],
  "questions": ["preguntas que reformulan el error"]
}`;

/** Permissive JSON extractor — handles ```json fences + leading/trailing prose. */
export function safeParseJson(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const first = cleaned.search(/[{[]/);
    const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (first === -1 || last === -1) {
        throw new Error('Respuesta del agente sin JSON detectable.');
    }
    return JSON.parse(cleaned.substring(first, last + 1));
}

export function toStringArray(value: unknown, max = 3): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((v) => String(v ?? '').trim())
        .filter((s) => s.length > 0)
        .slice(0, max);
}

/**
 * Standard parser shared by most policies. Translates raw LLM JSON into
 * a typed `SocraticTurnOutput`. AI-forbidden generation steps OVERRIDE the
 * `pastorTextToPersist` to the pastor's verbatim message regardless of what
 * the LLM tried to put there.
 */
export function parseStandardLlmReply(
    raw: string,
    pastorMessage: string,
    options: { aiGenerationForbidden: boolean },
): SocraticTurnOutput {
    const parsed = safeParseJson(raw);
    const kind = String(parsed.kind ?? '').trim();
    const agentReply = String(parsed.agentReply ?? '').trim();

    if (kind === 'accepted') {
        // Hard guard: for AI-forbidden steps the persisted text is ALWAYS
        // the pastor's message. We never let the LLM smuggle generated
        // content into the seed.
        const pastorTextToPersist = options.aiGenerationForbidden
            ? pastorMessage.trim()
            : String(parsed.pastorTextToPersist ?? pastorMessage).trim();
        return {
            kind: 'accepted',
            pastorTextToPersist,
            agentReply: agentReply || 'Avanzamos.',
        };
    }
    if (kind === 'confront') {
        return {
            kind: 'confront',
            errorLabel: String(parsed.errorLabel ?? 'method-error').trim(),
            agentReply: agentReply || 'Revisemos tu método.',
            data: toStringArray(parsed.data),
            questions: toStringArray(parsed.questions),
        };
    }
    // Default: treat anything else as orient.
    return {
        kind: 'orient',
        reason: String(parsed.reason ?? 'insufficient').trim(),
        agentReply: agentReply || 'Profundicemos un poco.',
        data: toStringArray(parsed.data),
        questions: toStringArray(parsed.questions),
        caution: parsed.caution ? String(parsed.caution).trim() : undefined,
    };
}

/** Pastor draft summary block for system prompts (compact). */
export function priorStepsBlock(ctx: TurnContext): string {
    const prior = ctx.priorSteps ?? {};
    const lines: string[] = [];
    for (const [step, text] of Object.entries(prior)) {
        if (!text) continue;
        const trimmed = text.length > 200 ? `${text.slice(0, 200)}…` : text;
        lines.push(`- ${step}: ${trimmed}`);
    }
    if (lines.length === 0) return '(aún no hay trabajo previo del pastor)';
    return lines.join('\n');
}
