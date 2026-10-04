import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { GeminiLlmClient } from '../llm/GeminiLlmClient';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import {
    HEART_PROMPT_VERSION,
    HEART_ADMISIBILIDAD_SYSTEM,
    HEART_TEXTUAL_SYSTEM,
    HEART_TEMPORAL_SYSTEM,
    HEART_ROOT_SYSTEM,
    buildAdmisibilidadPrompt,
    buildTextualPrompt,
    buildTemporalPrompt,
    buildRootPrompt,
    type AfectoPromptClaim,
    type HeartDoctrineLevel,
} from './heartPrompts';
import { MODEL_FAST } from '../llm/modelCatalog';

/**
 * Examen del corazón — callable (manifiesto v1.3 §4). Espeja `validateSeedWitnesses`:
 * thin callable que corre las llamadas LLM y devuelve los verdicts crudos por
 * afecto; la escalación (nivel × disenso) y la composición de los tres estados
 * viven en el dominio puro (`evaluarExamenCorazon`), client-side. Sin dependencia
 * de @dosfilos/domain.
 *
 * Flujo: Cond 4 (admisibilidad) PRIMERO sobre todos los afectos → para los
 * admisibles, las 3 confrontaciones reapuntadas (textual+guarda / temporal / raíz)
 * en paralelo. Un afecto inadmisible (emoción) NO entra a los testigos: se devuelve
 * a reformular. Coste: 1 Flash (admisibilidad) + 3 Flash (si hay admisibles).
 */

type RawVerdict = { dissents: boolean; confidence: number; reasoning: string; evidence: string[] };
type RawRootVerdict = RawVerdict & { detectedLevel: HeartDoctrineLevel | null };

interface AfectoExamen {
    key: string;
    admisible: boolean;
    reasoningAdmisibilidad: string;
    /** Presentes solo si admisible. */
    detectedLevel: HeartDoctrineLevel | null;
    textual: RawVerdict | null;
    temporal: RawVerdict | null;
    root: RawRootVerdict | null;
}

function safeParseJson(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const first = cleaned.search(/[{[]/);
    const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (first === -1 || last === -1) throw new Error('Respuesta sin JSON detectable.');
    return JSON.parse(cleaned.substring(first, last + 1));
}

function clampConfidence(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function verdictByIndex(parsed: Record<string, unknown>): Map<number, Record<string, unknown>> {
    const raw = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
    const byIndex = new Map<number, Record<string, unknown>>();
    raw.forEach((r, i) => {
        const o = (r ?? {}) as Record<string, unknown>;
        const idx = Number.isFinite(Number(o.index)) ? Number(o.index) : i;
        byIndex.set(idx, o);
    });
    return byIndex;
}

function toVerdict(o: Record<string, unknown> | undefined): RawVerdict {
    return {
        dissents: o?.dissents === true,
        confidence: clampConfidence(o?.confidence),
        reasoning: String(o?.reasoning ?? ''),
        evidence: Array.isArray(o?.evidence) ? (o!.evidence as unknown[]).map((e) => String(e)) : [],
    };
}

function toLevel(v: unknown): HeartDoctrineLevel | null {
    return v === 'core' || v === 'distinctive' || v === 'open-evangelical' ? v : null;
}

function buildCacheId(estudioId: string, claims: AfectoPromptClaim[]): string {
    const digest = createHash('sha256')
        .update(
            claims
                .map((c) => `${c.key}::${c.afeccion}::${c.proposicionText}::${c.raizTeocentrica}::${c.puenteCongregacion}`)
                .join(''),
        )
        .digest('hex')
        .slice(0, 16);
    return [estudioId, digest, HEART_PROMPT_VERSION].map((s) => String(s).replace(/__+/g, '_')).join('__');
}

export const examenCorazon = onCall(
    { ...appCheckCallableOptions(), secrets: ['GEMINI_API_KEY'], timeoutSeconds: 120 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret not configured');
        }

        const data = request.data ?? {};
        const estudioId = String(data.estudioId ?? '').trim();
        const claims: AfectoPromptClaim[] = Array.isArray(data.afectos)
            ? data.afectos
                  .map((c: any) => ({
                      key: String(c?.key ?? ''),
                      afeccion: String(c?.afeccion ?? '').trim(),
                      proposicionText: String(c?.proposicionText ?? '').trim(),
                      caraAfectiva: String(c?.caraAfectiva ?? '').trim(),
                      raizTeocentrica: String(c?.raizTeocentrica ?? '').trim(),
                      puenteCongregacion: String(c?.puenteCongregacion ?? '').trim(),
                  }))
                  // Fail-closed: un afecto sin afección o sin proposición resuelta NO
                  // llega aquí (el dominio lo marcó huérfano); este filtro es la red.
                  .filter((c: AfectoPromptClaim) => c.key && c.afeccion && c.proposicionText)
            : [];

        if (!estudioId || claims.length === 0) {
            throw new HttpsError('invalid-argument', 'estudioId y al menos un afecto con proposición son requeridos.');
        }

        const db = admin.firestore();
        const cacheRef = db.collection('heartExamResults').doc(buildCacheId(estudioId, claims));
        const cached = await cacheRef.get();
        if (cached.exists) {
            return { examenes: cached.data()?.examenes, cacheHit: true };
        }

        // Vía el port: el adapter mide el consumo (tokens → USD) que antes se
        // perdía al llamar al SDK directo. Mismo modelo, misma config.
        const llm = new GeminiLlmClient(apiKey, MODEL_FAST, {
            feature: 'examenCorazon',
            userId: request.auth?.uid,
        });
        const call = async (systemInstruction: string, prompt: string) => {
            const raw = await llm.generate({
                system: systemInstruction,
                prompt,
                responseMimeType: 'application/json',
                temperature: 0.2,
            });
            return safeParseJson(raw);
        };

        try {
            // Cond 4 — admisibilidad sobre TODOS los afectos.
            const admParsed = await call(HEART_ADMISIBILIDAD_SYSTEM, buildAdmisibilidadPrompt(claims));
            const admByIndex = verdictByIndex(admParsed);
            const admisibles: boolean[] = claims.map((_, i) => {
                const o = admByIndex.get(i);
                // Ante respuesta ausente/ambigua, admisible=false (devolver a reformular).
                return o?.admisible === true;
            });
            const admReason: string[] = claims.map((_, i) => String(admByIndex.get(i)?.reasoning ?? ''));

            // Los 3 testigos solo sobre el subconjunto admisible.
            const examinables = claims.filter((_, i) => admisibles[i]);
            let textualByIdx = new Map<number, Record<string, unknown>>();
            let temporalByIdx = new Map<number, Record<string, unknown>>();
            let rootByIdx = new Map<number, Record<string, unknown>>();
            if (examinables.length > 0) {
                const [tx, tp, rt] = await Promise.all([
                    call(HEART_TEXTUAL_SYSTEM, buildTextualPrompt(examinables)),
                    call(HEART_TEMPORAL_SYSTEM, buildTemporalPrompt(examinables)),
                    call(HEART_ROOT_SYSTEM, buildRootPrompt(examinables)),
                ]);
                textualByIdx = verdictByIndex(tx);
                temporalByIdx = verdictByIndex(tp);
                rootByIdx = verdictByIndex(rt);
            }

            // Re-ensamblar por clave (el índice de los testigos es del subconjunto).
            let subIdx = 0;
            const examenes: AfectoExamen[] = claims.map((c, i) => {
                if (!admisibles[i]) {
                    return {
                        key: c.key,
                        admisible: false,
                        reasoningAdmisibilidad: admReason[i],
                        detectedLevel: null,
                        textual: null,
                        temporal: null,
                        root: null,
                    };
                }
                const j = subIdx++;
                const rootRaw = rootByIdx.get(j);
                return {
                    key: c.key,
                    admisible: true,
                    reasoningAdmisibilidad: admReason[i],
                    detectedLevel: toLevel(rootRaw?.detectedLevel),
                    textual: toVerdict(textualByIdx.get(j)),
                    temporal: toVerdict(temporalByIdx.get(j)),
                    root: { ...toVerdict(rootRaw), detectedLevel: toLevel(rootRaw?.detectedLevel) },
                };
            });

            try {
                await cacheRef.set({
                    estudioId,
                    // El dueño: sin él, borrar la cuenta no lo encontraba (B2).
                    userId: request.auth?.uid ?? null,
                    promptVersion: HEART_PROMPT_VERSION,
                    examenes,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } catch (err) {
                console.warn('[examenCorazon] cache save failed', err);
            }

            return { examenes, cacheHit: false };
        } catch (err) {
            console.error('[examenCorazon] gemini failed', err);
            throw new HttpsError('internal', err instanceof Error ? err.message : 'Examen del corazón falló');
        }
    },
);
