import { FirebaseSermonRepository, AnalyticsService } from '@dosfilos/infrastructure';
import {
    SermonEntity,
    FindOptions,
    Sermon,
    evaluatePublishGate,
    FidelityGateError,
    evaluateContraScanGate,
    ContraScanGateError,
    publicationChange,
    PublicationUnchangedError,
    type PublicationChange,
    type GateOverride,
    type PublishOverrideInput,
    type ContraScanReport,
    type PastoralSeed,
} from '@dosfilos/domain';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

export class SermonService {
    private sermonRepository: FirebaseSermonRepository;

    constructor() {
        this.sermonRepository = new FirebaseSermonRepository();
    }

    async createSermon(data: {
        userId: string;
        title: string;
        content: string;
        bibleReferences?: string[];
        tags?: string[];
        category?: string;
        status?: 'working' | 'draft' | 'published' | 'archived';
        authorName?: string;
        seriesId?: string;
        scheduledDate?: Date;
        wizardProgress?: Sermon['wizardProgress'];
        sourceFacultySessionId?: string;
        sourcePaperId?: string;
        projectId?: string;
    }): Promise<SermonEntity> {
        try {
            const sermon = SermonEntity.create({
                userId: data.userId,
                title: data.title,
                content: data.content,
                bibleReferences: data.bibleReferences || [],
                tags: data.tags || [],
                category: data.category,
                status: data.status || 'draft',
                isShared: false,
                authorName: data.authorName || 'Pastor',
                seriesId: data.seriesId,
                scheduledDate: data.scheduledDate,
                wizardProgress: data.wizardProgress,
                sourceFacultySessionId: data.sourceFacultySessionId,
                sourcePaperId: data.sourcePaperId,
                projectId: data.projectId,
            });
            const createdSermon = await this.sermonRepository.create(sermon);

            // Track sermon creation
            AnalyticsService.trackSermonCreated(
                createdSermon.id,
                data.bibleReferences?.[0] || 'Unknown'
            ).catch(err => console.warn('[SermonService] Failed to track sermon creation:', err));

            return createdSermon;
        } catch (error: any) {
            throw new Error(error.message || 'Error al crear el sermón');
        }
    }

    async updateSermon(
        id: string,
        data: Partial<{
            title: string;
            content: string;
            bibleReferences: string[];
            tags: string[];
            category: string;
            status: 'working' | 'draft' | 'published' | 'archived';
            seriesId: string;
            scheduledDate: Date;
            wizardProgress: any;
            preachingHistory: any[];
            /** Editor tutor session opened for follow-up questions (lazy-created). */
            tutorSessionId: string;
            /** Phase 2.5 PR C (ADR-027) — gate snapshot embedded at generation time. */
            studyDepthSnapshot: import('@dosfilos/domain').StudyDepthSnapshot;
        }>
    ): Promise<SermonEntity> {
        try {
            const sermon = await this.sermonRepository.findById(id);
            if (!sermon) {
                throw new Error('Sermón no encontrado');
            }
            const updatedSermon = sermon.update(data);
            return await this.sermonRepository.update(updatedSermon);
        } catch (error: any) {
            throw new Error(error.message || 'Error al actualizar el sermón');
        }
    }

    /**
     * Creates an editable VERSION of an existing sermon so the pastor can
     * re-preach the same message in a new context with light edits. Copies
     * only the finished sermon (not the wizard exegetical material) into a
     * fresh `'draft'` linked to the original ROOT via `versionOf`. Works
     * whether `sourceId` is the root or an existing version — the entity
     * resolves the root so the whole family stays a flat group.
     * @param label Optional occasion label (e.g. "Retiro jóvenes 2026").
     */
    async createVersion(sourceId: string, label?: string): Promise<SermonEntity> {
        try {
            const source = await this.sermonRepository.findById(sourceId);
            if (!source) {
                throw new Error('Sermón no encontrado');
            }
            const version = source.createVersion(label?.trim() || undefined);
            return await this.sermonRepository.create(version);
        } catch (error: any) {
            throw new Error(error.message || 'Error al crear la versión del sermón');
        }
    }

    /**
     * Guided-sermon handoff: ensures a sermon doc exists with the SAME id the
     * completed `pastoralSeed` already references (`seed.sermonId`), so the
     * wizard's `getBySermonId` reconnects the 8-step study to the sermon. The
     * guided flow mints only the seed (placeholder sermonId, no doc); this
     * materializes the doc when the pastor crosses into the wizard. Idempotent.
     */
    async ensureSermonForCompletedSeed(seed: PastoralSeed): Promise<SermonEntity> {
        const existing = await this.sermonRepository.findById(seed.sermonId);
        if (existing) return existing;
        const rawTitle = seed.insight?.centralIdea?.trim() || `Sermón sobre ${seed.passage}`;
        const sermon = SermonEntity.create({
            id: seed.sermonId,
            userId: seed.userId,
            title: rawTitle.slice(0, 200),
            content: '',
            bibleReferences: seed.passage ? [seed.passage] : [],
            status: 'draft',
            ...(seed.projectId ? { projectId: seed.projectId } : {}),
        });
        return this.sermonRepository.create(sermon);
    }

    async deleteSermon(id: string): Promise<void> {
        try {
            await this.sermonRepository.delete(id);
        } catch (error: any) {
            throw new Error(error.message || 'Error al eliminar el sermón');
        }
    }

    /**
     * Links (or unlinks, when `projectId` is null) a sermon to a faculty project.
     * Encapsulates the persistence so UI components don't import Firestore directly.
     */
    async linkSermonToProject(sermonId: string, projectId: string | null): Promise<SermonEntity> {
        const sermon = await this.sermonRepository.findById(sermonId);
        if (!sermon) {
            throw new Error('Sermón no encontrado');
        }
        const updated = sermon.update({ projectId: projectId ?? undefined });
        return await this.sermonRepository.update(updated);
    }

    async getSermon(id: string): Promise<SermonEntity | null> {
        try {
            return await this.sermonRepository.findById(id);
        } catch (error: any) {
            throw new Error(error.message || 'Error al obtener el sermón');
        }
    }

    async getUserSermons(userId: string, options?: FindOptions): Promise<SermonEntity[]> {
        try {
            return await this.sermonRepository.findByUserId(userId, options);
        } catch (error: any) {
            throw new Error(error.message || 'Error al obtener los sermones');
        }
    }

    /**
     * Trimmed list read for the dashboard — same options as `getUserSermons`
     * but returns sermons without the heavy fields (content, wizard
     * draft/outline, citationManifest, fidelityReport, studyDepthSnapshot).
     * Keeps the list payload small; the full sermon loads via `getSermon`.
     */
    async getUserSermonSummaries(userId: string, options?: FindOptions): Promise<SermonEntity[]> {
        try {
            return await this.sermonRepository.findSummariesByUserId(userId, options);
        } catch (error: any) {
            throw new Error(error.message || 'Error al obtener los sermones');
        }
    }

    async publishSermon(id: string, override?: PublishOverrideInput): Promise<SermonEntity> {
        try {
            const sermon = await this.sermonRepository.findById(id);
            if (!sermon) {
                throw new Error('Sermón no encontrado');
            }
            this.enforceContraScanGate(sermon);
            await this.enforceFidelityGate(sermon, override);
            const publishedSermon = sermon.publish();
            return await this.sermonRepository.update(publishedSermon);
        } catch (error: any) {
            // Preserve the typed gate refusals so the UI can map `reason` to
            // the right confrontation copy (Phase 3 PR 2 ADR-029 / Phase 4 PR 1 ADR-033).
            if (error instanceof FidelityGateError) throw error;
            if (error instanceof ContraScanGateError) throw error;
            throw new Error(error.message || 'Error al publicar el sermón');
        }
    }

    /**
     * Phase 4 PR 1 (ADR-033) — Persists the contra-scan confrontation result.
     * The web flow runs the scan, records the pastor's consideration (or
     * override), and calls this before `publishSermon`. The report is the
     * permanent P3 audit trail; `publishSermon` then re-reads it and refuses
     * a still-unresolved soft-block (defense-in-depth, mirrors the fidelity
     * gate). With the `contra_scan` flag off no report is ever written, so
     * publish behaves exactly as before (blast radius 0).
     */
    async recordContraScan(sermonId: string, report: ContraScanReport): Promise<void> {
        try {
            await this.sermonRepository.updateContraScanReport(sermonId, report);
        } catch (error: any) {
            throw new Error(error.message || 'Error al registrar la revisión de posiciones contrarias');
        }
    }

    /**
     * Phase 4 PR 1 (ADR-033) — Refuses publish when a contra-scan surfaced
     * dissent the pastor never engaged. Bites only when a `contraScanReport`
     * is present (flag on + scan ran). `no-dissent`/`pass` proceed; an
     * unresolved `soft-block` throws so the UI flow cannot be bypassed.
     */
    private enforceContraScanGate(sermon: SermonEntity): void {
        const report = sermon.contraScanReport;
        if (!report) return;
        const decision = evaluateContraScanGate(report.status);
        if (!decision.allowed) {
            throw new ContraScanGateError(decision.reason);
        }
    }

    /**
     * Pastoral Fidelity — Phase 3 PR 2 (ADR-029 §Q3/Q5). Enforces the
     * claim↔source fidelity gate before a sermon publishes.
     *
     * Defense-in-depth: the editor runs the fidelity pass and confronts the
     * pastor before calling publish, but this service is the choke point that
     * actually refuses a blocked publish so the UI flow cannot be bypassed.
     *
     * The gate only bites when a `fidelityReport` is present on the sermon —
     * with the `fidelity_pass` flag off, no report is ever generated, so
     * publish behaves exactly as before (blast radius 0). When the pastor
     * clears a soft-block, the supplied `GateOverride` is stamped + persisted
     * onto the report as the permanent audit record.
     */
    private async enforceFidelityGate(
        sermon: SermonEntity,
        override?: PublishOverrideInput,
    ): Promise<void> {
        const report = sermon.fidelityReport;
        if (!report) return;

        const decision = evaluatePublishGate(report.gateStatus, override);
        if (!decision.allowed) {
            throw new FidelityGateError(decision.reason);
        }

        if (decision.reason === 'soft-block-overridden' && override) {
            const stamped: GateOverride = {
                reason: override.reason.trim(),
                overriddenBy: override.overriddenBy,
                bypassedKind: override.bypassedKind,
                overriddenAt: new Date(),
            };
            await this.sermonRepository.updateFidelityReport(sermon.id, {
                ...report,
                gateOverride: stamped,
            });
            // Keep the in-memory entity consistent for the subsequent publish.
            sermon.fidelityReport = { ...report, gateOverride: stamped };
        }
    }

    /**
     * Qué pasaría al publicar el borrador ahora: la primera copia, una versión
     * nueva (la `version`), o nada porque es igual a la última copia
     * (`publicationChange`, #2 del ejercicio de Jonás). Se compara contra la
     * copia publicada más reciente que salió de este borrador.
     */
    async publicationStatus(
        draftId: string,
    ): Promise<{ change: PublicationChange; version: number; lastCopyId: string | null }> {
        const draft = await this.sermonRepository.findById(draftId);
        if (!draft) throw new Error('Borrador no encontrado');
        const copies = await this.sermonRepository.findByDraftId(draftId, draft.userId);
        const last = copies[0] ?? null;
        return {
            change: publicationChange(draft.publishAsCopy(), last),
            version: copies.length + 1,
            lastCopyId: last?.id ?? null,
        };
    }

    /**
     * Creates a published COPY of the draft sermon.
     * The original draft remains untouched (status='working')but tracks the publication.
     * The copy has a new ID and status='published'.
     * @returns The newly created published sermon copy
     */
    async publishSermonAsCopy(draftId: string, override?: PublishOverrideInput): Promise<SermonEntity> {
        try {
            const draft = await this.sermonRepository.findById(draftId);
            if (!draft) {
                throw new Error('Borrador no encontrado');
            }

            // Contra-scan gate (Phase 4 PR 1, ADR-033). The wizard publishes via
            // this copy path too; the report was persisted on the draft before
            // this call, so re-read enforces it.
            this.enforceContraScanGate(draft);
            // Fidelity gate (Phase 3 PR 2, ADR-029). The wizard publishes via
            // this copy path; the override + audit attach to the draft's report.
            await this.enforceFidelityGate(draft, override);

            // Create a published copy using the entity method
            const publishedCopy = draft.publishAsCopy();

            // Igual a la última copia: no se crea otra (#2 del ejercicio de
            // Jonás). Quien llama avisa con `PublicationUnchangedError`. Si la
            // consulta falla se publica como antes: una copia de más es mejor
            // que un pastor que no puede publicar el domingo.
            const [last] = await this.sermonRepository.findByDraftId(draftId, draft.userId).catch(() => []);
            if (last && publicationChange(publishedCopy, last) === 'unchanged') {
                throw new PublicationUnchangedError(last.id);
            }

            // Save the copy as a new sermon
            const createdCopy = await this.sermonRepository.create(publishedCopy);

            // Update the draft to track this published copy
            if (draft.wizardProgress) {
                const currentCount = draft.wizardProgress.publishCount || 0;
                const updatedProgress = {
                    ...draft.wizardProgress,
                    publishedCopyId: createdCopy.id,
                    lastPublishedAt: new Date(),
                    publishCount: currentCount + 1
                };

                const updatedDraft = draft.update({ wizardProgress: updatedProgress });
                await this.sermonRepository.update(updatedDraft);
            }

            return createdCopy;
        } catch (error: any) {
            if (error instanceof FidelityGateError) throw error;
            if (error instanceof ContraScanGateError) throw error;
            if (error instanceof PublicationUnchangedError) throw error;
            throw new Error(error.message || 'Error al publicar el sermón');
        }
    }

    async archiveSermon(id: string): Promise<SermonEntity> {
        try {
            const sermon = await this.sermonRepository.findById(id);
            if (!sermon) {
                throw new Error('Sermón no encontrado');
            }
            const archivedSermon = sermon.archive();
            return await this.sermonRepository.update(archivedSermon);
        } catch (error: any) {
            throw new Error(error.message || 'Error al archivar el sermón');
        }
    }

    async shareSermon(id: string): Promise<string> {
        try {
            const sermon = await this.sermonRepository.findById(id);
            if (!sermon) {
                throw new Error('Sermón no encontrado');
            }
            const sharedSermon = sermon.enableSharing();
            await this.sermonRepository.update(sharedSermon);
            return sharedSermon.shareToken!;
        } catch (error: any) {
            throw new Error(error.message || 'Error al compartir el sermón');
        }
    }

    async unshareSermon(id: string): Promise<void> {
        try {
            const sermon = await this.sermonRepository.findById(id);
            if (!sermon) {
                throw new Error('Sermón no encontrado');
            }
            const unsharedSermon = sermon.disableSharing();
            await this.sermonRepository.update(unsharedSermon);
        } catch (error: any) {
            throw new Error(error.message || 'Error al dejar de compartir el sermón');
        }
    }

    async getSharedSermon(token: string): Promise<SermonEntity | null> {
        try {
            return await this.sermonRepository.findByShareToken(token);
        } catch (error: any) {
            throw new Error(error.message || 'Error al obtener el sermón compartido');
        }
    }

    // Wizard-specific methods
    async createDraft(data: {
        userId: string;
        passage: string;
        wizardProgress?: Sermon['wizardProgress'];
        /** Optional: link this sermon to a project workspace from creation. */
        projectId?: string;
    }): Promise<string> {
        try {
            const sermon = SermonEntity.create({
                userId: data.userId,
                title: `Sermón sobre ${data.passage}`,
                content: '', // Empty until final draft
                bibleReferences: [data.passage],
                tags: [],
                status: 'draft', // 🎯 Using 'draft' for wizard in-progress sermons
                isShared: false,
                authorName: 'Pastor',
                wizardProgress: data.wizardProgress || {
                    currentStep: 1,
                    passage: data.passage,
                    lastSaved: new Date()
                },
                projectId: data.projectId,
            });
            const created = await this.sermonRepository.create(sermon);
            return created.id;
        } catch (error: any) {
            throw new Error(error.message || 'Error al crear borrador de sermón');
        }
    }

    async getInProgressSermons(userId: string): Promise<SermonEntity[]> {
        try {
            // Get ALL sermons (drafts, published, archived) to include those with wizardProgress
            // This allows users to continue editing published sermons in the wizard
            const sermons = await this.sermonRepository.findByUserId(userId, {
                // Removed status filter to include published sermons with wizardProgress
                limit: 50, // Increased to show more sermons
                orderBy: 'updatedAt',
                order: 'desc'
            });

            // Filter sermons that have wizardProgress (includes drafts and published sermons)
            return sermons.filter(s => s.wizardProgress !== undefined);
        } catch (error: any) {
            throw new Error(error.message || 'Error al obtener sermones en progreso');
        }
    }

    async updateWizardProgress(
        sermonId: string,
        progress: Sermon['wizardProgress']
    ): Promise<void> {
        try {
            const sermon = await this.sermonRepository.findById(sermonId);
            if (!sermon) {
                throw new Error('Sermón no encontrado');
            }

            // 🎯 Clean undefined values from progress (Firestore doesn't accept undefined)
            const cleanedProgress = this.removeUndefinedFields(progress);

            const updated = sermon.update({ wizardProgress: cleanedProgress });
            await this.sermonRepository.update(updated);
        } catch (error: any) {
            throw new Error(error.message || 'Error al actualizar progreso del wizard');
        }
    }

    /**
     * Recursively removes undefined fields from an object and handles Date conversion
     * Firestore doesn't accept undefined values and needs proper Date objects
     */
    private removeUndefinedFields(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        // Handle Date objects - convert to JavaScript Date
        if (obj instanceof Date) {
            return obj;
        }

        // Handle Date-like objects (with seconds/nanoseconds from Firestore)
        if (obj && typeof obj === 'object' && 'seconds' in obj && 'nanoseconds' in obj) {
            return new Date(obj.seconds * 1000);
        }

        // Handle string dates — SOLO ISO 8601 ESTRICTO. La heurística anterior
        // ("parsea como fecha y contiene una T") convertía en fecha CUALQUIER
        // texto con una T que el parser laxo de V8 tragara. Caso real: la cita
        // "…A Literary and Theological Commentary, p. 194" tiene la T de
        // "Theological" y V8 lee ", p. 194" como el año 194 — el TEXTO de la
        // cita del pastor se guardó como timestamp del siglo II y su decisión
        // se perdió. Un dato del usuario jamás se coerciona por adivinanza.
        if (typeof obj === 'string') {
            return ISO_DATE_STRING.test(obj) ? new Date(obj) : obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.removeUndefinedFields(item));
        }

        if (typeof obj === 'object') {
            const cleaned: any = {};
            for (const key in obj) {
                const value = obj[key];
                if (value !== undefined) {
                    // Special handling for lastSaved field
                    if (key === 'lastSaved' && value) {
                        if (value instanceof Date) {
                            cleaned[key] = value;
                        } else if (typeof value === 'object' && 'seconds' in value) {
                            cleaned[key] = new Date(value.seconds * 1000);
                        } else {
                            cleaned[key] = new Date(value);
                        }
                    } else {
                        cleaned[key] = this.removeUndefinedFields(value);
                    }
                }
            }
            return cleaned;
        }

        return obj;
    }

    async getPublishedVersions(draftId: string, userId: string): Promise<SermonEntity[]> {
        return await this.sermonRepository.findByDraftId(draftId, userId);
    }

    /**
     * Reads the canvas annotation snapshot persisted under
     * `sermons/{id}/annotations/main`. Returns the parsed snapshot
     * object (the engine-specific type lives in the web adapter; the
     * service deals in opaque `unknown` so the domain doesn't depend
     * on the drawing engine). Falls back to the legacy `snapshot`
     * field for pre-JSON migration docs.
     */
    async getAnnotationSnapshot(sermonId: string): Promise<unknown | null> {
        const db = getFirestore();
        const snap = await getDoc(doc(db, 'sermons', sermonId, 'annotations', 'main'));
        if (!snap.exists()) return null;
        const data = snap.data();
        if (data?.snapshotJSON) {
            try {
                return JSON.parse(data.snapshotJSON as string);
            } catch (err) {
                console.error('[SermonService] Failed to parse annotation JSON:', err);
                return null;
            }
        }
        if (data?.snapshot) return data.snapshot;
        return null;
    }

    /**
     * Persists an annotation snapshot. Stored as a JSON string
     * because Firestore rejects nested arrays (which tldraw / canvas
     * snapshots produce). Caller (the React hook) debounces writes —
     * the service is a pure boundary.
     */
    async saveAnnotationSnapshot(sermonId: string, snapshot: unknown): Promise<void> {
        const db = getFirestore();
        await setDoc(doc(db, 'sermons', sermonId, 'annotations', 'main'), {
            snapshotJSON: JSON.stringify(snapshot),
            updatedAt: new Date(),
        });
    }
}

// Singleton instance
export const sermonService = new SermonService();


/**
 * Fecha ISO 8601 completa ("2026-08-26T13:19:34.393Z"), y nada más.
 * Exportada para poder probar el caso que corrompió datos reales.
 */
export const ISO_DATE_STRING = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
