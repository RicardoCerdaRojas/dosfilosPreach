import type { AiAssistLog } from '../entities/AiAssistLog';
import type { PastoralSeed } from '../entities/PastoralSeed';
import type { DimensionOverrides } from '../entities/StudyDepthAssessment';

/**
 * Reads + mutates pastoralSeeds documents. ADR-015 defines the storage
 * as the top-level collection `pastoralSeeds/{seedId}` keyed by an
 * auto-generated id; `sermonId` is the natural lookup field.
 *
 * The wizard autosaves via `update`; the inspector lists by `userId`.
 * Phase 5 will add a `listByProject(projectId)` method when the
 * `Project` entity lands — kept off the interface for now to avoid
 * forward-referencing a non-existent type.
 */
export interface IPastoralSeedRepository {
    /**
     * Returns the most recently updated seed for the given sermon.
     * The wizard treats sermons as 1:1 with seeds in Phase 1, but the
     * `orderBy updatedAt desc + limit 1` guards against duplicates that
     * could arise from a race during creation.
     *
     * `userId` NO ES OPCIONAL POR COMODIDAD. Las reglas de `pastoralSeeds`
     * acotan `list` al dueño, y Firestore no evalúa esa regla documento por
     * documento: exige que la CONSULTA esté probadamente acotada, así que sin
     * el filtro por `userId` la consulta se rechaza entera. Se omite sólo en
     * las superficies de auditoría (inspector, panel), donde el llamador es
     * super_admin, no conoce el uid del dueño, y pasa por la otra rama de la
     * regla. Cubierto en `tests/firestore-rules/pastoralSeeds.test.ts`.
     */
    findBySermonId(sermonId: string, opts?: { userId?: string }): Promise<PastoralSeed | null>;
    getById(seedId: string): Promise<PastoralSeed | null>;
    /**
     * Persists a freshly minted seed. Returns the same document with
     * server-assigned timestamps when the implementation uses
     * Firestore `serverTimestamp`.
     */
    create(seed: PastoralSeed): Promise<PastoralSeed>;
    /**
     * Partial update keyed by `seedId`. Only the supplied fields are
     * written; `updatedAt` is always bumped server-side.
     */
    update(seedId: string, patch: Partial<PastoralSeed>): Promise<void>;
    /**
     * Audit list — used by the admin inspector + future depth-of-study
     * metrics. Ordered by `updatedAt desc` so the most-recent work
     * surfaces first.
     */
    listByUserId(userId: string, opts?: { limit?: number }): Promise<PastoralSeed[]>;
    /**
     * Phase 1.6 (ADR-024) — append a first-class assist log to the seed's
     * `aiAssistLogs/{id}` subcollection. The caller has already validated
     * the step is allowed (`assertAiAssistAllowed`); `id` + `createdAt` are
     * assigned by the implementation.
     */
    appendAiAssistLog(
        seedId: string,
        log: Omit<AiAssistLog, 'id' | 'seedId' | 'createdAt'>,
    ): Promise<void>;
    /**
     * Audit read — lists assist logs for a seed, ordered by `createdAt`.
     * Used by the audit panel + the "% tuyo" rollup.
     */
    listAiAssistLogs(seedId: string): Promise<AiAssistLog[]>;
    /**
     * Phase 2.5 (ADR-025/027) — read the pastor's per-dimension manual
     * overrides ("marked complete"). Persisted at
     * `pastoralSeeds/{seedId}/studyDepth/current`. The displayed coverage is
     * `computeStudyDepthFromSeed(seed, overrides)` — overrides are the only
     * piece that is not recomputable from the seed in PR A. Returns `{}`
     * when no overrides have been set.
     */
    getStudyDepthOverrides(seedId: string): Promise<DimensionOverrides>;
    /**
     * Phase 2.5 (ADR-027) — set/clear a single dimension's manual override.
     * Audited upstream (the service writes the `AiAssistLog`-adjacent trail).
     */
    setStudyDepthOverride(
        seedId: string,
        dimensionId: string,
        pastorMarkedComplete: boolean,
    ): Promise<void>;
}
