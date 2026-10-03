/**
 * Phase 2.5 PR B (ADR-028) — Step 6 (Función) policy.
 *
 * Pastor articulates what the text DID to its ORIGINAL audience (≥100 chars).
 * The agent confronts "modern application leap": jumping to "lo que me dice a
 * mí hoy" without first establishing the original function.
 */

import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateFunction,
    type PastoralSeed,
} from '../../entities/PastoralSeed';
import { featuresForStep } from '../../entities/PassageProfile';
import type {
    MethodErrorReport,
    SocraticTurnOutput,
    StepValidationResult,
    TurnContext,
} from '../SocraticTurn';
import { BASE_SYSTEM_GUARDS, parseStandardLlmReply, priorStepsBlock } from './_shared';
import { detectMethodErrorForStep } from '../methodErrorCatalog';
import type { IStepPolicy } from './IStepPolicy';

const MIN = PASTORAL_SEED_THRESHOLDS.function.originalAudienceFunctionMinChars;

export class FunctionStepPolicy implements IStepPolicy {
    readonly stepKey = 'function' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('function');

    buildSystemPrompt(ctx: TurnContext): string {
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Función para la audiencia original (paso 6 de 8).
Pasaje: ${ctx.passage}

Lo que pides al pastor: que escriba qué HACÍA EL TEXTO PARA SU AUDIENCIA ORIGINAL — qué afirmaba, qué exigía, qué descartaba, qué consolaba. Mínimo ${MIN} caracteres.

Reglas duras de este paso:
- Confrontación de método: SALTO A APLICACIÓN MODERNA. Si el pastor escribe "para nosotros hoy / aplicado a la iglesia actual" sin primero anclar la función original → CONFRONTA con errorLabel "modern-application-leap", pidiéndole que primero responda qué le hacía AL LECTOR ORIGINAL.
- Si su respuesta es < ${MIN} chars o muy vaga → "orient" pidiendo más concreción (qué exigía a CÓMO leían, qué confrontaba en su contexto).
- Si responde bien sobre función original → "accepted" con pastorTextToPersist verbatim.

Trabajo previo del pastor:
${priorStepsBlock(ctx)}

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): que ancló la función en la audiencia ORIGINAL antes de cualquier salto a hoy — cita qué les hacía el texto. Nada genérico.
${this.buildMisreadingNudge(ctx)}${this.buildIllustrationNudge(ctx)}
Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    /**
     * ADR-035 D — nudge informativo de lecturas erróneas frecuentes del perfil
     * ruteadas a este paso. SOLO con enforce on (gated por `ctx.enforceCoverage`);
     * sin él devuelve '' (clásico). Socrático: surface la mala lectura + el ancla,
     * NO da la respuesta. El confront real (con tope + override) lo decide el
     * dispatch (commit 3) vía `decideMisreadingTurn`.
     */
    private buildMisreadingNudge(ctx: TurnContext): string {
        if (!ctx.enforceCoverage) return '';
        const misreadings = featuresForStep(ctx.passageProfile, this.stepKey).filter(
            (f) => f.typeKey === 'common-misreading',
        );
        if (misreadings.length === 0) return '';
        const lines = misreadings
            .map((f) =>
                f.typeKey === 'common-misreading'
                    ? `- "${f.claim}" (${f.verseRef}). Anclas que la refutan: ${f.correctiveAnchor
                          .map((a) => a.reference)
                          .filter(Boolean)
                          .join(', ')}.`
                    : '',
            )
            .filter(Boolean)
            .join('\n');
        return `
DATO DEL PERFIL — lecturas erróneas frecuentes de este pasaje:
${lines}
Si la respuesta del pastor CAE en una de estas lecturas, CONFRONTA con errorLabel "common-misreading": nombra el ancla y pregúntale si su lectura la sostiene o la contradice — SIN darle la respuesta. Si no toca el tema o lo trata bien, no confrontes por esto.`;
    }

    /**
     * ADR-035 R4 — nudge informativo de las ilustraciones/metáforas del texto que
     * el perfil detectó. SOLO con enforce on. Surface la imagen como dato para que
     * el pastor la trate al explicar la función; él escribe qué aporta. NO da la
     * respuesta. Sin enforce/perfil → '' (clásico).
     */
    private buildIllustrationNudge(ctx: TurnContext): string {
        if (!ctx.enforceCoverage) return '';
        const illustrations = featuresForStep(ctx.passageProfile, this.stepKey).filter(
            (f) => f.typeKey === 'illustration',
        );
        if (illustrations.length === 0) return '';
        const lines = illustrations
            .map((f) => (f.typeKey === 'illustration' ? `- "${f.summary}" (${f.verseRef})` : ''))
            .filter(Boolean)
            .join('\n');
        return `
DATO DEL PERFIL — ilustraciones/metáforas directas de este pasaje:
${lines}
Si el pastor explica la función sin tratarlas, muéstraselas como dato y pregúntale qué aporta cada imagen al mensaje. Él escribe el aporte; no se lo des hecho.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: false });
    }

    validatePastorInput(pastorMessage: string): StepValidationResult {
        return validateFunction({
            originalAudienceFunction: pastorMessage,
            timeSpentSeconds: 0,
        });
    }

    detectMethodError(pastorMessage: string): MethodErrorReport | null {
        return detectMethodErrorForStep(this.stepKey, pastorMessage);
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        return {
            function: {
                ...seed.function,
                originalAudienceFunction: pastorMessage.trim(),
                completedAt: new Date(),
            },
        };
    }
}
