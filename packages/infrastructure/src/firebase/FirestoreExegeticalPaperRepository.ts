import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    runTransaction,
    type DocumentData,
    } from 'firebase/firestore';
import { getFunctions,
    httpsCallable } from 'firebase/functions';
import { db } from '../config/firebase';
import type {
    ExegeticalPaper,
    ExegeticalPaperDraft,
    ExegeticalPaperPhase,
    ExegeticalStep,
    ExegeticalStepKind,
    ExegeticalStepState,
    ExegeticalStepVersion,
    ExegesisPaperSummary,
    IExegeticalPaperRepository,
    PaperRubric,
    ProjectSource,
    SheetRange,
    ProjectSourceExcerpt,
    SourceType,
    StepSourcePlan,
    VerificationSummary,
} from '@dosfilos/domain';
import { DEFAULT_STRATEGY_FOR_NEW_PAPER, resolveExegeticalStrategy } from '@dosfilos/domain';
import {
    EMPTY_STEP_SOURCE_PLAN,
    EMPTY_VERIFICATION_SUMMARY,
    buildDefaultRubric,
    migrateLegacyRole,
} from '@dosfilos/domain';

/**
 * Firestore implementation of `IExegeticalPaperRepository`.
 *
 * Document layout:
 *   exegeticalPapers/{paperId}                ← top-level
 *     - ownerId, passage, displayLanguage, title, styleGuideId
 *     - phase, currentStepId, assembledMarkdown, archivedAt
 *     - createdAt, updatedAt (Firestore Timestamps)
 *     - sources: ProjectSource[]              ← stored inline (small,
 *                                               always loaded with paper)
 *     - steps:   ExegeticalStep[]             ← stored inline (small in
 *                                               v1; if step versions grow
 *                                               unbounded later, split to
 *                                               a subcollection)
 *
 * The inline-array decision is deliberate for v1: an exegetical paper has
 * O(passage-verse-count + 3) steps (typically <30) and one accepted version
 * per step at any point. Document size stays well under the 1 MiB limit.
 * Splitting to subcollections costs us atomic reads of "the whole paper"
 * which the wizard relies on. We can shard later if needed.
 *
 * v1 implements only the methods the setup wizard and list page use:
 * paper CRUD + archive. Step and source mutations exist as 'not implemented'
 * stubs that throw — they're filled in as the wizard grows beyond setup.
 */
export class FirestoreExegeticalPaperRepository implements IExegeticalPaperRepository {
    private collectionRef() {
        return collection(db, 'exegeticalPapers');
    }

    private docRef(paperId: string) {
        return doc(db, 'exegeticalPapers', paperId);
    }

    // ── Papers ────────────────────────────────────────────────────────────

    async listPapers(ownerId: string): Promise<ExegeticalPaper[]> {
        const q = query(
            this.collectionRef(),
            where('ownerId', '==', ownerId)
            // orderBy intentionally omitted — sorting is client-side to avoid
            // requiring a composite index for what is a small list per user.
        );
        const snap = await getDocs(q);
        return snap.docs
            .map(d => deserialize(d.id, d.data()))
            .filter(p => p.archivedAt === null)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async listAllPapers(ownerId: string): Promise<ExegeticalPaper[]> {
        const q = query(this.collectionRef(), where('ownerId', '==', ownerId));
        const snap = await getDocs(q);
        return snap.docs
            .map(d => deserialize(d.id, d.data()))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    /**
     * Trimmed list read — delegates to the `getExegesisPapersSummary` callable,
     * which reads server-side and drops the heavy `steps`/`assembledMarkdown`/
     * `sources` (computing the counts the list shows). Sorted by `updatedAt`
     * desc client-side, matching `listPapers`. Includes archived (the list
     * filters them).
     */
    async listPaperSummaries(ownerId: string): Promise<ExegesisPaperSummary[]> {
        const callable = httpsCallable<Record<string, never>, { papers: any[] }>(
            getFunctions(),
            'getExegesisPapersSummary',
        );
        const res = await callable({});
        return (res.data.papers ?? [])
            .map((p: any): ExegesisPaperSummary => ({
                id: p.id,
                title: p.title,
                passage: p.passage,
                displayLanguage: p.displayLanguage === 'en' ? 'en' : 'es',
                phase: p.phase,
                archivedAt: typeof p.archivedAt === 'number' ? new Date(p.archivedAt) : null,
                createdAt: new Date(p.createdAt),
                updatedAt: new Date(p.updatedAt),
                assignmentBrief: typeof p.assignmentBrief === 'string' ? p.assignmentBrief : null,
                stepCount: p.stepCount ?? 0,
                acceptedStepCount: p.acceptedStepCount ?? 0,
                sourceCount: p.sourceCount ?? 0,
            }))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getPaper(ownerId: string, paperId: string): Promise<ExegeticalPaper | null> {
        const snap = await getDoc(this.docRef(paperId));
        if (!snap.exists()) return null;
        const paper = deserialize(snap.id, snap.data());
        // Defense in depth: enforce ownership at the repo even though
        // Firestore rules also do. A hand-crafted client could try to read
        // with the wrong uid; we double-check.
        if (paper.ownerId !== ownerId) return null;
        return paper;
    }

    async createPaper(draft: ExegeticalPaperDraft): Promise<ExegeticalPaper> {
        const ref = doc(this.collectionRef());
        const now = new Date();
        // Default rubric and empty plan are applied here — the setup UI's
        // sub-steps overwrite them once the student uploads a real rubric
        // and configures the per-step plan. Generating against the default
        // is allowed but the UI nudges the student to confirm first.
        const defaultRubric = buildDefaultRubric();
        const paper: ExegeticalPaper = {
            id: ref.id,
            ownerId: draft.ownerId,
            createdAt: now,
            updatedAt: now,
            passage: draft.passage,
            displayLanguage: draft.displayLanguage,
            // New papers default to dialectical methodology — the
            // differentiator pitch hinges on guided strategy. Caller
            // can override at create time (the create UI surfaces the
            // choice). Pre-strategy docs that get re-saved through
            // this path will inherit the field naturally.
            exegeticalStrategy: draft.exegeticalStrategy ?? DEFAULT_STRATEGY_FOR_NEW_PAPER,
            title: draft.title,
            assignmentBrief: draft.assignmentBrief ?? null,
            styleGuideId: draft.styleGuideId,
            sources: draft.sources,
            rubric: defaultRubric,
            // Phase 2B: seed the paper-level field from the same
            // default the rubric carries. The chokepoint helper now
            // prefers this top-level field; the rubric copy stays for
            // back-compat reads.
            structuralExpectations: defaultRubric.structuralExpectations,
            stepPlan: { ...EMPTY_STEP_SOURCE_PLAN, updatedAt: now },
            phase: 'configuring',
            steps: [],
            currentStepId: null,
            assembledMarkdown: null,
            archivedAt: null,
            seriesId: draft.seriesId ?? null,
            pericopeId: draft.pericopeId ?? null,
        };
        await setDoc(ref, serialize(paper));
        return paper;
    }

    async updatePaper(
        ownerId: string,
        paperId: string,
        patch: Partial<Pick<ExegeticalPaper, 'title' | 'displayLanguage' | 'styleGuideId' | 'currentStepId' | 'assembledMarkdown'>>
    ): Promise<ExegeticalPaper> {
        await this.requireOwned(ownerId, paperId);
        // Strip undefined — Firestore rejects undefined values; null is fine.
        const clean = Object.fromEntries(
            Object.entries(patch).filter(([, v]) => v !== undefined)
        );
        await updateDoc(this.docRef(paperId), { ...clean, updatedAt: new Date() });
        const fresh = await this.getPaper(ownerId, paperId);
        if (!fresh) throw new Error(`Paper ${paperId} not found after update`);
        return fresh;
    }

    async setPhase(ownerId: string, paperId: string, phase: ExegeticalPaperPhase): Promise<ExegeticalPaper> {
        await this.requireOwned(ownerId, paperId);
        await updateDoc(this.docRef(paperId), { phase, updatedAt: new Date() });
        const fresh = await this.getPaper(ownerId, paperId);
        if (!fresh) throw new Error(`Paper ${paperId} not found after setPhase`);
        return fresh;
    }

    async setStepPlan(ownerId: string, paperId: string, plan: StepSourcePlan): Promise<ExegeticalPaper> {
        await this.requireOwned(ownerId, paperId);
        const now = new Date();
        await updateDoc(this.docRef(paperId), {
            stepPlan: { ...plan, updatedAt: now },
            updatedAt: now,
        });
        const fresh = await this.getPaper(ownerId, paperId);
        if (!fresh) throw new Error(`Paper ${paperId} not found after setStepPlan`);
        return fresh;
    }

    async setRubric(ownerId: string, paperId: string, rubric: PaperRubric | null): Promise<ExegeticalPaper> {
        await this.requireOwned(ownerId, paperId);
        const now = new Date();
        // When clearing the rubric we explicitly write null (Firestore
        // accepts null but rejects undefined). When saving, stamp
        // updatedAt on the rubric so the UI surfaces a "last edited"
        // hint without us having to track it elsewhere.
        //
        // Phase 2B dual-write: paper.structuralExpectations mirrors
        // rubric.structuralExpectations so the chokepoint helper's
        // paper-level read returns fresh data without legacy callers
        // needing to learn the new field name. On clear we leave the
        // paper-level field as-is — losing it would force a fall back
        // to the system default, but the student probably wanted to
        // retain their structure even after dropping the rubric.
        const payload = rubric === null
            ? { rubric: null, updatedAt: now }
            : {
                rubric: { ...rubric, updatedAt: now },
                structuralExpectations: rubric.structuralExpectations,
                updatedAt: now,
            };
        await updateDoc(this.docRef(paperId), payload);
        const fresh = await this.getPaper(ownerId, paperId);
        if (!fresh) throw new Error(`Paper ${paperId} not found after setRubric`);
        return fresh;
    }

    async archivePaper(ownerId: string, paperId: string): Promise<ExegeticalPaper> {
        await this.requireOwned(ownerId, paperId);
        await updateDoc(this.docRef(paperId), {
            archivedAt: new Date(),
            updatedAt: new Date(),
        });
        const fresh = await this.getPaper(ownerId, paperId);
        if (!fresh) throw new Error(`Paper ${paperId} not found after archive`);
        return fresh;
    }

    async unarchivePaper(ownerId: string, paperId: string): Promise<ExegeticalPaper> {
        await this.requireOwned(ownerId, paperId);
        await updateDoc(this.docRef(paperId), {
            archivedAt: null,
            updatedAt: new Date(),
        });
        const fresh = await this.getPaper(ownerId, paperId);
        if (!fresh) throw new Error(`Paper ${paperId} not found after unarchive`);
        return fresh;
    }

    async hardDeletePaper(ownerId: string, paperId: string): Promise<void> {
        await this.requireOwned(ownerId, paperId);
        await deleteDoc(this.docRef(paperId));
    }

    // ── Sources ───────────────────────────────────────────────────────────
    //
    // Sources are stored inline in `paper.sources`. Mutations run inside a
    // Firestore transaction so two tabs of the same user adding sources at
    // the same time can't lose writes (read-modify-write race). Owner check
    // happens inside the transaction against `data.ownerId`.

    async addSource(
        ownerId: string,
        paperId: string,
        source: Omit<ProjectSource, 'id' | 'paperId' | 'createdAt'>
    ): Promise<ProjectSource> {
        const ref = this.docRef(paperId);
        const newSource: ProjectSource = {
            id: crypto.randomUUID(),
            paperId,
            createdAt: new Date(),
            corpusId: source.corpusId,
            sourceType: source.sourceType,
            chosenRole: source.chosenRole ?? null,
            displayLabel: source.displayLabel,
            citationKey: source.citationKey,
            order: source.order,
            excerptSelectionMode: source.excerptSelectionMode ?? null,
            excerptRecipe: source.excerptRecipe ?? null,
            // v1.5 fields. Defaults match the historical 'full-document'
            // behavior so existing callers (CorpusSubStep direct upload)
            // keep working without changes.
            mode: source.mode ?? 'full-document',
            excerpts: source.excerpts ?? [],
            sourceLibraryResourceId: source.sourceLibraryResourceId ?? null,
            extractedAt: source.extractedAt ?? null,
            extractionFingerprint: source.extractionFingerprint ?? null,
        };

        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                throw new Error(`Paper ${paperId} not found`);
            }
            const data = snap.data();
            if (data.ownerId !== ownerId) {
                throw new Error(`Paper ${paperId} not owned by ${ownerId}`);
            }
            const sources: ProjectSource[] = Array.isArray(data.sources) ? data.sources : [];
            // Serialize through the helper to flatten Date fields and
            // strip any inadvertent undefineds — Firestore rejects
            // undefined and the new excerpts can carry editedAt: Date.
            sources.push(serializeSource(newSource) as unknown as ProjectSource);
            tx.update(ref, {
                sources,
                updatedAt: new Date(),
            });
        });

        return newSource;
    }

    async updateSource(
        ownerId: string,
        paperId: string,
        sourceId: string,
        patch: Partial<Pick<ProjectSource, 'sourceType' | 'chosenRole' | 'displayLabel' | 'citationKey' | 'order' | 'excerpts' | 'excerptSelectionMode' | 'excerptRecipe' | 'extractedAt' | 'extractionFingerprint'>>
    ): Promise<ProjectSource> {
        const ref = this.docRef(paperId);
        let updated: ProjectSource | null = null;

        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                throw new Error(`Paper ${paperId} not found`);
            }
            const data = snap.data();
            if (data.ownerId !== ownerId) {
                throw new Error(`Paper ${paperId} not owned by ${ownerId}`);
            }
            const sources: any[] = Array.isArray(data.sources) ? [...data.sources] : [];
            const idx = sources.findIndex((s: any) => s.id === sourceId);
            if (idx === -1) {
                throw new Error(`Source ${sourceId} not found in paper ${paperId}`);
            }
            // Deserialize the existing entry first so the merged
            // ProjectSource is well-typed (handles legacy docs without
            // the v1.5 fields).
            const existing = deserializeSource(sources[idx]);
            // Only apply defined keys — undefined would erase the existing value.
            const merged: ProjectSource = { ...existing };
            if (patch.sourceType !== undefined) merged.sourceType = patch.sourceType;
            if (patch.chosenRole !== undefined) merged.chosenRole = patch.chosenRole;
            if (patch.displayLabel !== undefined) merged.displayLabel = patch.displayLabel;
            if (patch.citationKey !== undefined) merged.citationKey = patch.citationKey;
            if (patch.order !== undefined) merged.order = patch.order;
            if (patch.excerpts !== undefined) merged.excerpts = patch.excerpts;
            if (patch.extractedAt !== undefined) merged.extractedAt = patch.extractedAt;
            if (patch.extractionFingerprint !== undefined) merged.extractionFingerprint = patch.extractionFingerprint;
            sources[idx] = serializeSource(merged);
            updated = merged;
            tx.update(ref, {
                sources,
                updatedAt: new Date(),
            });
        });

        if (!updated) throw new Error('Source update failed');
        return updated;
    }

    async removeSource(ownerId: string, paperId: string, sourceId: string): Promise<void> {
        const ref = this.docRef(paperId);

        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                throw new Error(`Paper ${paperId} not found`);
            }
            const data = snap.data();
            if (data.ownerId !== ownerId) {
                throw new Error(`Paper ${paperId} not owned by ${ownerId}`);
            }
            const sources: ProjectSource[] = Array.isArray(data.sources) ? data.sources : [];
            const filtered = sources.filter(s => s.id !== sourceId);
            tx.update(ref, {
                sources: filtered,
                updatedAt: new Date(),
            });
        });
    }

    // ── Steps ─────────────────────────────────────────────────────────────
    //
    // Steps live inline on the paper (`paper.steps`). Mutations run inside
    // a Firestore transaction so concurrent updates from the same user
    // (e.g. accepting one step while a regen of another finishes) can't
    // corrupt the array via read-modify-write races.

    async seedStepsForPassage(ownerId: string, paperId: string): Promise<ExegeticalStep[]> {
        const ref = this.docRef(paperId);
        let result: ExegeticalStep[] = [];

        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                throw new Error(`Paper ${paperId} not found`);
            }
            const data = snap.data();
            if (data.ownerId !== ownerId) {
                throw new Error(`Paper ${paperId} not owned by ${ownerId}`);
            }

            const existing: ExegeticalStep[] = Array.isArray(data.steps) ? data.steps : [];
            // Idempotent: if any step exists, return existing untouched.
            if (existing.length > 0) {
                result = existing;
                return;
            }

            // Compute the verse list. v1 supports only single-chapter
            // passages with explicit verses — multi-chapter and chapter-
            // only ranges throw with a clear message so the UI can
            // render a hint instead of silently doing nothing weird.
            const passage = data.passage;
            if (!passage) {
                throw new Error('Paper has no passage');
            }
            if (passage.chapterStart !== passage.chapterEnd) {
                throw new Error(
                    'v1 only supports single-chapter passages. Edit the passage to a single-chapter range before generating.'
                );
            }
            if (passage.verseStart === null || passage.verseEnd === null) {
                throw new Error(
                    'v1 requires explicit verses. Edit the passage to include verse start/end before generating.'
                );
            }

            const newSteps: ExegeticalStep[] = [];
            const now = new Date();

            // One step per verse, then conclusion, introduction, assembly.
            // Order matches the wizard flow: verses are written first,
            // conclusion second, introduction third (sees the body), and
            // assembly mechanically concatenates with the introduction
            // surfaced FIRST in the assembled output (TMS convention).
            for (let v = passage.verseStart; v <= passage.verseEnd; v++) {
                newSteps.push(buildStep({
                    paperId,
                    kind: 'verse',
                    order: newSteps.length + 1,
                    now,
                    verseRef: {
                        bookId: passage.bookId,
                        chapterStart: passage.chapterStart,
                        chapterEnd: passage.chapterStart,
                        verseStart: v,
                        verseEnd: v,
                    },
                }));
            }
            newSteps.push(buildStep({ paperId, kind: 'conclusion', order: newSteps.length + 1, now }));
            newSteps.push(buildStep({ paperId, kind: 'introduction', order: newSteps.length + 1, now }));
            newSteps.push(buildStep({ paperId, kind: 'assembly', order: newSteps.length + 1, now }));

            tx.update(ref, {
                steps: newSteps,
                phase: 'in-progress',
                currentStepId: newSteps[0]!.id,
                updatedAt: now,
            });
            result = newSteps;
        });

        return result;
    }

    async setStepState(
        ownerId: string,
        paperId: string,
        stepId: string,
        state: ExegeticalStepState
    ): Promise<ExegeticalStep> {
        return this.mutateStep(ownerId, paperId, stepId, (step) => {
            step.state = state;
            step.updatedAt = new Date();
            return step;
        });
    }

    async appendStepVersion(
        ownerId: string,
        paperId: string,
        stepId: string,
        version: Omit<ExegeticalStepVersion, 'id' | 'createdAt'>
    ): Promise<ExegeticalStepVersion> {
        const fullVersion: ExegeticalStepVersion = {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            markdown: version.markdown,
            origin: version.origin,
            parentVersionId: version.parentVersionId,
            modelId: version.modelId,
            regenerationHint: version.regenerationHint,
            tokensUsed: version.tokensUsed,
            verifications: version.verifications,
        };
        // Only attach `canonicalAnalysis` when the caller produced one
        // (the new analysis pipeline). Firestore rejects `undefined`,
        // so legacy `GenerateStepUseCase` callers continue to omit the
        // field cleanly. The structured payload includes its own
        // Date fields (createdAt/updatedAt) which Firestore converts
        // to Timestamp on write — auto-conversion is fine here because
        // the downstream `*.toDate?.()` pattern handles either shape.
        if (version.canonicalAnalysis) {
            fullVersion.canonicalAnalysis = version.canonicalAnalysis;
        }

        await this.mutateStep(ownerId, paperId, stepId, (step) => {
            step.versions = [...step.versions, fullVersion];
            step.current = fullVersion;
            step.state = 'awaiting-review';
            step.updatedAt = new Date();
            return step;
        });

        return fullVersion;
    }

    /**
     * Reabre un paso aceptado. Las versiones quedan; solo se suelta cuál era la
     * aceptada y el estado vuelve a revisión —o a pendiente si nunca hubo
     * versiones, que es el caso de un paso aceptado a mano sin generar.
     */
    async reopenStep(ownerId: string, paperId: string, stepId: string): Promise<ExegeticalStep> {
        return this.mutateStep(ownerId, paperId, stepId, (step) => {
            step.accepted = null;
            step.state = step.versions.length > 0 ? 'awaiting-review' : 'pending';
            step.updatedAt = new Date();
            return step;
        });
    }

    async acceptStepVersion(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string
    ): Promise<ExegeticalStep> {
        return this.mutateStep(ownerId, paperId, stepId, (step) => {
            const target = step.versions.find(v => v.id === versionId);
            if (!target) {
                throw new Error(`Version ${versionId} not found in step ${stepId}`);
            }
            step.accepted = target;
            step.state = 'accepted';
            step.updatedAt = new Date();
            return step;
        });
    }

    async saveManualEdit(
        ownerId: string,
        paperId: string,
        stepId: string,
        markdown: string
    ): Promise<ExegeticalStep> {
        const editVersion: ExegeticalStepVersion = {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            markdown,
            origin: 'edited',
            parentVersionId: null, // filled inside mutateStep using step.accepted
            modelId: null,
            regenerationHint: null,
            tokensUsed: null,
            verifications: { ...EMPTY_VERIFICATION_SUMMARY },
        };

        return this.mutateStep(ownerId, paperId, stepId, (step) => {
            // Edits are anchored to whatever was previously accepted (or
            // current, as a fallback). Resets verifications: per the
            // user's request, edits do NOT auto-re-run verification —
            // they show as 'manualPending' instead until the user
            // explicitly clicks "verify".
            const parent = step.accepted ?? step.current;
            const versioned: ExegeticalStepVersion = {
                ...editVersion,
                parentVersionId: parent?.id ?? null,
            };
            step.versions = [...step.versions, versioned];
            step.accepted = versioned;
            // State stays 'accepted' if it was already; if it was
            // 'awaiting-review' or earlier and the user manually edits,
            // we count that as an implicit accept of the manual content.
            step.state = 'accepted';
            step.updatedAt = new Date();
            return step;
        });
    }

    async setStepVersionVerifications(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string,
        verifications: VerificationSummary
    ): Promise<ExegeticalStepVersion> {
        let updatedVersion: ExegeticalStepVersion | null = null;
        await this.mutateStep(ownerId, paperId, stepId, (step) => {
            const idx = step.versions.findIndex(v => v.id === versionId);
            if (idx === -1) {
                throw new Error(`Version ${versionId} not found in step ${stepId}`);
            }
            const next: ExegeticalStepVersion = {
                ...step.versions[idx]!,
                verifications,
            };
            const versions = [...step.versions];
            versions[idx] = next;
            step.versions = versions;
            // Keep `current` and `accepted` references in sync so the
            // UI (which reads from either) sees fresh counts immediately.
            if (step.current?.id === versionId) step.current = next;
            if (step.accepted?.id === versionId) step.accepted = next;
            step.updatedAt = new Date();
            updatedVersion = next;
            return step;
        });
        if (!updatedVersion) throw new Error('Verification mutation produced no result');
        return updatedVersion;
    }

    async setStepVersionMarkdown(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string,
        markdown: string
    ): Promise<ExegeticalStepVersion> {
        let updatedVersion: ExegeticalStepVersion | null = null;
        await this.mutateStep(ownerId, paperId, stepId, (step) => {
            const idx = step.versions.findIndex(v => v.id === versionId);
            if (idx === -1) {
                throw new Error(`Version ${versionId} not found in step ${stepId}`);
            }
            const next: ExegeticalStepVersion = {
                ...step.versions[idx]!,
                markdown,
            };
            const versions = [...step.versions];
            versions[idx] = next;
            step.versions = versions;
            if (step.current?.id === versionId) step.current = next;
            if (step.accepted?.id === versionId) step.accepted = next;
            step.updatedAt = new Date();
            updatedVersion = next;
            return step;
        });
        if (!updatedVersion) throw new Error('Markdown mutation produced no result');
        return updatedVersion;
    }

    /**
     * Generic step mutator: reads the paper, finds the step by id,
     * applies the mutator, writes back. Wrapped in a transaction so the
     * read-modify-write doesn't race with concurrent step changes.
     */
    private async mutateStep(
        ownerId: string,
        paperId: string,
        stepId: string,
        mutator: (step: ExegeticalStep) => ExegeticalStep
    ): Promise<ExegeticalStep> {
        const ref = this.docRef(paperId);
        let updatedStep: ExegeticalStep | null = null;

        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                throw new Error(`Paper ${paperId} not found`);
            }
            const data = snap.data();
            if (data.ownerId !== ownerId) {
                throw new Error(`Paper ${paperId} not owned by ${ownerId}`);
            }
            const steps: ExegeticalStep[] = Array.isArray(data.steps) ? [...data.steps] : [];
            const idx = steps.findIndex(s => s.id === stepId);
            if (idx === -1) {
                throw new Error(`Step ${stepId} not found in paper ${paperId}`);
            }
            const next = mutator({ ...steps[idx]! });
            steps[idx] = next;
            updatedStep = next;
            tx.update(ref, { steps, updatedAt: new Date() });
        });

        if (!updatedStep) throw new Error('Step mutation produced no result');
        return updatedStep;
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private async requireOwned(ownerId: string, paperId: string): Promise<void> {
        const paper = await this.getPaper(ownerId, paperId);
        if (!paper) {
            throw new Error(`Paper ${paperId} not found or not owned by ${ownerId}`);
        }
    }
}

// ── Serialization ───────────────────────────────────────────────────────
//
// Firestore stores `Date` as Timestamp and rejects `undefined`. We convert
// in/out at the boundary so the rest of the app works with native `Date`
// and `null` (which Firestore handles).

function serialize(paper: ExegeticalPaper): DocumentData {
    const data: DocumentData = {
        ownerId: paper.ownerId,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
        passage: paper.passage,
        displayLanguage: paper.displayLanguage,
        styleGuideId: paper.styleGuideId,
        assignmentBrief: paper.assignmentBrief,
        sources: paper.sources.map(serializeSource),
        rubric: paper.rubric,
        stepPlan: paper.stepPlan,
        phase: paper.phase,
        steps: paper.steps,
        currentStepId: paper.currentStepId,
        assembledMarkdown: paper.assembledMarkdown,
        archivedAt: paper.archivedAt,
    };
    if (paper.title !== undefined) data.title = paper.title;
    if (paper.exegeticalStrategy !== undefined) data.exegeticalStrategy = paper.exegeticalStrategy;
    if (paper.structuralExpectations !== undefined) {
        data.structuralExpectations = paper.structuralExpectations;
    }
    if (paper.seriesId !== undefined) data.seriesId = paper.seriesId;
    if (paper.pericopeId !== undefined) data.pericopeId = paper.pericopeId;
    return data;
}

function deserialize(id: string, data: DocumentData): ExegeticalPaper {
    return {
        id,
        ownerId: data.ownerId,
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt ?? new Date(),
        passage: data.passage,
        displayLanguage: data.displayLanguage ?? 'es',
        // Pre-strategy papers default to 'free' so we don't suddenly
        // bug-banner about missing dialectical roles on existing work.
        // New papers always carry an explicit value.
        exegeticalStrategy: resolveExegeticalStrategy(data.exegeticalStrategy),
        title: data.title,
        assignmentBrief: data.assignmentBrief ?? null,
        styleGuideId: data.styleGuideId ?? null,
        // La copia de la guía. `capturedAt` viaja como Timestamp y hay
        // que devolverlo a Date: la interfaz lo muestra como fecha.
        // Ausente en los papers anteriores a la copia — ahí se resuelve
        // contra la guía viva.
        styleGuideSnapshot: data.styleGuideSnapshot
            ? {
                ...data.styleGuideSnapshot,
                capturedAt: data.styleGuideSnapshot.capturedAt?.toDate?.()
                    ?? data.styleGuideSnapshot.capturedAt
                    ?? new Date(),
            }
            : null,
        sources: Array.isArray(data.sources) ? data.sources.map(deserializeSource) : [],
        rubric: data.rubric ? deserializeRubric(data.rubric) : null,
        // Phase 2B paper-level field. Legacy papers don't carry it
        // (the helper falls back to rubric.structuralExpectations).
        // Read as-is so downstream code can detect `undefined` and
        // route through `getEffectiveStructuralExpectations`.
        structuralExpectations: Array.isArray(data.structuralExpectations)
            ? data.structuralExpectations
            : undefined,
        stepPlan: deserializeStepPlan(data.stepPlan),
        phase: data.phase ?? 'configuring',
        steps: Array.isArray(data.steps) ? data.steps.map(deserializeStep) : [],
        currentStepId: data.currentStepId ?? null,
        assembledMarkdown: data.assembledMarkdown ?? null,
        archivedAt: data.archivedAt?.toDate?.() ?? data.archivedAt ?? null,
        seriesId: typeof data.seriesId === 'string' ? data.seriesId : null,
        pericopeId: typeof data.pericopeId === 'string' ? data.pericopeId : null,
    };
}

/**
 * Source-level deserializer that handles the legacy `role` field. Pre-
 * redesign documents stored `role: ProjectSourceRole` (8 flat values);
 * the redesign uses `sourceType: SourceType` (13 granular values). Any
 * doc that still carries the old field is migrated transparently here.
 *
 * Once all in-flight test papers have been read at least once (and re-
 * saved by any subsequent mutation), the legacy field will disappear
 * and this shim becomes a no-op. Keep it indefinitely as a safety net.
 */
/**
 * Lee la receta del selector de páginas desde Firestore.
 *
 * Defensivo a propósito: los rangos vienen de un documento que puede haber
 * sido escrito por una versión anterior o quedar a medio migrar, y una receta
 * malformada no debe tumbar la lectura del paper entero — se descarta y la
 * fuente queda como si nunca se hubiera armado con el selector.
 */
function deserializeRecipe(raw: any): ProjectSource['excerptRecipe'] {
    if (!raw || typeof raw !== 'object') return null;
    const ranges = (value: unknown): SheetRange[] =>
        Array.isArray(value)
            ? value
                .filter((r: any) => r && Number.isFinite(r.start) && Number.isFinite(r.end))
                .map((r: any) => ({ start: Number(r.start), end: Number(r.end) }))
            : [];
    const sheetRanges = ranges(raw.sheetRanges);
    if (sheetRanges.length === 0) return null;
    return {
        sheetRanges,
        proposedRanges: ranges(raw.proposedRanges),
        // Las recetas anteriores a los tramos fijados no traen el campo: sin
        // fijados, todo compite en el ranking, que es el comportamiento previo.
        pinnedRanges: ranges(raw.pinnedRanges),
        passageFingerprint: typeof raw.passageFingerprint === 'string' ? raw.passageFingerprint : '',
    };
}

function deserializeSource(raw: any): ProjectSource {
    const sourceType: SourceType = raw.sourceType
        ? raw.sourceType
        : migrateLegacyRole(raw.role ?? 'misc');
    return {
        id: raw.id,
        paperId: raw.paperId,
        corpusId: raw.corpusId,
        sourceType,
        // Ausente en las fuentes anteriores al campo: sin elección del
        // pastor, `resolveSourceRole` vuelve a la sugerencia del tipo y
        // se clasifican igual que siempre.
        chosenRole: raw.chosenRole ?? null,
        displayLabel: raw.displayLabel ?? '',
        citationKey: raw.citationKey ?? null,
        order: typeof raw.order === 'number' ? raw.order : 0,
        // Las fuentes extraídas antes de la selección estructural no
        // declaran cómo se eligieron sus fragmentos: quedan en null y la UI
        // no afirma nada sobre ellas.
        excerptSelectionMode: raw.excerptSelectionMode ?? null,
        // La receta solo existe en fuentes armadas con el selector de páginas.
        excerptRecipe: deserializeRecipe(raw.excerptRecipe),
        // v1.5 fields with retro-compat defaults. Pre-v1.5 docs have
        // none of these — they should keep behaving as 'full-document'
        // sources with no excerpts and no library backref.
        mode: raw.mode === 'extracted-excerpts' ? 'extracted-excerpts' : 'full-document',
        excerpts: Array.isArray(raw.excerpts) ? raw.excerpts.map(deserializeExcerpt) : [],
        sourceLibraryResourceId: raw.sourceLibraryResourceId ?? null,
        // v1.5.1 stale-detection fields. Null on pre-v1.5.1 sources;
        // the UI treats null fingerprint as "not stale" so legacy
        // excerpts don't suddenly bug-banner the user.
        extractedAt: raw.extractedAt?.toDate?.() ?? raw.extractedAt ?? null,
        extractionFingerprint: typeof raw.extractionFingerprint === 'string' ? raw.extractionFingerprint : null,
        createdAt: raw.createdAt?.toDate?.() ?? raw.createdAt ?? new Date(),
    };
}

/**
 * One excerpt deserializer. Mirrors `deserializeSource` for the
 * timestamp coercion. `editedAt` is intentionally null (not undefined)
 * for never-edited excerpts so consumers can rely on `=== null` checks
 * without worrying about the `undefined` case.
 */
function deserializeExcerpt(raw: any): ProjectSourceExcerpt {
    return {
        text: typeof raw?.text === 'string' ? raw.text : '',
        sourceLocation: typeof raw?.sourceLocation === 'string' ? raw.sourceLocation : '',
        relevanceScore: typeof raw?.relevanceScore === 'number' ? raw.relevanceScore : 0,
        userEdited: raw?.userEdited === true,
        editedAt: raw?.editedAt?.toDate?.() ?? raw?.editedAt ?? null,
        // Ausentes en todo extracto anterior al campo; ahí se sigue parseando
        // `sourceLocation`, que es lo que hace `relabelExcerptAnchor`.
        ...(typeof raw?.sheet === 'number' ? { sheet: raw.sheet } : {}),
        ...(typeof raw?.section === 'string' && raw.section ? { section: raw.section } : {}),
    };
}

/**
 * Forma escrita de una entidad: una clave por cada campo, sin excepción.
 *
 * El tipo existe para que agregar un campo a la entidad y olvidarse de
 * serializarlo NO compile. Antes esta función devolvía `DocumentData`, que
 * tiene índice libre, así que omitir un campo pasaba el compilador y el dato se
 * perdía en silencio al escribir — que es exactamente lo que pasó con
 * `excerptSelectionMode` y `excerptRecipe`: el badge del corpus nunca persistió
 * y nadie se enteró hasta mirar el documento en Firestore.
 */
type Serialized<T> = { [K in keyof Required<T>]: unknown };

/**
 * Mirror of `deserializeSource` for writes. Firestore rejects `undefined`
 * inside arrays, so this helper guarantees every field is a concrete
 * value (never undefined). Date fields are passed through unchanged —
 * the SDK converts them to Timestamps at write time. Used by `addSource`
 * and `updateSource` (and the global `serialize` indirectly via the
 * sources mapper) so the on-disk shape is always consistent.
 */
function serializeSource(source: ProjectSource): Serialized<ProjectSource> {
    return {
        id: source.id,
        paperId: source.paperId,
        corpusId: source.corpusId,
        sourceType: source.sourceType,
        chosenRole: source.chosenRole ?? null,
        displayLabel: source.displayLabel,
        citationKey: source.citationKey ?? null,
        order: source.order,
        mode: source.mode,
        excerpts: source.excerpts.map(serializeExcerpt),
        excerptSelectionMode: source.excerptSelectionMode ?? null,
        excerptRecipe: source.excerptRecipe
            ? {
                sheetRanges: source.excerptRecipe.sheetRanges.map(r => ({ start: r.start, end: r.end })),
                proposedRanges: source.excerptRecipe.proposedRanges.map(r => ({ start: r.start, end: r.end })),
                pinnedRanges: source.excerptRecipe.pinnedRanges.map(r => ({ start: r.start, end: r.end })),
                passageFingerprint: source.excerptRecipe.passageFingerprint,
            }
            : null,
        sourceLibraryResourceId: source.sourceLibraryResourceId ?? null,
        extractedAt: source.extractedAt ?? null,
        extractionFingerprint: source.extractionFingerprint ?? null,
        createdAt: source.createdAt,
    };
}

function serializeExcerpt(excerpt: ProjectSourceExcerpt): Serialized<ProjectSourceExcerpt> {
    return {
        text: excerpt.text,
        sourceLocation: excerpt.sourceLocation,
        relevanceScore: excerpt.relevanceScore,
        userEdited: excerpt.userEdited,
        editedAt: excerpt.editedAt ?? null,
        // La hoja y la sección van APARTE del rótulo ya formateado: quien cite
        // necesita el número para traducirlo a página impresa, no la cadena
        // «p. 47» que el extractor escribió cuando la numeración del recurso
        // todavía no existía. Firestore rechaza `undefined`, así que van null.
        sheet: excerpt.sheet ?? null,
        section: excerpt.section ?? null,
    };
}

/**
 * Deserializes a `PaperRubric` blob from Firestore. The structure is
 * preserved verbatim apart from the `Date` fields, which Firestore
 * serializes as Timestamps. Pre-redesign documents have no `rubric`
 * field; the caller skips this helper for those (passes `null` to the
 * `paper.rubric` slot).
 */
function deserializeRubric(raw: any): ExegeticalPaper['rubric'] {
    if (!raw) return null;
    return {
        provenance: raw.provenance ?? 'system-default',
        description: raw.description ?? null,
        expectedLength: raw.expectedLength ?? null,
        citationStandard: raw.citationStandard ?? null,
        sourceRequirements: Array.isArray(raw.sourceRequirements) ? raw.sourceRequirements : [],
        structuralExpectations: Array.isArray(raw.structuralExpectations) ? raw.structuralExpectations : [],
        qualityCriteria: Array.isArray(raw.qualityCriteria) ? raw.qualityCriteria : [],
        sourceCorpusId: raw.sourceCorpusId ?? null,
        sourcePastedText: raw.sourcePastedText ?? null,
        sourceTemplateId: raw.sourceTemplateId ?? null,
        createdAt: raw.createdAt?.toDate?.() ?? raw.createdAt ?? new Date(),
        updatedAt: raw.updatedAt?.toDate?.() ?? raw.updatedAt ?? new Date(),
    };
}

/**
 * Deserializes a `StepSourcePlan`. Defaults to the empty plan when
 * the document predates the redesign — generation against the empty
 * plan is identical to "use rubric defaults for everything".
 */
function deserializeStepPlan(raw: any): ExegeticalPaper['stepPlan'] {
    if (!raw) {
        return { ...EMPTY_STEP_SOURCE_PLAN, updatedAt: new Date() };
    }
    return {
        perStep: raw.perStep ?? {},
        defaults: {
            verse: raw.defaults?.verse ?? EMPTY_STEP_SOURCE_PLAN.defaults.verse,
            conclusion: raw.defaults?.conclusion ?? EMPTY_STEP_SOURCE_PLAN.defaults.conclusion,
            introduction: raw.defaults?.introduction ?? EMPTY_STEP_SOURCE_PLAN.defaults.introduction,
        },
        updatedAt: raw.updatedAt?.toDate?.() ?? raw.updatedAt ?? new Date(),
        // v1.7 corpus-usage planning. Without these the proposer's
        // save round-trips lose `proposedAt` → `hasProposal` stays
        // false → the planning table never renders after the user
        // clicks "Propose" (the bug surfaced in May 2026 testing).
        proposedAt: raw.proposedAt?.toDate?.() ?? raw.proposedAt ?? null,
        proposalCorpusSourceIds: Array.isArray(raw.proposalCorpusSourceIds)
            ? raw.proposalCorpusSourceIds.filter((id: unknown): id is string => typeof id === 'string')
            : undefined,
    };
}

/**
 * Constructs a fresh `ExegeticalStep` in 'pending' state with empty
 * version history. Used by `seedStepsForPassage` to build the initial
 * step list when the user starts generation.
 */
function buildStep(input: {
    paperId: string;
    kind: ExegeticalStepKind;
    order: number;
    now: Date;
    verseRef?: ExegeticalStep['verseRef'];
}): ExegeticalStep {
    return {
        id: crypto.randomUUID(),
        paperId: input.paperId,
        kind: input.kind,
        verseRef: input.verseRef ?? null,
        order: input.order,
        state: 'pending',
        current: null,
        accepted: null,
        versions: [],
        createdAt: input.now,
        updatedAt: input.now,
    };
}

/**
 * Normaliza las fechas de un paso.
 *
 * Los pasos se leían CRUDOS —`steps: data.steps`— y por eso `ExegeticalStep`
 * declaraba `createdAt: Date` mientras en ejecución llegaba un `Timestamp` de
 * Firestore. Nadie lo notó porque nadie tocaba esas fechas: el primer consumidor
 * real fue `isAbandonedGeneration`, que llamó `getTime()` —que `Timestamp` no
 * tiene— y quedó silenciosamente inerte. Es el mismo patrón del `author: string`
 * que en producción era null: el tipo decía una cosa y el dato decía otra.
 *
 * Se preserva el resto del paso con spread en vez de enumerar campos: un
 * whitelist acá borraría en silencio cualquier campo nuevo, que es exactamente
 * el fallo que `serializeSource` tuvo que resolver con tipos.
 */
function toDateOrNull(value: unknown): Date | null {
    if (!value) return null;
    const asTimestamp = value as { toDate?: () => Date };
    if (typeof asTimestamp.toDate === 'function') return asTimestamp.toDate();
    return value instanceof Date ? value : new Date(value as string | number);
}

/**
 * El texto en lengua original se llamó `greekText` hasta que el módulo empezó a
 * analizar el AT, y para entonces guardaba hebreo bajo un nombre que decía
 * griego. Todo análisis escrito antes del rename sigue en Firestore con el
 * nombre viejo, y son trabajos reales en curso: leerlos con el nombre nuevo los
 * dejaría sin texto base, en silencio y sin error.
 *
 * Se traduce al leer, y se borra el nombre viejo del objeto para que no vuelva
 * a escribirse: si sobreviviera al `...raw`, cada guardado posterior dejaría los
 * dos campos y no habría forma de saber cuál manda.
 */
function normalizeAnalysisTextField(analysis: any): any {
    if (!analysis || typeof analysis !== 'object') return analysis;
    if (!('greekText' in analysis)) return analysis;
    const { greekText, ...resto } = analysis;
    return { ...resto, originalText: resto.originalText ?? greekText ?? '' };
}

function deserializeStepVersion(raw: any): ExegeticalStepVersion {
    return {
        ...raw,
        canonicalAnalysis: normalizeAnalysisTextField(raw?.canonicalAnalysis),
        createdAt: toDateOrNull(raw?.createdAt) ?? new Date(),
        verifications: raw?.verifications
            ? { ...raw.verifications, lastRunAt: toDateOrNull(raw.verifications.lastRunAt) }
            : raw?.verifications ?? undefined,
    };
}

export function deserializeStep(raw: any): ExegeticalStep {
    return {
        ...raw,
        createdAt: toDateOrNull(raw?.createdAt) ?? new Date(),
        updatedAt: toDateOrNull(raw?.updatedAt) ?? new Date(),
        current: raw?.current ? deserializeStepVersion(raw.current) : null,
        accepted: raw?.accepted ? deserializeStepVersion(raw.accepted) : null,
        versions: Array.isArray(raw?.versions) ? raw.versions.map(deserializeStepVersion) : [],
    };
}
