/**
 * Phase 2.5 PR B (ADR-028) — Step 3 (Análisis Estructural) policy.
 *
 * Pastor identifies the main clause + writes a note about what it affirms /
 * what carries the argument. Agent validates length; confronts when the
 * pastor's note leans on lexical/morphological detail instead of structure
 * (that belongs to step 4 Palabras clave).
 */

import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateStructuralAnalysis,
    type PastoralSeed,
} from '../../entities/PastoralSeed';
import { structuralGuidanceFor } from '../structuralSufficiency';
import type {
    MethodErrorReport,
    SocraticTurnOutput,
    StepValidationResult,
    TurnContext,
} from '../SocraticTurn';
import { BASE_SYSTEM_GUARDS, buildInformationalFeatureNudge, parseStandardLlmReply, priorStepsBlock } from './_shared';
import { detectMethodErrorForStep } from '../methodErrorCatalog';
import type { IStepPolicy } from './IStepPolicy';

const MIN = PASTORAL_SEED_THRESHOLDS.structuralAnalysis.pastorNoteMinChars;

/**
 * Pastor messages for the structural step expect a clause reference (e.g.
 * "Juan 1:1c") + a note. We accept either combined ("Juan 1:1c — la
 * cláusula climática…") or just the note text; the use case parses the
 * reference loosely.
 */
const REF_PATTERN = /\b\d?\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s*\d+[:.]\d+[a-c]?(?:-\d+[a-c]?)?\b/i;

export class StructuralAnalysisStepPolicy implements IStepPolicy {
    readonly stepKey = 'structuralAnalysis' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('structuralAnalysis');

    buildSystemPrompt(ctx: TurnContext): string {
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Análisis Estructural (paso 3 de 8).
Pasaje: ${ctx.passage}

Lo que pides al pastor: que IDENTIFIQUE LA CLÁUSULA PRINCIPAL del pasaje (con su referencia, ej. "Juan 1:1c") + escriba qué AFIRMA esa cláusula y CÓMO LAS DEMÁS LA SOSTIENEN. Mínimo ${MIN} caracteres en la nota.

Reglas duras de este paso:
- ESTRUCTURA, no léxico. Si el pastor se mete en "predicado nominal sin artículo griego" / "verbo θεός" → CONFRONTA con "kind: confront", errorLabel "lexical-leakage", explícale que el léxico va en el paso 4 (Palabras clave) y reformulalo: "¿qué AFIRMA esta cláusula sobre el argumento del pasaje?".
- Si dice algo razonable sobre estructura pero corto (< ${MIN}) → "orient" pidiendo más detalle estructural (qué cláusula es climática, cuál prepara, cuál desarrolla).
- Si su nota es estructural y suficiente → "accepted" con pastorTextToPersist verbatim.
- Si no incluye referencia de la cláusula principal → "orient" pidiéndola.

Trabajo previo del pastor:
${priorStepsBlock(ctx)}

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): que identificó la cláusula principal correcta y mostró cómo las demás la sostienen — nombra la cláusula. Nada genérico.
${this.buildGenreStructuralHelp(ctx)}${this.buildMovementsNudge(ctx)}${buildInformationalFeatureNudge(
            ctx,
            'structuralAnalysis',
            'parallelism',
            'DATO DEL PERFIL — paralelismos poéticos del texto:',
            (f) => (f.typeKey === 'parallelism' ? `- "${f.summary}" (${f.verseRef})` : ''),
            'Si es poesía/sabiduría, ayuda al pastor a leer la estructura por el paralelismo; él escribe el análisis.',
        )}
Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    /**
     * ADR-035 R2 — nudge de los movimientos que el perfil detectó. SOLO con
     * enforce on. Para pasajes grandes (varios movimientos), ayuda a que el
     * pastor no aplane la estructura a una sola cláusula. Surface el dato; él
     * escribe la estructura. Sin enforce/perfil/un-solo-movimiento → '' (clásico).
     */
    private buildMovementsNudge(ctx: TurnContext): string {
        if (!ctx.enforceCoverage) return '';
        const movements = ctx.passageProfile?.movements ?? [];
        if (movements.length <= 1) return '';
        const lines = movements.map((m) => `- ${m.reference}: ${m.summary}`).join('\n');
        return `
DATO DEL PERFIL — este pasaje tiene ${movements.length} movimientos (insumo estructural):
${lines}
Ayuda al pastor a ver cómo la cláusula principal se relaciona con estos bloques y a no aplanar el argumento a una sola cláusula. Él escribe la estructura; no se la des hecha.`;
    }

    /**
     * Redacción v2 (§4.5) B3 — ayuda estructural sensible al GÉNERO confirmado
     * (paso 2): la guía de discernimiento propia del género (epístola=conectores,
     * narrativa=arco, poesía=paralelismo…). Andamiaje FORMATIVO, no juicio. Sale
     * FLAG-INERT: solo con `enableGenreStructuralHelp` on (el texto pastoral-facing
     * `guidance` espera revisión del fundador). Sin flag / sin género confirmado /
     * sin guía → '' (prompt clásico intacto). El pastor escribe el análisis; esto
     * ilumina cómo leer la estructura de SU género, no se lo da hecho.
     */
    private buildGenreStructuralHelp(ctx: TurnContext): string {
        if (!ctx.enableGenreStructuralHelp) return '';
        const guidance = structuralGuidanceFor(ctx.genre);
        if (!guidance) return '';
        return `
AYUDA SENSIBLE AL GÉNERO (el pastor confirmó "${ctx.genre}" en el paso 2) — cómo leer la estructura de este género:
${guidance}
Usa esto para ORIENTAR su lectura estructural (qué mirar en este género); él escribe el análisis, no se lo des hecho.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: false });
    }

    validatePastorInput(pastorMessage: string): StepValidationResult {
        const refMatch = pastorMessage.match(REF_PATTERN);
        return validateStructuralAnalysis({
            mainClause: {
                reference: refMatch ? refMatch[0] : '',
                pastorNote: pastorMessage,
            },
            timeSpentSeconds: 0,
        });
    }

    detectMethodError(pastorMessage: string): MethodErrorReport | null {
        return detectMethodErrorForStep(this.stepKey, pastorMessage);
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        const refMatch = pastorMessage.match(REF_PATTERN);
        return {
            structuralAnalysis: {
                ...seed.structuralAnalysis,
                mainClause: {
                    reference: refMatch ? refMatch[0] : seed.structuralAnalysis?.mainClause?.reference ?? '',
                    pastorNote: pastorMessage.trim(),
                },
                completedAt: new Date(),
            },
        };
    }
}
