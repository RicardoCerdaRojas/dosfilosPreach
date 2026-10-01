import { CitationManifest, ExegeticalStudy, HomileticalAnalysis, RAGSource, SermonContent } from './SermonGenerator';
import type { SermonPersonalization } from './SermonPersonalization';
import type { FidelityReport } from './FidelityReport';
import type { ContraScanReport } from './ContraScanReport';
import { buildSermonAuthorshipSnapshot } from '../drafting/sermonAuthorship';
import { aggregateRagSourcesFlat } from '../services/aggregateRagSources';

export interface PreachingLog {
    date: Date;
    location: string;
    durationMinutes: number;
    notes?: string;
}

import type { SermonElement } from '../drafting/SermonElement';

export interface Sermon {
    id: string;
    userId: string;
    title: string;
    content: string;
    bibleReferences: string[];
    tags: string[];
    category?: string | undefined;
    status: 'working' | 'draft' | 'published' | 'archived';
    createdAt: Date;
    updatedAt: Date;
    publishedAt?: Date | undefined;
    shareToken?: string | undefined;
    isShared: boolean;
    authorName: string;

    // Series and History
    seriesId?: string | undefined;
    scheduledDate?: Date | undefined;  // Planned preaching date from planner
    preachingHistory: PreachingLog[];

    // Wizard progress for in-progress sermons
    wizardProgress?: {
        currentStep: number;
        passage: string;
        exegesis?: ExegeticalStudy;
        homiletics?: HomileticalAnalysis;
        draft?: SermonContent;
        lastSaved: Date;
        cacheName?: string;
        selectedResourceIds?: string[];
        /**
         * Optional pastoral personalization captured in PromptSettings.
         * When present, the draft prompt prepends a "Voz del Predicador"
         * block (situational context, congregation, illustrations…) so
         * the wizard reaches Faculty parity for occasion-specific
         * sermons (funerals, weddings, crisis preaching).
         *
         * Note: `personalization.tone` is intentionally NOT surfaced in
         * the wizard panel — narrative voice lives in `GenerationRules.tone`
         * (pastoral/expositivo/narrativo). Personalization.tone is the
         * Faculty-only occasion posture (doxological/confrontational/…)
         * and stays out of the wizard form to avoid two tone selectors.
         */
        personalization?: SermonPersonalization;
        /**
         * Audience rigor tier (T3 #19). Mirrors `GenerationRules.audienceRigor`
         * so the wizard's pre-gen choice survives a refresh. 'beginner' is
         * the default and is left implicit (undefined) to keep legacy
         * sermons untouched.
         */
        audienceRigor?: 'beginner' | 'seminary';
        /**
         * ADR-037 — las decisiones de redacción socrática, por sección.
         *
         * La clave es el `sectionId` (`introduction.historicalContext`,
         * `point.1.exposition`…). El valor es la lista COMPLETA de esa sección:
         * Firestore reemplaza arrays enteros en un merge, así que borrar un
         * elemento funciona; lo que un merge NO hace es borrar una clave
         * ausente, y por eso una sección vaciada se escribe como lista vacía en
         * vez de omitirse.
         *
         * ⚠️ LAS CLAVES LLEVAN PUNTOS y eso es seguro SÓLO por cómo se escriben.
         * `setDoc(..., { merge: true })` con un objeto anidado guarda la clave
         * literal, punto incluido. Un `updateDoc` con RUTA DE CAMPO
         * (`wizardProgress.sectionElements.introduction.historicalContext`)
         * interpretaría cada punto como un nivel y crearía mapas anidados
         * paralelos, dejando los datos reales huérfanos. Este mapa se escribe
         * SIEMPRE entero, nunca por ruta.
         *
         * Ausente en todo sermón anterior al flujo. AUSENTE NO ES CERO: un
         * sermón legacy no tiene elementos porque el modelo no existía, no
         * porque el pastor no aportara ideas. Quien lea este campo para mostrar
         * autoría debe distinguir "sin medir" de "medido en cero".
         */
        sectionElements?: Record<string, SermonElement[]>;
        /**
         * ADR-037 — la prosa escrita a partir de las decisiones, por sección.
         *
         * Se guarda APARTE de `sectionElements` a propósito. Son dos cosas con
         * ciclos de vida distintos: las decisiones son del pastor y persisten;
         * la prosa es derivada y se puede volver a escribir sin perderlas. Si
         * vivieran juntas, reescribir una sección arriesgaría pisar lo decidido.
         *
         * Mismas claves y las mismas cautelas que `sectionElements`: se escribe
         * el mapa entero, nunca por ruta de campo.
         */
        sectionProse?: Record<string, string>;
        // Track if this draft has been published
        publishedCopyId?: string;  // ID of the most recent published copy
        lastPublishedAt?: Date;    // When it was last published
        publishCount?: number;      // How many times it's been published
        /**
         * El pastor lo dio por terminado a mano desde el plan de la serie
         * (un sermón predicado sin publicarlo en la app). Antes esa marca era
         * `currentStep: 4` escrito ENCIMA de todo `wizardProgress`: borraba
         * el borrador guardado y dejaba al asistente en un paso inexistente.
         */
        markedCompleteAt?: Date;
        planId?: string; // ID of the preaching plan this sermon belongs to
        /**
         * Provenance of any pre-population that happened at creation
         * time. Each wizard Step inspects this field to render a
         * "Pre-cargado desde {origen}" banner so the user knows the
         * source + can opt into regenerating with the wizard's native
         * generators if they want deeper detail.
         *
         * Absent for sermons created from scratch via the standalone
         * wizard flow. Discriminated union by `kind`:
         *   - 'paper'   → generated from an `ExegeticalPaper`.
         *   - 'faculty' → generated from a Faculty conversation
         *                 (outline + optional pastoral personalization).
         */
        derivedContext?:
            | {
                  kind: 'paper';
                  paperId: string;
                  paperTitle: string;
                  /**
                   * Registro homilético pedido al transformador
                   * paper→sermón. OPCIONAL: ese transformador se
                   * retiró — el paper ahora alimenta el estudio de 8
                   * pasos en vez de producir un borrador, y ese
                   * camino no elige tono porque no redacta nada.
                   * Sigue presente en los sermones generados antes
                   * del cambio.
                   */
                  tone?: 'pastoral' | 'expositivo' | 'narrativo';
                  generatedAt: Date;
                  /** Ídem: solo los sermones del transformador retirado lo traen. */
                  transformerModelId?: string;
              }
            | {
                  kind: 'faculty';
                  sessionId: string;
                  sessionTitle: string;
                  /**
                   * The outline the user approved in
                   * `SermonOutlinePreviewModal` before generation. Kept
                   * so a wizard regenerate can re-run with the same
                   * structure without forcing the user to re-edit.
                   */
                  outline: {
                      title: string;
                      passage: string;
                      proposition: string;
                      points: { title: string; verses: string }[];
                  };
                  /**
                   * Optional personalization (tone, illustrations,
                   * notes) the user attached. Persisted so wizard
                   * refinement calls can keep injecting it without
                   * losing the pastoral framing.
                   */
                  personalization?: Record<string, unknown>;
                  generatedAt: Date;
              };
    } | undefined;

    // If this is a published copy, references the original draft sermon
    sourceSermonId?: string | undefined;

    // Link back to the faculty study session this sermon was generated from
    sourceFacultySessionId?: string | undefined;

    /**
     * Optional link to the project this sermon belongs to. Established by:
     *  - the legacy migration (assigns orphan sermons to a "Material previo" project per user)
     *  - new sermons created from within a project workspace
     * Sermons without a `projectId` are still valid (free-form / pre-migration).
     */
    projectId?: string | undefined;

    /**
     * Optional link to the ExegeticalPaper this sermon was generated from.
     * Set by the paper → sermon transformer (Phase 2 of the pipeline) so
     * the sermon detail view can deep-link back to the source paper and
     * faculty enrichment can pull paper context.
     */
    sourcePaperId?: string | undefined;

    /**
     * Sources from the user's library that fed the generation prompt
     * via RAG retrieval. Populated when the wizard's `wizardProgress
     * .draft.ragSources` is copied into the published sermon — see
     * `publishAsCopy()`. The sermon detail page renders a "📚 Fuentes
     * consultadas" section so the pastor can see which library docs
     * shaped the output (transparency + later study). v1 ships the
     * list; v2 will add inline footnote markers (`[^1]`) that tie
     * specific prose sections back to a source. Undefined for sermons
     * generated without library context (standalone wizard with empty
     * library, or pre-RAG legacy content).
     */
    bibliography?: RAGSource[];

    /**
     * Phase B citation manifest snapshot. Captured at generation time
     * and persisted alongside `content` so the published view can
     * render inline `[N]` markers as interactive popovers without
     * re-running RAG retrieval. The manifest's `entries[idx].sourceId`
     * lines up 1:1 with the bare ordinals the validator left in the
     * prose. Absent on pre-Phase-B sermons — the renderer falls back
     * to bibliography-only mode in that case.
     */
    citationManifest?: CitationManifest;

    /**
     * Phase 2.5 PR C (ADR-027) — Snapshot of the pastor's study coverage
     * (7 dimensions of the `pastoralSeed`) captured at the moment this
     * sermon was generated from the seed. Immutable record used by Fase 4
     * ("Sello propio" badge) + override-rate metrics. Pre-Phase-2.5
     * sermons have this `undefined`; the badge falls back to "no data".
     */
    studyDepthSnapshot?: import('./StudyDepthAssessment').StudyDepthSnapshot;

    /**
     * ADR-037 — cómo se armó este sermón: cuántas ideas originó el pastor,
     * cuántas eligió, cuántas reescribió.
     *
     * ES UN SNAPSHOT Y NO UNA LECTURA EN VIVO POR UNA RAZÓN DURA: la copia
     * publicada NO lleva `wizardProgress`, donde viven las decisiones. Sin
     * grabarlo al publicar, toda pantalla que describiera la autoría de un
     * sermón publicado diría "sin medir" para TODOS — incluido el que se armó
     * entero en el taller.
     *
     * AUSENTE EN TODO SERMÓN ANTERIOR AL TALLER, y ausente es `sin-medir`, que
     * NO es lo mismo que medido en cero. Un sermón legacy no tiene decisiones
     * registradas porque el registro no existía, no porque el pastor no aportara
     * ideas: tratarlo como el estado más bajo le diría a un pastor con noventa
     * sermones propios que ninguna idea es suya.
     */
    authorshipSnapshot?: import('../drafting/sermonAuthorship').SermonAuthorshipSnapshot;

    /**
     * Phase 3 PR 1 (ADR-029) — Claim/source fidelity pass result. Written by
     * `RunFidelityPassUseCase` after a Gemini Flash (+ optional Sonnet
     * escalation) evaluator scores every `[N]` marker. Read by the
     * FidelityReviewPanel in the editor and (later PRs) the pre-publish
     * gate. Absent on sermons whose pastor never ran the pass or whose
     * `fidelity_pass` sub-flag is off. The field is purely additive —
     * mutators carry it forward without alteration so re-running the pass
     * fully replaces the report instead of merging it.
     */
    fidelityReport?: FidelityReport;

    /**
     * Phase 4 PR 1 (ADR-033) — contra-scan confrontation report. Written when
     * the pastor publishes under the `contra_scan` flag: the dissenting library
     * chunks surfaced + the pastor's recorded consideration (or override). The
     * permanent P3 audit trail (Acts 20:27). Independent of `fidelityReport`
     * (dormant per ADR-032). Absent on sermons published before this feature or
     * with the flag off. Purely additive — mutators carry it forward unchanged.
     */
    contraScanReport?: ContraScanReport;

    /**
     * Version grouping — set on a sermon that is a re-preaching VERSION of an
     * existing sermon (pastor preaches the same message in a new context with
     * light edits). Points to the ROOT sermon's id. The group is flat: a
     * version of a version still points to the original root, so the whole
     * family is fetched with a single `versionOf == rootId` filter and the
     * "v2 / v3…" ordinal is computed in the UI from `createdAt` order. The
     * root sermon itself leaves this `undefined`. Carried forward unchanged
     * by every mutator (additive field).
     */
    versionOf?: string | undefined;

    /**
     * Optional occasion label for a version (e.g. "Retiro jóvenes 2026",
     * "Iglesia X"). Lets the pastor tell two versions apart at a glance in
     * the grouped list without editing the title. Only meaningful when
     * `versionOf` is set. Carried forward unchanged by mutators.
     */
    versionLabel?: string | undefined;

    /**
     * Faculty (tutor) chat session opened from the SERMON EDITOR so the pastor
     * can ask follow-up questions about an already-generated sermon. Distinct
     * from `sourceFacultySessionId` (the session the sermon was GENERATED from):
     * this one is created lazily on the first editor question for sermons that
     * have no origin session (wizard/paper/blank). The editor prefers
     * `sourceFacultySessionId` when present and falls back to this. Points to a
     * `users/{uid}/ai_sessions/{id}` doc. Carried forward unchanged by mutators.
     */
    tutorSessionId?: string | undefined;

    /**
     * SUMMARY-ONLY derived flag: whether the sermon has a non-empty `content`
     * body. The trimmed list read strips `content`, so the dashboard can't tell
     * a finished sermon from an in-progress wizard draft without it. Set by the
     * list-summary projection; `undefined` on full entities (which carry the
     * real `content`). Not persisted.
     */
    hasContent?: boolean | undefined;
}

export class SermonEntity implements Sermon {
    constructor(
        public id: string,
        public userId: string,
        public title: string,
        public content: string,
        public bibleReferences: string[] = [],
        public tags: string[] = [],
        public category: string | undefined = undefined,
        public status: 'working' | 'draft' | 'published' | 'archived' = 'working',
        public createdAt: Date = new Date(),
        public updatedAt: Date = new Date(),
        public publishedAt: Date | undefined = undefined,
        public shareToken: string | undefined = undefined,
        public isShared: boolean = false,
        public authorName: string = 'Pastor',
        public wizardProgress?: Sermon['wizardProgress'],
        public seriesId?: string,
        public scheduledDate?: Date,
        public preachingHistory: PreachingLog[] = [],
        public sourceSermonId?: string,
        public sourceFacultySessionId?: string,
        public projectId?: string,
        public sourcePaperId?: string,
        public bibliography?: RAGSource[],
        public citationManifest?: CitationManifest,
        public studyDepthSnapshot?: Sermon['studyDepthSnapshot'],
        public fidelityReport?: FidelityReport,
        public contraScanReport?: ContraScanReport,
        public versionOf?: string,
        public versionLabel?: string,
        public tutorSessionId?: string,
        public authorshipSnapshot?: Sermon['authorshipSnapshot'],
        public hasContent?: boolean,
        /**
         * Skips the "content required" rule. Set ONLY when reconstructing a
         * trimmed list summary (`createSummary`), where `content` is empty by
         * design because the full body loads on the detail page. Never set on
         * a real create/save path. Not a persisted field.
         */
        private readonly _skipContentValidation: boolean = false
    ) {
        this.validate();
    }

    private validate(): void {
        if (!this.title || this.title.trim().length < 5) {
            throw new Error('El título debe tener al menos 5 caracteres');
        }
        if (this.title.length > 200) {
            throw new Error('El título no puede exceder 200 caracteres');
        }
        // Allow empty content for draft sermons (wizard in progress) and for
        // trimmed list summaries (content lives on the detail page, not the list).
        if (!this._skipContentValidation && this.status !== 'draft' && (!this.content || this.content.trim().length === 0)) {
            throw new Error('El contenido no puede estar vacío');
        }
        if (!this.userId) {
            throw new Error('El sermón debe tener un usuario asociado');
        }
    }

    static create(
        data: Pick<Sermon, 'userId' | 'title' | 'content'>
            & Partial<Omit<Sermon, 'userId' | 'title' | 'content' | 'id'>>
            & { id?: string; preachingHistory?: PreachingLog[] },
        /** Internal — skips the content-required rule for trimmed summaries. */
        skipContentValidation = false
    ): SermonEntity {
        const d = data as any;
        return new SermonEntity(
            data.id ?? crypto.randomUUID(),
            data.userId,
            data.title,
            data.content,
            data.bibleReferences ?? [],
            data.tags ?? [],
            data.category,
            data.status ?? 'working',
            // Honor caller-provided timestamps (deserialization from
            // Firestore needs to preserve the actual creation/update
            // dates). Fall back to `now` only when caller doesn't
            // supply them — that's the "fresh sermon being created
            // for the first time" case.
            data.createdAt ?? new Date(),
            data.updatedAt ?? new Date(),
            d.publishedAt,
            d.shareToken,
            d.isShared ?? false,
            d.authorName ?? 'Pastor',
            data.wizardProgress,
            data.seriesId,
            data.scheduledDate,
            data.preachingHistory ?? [],
            data.sourceSermonId,
            data.sourceFacultySessionId,
            data.projectId,
            data.sourcePaperId,
            data.bibliography ?? (data as any).bibliography,
            data.citationManifest,
            data.studyDepthSnapshot,
            data.fidelityReport,
            data.contraScanReport,
            data.versionOf,
            data.versionLabel,
            data.tutorSessionId,
            data.authorshipSnapshot,
            data.hasContent,
            skipContentValidation
        );
    }

    /**
     * Reconstruct a trimmed LIST summary (no `content`). The dashboard list
     * only reads headline fields; the full body loads on the detail page. This
     * skips the "content required" validation that legitimately doesn't apply
     * to a summary projection — see `findSummariesByUserId`.
     */
    static createSummary(
        data: Pick<Sermon, 'userId' | 'title'>
            & Partial<Omit<Sermon, 'userId' | 'title' | 'id'>>
            & { id?: string; preachingHistory?: PreachingLog[] }
    ): SermonEntity {
        return SermonEntity.create({ content: '', ...data }, true);
    }

    update(data: Partial<Omit<Sermon, 'id' | 'userId' | 'createdAt'>>): SermonEntity {
        const d = data as any;
        return new SermonEntity(
            this.id,
            this.userId,
            data.title ?? this.title,
            data.content ?? this.content,
            data.bibleReferences ?? this.bibleReferences,
            data.tags ?? this.tags,
            data.category ?? this.category,
            data.status ?? this.status,
            this.createdAt,
            new Date(),
            d.publishedAt ?? this.publishedAt,
            d.shareToken ?? this.shareToken,
            d.isShared ?? this.isShared,
            d.authorName ?? this.authorName,
            data.wizardProgress ?? this.wizardProgress,
            data.seriesId ?? this.seriesId,
            data.scheduledDate ?? this.scheduledDate,
            data.preachingHistory ?? this.preachingHistory,
            d.sourceSermonId ?? this.sourceSermonId,
            d.sourceFacultySessionId ?? this.sourceFacultySessionId,
            d.projectId ?? this.projectId,
            d.sourcePaperId ?? this.sourcePaperId,
            data.bibliography ?? this.bibliography,
            data.citationManifest ?? this.citationManifest,
            data.studyDepthSnapshot ?? this.studyDepthSnapshot,
            data.fidelityReport ?? this.fidelityReport,
            data.contraScanReport ?? this.contraScanReport,
            d.versionOf ?? this.versionOf,
            d.versionLabel ?? this.versionLabel,
            d.tutorSessionId ?? this.tutorSessionId,
            d.authorshipSnapshot ?? this.authorshipSnapshot
        );
    }

    publish(): SermonEntity {
        return new SermonEntity(
            this.id,
            this.userId,
            this.title,
            this.content,
            this.bibleReferences,
            this.tags,
            this.category,
            'published',
            this.createdAt,
            new Date(),
            new Date(),
            this.shareToken,
            this.isShared,
            this.authorName,
            this.wizardProgress,
            this.seriesId,
            this.scheduledDate,
            this.preachingHistory,
            this.sourceSermonId,
            this.sourceFacultySessionId,
            this.projectId,
            this.sourcePaperId,
            this.bibliography ?? aggregateRagSourcesFlat({
                exegesisSources: this.wizardProgress?.exegesis?.ragSources,
                homileticsSources: this.wizardProgress?.homiletics?.ragSources,
                draftSources: this.wizardProgress?.draft?.ragSources,
            }),
            this.citationManifest ?? this.wizardProgress?.draft?.citationManifest,
            this.studyDepthSnapshot,
            this.fidelityReport,
            this.contraScanReport,
            this.versionOf,
            this.versionLabel,
            this.tutorSessionId,
            this.authorshipSnapshot
        );
    }

    /**
     * Creates a published COPY of this sermon with a new ID.
     * The copy references this sermon as the source (sourceSermonId).
     * Used when publishing from the wizard without losing the draft.
     */
    publishAsCopy(): SermonEntity {
        // Use draft content from wizardProgress if main content is empty
        let draftContent = '';
        if (this.wizardProgress?.draft) {
            const draft = this.wizardProgress.draft;
            draftContent = `${draft.title}\n\n${draft.introduction}\n\n`;
            draft.body.forEach((point) => {
                draftContent += `${point.point}\n\n${point.content}\n\n`;
            });
            draftContent += draft.conclusion;
        }
        const contentToPublish = this.content || draftContent || '';
        const titleToPublish = this.title || this.wizardProgress?.passage || 'Sermón';

        return new SermonEntity(
            crypto.randomUUID(), // New ID for the copy
            this.userId,
            titleToPublish,
            contentToPublish,
            this.bibleReferences,
            this.tags,
            this.category,
            'published',
            new Date(), // New creation date
            new Date(),
            new Date(), // Published now
            undefined, // No share token yet
            false,
            this.authorName,
            undefined, // Don't copy wizardProgress to published version
            this.seriesId,
            this.scheduledDate,
            [],
            this.id, // Link back to the source draft
            this.sourceFacultySessionId,
            this.projectId,
            this.sourcePaperId,
            this.bibliography ?? aggregateRagSourcesFlat({
                exegesisSources: this.wizardProgress?.exegesis?.ragSources,
                homileticsSources: this.wizardProgress?.homiletics?.ragSources,
                draftSources: this.wizardProgress?.draft?.ragSources,
            }),
            this.citationManifest ?? this.wizardProgress?.draft?.citationManifest,
            this.studyDepthSnapshot,
            this.fidelityReport,
            this.contraScanReport,
            this.versionOf,
            this.versionLabel,
            this.tutorSessionId,
            // SE CAPTURA ACÁ, no se arrastra. Las decisiones viven en
            // `wizardProgress`, que la copia publicada NO lleva: si no se
            // graban en este preciso momento, se pierden y el sermón publicado
            // quedaría descrito como "sin medir" aunque se armara entero en el
            // taller. Un sermón sin decisiones devuelve `undefined` — no se
            // graba una medición en cero.
            buildSermonAuthorshipSnapshot(this.wizardProgress?.sectionElements)
        );
    }

    /**
     * Creates an editable VERSION of this sermon for re-preaching the same
     * message in a new context with light edits. The version is a fresh
     * `'draft'` sermon with a new id that copies only the FINISHED sermon
     * (title/content/references/tags/category + bibliography/citation manifest
     * so footnotes keep rendering) — NOT the wizard exegetical material. It
     * points at the ROOT sermon via `versionOf` (flat grouping: a version of a
     * version still resolves to the original root) and carries an optional
     * occasion `label`. Preaching history, sharing, schedule and series are
     * intentionally reset so the new context starts clean.
     */
    createVersion(label?: string): SermonEntity {
        const rootId = this.versionOf ?? this.id;
        return SermonEntity.create({
            userId: this.userId,
            title: this.title,
            content: this.content,
            bibleReferences: [...this.bibleReferences],
            tags: [...this.tags],
            category: this.category,
            status: 'draft',
            isShared: false,
            authorName: this.authorName,
            projectId: this.projectId,
            bibliography: this.bibliography,
            citationManifest: this.citationManifest,
            versionOf: rootId,
            versionLabel: label,
        });
    }

    archive(): SermonEntity {
        return new SermonEntity(
            this.id,
            this.userId,
            this.title,
            this.content,
            this.bibleReferences,
            this.tags,
            this.category,
            'archived',
            this.createdAt,
            new Date(),
            this.publishedAt,
            this.shareToken,
            this.isShared,
            this.authorName,
            this.wizardProgress,
            this.seriesId,
            this.scheduledDate,
            this.preachingHistory,
            this.sourceSermonId,
            this.sourceFacultySessionId,
            this.projectId,
            this.sourcePaperId,
            this.bibliography,
            this.citationManifest,
            this.studyDepthSnapshot,
            this.fidelityReport,
            this.contraScanReport,
            this.versionOf,
            this.versionLabel,
            this.tutorSessionId,
            this.authorshipSnapshot
        );
    }

    enableSharing(): SermonEntity {
        return new SermonEntity(
            this.id,
            this.userId,
            this.title,
            this.content,
            this.bibleReferences,
            this.tags,
            this.category,
            this.status,
            this.createdAt,
            new Date(),
            this.publishedAt,
            this.shareToken ?? crypto.randomUUID(),
            true,
            this.authorName,
            this.wizardProgress,
            this.seriesId,
            this.scheduledDate,
            this.preachingHistory,
            this.sourceSermonId,
            this.sourceFacultySessionId,
            this.projectId,
            this.sourcePaperId,
            this.bibliography,
            this.citationManifest,
            this.studyDepthSnapshot,
            this.fidelityReport,
            this.contraScanReport,
            this.versionOf,
            this.versionLabel,
            this.tutorSessionId,
            this.authorshipSnapshot
        );
    }

    disableSharing(): SermonEntity {
        return new SermonEntity(
            this.id,
            this.userId,
            this.title,
            this.content,
            this.bibleReferences,
            this.tags,
            this.category,
            this.status,
            this.createdAt,
            new Date(),
            this.publishedAt,
            this.shareToken,
            false,
            this.authorName,
            this.wizardProgress,
            this.seriesId,
            this.scheduledDate,
            this.preachingHistory,
            this.sourceSermonId,
            this.sourceFacultySessionId,
            this.projectId,
            this.sourcePaperId,
            this.bibliography,
            this.citationManifest,
            this.studyDepthSnapshot,
            this.fidelityReport,
            this.contraScanReport,
            this.versionOf,
            this.versionLabel,
            this.tutorSessionId,
            this.authorshipSnapshot
        );
    }

    addPreachingLog(log: PreachingLog): SermonEntity {
        return this.update({
            preachingHistory: [...this.preachingHistory, log]
        });
    }

    assignToSeries(seriesId: string): SermonEntity {
        return this.update({ seriesId });
    }

    removeFromSeries(): SermonEntity {
        return this.update({ seriesId: undefined } as any);
    }
}
