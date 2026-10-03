/**
 * Phase 2.5 PR B (ADR-028) — Step 7 (Principio Atemporal) policy.
 *
 * AI-forbidden GENERATION step: the agent verifies but NEVER writes the
 * principle. The principle is the Kaiser/Robinson principlizing bridge —
 * pastor's voice. Agent validates length + may flag eisegesis risk (same
 * spirit as `verifyTimelessPrinciple` callable from ADR-023, kept inline
 * here for the agent's pipeline).
 */

import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateTimelessPrinciple,
    type PastoralSeed,
} from '../../entities/PastoralSeed';
import type {
    MethodErrorReport,
    SocraticTurnOutput,
    StepValidationResult,
    TurnContext,
} from '../SocraticTurn';
import { BASE_SYSTEM_GUARDS, parseStandardLlmReply, priorStepsBlock } from './_shared';
import type { IStepPolicy } from './IStepPolicy';

const MIN = PASTORAL_SEED_THRESHOLDS.timelessPrinciple.principleMinChars;

export class TimelessPrincipleStepPolicy implements IStepPolicy {
    readonly stepKey = 'timelessPrinciple' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('timelessPrinciple');

    buildSystemPrompt(ctx: TurnContext): string {
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Principio Atemporal (paso 7 de 8). PASO AI-FORBIDDEN DE GENERACIÓN.
Pasaje: ${ctx.passage}

Lo que pides al pastor: que escriba EL PRINCIPIO TEOLÓGICO ATEMPORAL que conecta la función original con la enseñanza para hoy (el "principlizing bridge" de Kaiser). Mínimo ${MIN} caracteres.

Reglas duras INVIOLABLES en este paso:
- NUNCA propongas el principio. NUNCA redactes opciones. NUNCA des ejemplos del principio "correcto" para este pasaje.
- Si el principio es < ${MIN} chars → "orient" pidiendo más profundidad (puedes preguntar "¿qué afirma del carácter de Dios?", "¿qué exige de toda la humanidad?", sin proponer la respuesta).
- Si parece eisegético (lee significado HACIA el texto en vez de extraerlo del trabajo previo del pastor) → "orient" con preguntas que lo regresen a sus pasos 1-6.
- Si parece copy-paste de fuente externa → "orient" pidiendo que lo reformule con sus palabras.
- Si es suficiente y se funda en su estudio → "accepted" con pastorTextToPersist DEBE ir vacío en tu salida; el sistema usa su mensaje verbatim.

Trabajo previo del pastor (sobre lo que el principio debe fundarse):
${priorStepsBlock(ctx)}

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): un puente que se funda en su estudio previo (no eisegético) — señala de qué paso lo sostiene, sin redactarlo por él. Nada genérico.

Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: true });
    }

    validatePastorInput(pastorMessage: string): StepValidationResult {
        return validateTimelessPrinciple({
            principle: pastorMessage,
            timeSpentSeconds: 0,
        });
    }

    detectMethodError(): MethodErrorReport | null {
        return null;
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        return {
            timelessPrinciple: {
                ...seed.timelessPrinciple,
                principle: pastorMessage.trim(),
                completedAt: new Date(),
            },
        };
    }
}
