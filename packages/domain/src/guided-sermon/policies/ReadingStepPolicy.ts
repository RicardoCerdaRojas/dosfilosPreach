/**
 * Phase 2.5 PR B (ADR-028) — Step 1 (Lectura) policy.
 *
 * AI-forbidden generation step: the agent asks the pastor for his FIRST
 * IMPRESSION of the passage and validates length only. NEVER proposes
 * what the impression should be. The persisted text is the pastor's
 * verbatim message.
 */

import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateReading,
    type PastoralSeed,
} from '../../entities/PastoralSeed';
import type {
    MethodErrorReport,
    SocraticTurnOutput,
    StepValidationResult,
    TurnContext,
} from '../SocraticTurn';
import { BASE_SYSTEM_GUARDS, parseStandardLlmReply } from './_shared';
import type { IStepPolicy } from './IStepPolicy';

const MIN = PASTORAL_SEED_THRESHOLDS.reading.firstImpressionMinChars;

export class ReadingStepPolicy implements IStepPolicy {
    readonly stepKey = 'reading' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('reading');

    buildSystemPrompt(ctx: TurnContext): string {
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Lectura (paso 1 de 8).
Pasaje: ${ctx.passage}

Lo que pides al pastor: que LEA EL PASAJE COMPLETO y escriba su PRIMERA IMPRESIÓN con sus propias palabras (mínimo ${MIN} caracteres).

Reglas duras de este paso:
- Este es un paso AI-forbidden de generación. NUNCA propongas qué debería escribir. NUNCA redactes una impresión por él.
- Si el pastor escribe < ${MIN} chars → "orient" pidiéndole que profundice (sin decirle qué decir).
- Si su impresión tiene ≥ ${MIN} chars y refleja contacto real con el texto → "accepted". El campo "pastorTextToPersist" DEBE ir vacío en tu salida; el sistema usa su mensaje verbatim.
- Si parece copy-paste obvio (estructura demasiado formal, lista numerada larga, lenguaje claramente no-suyo) → "orient" pidiéndole que lo reformule con sus palabras.
- Confrontación de método: poco probable en este paso (lectura es subjetiva). Reservalo para los siguientes.

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): que hizo contacto real con el texto y nombró una impresión propia — cita una frase suya. Nada genérico.

Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: true });
    }

    validatePastorInput(pastorMessage: string): StepValidationResult {
        return validateReading({ firstImpression: pastorMessage, timeSpentSeconds: 0 });
    }

    detectMethodError(): MethodErrorReport | null {
        // Reading is subjective; no static heuristic detects "wrong" first
        // impressions. The LLM may still confront via the prompt.
        return null;
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        return {
            reading: {
                ...seed.reading,
                firstImpression: pastorMessage.trim(),
                completedAt: new Date(),
            },
        };
    }
}
