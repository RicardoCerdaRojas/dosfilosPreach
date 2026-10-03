/**
 * Phase 2.5 PR B (ADR-028) — Step 5 (Reconocimiento canónico) policy.
 *
 * Pastor produces 1-8 canonical parallels, each with a relevance note
 * (≥30 chars). Format in chat:
 *
 *   - Gálatas 5:1: el "stand firm" libertador eco la victoria del Verbo
 *     sobre las tinieblas en Juan 1.
 *
 * Agent confronts "proof-texting": parallels with weak relevance notes or
 * superficial verbal echoes without theological convergence.
 */

import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateRecognition,
    type ParallelRef,
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
import type { IStepPolicy } from './IStepPolicy';

const T = PASTORAL_SEED_THRESHOLDS.recognition;

const REF_PATTERN = /\b\d?\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s*\d+[:.]\d+(?:-\d+)?\b/i;

export function parseParallelsFromMessage(message: string): ParallelRef[] {
    const lines = message.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 0);
    const out: ParallelRef[] = [];
    for (const line of lines) {
        const refMatch = line.match(REF_PATTERN);
        if (!refMatch) continue;
        const reference = refMatch[0];
        const restStart = line.indexOf(reference) + reference.length;
        const relevanceNote = line.slice(restStart).replace(/^[:\-—.\s]+/, '').trim();
        if (!relevanceNote) continue;
        out.push({ reference, relevanceNote, source: 'pastor-suggested' });
    }
    return out;
}

export class RecognitionStepPolicy implements IStepPolicy {
    readonly stepKey = 'recognition' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('recognition');

    buildSystemPrompt(ctx: TurnContext): string {
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Reconocimiento canónico (paso 5 de 8).
Pasaje: ${ctx.passage}

Lo que pides al pastor: que identifique ${T.minParallels}-${T.maxParallels} PARALELOS canónicos al pasaje + escriba POR QUÉ cada uno importa (mínimo ${T.relevanceNoteMinChars} chars por nota).

Reglas duras de este paso:
- Confrontación de método: PROOF-TEXTING. Si el pastor cita un paralelo solo por eco verbal sin conexión teológica genuina → CONFRONTA con errorLabel "proof-texting", pidiéndole que demuestre la convergencia teológica.
- Si entrega menos paralelos que el mínimo, o notas < ${T.relevanceNoteMinChars} chars → "orient" pidiendo más.
- Privilegia paralelos con peso teológico claro (no "famosos pero ambiguos") — esto sí puedes sugerirlo como dato en orient.
- Si los paralelos son sustanciales y las notas explican la convergencia → "accepted" con pastorTextToPersist verbatim.
- NUNCA escribas el paralelo o la nota por él.

Trabajo previo del pastor:
${priorStepsBlock(ctx)}

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): un paralelo con convergencia teológica genuina (no eco verbal) — cita la conexión que trazó. Nada genérico.
${this.buildAllusionNudge(ctx)}
Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    /**
     * ADR-035 R2 — nudge informativo de alusiones AT que el perfil detectó para
     * este paso. SOLO con enforce on (`ctx.enforceCoverage`). Surface el dato (la
     * fuente AT) para que el pastor no la pase por alto; él escribe POR QUÉ
     * importa. NO le da la nota hecha. Sin enforce/perfil → '' (clásico).
     */
    private buildAllusionNudge(ctx: TurnContext): string {
        if (!ctx.enforceCoverage) return '';
        const allusions = featuresForStep(ctx.passageProfile, this.stepKey).filter(
            (f) => f.typeKey === 'ot-allusion',
        );
        if (allusions.length === 0) return '';
        const lines = allusions
            .map((f) => (f.typeKey === 'ot-allusion' ? `- ${f.anchor.reference} (${f.verseRef}): ${f.summary}` : ''))
            .filter(Boolean)
            .join('\n');
        return `
DATO DEL PERFIL — alusiones/citas del AT que este pasaje invoca (insumo, NO la nota del pastor):
${lines}
Si el pastor las pasa por alto, muéstraselas como dato y pregúntale qué aportan; él escribe la convergencia teológica. NUNCA escribas el paralelo o la nota por él.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: false });
    }

    validatePastorInput(pastorMessage: string): StepValidationResult {
        const parallels = parseParallelsFromMessage(pastorMessage);
        return validateRecognition({ parallels, timeSpentSeconds: 0 });
    }

    detectMethodError(): MethodErrorReport | null {
        return null;
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        const parallels = parseParallelsFromMessage(pastorMessage);
        return {
            recognition: {
                ...seed.recognition,
                parallels,
                completedAt: new Date(),
            },
        };
    }
}
