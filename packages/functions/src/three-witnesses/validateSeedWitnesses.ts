import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { GeminiLlmClient } from '../llm/GeminiLlmClient';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import {
    WITNESS_PROMPT_VERSION,
    buildContextPrompt,
    buildParallelsPrompt,
    buildConfessionPrompt,
    WITNESS_CONTEXT_SYSTEM,
    WITNESS_PARALLELS_SYSTEM,
    WITNESS_CONFESSION_SYSTEM,
    type PromptClaim,
    type SeedContext,
    type TraditionSection,
} from './prompts';
import { MODEL_FAST } from '../llm/modelCatalog';

/**
 * Pastoral Fidelity Phase 2 — three-witnesses orchestrator (ADR-011).
 *
 * Thin callable: runs the three witness LLM calls and returns the RAW
 * per-claim verdicts. The escalation math (level × dissent → block) is a
 * pure domain function that runs client-side in `useWitnessValidation`,
 * so this function stays decoupled from `@dosfilos/domain` (same pattern
 * as the Phase 1.5 word-study callables).
 *
 * Cost: ≤3 Flash calls on a miss; cached repeats are 1 read. Cache key is
 * deterministic over the claim texts + toggle + prompt version, so editing
 * a claim or bumping the prompts invalidates it.
 */

// Local mirror of `CORE_DOCTRINE_CLAIMS` (domain). Kept here because the
// functions package does not depend on @dosfilos/domain. Keep in sync with
// packages/domain/src/entities/WitnessValidation.ts.
const CORE_DOCTRINES: ReadonlyArray<{ id: string; statement: string }> = [
    { id: 'trinity', statement: 'Un solo Dios en tres personas: Padre, Hijo y Espíritu Santo.' },
    { id: 'deity-of-christ', statement: 'Jesucristo es verdaderamente Dios, de la misma sustancia que el Padre.' },
    { id: 'incarnation', statement: 'El Hijo se encarnó verdaderamente: dos naturalezas, divina y humana, en una persona (Calcedonia).' },
    { id: 'bodily-resurrection', statement: 'Cristo resucitó corporalmente de entre los muertos.' },
    { id: 'salvation-by-grace', statement: 'La salvación es por gracia mediante la fe, no por obras.' },
    { id: 'scripture-authority', statement: 'La Escritura es suficiente y la autoridad final en fe y práctica.' },
    { id: 'virgin-birth', statement: 'Cristo fue concebido por el Espíritu Santo y nacido de la virgen María.' },
    { id: 'second-coming', statement: 'Cristo volverá a juzgar a vivos y muertos.' },
];

const MAX_TRADITION_SECTIONS = 80;

type DoctrineLevel = 'core' | 'distinctive' | 'open-evangelical';

interface RawVerdict {
    index: number;
    dissents: boolean;
    confidence: number;
    reasoning: string;
    evidence: string[];
}
interface RawConfessionVerdict extends RawVerdict {
    detectedLevel: DoctrineLevel | null;
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

function normalizeVerdicts(parsed: Record<string, unknown>, claimCount: number): RawVerdict[] {
    const raw = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
    const byIndex = new Map<number, Record<string, unknown>>();
    raw.forEach((r, i) => {
        const o = (r ?? {}) as Record<string, unknown>;
        const idx = Number.isFinite(Number(o.index)) ? Number(o.index) : i;
        byIndex.set(idx, o);
    });
    const out: RawVerdict[] = [];
    for (let i = 0; i < claimCount; i++) {
        const o = byIndex.get(i) ?? {};
        out.push({
            index: i,
            dissents: o.dissents === true,
            confidence: clampConfidence(o.confidence),
            reasoning: String(o.reasoning ?? ''),
            evidence: Array.isArray(o.evidence) ? (o.evidence as unknown[]).map((e) => String(e)) : [],
        });
    }
    return out;
}

function normalizeConfessionVerdicts(parsed: Record<string, unknown>, claimCount: number): RawConfessionVerdict[] {
    const base = normalizeVerdicts(parsed, claimCount);
    const raw = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
    const levelByIndex = new Map<number, DoctrineLevel | null>();
    raw.forEach((r, i) => {
        const o = (r ?? {}) as Record<string, unknown>;
        const idx = Number.isFinite(Number(o.index)) ? Number(o.index) : i;
        const lvl = o.detectedLevel;
        levelByIndex.set(
            idx,
            lvl === 'core' || lvl === 'distinctive' || lvl === 'open-evangelical' ? lvl : null,
        );
    });
    return base.map((v) => ({ ...v, detectedLevel: levelByIndex.get(v.index) ?? null }));
}

function buildCacheId(args: {
    sermonId: string;
    claims: PromptClaim[];
    confessionalWitnessesEnabled: boolean;
    mode: 'inline-core' | 'full-gate';
}): string {
    const claimDigest = createHash('sha256')
        .update(args.claims.map((c) => `${c.key}::${c.text}`).join(''))
        .digest('hex')
        .slice(0, 16);
    return [
        args.sermonId,
        args.mode,
        claimDigest,
        args.confessionalWitnessesEnabled ? 'wON' : 'wOFF',
        WITNESS_PROMPT_VERSION,
    ]
        .map((s) => String(s).replace(/__+/g, '_'))
        .join('__');
}

/** Reads core+distinctive tagged sections across all traditions (admin SDK). */
async function fetchTraditionSections(): Promise<TraditionSection[]> {
    const db = admin.firestore();
    // Map confessionId → tradition label (small catalog, single read).
    const traditionById = new Map<string, string>();
    try {
        const confessions = await db.collection('confessions').get();
        confessions.forEach((d) => {
            const data = d.data();
            traditionById.set(d.id, String(data.shortTitle ?? data.tradition ?? d.id));
        });
    } catch (err) {
        console.warn('[validateSeedWitnesses] confessions read failed', err);
    }

    try {
        const snap = await db
            .collectionGroup('sections')
            .where('doctrineLevel', 'in', ['core', 'distinctive'])
            .limit(MAX_TRADITION_SECTIONS)
            .get();
        return snap.docs.map((d) => {
            const data = d.data();
            const confessionId = d.ref.parent.parent?.id ?? 'unknown';
            return {
                tradition: traditionById.get(confessionId) ?? confessionId,
                sectionReference: String(data.sectionReference ?? d.id),
                doctrineLevel: (data.doctrineLevel ?? 'distinctive') as TraditionSection['doctrineLevel'],
                text: String(data.text ?? '').slice(0, 600),
            };
        });
    } catch (err) {
        // Missing collectionGroup index degrades gracefully — T3 still
        // classifies core via the curated list in the prompt.
        console.warn('[validateSeedWitnesses] sections collectionGroup failed', err);
        return [];
    }
}

export const validateSeedWitnesses = onCall(
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
        const sermonId = String(data.sermonId ?? '').trim();
        const seedId = String(data.seedId ?? '').trim();
        const passage = String(data.passage ?? '').trim();
        // Phase 1.6 (ADR-023) — two-tier verification. `inline-core` runs
        // ONLY Testigo 3 at core level (the productive-struggle tripwire);
        // `full-gate` runs all three witnesses (the Phase 2 default).
        const mode: 'inline-core' | 'full-gate' =
            data.mode === 'inline-core' ? 'inline-core' : 'full-gate';
        // In inline-core we force confessional witnesses OFF so only `core`
        // dissent fires (silence on distinctive/open — manifesto P1).
        const confessionalWitnessesEnabled =
            mode === 'inline-core' ? false : data.confessionalWitnessesEnabled !== false;
        const claims: PromptClaim[] = Array.isArray(data.claims)
            ? data.claims
                  .map((c: any) => ({
                      key: String(c?.key ?? ''),
                      kind: (c?.kind ?? 'observation') as PromptClaim['kind'],
                      text: String(c?.text ?? '').trim(),
                  }))
                  .filter((c: PromptClaim) => c.key && c.text)
            : [];

        if (!sermonId || !passage || claims.length === 0) {
            throw new HttpsError('invalid-argument', 'sermonId, passage y al menos un claim son requeridos.');
        }

        const ctx: SeedContext = {
            passage,
            mainClauseRef: String(data.context?.mainClauseRef ?? ''),
            mainClauseNote: String(data.context?.mainClauseNote ?? ''),
            wordStudies: Array.isArray(data.context?.wordStudies)
                ? data.context.wordStudies.map((w: any) => ({
                      word: String(w?.word ?? ''),
                      reference: String(w?.reference ?? ''),
                      discovery: String(w?.discovery ?? ''),
                  }))
                : [],
            originalAudienceFunction: String(data.context?.originalAudienceFunction ?? ''),
        };
        const crossRefs: string[] = Array.isArray(data.crossRefs)
            ? data.crossRefs.map((r: any) => String(r))
            : [];
        const seedParallels: Array<{ reference: string; note: string }> = Array.isArray(data.seedParallels)
            ? data.seedParallels.map((p: any) => ({ reference: String(p?.reference ?? ''), note: String(p?.note ?? '') }))
            : [];

        const cacheId = buildCacheId({ sermonId, claims, confessionalWitnessesEnabled, mode });
        const db = admin.firestore();
        const cacheRef = db.collection('witnessResults').doc(cacheId);

        const cached = await cacheRef.get();
        if (cached.exists) {
            const cd = cached.data();
            return { witnesses: cd?.witnesses, cacheHit: true, cacheId };
        }

        const sections = await fetchTraditionSections();

        // Vía el port: el adapter mide el consumo (tokens → USD) que antes se
        // perdía al llamar al SDK directo. Mismo modelo, misma config.
        const llm = new GeminiLlmClient(apiKey, MODEL_FAST, {
            feature: 'validateSeedWitnesses',
            userId: request.auth?.uid,
        });

        const callWitness = async (systemInstruction: string, prompt: string) => {
            const raw = await llm.generate({
                system: systemInstruction,
                prompt,
                responseMimeType: 'application/json',
                temperature: 0.2,
            });
            return safeParseJson(raw);
        };

        let context: RawVerdict[];
        let parallels: RawVerdict[];
        let confession: RawConfessionVerdict[];
        try {
            if (mode === 'inline-core') {
                // Tier 1: only Testigo 3 (core-only). Context + parallels are
                // skipped (the inline tripwire acts on `detectedLevel==='core'`
                // alone), keeping the call to a single Flash request.
                const confParsed = await callWitness(
                    WITNESS_CONFESSION_SYSTEM,
                    buildConfessionPrompt(claims, CORE_DOCTRINES, sections, false),
                );
                context = claims.map((_, i) => ({ index: i, dissents: false, confidence: 0, reasoning: '', evidence: [] }));
                parallels = context.map((v) => ({ ...v }));
                confession = normalizeConfessionVerdicts(confParsed, claims.length);
            } else {
                const [ctxParsed, parParsed, confParsed] = await Promise.all([
                    callWitness(WITNESS_CONTEXT_SYSTEM, buildContextPrompt(claims, ctx)),
                    callWitness(WITNESS_PARALLELS_SYSTEM, buildParallelsPrompt(claims, ctx, crossRefs, seedParallels)),
                    callWitness(
                        WITNESS_CONFESSION_SYSTEM,
                        buildConfessionPrompt(claims, CORE_DOCTRINES, sections, confessionalWitnessesEnabled),
                    ),
                ]);
                context = normalizeVerdicts(ctxParsed, claims.length);
                parallels = normalizeVerdicts(parParsed, claims.length);
                confession = normalizeConfessionVerdicts(confParsed, claims.length);
            }
        } catch (err) {
            console.error('[validateSeedWitnesses] gemini failed', err);
            throw new HttpsError('internal', err instanceof Error ? err.message : 'Witness validation failed');
        }

        // ADR-010 toggle: when confessional witnesses are off, suppress T3
        // dissent on non-core levels (core still fires universally).
        if (!confessionalWitnessesEnabled) {
            confession = confession.map((v) =>
                v.detectedLevel === 'core' ? v : { ...v, dissents: false },
            );
        }

        const witnesses = {
            // Each array aligned to `claims` index; client maps key by order.
            claimKeys: claims.map((c) => c.key),
            context,
            parallels,
            confession,
        };

        try {
            await cacheRef.set({
                sermonId,
                seedId,
                // El dueño: sin él, borrar la cuenta no lo encontraba (B2).
                userId: request.auth?.uid ?? null,
                confessionalWitnessesEnabled,
                promptVersion: WITNESS_PROMPT_VERSION,
                witnesses,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        } catch (err) {
            console.warn('[validateSeedWitnesses] cache save failed', err);
        }

        return { witnesses, cacheHit: false, cacheId };
    },
);
