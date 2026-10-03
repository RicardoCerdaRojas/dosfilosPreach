/**
 * Phase 2.5 PR B (ADR-028) — Step 4 (Estudio de Palabras) policy.
 *
 * Pastor produces ≥2 word studies, each with: original-language form,
 * reference, and his own discovery (≥30 chars). In conversational form,
 * the pastor types something like:
 *
 *   1. λόγος (Juan 1:1): el Verbo es agente personal, no idea abstracta.
 *      Resuena con Génesis 1.
 *   2. ἀρχή (Juan 1:1): inicio absoluto, ecos creacionales.
 *
 * The policy parses the structure loosely (numbered list or "word (ref):
 * discovery" pattern). Validator requires ≥2 entries with ≥30-char
 * discoveries.
 */

import {
    isPastorVoiceStep,
    PASTORAL_SEED_THRESHOLDS,
    validateWordStudies,
    type PastoralSeed,
    type WordStudy,
} from '../../entities/PastoralSeed';
import type {
    MethodErrorReport,
    SocraticTurnOutput,
    StepValidationResult,
    TurnContext,
} from '../SocraticTurn';
import { BASE_SYSTEM_GUARDS, buildInformationalFeatureNudge, parseStandardLlmReply, priorStepsBlock } from './_shared';
import type { IStepPolicy } from './IStepPolicy';

const T = PASTORAL_SEED_THRESHOLDS.wordStudies;

/**
 * Parse pastor message into WordStudy entries. Loose grammar:
 *   - One per line.
 *   - Format: "<word> (<ref>): <discovery>" OR "<n>. <word> (<ref>) <discovery>".
 *   - Falls back: the whole message as a single entry without ref.
 */
/**
 * Merges newly-submitted studies into the ones already saved on the seed,
 * de-duplicated by original word (case-insensitive). Incoming wins, so the
 * pastor can refine a word he already studied. This is what lets Step 4
 * ACCUMULATE one word per turn instead of demanding all ≥2 in a single
 * message.
 */
export function mergeWordStudies(existing: WordStudy[], incoming: WordStudy[]): WordStudy[] {
    const byKey = new Map<string, WordStudy>();
    for (const s of existing) {
        if (s.word?.trim()) byKey.set(s.word.trim().toLowerCase(), s);
    }
    for (const s of incoming) {
        if (s.word?.trim()) byKey.set(s.word.trim().toLowerCase(), s);
    }
    return Array.from(byKey.values());
}

/**
 * A study counts toward the step only when it is STRUCTURALLY complete: an
 * original word, a reference, and a discovery ≥ the threshold. This is the
 * guard that keeps stray lines (a bare "2:1", refinement prose, a question)
 * from polluting the accumulated set — the loose parser will happily turn any
 * line into a half-study, but only complete ones persist/count.
 */
export function isCompleteWordStudy(s: WordStudy): boolean {
    return Boolean(s.word?.trim())
        && Boolean(s.reference?.trim())
        && (s.pastorDiscovery?.trim().length ?? 0) >= T.pastorDiscoveryMinChars;
}

export function parseWordStudiesFromMessage(message: string): WordStudy[] {
    const lines = message.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 0);
    const entries: WordStudy[] = [];
    const pattern = /^(?:\d+[.)\s-]+)?(?<word>[^\s(:]+)\s*(?:\((?<ref>[^)]+)\))?\s*[:\-—]?\s*(?<rest>.*)$/u;
    for (const line of lines) {
        const m = line.match(pattern);
        if (!m || !m.groups) continue;
        const word = m.groups.word?.trim() ?? '';
        const reference = m.groups.ref?.trim() ?? '';
        const pastorDiscovery = m.groups.rest?.trim() ?? '';
        if (!word || !pastorDiscovery) continue;
        entries.push({ word, reference, pastorDiscovery });
    }
    return entries;
}

export class WordStudiesStepPolicy implements IStepPolicy {
    readonly stepKey = 'wordStudies' as const;
    // Deriva del SSOT: la voz del pastor se declara UNA vez.
    readonly isAiGenerationForbidden = isPastorVoiceStep('wordStudies');
    readonly accumulatesAcrossTurns = true;

    buildSystemPrompt(ctx: TurnContext): string {
        const existingCount = (ctx.existingWordStudies ?? []).filter(isCompleteWordStudy).length;
        const accumulatedBlock = existingCount > 0
            ? `\nESTUDIOS YA GUARDADOS: ${existingCount} de ${T.minWordStudies} mínimos. Las palabras se ACUMULAN entre mensajes — NO le pidas repetir las que ya hizo. Si este mensaje agrega una palabra NUEVA válida y el total llega a ${T.minWordStudies}, acepta. Si todavía falta, "orient" pidiendo UNA palabra más (no todas de nuevo).\n`
            : '';
        return `${BASE_SYSTEM_GUARDS}

PASO ACTUAL: Estudio de Palabras (paso 4 de 8).
Pasaje: ${ctx.passage}
${accumulatedBlock}
Lo que pides al pastor: que produzca ≥${T.minWordStudies} ESTUDIOS DE PALABRAS clave del pasaje EN TOTAL (puede ser de a uno por mensaje). Cada uno con:
- Palabra original (griega/hebrea, transliterada está bien)
- Referencia (en qué versículo aparece)
- Descubrimiento PROPIO del pastor (≥${T.pastorDiscoveryMinChars} caracteres por estudio)

Reglas duras de este paso:
- Si el pastor entrega < ${T.minWordStudies} estudios o algún descubrimiento es < ${T.pastorDiscoveryMinChars} chars → "orient" pidiendo más.
- Confrontación de método: si copia definiciones genéricas de diccionario sin descubrimiento PASTORAL/EXEGÉTICO propio → "orient" pidiendo aplicación al pasaje en estudio. (No es "confront" hard porque el método no está mal, solo está superficial.)
- Confronta (kind: "confront", errorLabel "word-study-fallacy") si el descubrimiento comete una FALACIA de estudio de palabra:
  · falacia de la raíz / etimológica (deducir el significado de la raíz o etimología, ej. "dýnamis significa 'dinamita'");
  · transferencia ilegítima de totalidad (importar TODOS los sentidos del rango semántico a este versículo en vez del que el contexto exige);
  · anacronismo (leer en la palabra un significado posterior al texto).
  Nombra la falacia + pregunta cómo el CONTEXTO del versículo gobierna el sentido. NUNCA le des el significado correcto.
- Si entrega ≥${T.minWordStudies} con descubrimientos sustanciales y sin falacias → "accepted" con pastorTextToPersist = su mensaje verbatim (el sistema parsea los estudios).
- NUNCA propongas qué palabras estudiar (sí puedes sugerirle EN orient "considera ἀρχή y λόγος" como datos, nunca como redacción).

Trabajo previo del pastor:
${priorStepsBlock(ctx)}

AFIRMACIÓN (al aceptar, reconoce algo CONCRETO): un descubrimiento exegético propio gobernado por el contexto (no copia de diccionario) — nombra la palabra. Nada genérico.
${buildInformationalFeatureNudge(
            ctx,
            'wordStudies',
            'textual-crux',
            'DATO DEL PERFIL — cruces/variantes textuales en este pasaje:',
            (f) => (f.typeKey === 'textual-crux' ? `- "${f.summary}" (${f.verseRef})` : ''),
            'Surfacealo como dato si es relevante; no fuerces crítica textual. El pastor decide si lo trabaja.',
        )}
Intento ${ctx.attemptIndex + 1} en este paso.`;
    }

    parseLlmReply(raw: string, pastorMessage: string): SocraticTurnOutput {
        return parseStandardLlmReply(raw, pastorMessage, { aiGenerationForbidden: false });
    }

    validatePastorInput(pastorMessage: string, ctx: TurnContext): StepValidationResult {
        // Count only COMPLETE studies (across saved + this message). Incomplete
        // or stray lines are ignored, not reported as broken "Estudio #N" — the
        // agent gives that feedback conversationally.
        const complete = mergeWordStudies(
            ctx.existingWordStudies ?? [],
            parseWordStudiesFromMessage(pastorMessage),
        ).filter(isCompleteWordStudy);
        return validateWordStudies({ studies: complete, timeSpentSeconds: 0 });
    }

    detectMethodError(): MethodErrorReport | null {
        return null;
    }

    persistTo(seed: PastoralSeed, pastorMessage: string): Partial<PastoralSeed> {
        // Persist ONLY complete studies — this both prevents new garbage and
        // self-heals a seed already polluted by earlier stray lines (they get
        // dropped on the next save).
        const complete = mergeWordStudies(
            seed.wordStudies?.studies ?? [],
            parseWordStudiesFromMessage(pastorMessage),
        ).filter(isCompleteWordStudy);
        return {
            wordStudies: {
                ...seed.wordStudies,
                studies: complete,
                completedAt: new Date(),
            },
        };
    }
}
