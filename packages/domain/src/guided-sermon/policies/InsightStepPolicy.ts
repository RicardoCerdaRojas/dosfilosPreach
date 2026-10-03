/**
 * Phase 2.5 PR B (ADR-028) — Step 8 (Insight) policy.
 *
 * AI-forbidden GENERATION step — the most protected. The pastor's homiletic
 * idea, observations, open question, anecdote, doxological application all
 * come ONLY from him. The agent SOLELY validates structure + length.
 *
 * In conversational form, the pastor types the WHOLE Insight in one message
 * structured like:
 *
 *   Idea central: ...
 *   Observaciones: 1) ... 2) ... 3) ...
 *   Pregunta abierta: ...
 *   Anécdota: ...
 *   Aplicación doxológica: ...
 *
 * The policy parses the labelled blocks; each sub-field has its own min.
 */

import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateInsight,
    type PastoralSeed,
    type InsightStepData,
} from '../../entities/PastoralSeed';
import type {
    MethodErrorReport,
    SocraticTurnOutput,
    StepValidationResult,
    TurnContext,
} from '../SocraticTurn';
import { BASE_SYSTEM_GUARDS, parseStandardLlmReply, priorStepsBlock } from './_shared';
import type { IStepPolicy } from './IStepPolicy';

const T = PASTORAL_SEED_THRESHOLDS.insight;

/**
 * Loose parser for labelled blocks. Each block starts with a marker
 * (case-insensitive). Anything between markers belongs to the previous one.
 */
const BLOCK_MARKERS: Array<{ key: keyof InsightStepData; regex: RegExp }> = [
    { key: 'centralIdea', regex: /(?:idea\s+central|idea\s+homil[eé]tica)\s*[:\-]/i },
    { key: 'observations', regex: /observaciones?\s*[:\-]/i },
    { key: 'openQuestion', regex: /(?:pregunta\s+abierta|pregunta)\s*[:\-]/i },
    { key: 'pastoralAnecdote', regex: /(?:an[eé]cdota|ilustraci[oó]n)\s*[:\-]/i },
    { key: 'doxologicalApplication', regex: /(?:aplicaci[oó]n\s+doxol[oó]gica|doxolog[ií]a|aplicaci[oó]n)\s*[:\-]/i },
];

interface ParsedInsight {
    centralIdea: string;
    observations: string[];
    openQuestion: string;
    pastoralAnecdote: string;
    doxologicalApplication: string;
}

export function parseInsightFromMessage(message: string): ParsedInsight {
    // Find marker positions.
    const hits: Array<{ key: keyof InsightStepData; start: number; end: number }> = [];
    for (const m of BLOCK_MARKERS) {
        const r = m.regex.exec(message);
        if (r) hits.push({ key: m.key, start: r.index, end: r.index + r[0].length });
    }
    hits.sort((a, b) => a.start - b.start);

    const blocks: Partial<Record<keyof InsightStepData, string>> = {};
    for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        const next = hits[i + 1];
        const content = message.slice(h.end, next ? next.start : undefined).trim();
        blocks[h.key] = content;
    }

    const observations = (blocks.observations ?? '')
        .split(/\n+|(?:^|\s)\d+[.)]\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 5);

    return {
        centralIdea: blocks.centralIdea ?? '',
        observations,
        openQuestion: blocks.openQuestion ?? '',
        pastoralAnecdote: blocks.pastoralAnecdote ?? '',
        doxologicalApplication: blocks.doxologicalApplication ?? '',
    };
}

export class InsightStepPolicy implements IStepPolicy {
    readonly stepKey = 'insight' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('insight');

    buildSystemPrompt(ctx: TurnContext): string {
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Insight (paso 8 de 8). PASO AI-FORBIDDEN DE GENERACIÓN — el más protegido.
Pasaje: ${ctx.passage}

Lo que pides al pastor: que escriba EN UN SOLO MENSAJE su Insight homilético completo, etiquetado así:

  Idea central: <una frase, ≥${T.centralIdeaMinChars} chars>
  Observaciones:
    1) <≥${T.observationMinChars} chars>
    2) <≥${T.observationMinChars} chars>
    3) <≥${T.observationMinChars} chars>
  Pregunta abierta: <≥${T.openQuestionMinChars} chars>
  Anécdota: <≥${T.pastoralAnecdoteMinChars} chars>
  Aplicación doxológica: <≥${T.doxologicalApplicationMinChars} chars>

Reglas duras INVIOLABLES:
- NUNCA escribas la idea central, las observaciones, la pregunta, la anécdota ni la aplicación. NUNCA des ejemplos del contenido "correcto" para este pasaje.
- Si falta alguno de los 5 bloques o alguno está corto → "orient" pidiendo el bloque faltante (sin proponer contenido). Puedes repetir el formato como recordatorio.
- Si detectas paste muy largo + estructurado → "orient" pidiendo reformulación en sus palabras (audit del paste se loggea aparte).
- Si los 5 bloques están y satisfacen los mínimos → "accepted" con pastorTextToPersist VACÍO en tu salida; el sistema parsea su mensaje en los campos.

Trabajo previo del pastor (sobre lo que el insight debe sintetizar):
${priorStepsBlock(ctx)}

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): la coherencia entre su idea central y el trabajo de los pasos 1-7 — reconoce un bloque que sintetiza bien su estudio. Nada genérico.

Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: true });
    }

    validatePastorInput(pastorMessage: string): StepValidationResult {
        const parsed = parseInsightFromMessage(pastorMessage);
        return validateInsight({
            centralIdea: parsed.centralIdea,
            observations: parsed.observations,
            openQuestion: parsed.openQuestion,
            pastoralAnecdote: parsed.pastoralAnecdote,
            doxologicalApplication: parsed.doxologicalApplication,
            pasteEvents: [],
            timeSpentSeconds: 0,
        });
    }

    detectMethodError(): MethodErrorReport | null {
        return null;
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        const parsed = parseInsightFromMessage(pastorMessage);
        return {
            insight: {
                ...seed.insight,
                centralIdea: parsed.centralIdea,
                observations: parsed.observations,
                openQuestion: parsed.openQuestion,
                pastoralAnecdote: parsed.pastoralAnecdote,
                doxologicalApplication: parsed.doxologicalApplication,
                completedAt: new Date(),
            },
        };
    }
}
