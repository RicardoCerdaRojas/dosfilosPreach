import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import type { ILlmClient } from '../llm/LlmClient';
import { GeminiLlmClient } from '../llm/GeminiLlmClient';
import { clientePorRuta } from '../llm/clientePorRuta';
import {
    buildFidelityFlashBatchPrompt,
    buildFidelitySonnetEscalationPrompt,
    type FidelityClaimInput,
} from './fidelityEvaluatorPrompt';
import { buildSubstantiveClaimDetectorPrompt } from './substantiveClaimDetectorPrompt';
import { buildAuthorityDetectorPrompt } from './authorityDetectorPrompt';
import { MODEL_FAST } from '../llm/modelCatalog';

/**
 * Pastoral Fidelity — Phase 3 PR 1 callable.
 *
 * Runs the second-pass LLM evaluator over every `[N]` marker in a sermon's
 * generated body and returns one verdict per marker. Two-tier model strategy
 * (ADR-029 Q1):
 *
 *   - Gemini Flash batched over ALL markers in a single call.
 *   - Claude Sonnet 4.6 re-judges only the `partial` / `contradicts`
 *     verdicts emitted by Flash, where the marginal cost buys real
 *     reasoning quality on the cases the pastor most needs to trust.
 *
 * The callable is intentionally thin: it returns the verdicts + the model
 * tier; the `RunFidelityPassUseCase` in `application` composes them into a
 * full `FidelityReport` (with summary + gateStatus from
 * `computeFidelitySummary`) and persists via `SermonRepository`.
 *
 * Ownership check: the sermon's `userId` must equal `request.auth.uid`.
 * No admin override path in PR 1.
 */

/** Mirror of the marker regex from `domain/entities/FidelityReport.ts`. */
const MARKER_REGEX = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
/** Mirror of the sentence-boundary regex used by `extractClaimForMarker`. */
const SENTENCE_BOUNDARY = /[.!?](?=\s|$)/g;

interface RawCitationManifestEntry {
    sourceId: string;
    resourceId?: string;
    chunkId?: string;
    title?: string;
    author?: string;
    page?: string;
    excerpt?: string;
}

interface RawSermonBodyBlock {
    point?: string;
    content?: string;
    illustration?: string;
    transition?: string;
}

interface RawSermonContent {
    introduction?: string;
    body?: RawSermonBodyBlock[];
    conclusion?: string;
    callToAction?: string;
    citationManifest?: { entries?: RawCitationManifestEntry[] };
}

/** PR 3 — one tagged substantive doctrinal claim + its biblical passages. */
interface PassageRefPayload {
    book: string;
    chapter: number;
    verseStart?: number;
    verseEnd?: number;
    label: string;
}

interface SubstantiveClaimPayload {
    claimText: string;
    detectedLevel: 'core' | 'distinctive' | 'open-evangelical';
    biblicalSources: PassageRefPayload[];
}

/** PR 4 — one authority-subordination violation. */
interface AuthorityViolationPayload {
    claim: string;
    citedAuthority: string;
    reformulationHint: string;
    reasoning: string;
}

interface VerdictPayload {
    marker: number;
    claim: string;
    citedSource: {
        sourceId: string;
        resourceId: string;
        chunkId: string;
        title: string;
        author?: string;
        page?: string;
        excerpt: string;
    };
    verdict: 'supports' | 'partial' | 'unrelated' | 'contradicts';
    reasoning: string;
    confidence: number;
    modelUsed: 'flash' | 'sonnet';
    evaluatedAt: number;
}

interface EvaluateResult {
    reportId: string;
    sermonId: string;
    generatedAt: number;
    modelTier: 'flash' | 'sonnet' | 'mixed';
    verdicts: VerdictPayload[];
    /** Diagnostic: how many markers were dropped because the prose held no claim. */
    skippedMarkers: number;
    /** PR 3 (Q4) — substantive doctrinal claims + their biblical grounding. */
    substantiveClaims: SubstantiveClaimPayload[];
    /** PR 4 — claims leaning on a confession/creed as the final authority. */
    authorityViolations: AuthorityViolationPayload[];
}

// 🛑 DORMANT (ADR-032). Gated by the `fidelity_pass` flag (default OFF). Per
// ADR-030/031 the per-marker claim↔source pass belongs to the PAPER, not the
// sermon. It also assumes STRUCTURED content (content.introduction/body[] +
// content.citationManifest); the published sermon persists `content` as a
// markdown STRING with the manifest at top level, so joinProse/extractClaims
// find nothing. Do NOT wire this on for the sermon without revisiting ADR-032 —
// the machinery relocates to the paper in Phase 7 (revival steps in the ADR).
export const evaluateClaimSourceFidelity = onCall(
    {
        ...appCheckCallableOptions(),
        secrets: ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
        timeoutSeconds: 120,
    },
    async (request): Promise<EvaluateResult> => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret not configured');
        }

        const data = request.data ?? {};
        const sermonId = String(data.sermonId ?? '').trim();
        const locale: 'es' | 'en' = data.locale === 'en' ? 'en' : 'es';
        if (!sermonId) {
            throw new HttpsError('invalid-argument', 'sermonId is required');
        }

        const db = getFirestore();
        const sermonSnap = await db.collection('sermons').doc(sermonId).get();
        if (!sermonSnap.exists) {
            throw new HttpsError('not-found', `Sermon ${sermonId} not found`);
        }
        const sermonData = sermonSnap.data() as {
            userId?: string;
            content?: RawSermonContent;
            bibleReferences?: unknown;
        };
        if (sermonData.userId && sermonData.userId !== request.auth.uid) {
            throw new HttpsError('permission-denied', 'Caller does not own this sermon');
        }

        const content = sermonData.content ?? {};
        const bibleReferences = Array.isArray(sermonData.bibleReferences)
            ? sermonData.bibleReferences.filter((r): r is string => typeof r === 'string')
            : [];
        const manifestEntries = content.citationManifest?.entries ?? [];
        const prose = joinProse(content);
        const claims = extractClaims(content, manifestEntries);

        const flash: ILlmClient = new GeminiLlmClient(geminiKey, MODEL_FAST, {
            feature: 'evaluateClaimSourceFidelity',
            userId: request.auth?.uid,
        });
        const sonnet: ILlmClient = await clientePorRuta({
            usage: { feature: 'evaluateClaimSourceFidelity.escalation', userId: request.auth?.uid },
            timeoutSeconds: 120,
        });

        const generatedAtMs = Date.now();
        const reportId = `${sermonId}-${generatedAtMs}`;

        // Marker fidelity — skip the LLM entirely when the sermon has no
        // citations, but still run the plurality tagger below.
        let verdicts: VerdictPayload[] = [];
        let modelTier: 'flash' | 'sonnet' | 'mixed' = 'flash';
        if (claims.length > 0) {
            const marker = await runMarkerFidelity(claims, flash, sonnet, locale, generatedAtMs);
            verdicts = marker.verdicts;
            modelTier = marker.modelTier;
        }

        // Substantive-claim detector (Q4) — second Flash call over the whole
        // prose. Degrades to [] on failure so a tagger hiccup never blocks the
        // marker report the pastor came for.
        const substantiveClaims = await detectSubstantiveClaims(flash, prose, bibleReferences, locale);
        const authorityViolations = await detectAuthorityViolations(flash, prose, locale);

        return {
            reportId,
            sermonId,
            generatedAt: generatedAtMs,
            modelTier,
            verdicts,
            skippedMarkers: Math.max(0, manifestEntries.length - claims.length),
            substantiveClaims,
            authorityViolations,
        };
    },
);

// ─────────────────────────────────────────────────────────────────────────
// Marker fidelity pipeline (PR 1) — extracted so the handler stays readable
// once the PR 3 tagger joins it.
// ─────────────────────────────────────────────────────────────────────────

async function runMarkerFidelity(
    claims: ExtractedClaim[],
    flash: ILlmClient,
    sonnet: ILlmClient,
    locale: 'es' | 'en',
    generatedAtMs: number,
): Promise<{ verdicts: VerdictPayload[]; modelTier: 'flash' | 'sonnet' | 'mixed' }> {
    const { system: flashSystem, prompt: flashPrompt } = buildFidelityFlashBatchPrompt(
        claims.map((c) => c.input),
        { locale },
    );

    let flashVerdicts: ParsedVerdict[];
    try {
        const raw = await flash.generate({
            system: flashSystem,
            prompt: flashPrompt,
            temperature: 0.2,
            responseMimeType: 'application/json',
            maxOutputTokens: 4096,
        });
        flashVerdicts = parseFlashVerdicts(raw, claims.map((c) => c.input.marker));
    } catch (err) {
        console.error('[evaluateClaimSourceFidelity] flash failed', err);
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Flash evaluator failed');
    }

    // Escalate partial/contradicts in parallel via Sonnet.
    const escalations = await Promise.all(
        flashVerdicts.map(async (v) => {
            if (v.verdict !== 'partial' && v.verdict !== 'contradicts') return v;
            const claim = claims.find((c) => c.input.marker === v.marker);
            if (!claim) return v;
            try {
                const { system, prompt } = buildFidelitySonnetEscalationPrompt(
                    claim.input,
                    v.verdict,
                    v.reasoning,
                    { locale },
                );
                const raw = await sonnet.generate({
                    system,
                    prompt,
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                    maxOutputTokens: 4096, // Sol razona dentro del mismo tope (revisión de #769).
                });
                const re = parseSonnetVerdict(raw);
                return {
                    marker: v.marker,
                    verdict: re.verdict,
                    reasoning: re.reasoning,
                    confidence: re.confidence,
                    modelUsed: 'sonnet' as const,
                };
            } catch (err) {
                console.warn('[evaluateClaimSourceFidelity] sonnet escalation failed', {
                    marker: v.marker,
                    error: err instanceof Error ? err.message : String(err),
                });
                return v;
            }
        }),
    );

    const verdicts: VerdictPayload[] = [];
    for (const e of escalations) {
        const claim = claims.find((c) => c.input.marker === e.marker);
        if (!claim) continue;
        verdicts.push({
            marker: e.marker,
            claim: claim.input.claim,
            citedSource: claim.citedSource,
            verdict: e.verdict,
            reasoning: e.reasoning,
            confidence: e.confidence,
            modelUsed: e.modelUsed,
            evaluatedAt: generatedAtMs,
        });
    }

    const usedSonnet = verdicts.some((v) => v.modelUsed === 'sonnet');
    const usedFlash = verdicts.some((v) => v.modelUsed === 'flash');
    const modelTier: 'flash' | 'sonnet' | 'mixed' =
        usedSonnet && usedFlash ? 'mixed' : usedSonnet ? 'sonnet' : 'flash';

    return { verdicts, modelTier };
}

// ─────────────────────────────────────────────────────────────────────────
// Substantive-claim detector (PR 3, Q4)
// ─────────────────────────────────────────────────────────────────────────

async function detectSubstantiveClaims(
    flash: ILlmClient,
    prose: string,
    bibleReferences: string[],
    locale: 'es' | 'en',
): Promise<SubstantiveClaimPayload[]> {
    if (!prose.trim()) return [];
    try {
        const { system, prompt } = buildSubstantiveClaimDetectorPrompt({
            prose,
            bibleReferences,
            locale,
        });
        const raw = await flash.generate({
            system,
            prompt,
            temperature: 0.2,
            responseMimeType: 'application/json',
            maxOutputTokens: 4096,
        });
        return parseSubstantiveClaims(raw);
    } catch (err) {
        console.warn('[evaluateClaimSourceFidelity] substantive-claim detector failed', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Authority-subordination detector (PR 4)
// ─────────────────────────────────────────────────────────────────────────

async function detectAuthorityViolations(
    flash: ILlmClient,
    prose: string,
    locale: 'es' | 'en',
): Promise<AuthorityViolationPayload[]> {
    if (!prose.trim()) return [];
    try {
        const { system, prompt } = buildAuthorityDetectorPrompt({ prose, locale });
        const raw = await flash.generate({
            system,
            prompt,
            temperature: 0.2,
            responseMimeType: 'application/json',
            maxOutputTokens: 4096,
        });
        return parseAuthorityViolations(raw);
    } catch (err) {
        console.warn('[evaluateClaimSourceFidelity] authority detector failed', err);
        return [];
    }
}

function parseAuthorityViolations(raw: string): AuthorityViolationPayload[] {
    const json = safeParseJson(raw);
    const arr = Array.isArray((json as { violations?: unknown }).violations)
        ? ((json as { violations: unknown[] }).violations)
        : [];
    const result: AuthorityViolationPayload[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const claim = String((item as { claim?: unknown }).claim ?? '').trim();
        if (!claim) continue;
        result.push({
            claim: claim.slice(0, 500),
            citedAuthority: String((item as { citedAuthority?: unknown }).citedAuthority ?? '').trim().slice(0, 120),
            reformulationHint: String((item as { reformulationHint?: unknown }).reformulationHint ?? '').trim().slice(0, 600),
            reasoning: String((item as { reasoning?: unknown }).reasoning ?? '').trim().slice(0, 400),
        });
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Claim + manifest extraction (mirrored from domain — see ADR-025 note on
// the functions/domain decoupling kept throughout this package).
// ─────────────────────────────────────────────────────────────────────────

interface ExtractedClaim {
    input: FidelityClaimInput;
    citedSource: VerdictPayload['citedSource'];
}

function extractClaims(content: RawSermonContent, manifestEntries: RawCitationManifestEntry[]): ExtractedClaim[] {
    const prose = joinProse(content);
    if (!prose || manifestEntries.length === 0) return [];

    const claims: ExtractedClaim[] = [];
    for (let i = 0; i < manifestEntries.length; i++) {
        const marker = i + 1;
        const entry = manifestEntries[i];
        if (!entry?.excerpt) continue;
        const claim = extractClaimForMarker(prose, marker);
        if (!claim) continue;
        claims.push({
            input: {
                marker,
                claim,
                sourceTitle: entry.title ?? '(untitled source)',
                sourceAuthor: entry.author,
                excerpt: entry.excerpt,
            },
            citedSource: {
                sourceId: entry.sourceId,
                resourceId: entry.resourceId ?? '',
                chunkId: entry.chunkId ?? '',
                title: entry.title ?? '(untitled source)',
                author: entry.author,
                page: entry.page,
                excerpt: entry.excerpt,
            },
        });
    }
    return claims;
}

function joinProse(content: RawSermonContent): string {
    const parts: string[] = [];
    if (content.introduction) parts.push(content.introduction);
    if (Array.isArray(content.body)) {
        for (const block of content.body) {
            if (block?.point) parts.push(block.point);
            if (block?.content) parts.push(block.content);
            if (block?.illustration) parts.push(block.illustration);
            if (block?.transition) parts.push(block.transition);
        }
    }
    if (content.conclusion) parts.push(content.conclusion);
    if (content.callToAction) parts.push(content.callToAction);
    return parts.join('\n\n');
}

/** Mirror of `extractClaimForMarker` from `@dosfilos/domain` (ADR-025 decoupling). */
function extractClaimForMarker(prose: string, markerN: number): string | null {
    if (!prose || markerN <= 0 || !Number.isInteger(markerN)) return null;
    MARKER_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MARKER_REGEX.exec(prose)) !== null) {
        const numbers = match[1].split(/\s*,\s*/).map((n) => Number.parseInt(n, 10));
        if (!numbers.includes(markerN)) continue;
        const before = prose.slice(0, match.index);
        const sentence = lastSentenceOf(before);
        if (sentence) return sentence;
    }
    return null;
}

function lastSentenceOf(text: string): string | null {
    const trimmed = text.replace(/\s+$/u, '');
    if (trimmed.length === 0) return null;
    let lastEnd = -1;
    SENTENCE_BOUNDARY.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SENTENCE_BOUNDARY.exec(trimmed)) !== null) {
        lastEnd = m.index;
    }
    if (lastEnd === -1) return null;
    let start = 0;
    SENTENCE_BOUNDARY.lastIndex = 0;
    let prev: RegExpExecArray | null;
    while ((prev = SENTENCE_BOUNDARY.exec(trimmed)) !== null) {
        if (prev.index >= lastEnd) break;
        start = prev.index + 1;
    }
    return trimmed.slice(start, lastEnd + 1).trim() || null;
}

// ─────────────────────────────────────────────────────────────────────────
// LLM response parsing
// ─────────────────────────────────────────────────────────────────────────

interface ParsedVerdict {
    marker: number;
    verdict: 'supports' | 'partial' | 'unrelated' | 'contradicts';
    reasoning: string;
    confidence: number;
    modelUsed: 'flash' | 'sonnet';
}

function parseFlashVerdicts(raw: string, expectedMarkers: number[]): ParsedVerdict[] {
    const json = safeParseJson(raw);
    const arr = Array.isArray(json?.verdicts) ? json.verdicts : [];
    const byMarker = new Map<number, ParsedVerdict>();
    for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const marker = Number((item as { marker?: unknown }).marker);
        if (!Number.isInteger(marker) || marker <= 0) continue;
        const verdict = normalizeVerdict((item as { verdict?: unknown }).verdict);
        if (!verdict) continue;
        const reasoning = String((item as { reasoning?: unknown }).reasoning ?? '').trim().slice(0, 500);
        const confidence = clampConfidence(Number((item as { confidence?: unknown }).confidence));
        byMarker.set(marker, { marker, verdict, reasoning, confidence, modelUsed: 'flash' });
    }
    // Fill missing markers as `partial` with low confidence so the report
    // still surfaces them — the alternative would silently hide markers the
    // evaluator forgot, which is worse than a soft-flag the pastor can see.
    const result: ParsedVerdict[] = [];
    for (const m of expectedMarkers) {
        const v = byMarker.get(m);
        if (v) {
            result.push(v);
        } else {
            result.push({
                marker: m,
                verdict: 'partial',
                reasoning: 'Verdict missing from evaluator response.',
                confidence: 0.2,
                modelUsed: 'flash',
            });
        }
    }
    return result;
}

function parseSonnetVerdict(raw: string): { verdict: ParsedVerdict['verdict']; reasoning: string; confidence: number } {
    const json = safeParseJson(raw);
    const verdict = normalizeVerdict((json as { verdict?: unknown }).verdict);
    if (!verdict) {
        throw new Error('Sonnet response missing valid verdict label.');
    }
    const reasoning = String((json as { reasoning?: unknown }).reasoning ?? '').trim().slice(0, 800);
    const confidence = clampConfidence(Number((json as { confidence?: unknown }).confidence));
    return { verdict, reasoning, confidence };
}

function normalizeVerdict(v: unknown): ParsedVerdict['verdict'] | null {
    if (v === 'supports' || v === 'partial' || v === 'unrelated' || v === 'contradicts') return v;
    return null;
}

function normalizeLevel(v: unknown): SubstantiveClaimPayload['detectedLevel'] | null {
    if (v === 'core' || v === 'distinctive' || v === 'open-evangelical') return v;
    return null;
}

function parseSubstantiveClaims(raw: string): SubstantiveClaimPayload[] {
    const json = safeParseJson(raw);
    const arr = Array.isArray((json as { claims?: unknown }).claims)
        ? ((json as { claims: unknown[] }).claims)
        : [];
    const result: SubstantiveClaimPayload[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const claimText = String((item as { claimText?: unknown }).claimText ?? '').trim();
        if (!claimText) continue;
        const detectedLevel = normalizeLevel((item as { detectedLevel?: unknown }).detectedLevel);
        if (!detectedLevel) continue;

        const rawSources = (item as { biblicalSources?: unknown }).biblicalSources;
        const sources = Array.isArray(rawSources) ? rawSources : [];
        const biblicalSources: PassageRefPayload[] = [];
        for (const s of sources) {
            if (!s || typeof s !== 'object') continue;
            const label = String((s as { label?: unknown }).label ?? '').trim();
            if (!label) continue;
            const chapterNum = Number((s as { chapter?: unknown }).chapter);
            const ref: PassageRefPayload = {
                label: label.slice(0, 60),
                book: String((s as { book?: unknown }).book ?? '').trim(),
                chapter: Number.isFinite(chapterNum) ? chapterNum : 0,
            };
            const vs = Number((s as { verseStart?: unknown }).verseStart);
            if (Number.isFinite(vs)) ref.verseStart = vs;
            const ve = Number((s as { verseEnd?: unknown }).verseEnd);
            if (Number.isFinite(ve)) ref.verseEnd = ve;
            biblicalSources.push(ref);
        }
        result.push({ claimText: claimText.slice(0, 500), detectedLevel, biblicalSources });
    }
    return result;
}

function clampConfidence(n: number): number {
    if (!Number.isFinite(n)) return 0.5;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

function safeParseJson(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const first = cleaned.search(/[{[]/);
    const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (first === -1 || last === -1) throw new Error('Evaluator response had no JSON to parse.');
    return JSON.parse(cleaned.substring(first, last + 1));
}
