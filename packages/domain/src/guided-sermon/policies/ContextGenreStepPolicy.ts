/**
 * Phase 2.5 PR B (ADR-028) — Step 2 (Contexto y Género) policy.
 *
 * Genre is determined by the assistant (BookPanorama / inferGenreFromBook
 * deterministic map) BEFORE this step; this policy validates the pastor's
 * INTERPRETIVE IMPLICATION of the genre. The agent CONFRONTS when the
 * pastor's writing reveals he is reading the passage as a different
 * genre (the UC3 scenario from the Phase 1.6 smoke).
 */

import { detectGenreInText } from '../../bible/inferGenreFromBook';
import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateContextGenre,
    type PastoralSeed,
} from '../../entities/PastoralSeed';
import type { LiteraryGenre } from '../../exegesis/expository/BookPanorama';
import type {
    MethodErrorReport,
    SocraticTurnOutput,
    StepValidationResult,
    TurnContext,
} from '../SocraticTurn';
import { BASE_SYSTEM_GUARDS, buildInformationalFeatureNudge, parseStandardLlmReply, priorStepsBlock } from './_shared';
import { detectMethodErrorForStep } from '../methodErrorCatalog';
import type { IStepPolicy } from './IStepPolicy';

const MIN = PASTORAL_SEED_THRESHOLDS.contextGenre.genreImplicationMinChars;

export class ContextGenreStepPolicy implements IStepPolicy {
    readonly stepKey = 'contextGenre' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('contextGenre');

    buildSystemPrompt(ctx: TurnContext): string {
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Contexto y Género (paso 2 de 8).
Pasaje: ${ctx.passage}
${ctx.genre ? `Género identificado por el sistema: ${ctx.genre}` : 'Género: aún por confirmar con el pastor.'}

Lo que pides al pastor: que escriba LA IMPLICANCIA INTERPRETATIVA del género para su lectura del pasaje (mínimo ${MIN} caracteres). Ej. "es Evangelio → narración teológica, leo buscando lo que afirma de Jesús" (no para copiar — solo para que entiendas el espíritu).

Confrontación de método ALTA prioridad en este paso:
- Si el pastor escribe algo que asume un GÉNERO DISTINTO al identificado (ej. trata un Evangelio como profecía apocalíptica con "todo se cumplirá") → CONFRONTA con "kind: confront", errorLabel "genre-mismatch", nómbrale el género real + pregúntale cómo cambia su regla de lectura.
- Si el género no fue confirmado todavía y el pastor escribe la implicancia → acepta si tiene sentido para el género real.
- Si lo que escribió es muy corto (< ${MIN}) → "orient" pidiendo que profundice.
- Si es satisfactorio → "accepted" con pastorTextToPersist = su mensaje verbatim (sin tu redacción).

Trabajo previo del pastor:
${priorStepsBlock(ctx)}

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): que conectó el género con una regla de lectura coherente — cita cómo cambia su forma de leer el pasaje. Nada genérico.
${buildInformationalFeatureNudge(
            ctx,
            'contextGenre',
            'named-entity',
            'DATO DEL PERFIL — personas/lugares que piden trasfondo:',
            (f) => (f.typeKey === 'named-entity' ? `- ${f.name} (${f.verseRef})${f.note ? `: ${f.note}` : ''}` : ''),
            'Si el pastor no los ubica, recuérdale consultar su trasfondo histórico-cultural; él escribe qué aportan.',
        )}
Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: false });
    }

    validatePastorInput(pastorMessage: string, ctx: TurnContext): StepValidationResult {
        // Fix C: the deterministic book genre is authoritative when present;
        // when it is missing (unrecognized book / legacy seed) the pastor's own
        // prose IS the source — recognize the genre he names.
        const genre = resolveEffectiveGenre(ctx.genre, pastorMessage);
        if (!genre) {
            // Safety net (fix A): no genre anywhere — book inference failed AND
            // the prose names none. The guided flow has no genre-confirm UI, so
            // don't dead-end the step; gate on the implication length alone.
            const len = pastorMessage.trim().length;
            return len >= MIN
                ? { valid: true, reasons: [] }
                : { valid: false, reasons: [`Implicancia del género requiere ≥${MIN} caracteres (actual: ${len}).`] };
        }
        return validateContextGenre({
            genre,
            // Present genre (book-inferred or prose-named) counts as confirmed:
            // the guided flow has no genre-confirm UI to satisfy.
            genreConfirmed: true,
            genreImplication: pastorMessage,
            bookLocationNote: '',
            historicalContextConsulted: false,
            timeSpentSeconds: 0,
        });
    }

    detectMethodError(pastorMessage: string, ctx: TurnContext): MethodErrorReport | null {
        // Delega al catálogo compartido: la misma vara la usa el wizard. Vivía
        // aquí y el wizard tenía la suya; dos copias de una regla derivan.
        return detectMethodErrorForStep(this.stepKey, pastorMessage, { genre: ctx.genre });
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        const existingGenre = seed.contextGenre?.genre ?? '';
        // Fix C: si el libro no infirió género, el que el pastor nombra en su
        // prosa se persiste para que los pasos siguientes tengan uno. Esto es
        // RESOLUCIÓN de género, no procedencia — ver el bloque de abajo.
        const namedGenre = existingGenre ? '' : (detectGenreInText(pastorMessage) ?? '');
        const resolvedGenre = existingGenre || namedGenre || '';
        // Redacción v2 0b-B (§4.4): la procedencia SOLO la escribe el ACTO del
        // pastor (el selector de género, vía `pronounceGenre`). Este turno NO la
        // deriva de la prosa: `detectGenreInText` es un match de keywords y casi
        // nunca aparece el nombre del género en la implicancia → emitía
        // `aiProposed` aunque el pastor se hubiera pronunciado, y un keyword
        // suelto podía emitir un `userConfirmed` FALSO que contaminaba la sombra.
        // Aquí se preserva lo que el acto haya escrito; si no hubo acto, queda
        // como estaba (`aiProposed`, honesto: nadie se pronunció).
        const genreProvenance = seed.contextGenre?.genreProvenance ?? 'aiProposed';
        return {
            contextGenre: {
                ...seed.contextGenre,
                genre: resolvedGenre,
                genreConfirmed: Boolean(resolvedGenre),
                genreProvenance,
                // La razón del override es la prosa del turno, pero solo cuando el
                // ACTO ya registró que hubo override.
                genreOverrideReason:
                    genreProvenance === 'userOverride'
                        ? pastorMessage.trim()
                        : seed.contextGenre?.genreOverrideReason,
                genreOverrideTarget: seed.contextGenre?.genreOverrideTarget,
                genreImplication: pastorMessage.trim(),
                completedAt: new Date(),
            },
        };
    }
}

/**
 * The genre to validate against: the deterministic book genre when the seed has
 * one, otherwise the genre the pastor names in his prose (fix C). Returns ''
 * when neither is available.
 */
function resolveEffectiveGenre(ctxGenre: string | undefined, pastorMessage: string): LiteraryGenre | '' {
    if (ctxGenre) return ctxGenre as LiteraryGenre;
    return detectGenreInText(pastorMessage) ?? '';
}
