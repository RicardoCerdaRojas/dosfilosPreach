import {
    AiAssistLog,
    assertAiAssistAllowed,
    computeStudyDepthFromSeed,
    createEmptyPastoralSeed,
    DimensionOverrides,
    DoxologicalGateRecord,
    evaluatePastoralSeed,
    IPastoralSeedRepository,
    PASTORAL_SEED_STEP_ORDER,
    PastoralSeed,
    PastoralSeedEvaluation,
    PastoralSeedStepKey,
    PasteEvent,
    PrincipleVerification,
    StudyDepthAssessment,
    ToolUsage,
    WordStudy,
} from '@dosfilos/domain';
import { FirestorePastoralSeedRepository } from '@dosfilos/infrastructure';
import { getFunctions, httpsCallable } from 'firebase/functions';

/** Input for the timeless-principle verifier callable (Phase 1.6, ADR-023). */
export interface VerifyPrincipleInput {
    passage: string;
    principle: string;
    centralIdea: string;
    mainClauseNote: string;
    wordStudies: Array<{ word: string; discovery: string }>;
    parallels: Array<{ reference: string; note: string }>;
    originalAudienceFunction: string;
}

/** A historical-cultural background chunk retrieved via RAG (ruta C). */
export interface HistoricalContextChunk {
    text: string;
    source: string;
}

/** Input/output for the `buildStructuralPuzzle` callable (Phase 2.5 Tier 3). */
export interface BuildStructuralPuzzleInput {
    passage: string;
}
export type StructuralPuzzleRole = 'climactic' | 'preparatory' | 'development';
export interface StructuralPuzzleClause {
    id: string;
    text: string;
    reference: string;
}
export interface StructuralPuzzle {
    clauses: StructuralPuzzleClause[];
    mainClauseId: string;
    roles: Record<string, StructuralPuzzleRole>;
    hints: Record<string, string>;
}

/** Input for the `orientStudy` callable (Phase 2.5, ADR-026). */
export interface OrientStudyInput {
    passage: string;
    /** One of the orientable method steps (genre/structure/words/parallels/function). */
    stepKey: 'contextGenre' | 'structuralAnalysis' | 'wordStudies' | 'recognition' | 'function';
    /** The pastor's current draft for the step (may be empty or hold a method error). */
    pastorInput: string;
    /** Genre, if already confirmed — sharpens the orientation. */
    genre?: string;
    /**
     * Second-level help (ZPD scaffolding): drop jargon + include a concrete
     * example of the METHOD applied to a different passage. The companion
     * still never writes the pastor's answer.
     */
    simplify?: boolean;
}

/**
 * Output of the Study Companion's step orientation (Moment 1, ADR-026).
 * Verifier-orienter: data + Socratic questions, never the pastor's answer.
 */
export interface StepOrientation {
    data: string[];
    questions: string[];
    /** Present only when a method error was detected (phrased as confrontation). */
    confrontation?: string;
    /** e.g. no real background source available for this book. */
    caution?: string;
    /** Simplified mode only — concrete example of the METHOD in another passage. */
    example?: string;
}

/**
 * Orchestrates pastoralSeeds reads + writes used by the wizard.
 *
 * Owns the "first-touch creation" flow: when the wizard's `Step 1`
 * enters for a given sermon and no seed exists yet, `ensureForSermon`
 * mints an empty one. Subsequent autosaves call `update` directly
 * through this service so we can keep cross-cutting logic (audit
 * timestamps, `completed` evaluation, tool tracking) in one place.
 */
export class PastoralSeedService {
    constructor(private readonly repo: IPastoralSeedRepository) {}

    /**
     * `opts.userId` viaja hasta la consulta y es lo que la vuelve aceptable
     * para `allow list`, que acota `pastoralSeeds` al dueño. Se omite SÓLO en
     * las superficies de auditoría, donde el llamador es super_admin y no
     * conoce el uid del pastor.
     */
    async getBySermonId(
        sermonId: string,
        opts?: { userId?: string },
    ): Promise<PastoralSeed | null> {
        return this.repo.findBySermonId(sermonId, opts);
    }

    async getById(seedId: string): Promise<PastoralSeed | null> {
        return this.repo.getById(seedId);
    }

    async listByUserId(userId: string, opts?: { limit?: number }): Promise<PastoralSeed[]> {
        return this.repo.listByUserId(userId, opts);
    }

    /**
     * Returns the existing seed for the sermon or mints + persists a
     * fresh one. Safe to call repeatedly — the underlying `findBySermonId`
     * short-circuits on hit.
     */
    async ensureForSermon(args: {
        sermonId: string;
        userId: string;
        passage: string;
        projectId?: string;
    }): Promise<PastoralSeed> {
        const existing = await this.repo.findBySermonId(args.sermonId, { userId: args.userId });
        if (existing) return existing;
        const empty = createEmptyPastoralSeed({
            id: '', // repo assigns it
            sermonId: args.sermonId,
            userId: args.userId,
            passage: args.passage,
            projectId: args.projectId,
            // Spine A: el estudio nace del formulario del wizard.
            origin: 'wizard',
        });
        return this.repo.create(empty);
    }

    /**
     * Persists an arbitrary patch + recomputes `completed` from the
     * full merged state. Callers pass the in-memory seed they already
     * have to avoid a redundant fetch on every autosave tick.
     */
    async savePatch(args: {
        seed: PastoralSeed;
        patch: Partial<PastoralSeed>;
    }): Promise<{ completed: boolean; evaluation: PastoralSeedEvaluation }> {
        const merged: PastoralSeed = { ...args.seed, ...args.patch };
        const evaluation = evaluatePastoralSeed(merged);
        const wasCompletedBefore = args.seed.completed === true;
        const completedAtPatch = !wasCompletedBefore && evaluation.completed
            ? { completedAt: new Date() }
            : {};
        await this.repo.update(args.seed.id, {
            ...args.patch,
            completed: evaluation.completed,
            ...completedAtPatch,
        });
        return { completed: evaluation.completed, evaluation };
    }

    /**
     * Grieta doxológica — Capa 2.B (puente de compat). Persiste el estado
     * autoritativo del gate doxológico en el seed. Aditivo + INERTE: no toca
     * `completed` ni el flujo; el enforce (C/D, `doxological_enforce`) lo leerá
     * en el chokepoint. Cada (re)corrida del gate sobrescribe el registro con
     * fingerprint + status frescos y `override:null`.
     */
    async persistDoxologicalGate(seedId: string, gate: DoxologicalGateRecord): Promise<void> {
        await this.repo.update(seedId, { doxologicalGate: gate });
    }

    /**
     * Append-only tool usage log. Wizard sub-steps call this when the
     * pastor opens Greek tutor / cross-ref / Faculty histórico from
     * inside the step so the audit panel reflects what was consulted.
     */
    async appendToolUsage(args: {
        seed: PastoralSeed;
        tool: ToolUsage;
    }): Promise<void> {
        const next = [...(args.seed.toolsConsulted ?? []), args.tool];
        await this.repo.update(args.seed.id, { toolsConsulted: next });
    }

    /**
     * Append-only paste event log on InsightStep AI-forbidden fields.
     * Never blocks; the wizard simply logs and renders the disuasoria copy.
     */
    async appendPasteEvent(args: {
        seed: PastoralSeed;
        event: PasteEvent;
    }): Promise<void> {
        const insight = args.seed.insight;
        const next = {
            ...insight,
            pasteEvents: [...(insight.pasteEvents ?? []), args.event],
        };
        await this.repo.update(args.seed.id, { insight: next });
    }

    /**
     * Helper for the word-studies step (formerly "morphology") — pushes a
     * word study into the existing array without forcing the UI to handle
     * merge logic.
     */
    async addWordStudy(args: { seed: PastoralSeed; study: WordStudy }): Promise<void> {
        const next = {
            ...args.seed.wordStudies,
            studies: [...(args.seed.wordStudies?.studies ?? []), args.study],
        };
        await this.repo.update(args.seed.id, { wordStudies: next });
    }

    /**
     * Phase 1.6 (ADR-024) — append a first-class assist log to the seed's
     * `aiAssistLogs/` subcollection. Throws on AI-forbidden steps (reading
     * / insight) so a contaminating write fails loud rather than silently
     * polluting the "% tuyo" metric.
     */
    async appendAiAssistLog(args: {
        seedId: string;
        log: Omit<AiAssistLog, 'id' | 'seedId' | 'createdAt'>;
    }): Promise<void> {
        assertAiAssistAllowed(args.log.stepKey, args.log.assistType);
        await this.repo.appendAiAssistLog(args.seedId, args.log);
    }

    /**
     * Phase 1.6 (ADR-023) — runs the `verifyTimelessPrinciple` callable.
     * Lives here (not in the step component) so web pages stay free of
     * direct Firebase imports (architecture compliance gate).
     */
    async verifyTimelessPrinciple(input: VerifyPrincipleInput): Promise<PrincipleVerification> {
        const callable = httpsCallable(getFunctions(), 'verifyTimelessPrinciple');
        const response = await callable(input);
        const r = (response.data ?? {}) as Partial<PrincipleVerification>;
        return {
            grounding: String(r.grounding ?? ''),
            eisegesisRisk:
                r.eisegesisRisk === 'high' || r.eisegesisRisk === 'medium' ? r.eisegesisRisk : 'low',
            generalization:
                r.generalization === 'too-abstract' ||
                r.generalization === 'too-specific' ||
                r.generalization === 'well-calibrated'
                    ? r.generalization
                    : 'unknown',
            notes: String(r.notes ?? ''),
            verifiedAt: new Date(),
        };
    }

    /**
     * Phase 1.6 (ADR-024) — retrieves historical-cultural background via
     * RAG over CORE sources (ruta C). Degrades to `[]` when no content is
     * ingested yet; never invents a citation.
     */
    async retrieveHistoricalContext(passage: string): Promise<HistoricalContextChunk[]> {
        const callable = httpsCallable(getFunctions(), 'retrieveChunks');
        const response = await callable({
            query: `Trasfondo histórico-cultural de ${passage}`,
            stores: ['core'],
            topK: 4,
        });
        const data = (response.data ?? {}) as {
            chunks?: Array<{ text?: string; source?: string; resourceTitle?: string }>;
        };
        return (data.chunks ?? [])
            .map((c) => ({
                text: String(c.text ?? ''),
                source: String(c.source ?? c.resourceTitle ?? 'Fuente'),
            }))
            .filter((c) => c.text.trim().length > 0);
    }

    /**
     * Phase 2.5 (ADR-025) — compute the Study Companion coverage model from
     * the pastor's seed (structured evidence) + persisted manual overrides.
     * Pure; re-exported so the hook doesn't import domain + service both.
     */
    computeStudyDepth(seed: PastoralSeed, overrides: DimensionOverrides = {}): StudyDepthAssessment {
        return computeStudyDepthFromSeed(seed, overrides);
    }

    /** Phase 2.5 (ADR-027) — read persisted per-dim manual overrides. */
    async getStudyDepthOverrides(seedId: string): Promise<DimensionOverrides> {
        return this.repo.getStudyDepthOverrides(seedId);
    }

    /** Phase 2.5 (ADR-027) — set/clear one dimension's manual override. */
    async setStudyDepthOverride(
        seedId: string,
        dimensionId: string,
        pastorMarkedComplete: boolean,
    ): Promise<void> {
        await this.repo.setStudyDepthOverride(seedId, dimensionId, pastorMarkedComplete);
    }

    /**
     * Phase 2.5 Tier 3 (proposal `structural-puzzle-tier3.md`) — runs the
     * `buildStructuralPuzzle` callable. Returns clauses + canonical roles +
     * Socratic hints. Lives here so web pages stay free of
     * `firebase/functions` imports (compliance gate).
     */
    async buildStructuralPuzzle(input: BuildStructuralPuzzleInput): Promise<StructuralPuzzle> {
        const callable = httpsCallable(getFunctions(), 'buildStructuralPuzzle');
        const response = await callable(input);
        const data = (response.data ?? {}) as Partial<StructuralPuzzle>;
        if (!Array.isArray(data.clauses) || data.clauses.length === 0) {
            throw new Error('El puzzle no devolvió cláusulas.');
        }
        return {
            clauses: data.clauses,
            mainClauseId: String(data.mainClauseId ?? data.clauses[0]?.id ?? ''),
            roles: (data.roles ?? {}) as Record<string, StructuralPuzzleRole>,
            hints: (data.hints ?? {}) as Record<string, string>,
        };
    }

    /**
     * Phase 2.5 (ADR-026) — runs the `orientStudy` callable (Study Companion,
     * Moment 1). Lives here so web pages stay free of `firebase/functions`
     * imports (compliance gate). Verifier-orienter — the callable never
     * writes the pastor's answer.
     */
    async orientStudy(input: OrientStudyInput): Promise<StepOrientation> {
        const callable = httpsCallable(getFunctions(), 'orientStudy');
        const response = await callable(input);
        const r = (response.data ?? {}) as Partial<StepOrientation>;
        const out: StepOrientation = {
            data: Array.isArray(r.data) ? r.data.map(String) : [],
            questions: Array.isArray(r.questions) ? r.questions.map(String) : [],
        };
        if (r.confrontation) out.confrontation = String(r.confrontation);
        if (r.caution) out.caution = String(r.caution);
        if (r.example) out.example = String(r.example);
        return out;
    }

    /**
     * Convenience evaluation for code paths that already hold the seed
     * (gate hook, audit panel, prompt builder). Re-exports the pure
     * function from the domain so callers don't need to import both.
     */
    evaluate(seed: PastoralSeed): PastoralSeedEvaluation {
        return evaluatePastoralSeed(seed);
    }

    /** Stable step order — re-exported for breadcrumb consumers. */
    static stepOrder(): readonly PastoralSeedStepKey[] {
        return PASTORAL_SEED_STEP_ORDER;
    }
}

export const pastoralSeedService = new PastoralSeedService(new FirestorePastoralSeedRepository());
