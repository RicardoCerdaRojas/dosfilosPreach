import {
    addDoc,
    collection,
    doc,
    getDoc,
    runTransaction,
    getDocs,
    limit as fsLimit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
    AiAssistLog,
    DimensionOverrides,
    ContextGenreStepData,
    InsightStepData,
    IPastoralSeedRepository,
    ParallelRef,
    PasteEvent,
    PastoralSeed,
    ReadingStepData,
    RecognitionStepData,
    StructuralAnalysisStepData,
    TimelessPrincipleStepData,
    ToolUsage,
    WordStudiesStepData,
    WordStudy,
    FunctionStepData,
} from '@dosfilos/domain';

/**
 * Firestore implementation of `IPastoralSeedRepository` (ADR-015).
 *
 * Collection: `pastoralSeeds/{seedId}` with `sermonId` as the natural
 * lookup key. Writes happen client-side under the wizard's autosave
 * loop; rules guard `request.auth.uid == resource.data.userId`.
 *
 * Server-side `createdAt`/`updatedAt` use `serverTimestamp()` so audit
 * timestamps remain authoritative even if the client clock drifts.
 */
export class FirestorePastoralSeedRepository implements IPastoralSeedRepository {
    private readonly collectionName = 'pastoralSeeds';

    async findBySermonId(sermonId: string): Promise<PastoralSeed | null> {
        const q = query(
            collection(db, this.collectionName),
            where('sermonId', '==', sermonId),
            orderBy('updatedAt', 'desc'),
            fsLimit(1),
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const first = snap.docs[0];
        return this.toSeed(first.id, first.data());
    }

    async getById(seedId: string): Promise<PastoralSeed | null> {
        const ref = doc(db, this.collectionName, seedId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return this.toSeed(snap.id, snap.data());
    }

    /**
     * Crea el seed del sermón. IDEMPOTENTE POR `sermonId`.
     *
     * El id del documento ES el `sermonId`, y la creación va en transacción: si
     * el documento ya existe, se devuelve el existente en vez de crear un
     * gemelo.
     *
     * POR QUÉ ASÍ, Y NO SINCRONIZANDO A LOS LLAMADORES: `ensureForSermon` hacía
     * `findBySermonId` y, si no había, `create`. Dos llamadas concurrentes
     * —dos montajes del wizard, un StrictMode, un doble click— leían las dos
     * "no existe" y creaban DOS seeds para el mismo sermón. Pasó de verdad el
     * 2026-08-22: dos seeds del mismo sermón, creados en el mismo segundo.
     *
     * Un lock o una bandera no lo arreglan: cualquier reintento los elude. La
     * regla del proyecto para esta clase de bug es sacar la disputa del azar
     * FIJANDO EL RECURSO — y el propio comentario que había acá ya decía que
     * "sermonId es la clave natural". Ahora también es la clave del documento,
     * así que dos creaciones colisionan en vez de duplicar.
     *
     * El seed es la unidad de estudio: dos seeds parten el trabajo del pastor
     * entre dos documentos y el gate lee el que no lo tiene.
     *
     * Compatible hacia atrás: los seeds anteriores conservan su id aleatorio y
     * se siguen encontrando por `findBySermonId`, que consulta el CAMPO.
     *
     * DEPENDE DE LAS REGLAS: el `tx.get` de abajo lee un documento que en el
     * caso normal NO EXISTE, así que `allow get` de `pastoralSeeds` tiene que
     * admitir `resource == null`. Si alguien "endurece" esa regla volviendo a
     * exigir `resource.data.userId`, Firestore responde permission-denied sobre
     * el documento ausente y NINGÚN sermón nuevo vuelve a crear su estudio.
     * Pasó de verdad entre el 2026-08-23 y el 2026-09-15. Lo cubre
     * `tests/firestore-rules/pastoralSeeds.test.ts`.
     */
    async create(seed: PastoralSeed): Promise<PastoralSeed> {
        const payload = {
            ...this.toFirestore(seed),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        delete (payload as any).id;

        // Sin `sermonId` no hay clave natural que fijar: se cae al id opaco.
        if (!seed.sermonId) {
            const ref = await addDoc(collection(db, this.collectionName), payload);
            return { ...seed, id: ref.id };
        }

        const ref = doc(db, this.collectionName, seed.sermonId);
        const existing = await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (snap.exists()) return snap;
            tx.set(ref, payload);
            return null;
        });
        // Si otra llamada ganó la carrera, se devuelve LO SUYO — no se pisa su
        // trabajo ni se crea un segundo documento.
        if (existing) return this.toSeed(existing.id, existing.data() as Record<string, unknown>);
        return { ...seed, id: ref.id };
    }

    async update(seedId: string, patch: Partial<PastoralSeed>): Promise<void> {
        const ref = doc(db, this.collectionName, seedId);
        const sanitized = this.toFirestore(patch as PastoralSeed, { partial: true });
        // Never let callers overwrite the immutable identity fields nor
        // forge timestamps — `updatedAt` always comes from the server.
        delete (sanitized as any).id;
        delete (sanitized as any).createdAt;
        delete (sanitized as any).sermonId;
        delete (sanitized as any).userId;
        await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
    }

    async listByUserId(
        userId: string,
        opts?: { limit?: number },
    ): Promise<PastoralSeed[]> {
        const q = opts?.limit
            ? query(
                  collection(db, this.collectionName),
                  where('userId', '==', userId),
                  orderBy('updatedAt', 'desc'),
                  fsLimit(opts.limit),
              )
            : query(
                  collection(db, this.collectionName),
                  where('userId', '==', userId),
                  orderBy('updatedAt', 'desc'),
              );
        const snap = await getDocs(q);
        return snap.docs.map((d) => this.toSeed(d.id, d.data()));
    }

    async appendAiAssistLog(
        seedId: string,
        log: Omit<AiAssistLog, 'id' | 'seedId' | 'createdAt'>,
    ): Promise<void> {
        const ref = collection(db, this.collectionName, seedId, 'aiAssistLogs');
        await addDoc(ref, {
            userId: log.userId,
            stepKey: log.stepKey,
            assistType: log.assistType,
            outputWasEditedByUser: Boolean(log.outputWasEditedByUser),
            createdAt: serverTimestamp(),
        });
    }

    async listAiAssistLogs(seedId: string): Promise<AiAssistLog[]> {
        const q = query(
            collection(db, this.collectionName, seedId, 'aiAssistLogs'),
            orderBy('createdAt', 'asc'),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
            const data = d.data() as any;
            return {
                id: d.id,
                seedId,
                userId: data.userId ?? '',
                stepKey: data.stepKey,
                assistType: data.assistType,
                outputWasEditedByUser: Boolean(data.outputWasEditedByUser),
                createdAt: this.toDate(data.createdAt),
            } satisfies AiAssistLog;
        });
    }

    async getStudyDepthOverrides(seedId: string): Promise<DimensionOverrides> {
        const ref = doc(db, this.collectionName, seedId, 'studyDepth', 'current');
        const snap = await getDoc(ref);
        if (!snap.exists()) return {};
        const data = snap.data() as { overrides?: DimensionOverrides };
        return data.overrides ?? {};
    }

    async setStudyDepthOverride(
        seedId: string,
        dimensionId: string,
        pastorMarkedComplete: boolean,
    ): Promise<void> {
        const ref = doc(db, this.collectionName, seedId, 'studyDepth', 'current');
        // merge:true deep-merges the nested `overrides` map, so per-dim writes
        // never clobber sibling dimensions.
        await setDoc(
            ref,
            {
                overrides: { [dimensionId]: { pastorMarkedComplete } },
                updatedAt: serverTimestamp(),
            },
            { merge: true },
        );
    }

    private toFirestore(seed: PastoralSeed, opts?: { partial?: boolean }): Record<string, unknown> {
        const isPartial = opts?.partial ?? false;
        const out: Record<string, unknown> = {};
        const assign = (key: string, value: unknown) => {
            if (isPartial && value === undefined) return;
            // Firestore rejects `undefined` at any nesting level.
            // Convert undefined / null fields to `null`, and scrub
            // nested undefineds recursively for the structured step
            // payloads. Dates → Timestamps handled by the per-step
            // serialisers below.
            out[key] = scrubUndefined(value ?? null);
        };
        assign('sermonId', seed.sermonId);
        assign('projectId', seed.projectId);
        assign('userId', seed.userId);
        assign('passage', seed.passage);
        // Superficie de creación: hecho del origen, se escribe una vez. En update
        // parcial `assign` omite el `undefined`, así que un patch nunca lo pisa.
        assign('origin', seed.origin);
        assign('reading', seed.reading ? this.dateOptionalStepToFirestore(seed.reading) : seed.reading);
        assign('contextGenre', seed.contextGenre ? this.dateOptionalStepToFirestore(seed.contextGenre) : seed.contextGenre);
        assign('structuralAnalysis', seed.structuralAnalysis ? this.dateOptionalStepToFirestore(seed.structuralAnalysis) : seed.structuralAnalysis);
        assign('wordStudies', seed.wordStudies ? this.dateOptionalStepToFirestore(seed.wordStudies) : seed.wordStudies);
        assign('recognition', seed.recognition ? this.dateOptionalStepToFirestore(seed.recognition) : seed.recognition);
        assign('function', seed.function ? this.dateOptionalStepToFirestore(seed.function) : seed.function);
        assign('timelessPrinciple', seed.timelessPrinciple ? this.timelessPrincipleToFirestore(seed.timelessPrinciple) : seed.timelessPrinciple);
        // BUG FIX: en update PARCIAL, si el patch no incluye el paso, hay que
        // pasar `undefined` (que `assign` omite) — NO `null`. `insightToFirestore`
        // devuelve `null` para insight ausente, y `assign` solo omite `undefined`,
        // así que la versión anterior escribía `insight: null` y BORRABA el
        // insight ya guardado por un update previo (p.ej. el 2º update que marca
        // `completed`). Mismo guard que el resto de los pasos. Igual `toolsConsulted`
        // (que se vaciaba a [] en cada update parcial → "0 herramientas consultadas").
        assign('insight', seed.insight ? this.insightToFirestore(seed.insight) : seed.insight);
        assign('totalTimeSeconds', seed.totalTimeSeconds);
        assign('toolsConsulted', seed.toolsConsulted ? seed.toolsConsulted.map(this.toolToFirestore) : seed.toolsConsulted);
        assign('completed', seed.completed);
        assign('completedAt', seed.completedAt ? Timestamp.fromDate(seed.completedAt) : null);
        // ADR-034 — routed doubts (plain, no Dates).
        assign('openDoubts', seed.openDoubts);
        return out;
    }

    /**
     * Shared serialiser for every step type that carries an optional
     * `completedAt` Date. Converts Date → Timestamp and forces missing
     * value to `null` (Firestore rejects `undefined`).
     */
    private dateOptionalStepToFirestore<T extends { completedAt?: Date }>(step: T): Record<string, unknown> {
        const { completedAt, ...rest } = step;
        return {
            ...rest,
            completedAt: completedAt ? Timestamp.fromDate(completedAt) : null,
        };
    }

    private insightToFirestore(insight: InsightStepData | undefined): Record<string, unknown> | null {
        if (!insight) return null;
        return {
            centralIdea: insight.centralIdea,
            observations: insight.observations,
            openQuestion: insight.openQuestion,
            pastoralAnecdote: insight.pastoralAnecdote,
            doxologicalApplication: insight.doxologicalApplication,
            timeSpentSeconds: insight.timeSpentSeconds,
            pasteEvents: (insight.pasteEvents ?? []).map((p) => ({
                step: p.step,
                field: p.field,
                charsCount: p.charsCount,
                at: p.at instanceof Date ? Timestamp.fromDate(p.at) : p.at,
            })),
            completedAt: insight.completedAt ? Timestamp.fromDate(insight.completedAt) : null,
        };
    }

    /**
     * Phase 1.6 — the timeless principle carries an optional verifier
     * report whose `verifiedAt` is a nested Date that needs Timestamp
     * conversion (the generic `dateOptionalStepToFirestore` only handles
     * the top-level `completedAt`).
     */
    private timelessPrincipleToFirestore(
        step: TimelessPrincipleStepData,
    ): Record<string, unknown> {
        const { completedAt, verificationReport, ...rest } = step;
        return {
            ...rest,
            verificationReport: verificationReport
                ? {
                      ...verificationReport,
                      verifiedAt:
                          verificationReport.verifiedAt instanceof Date
                              ? Timestamp.fromDate(verificationReport.verifiedAt)
                              : verificationReport.verifiedAt,
                  }
                : null,
            completedAt: completedAt ? Timestamp.fromDate(completedAt) : null,
        };
    }

    private toolToFirestore(tool: ToolUsage): ToolUsage {
        return {
            ...tool,
            invokedAt: tool.invokedAt instanceof Date
                ? (Timestamp.fromDate(tool.invokedAt) as unknown as Date)
                : tool.invokedAt,
        };
    }

    private toSeed(id: string, data: any): PastoralSeed {
        return {
            id,
            sermonId: data.sermonId,
            projectId: data.projectId ?? undefined,
            userId: data.userId,
            createdAt: this.toDate(data.createdAt),
            updatedAt: this.toDate(data.updatedAt),
            passage: data.passage ?? '',
            // Ausente en seeds legacy: se deja `undefined` (desconocido), NUNCA se
            // infiere hacia atrás — un dato que no se registró no se inventa.
            origin: data.origin ?? undefined,
            reading: this.toReading(data.reading),
            contextGenre: this.toContextGenre(data.contextGenre),
            // Back-compat: legacy seeds stored these under `syntax` / `morphology`
            // before the ADR-022 rename. The migration callable rewrites them,
            // but reading falls back so docs load even pre-migration.
            structuralAnalysis: this.toStructuralAnalysis(data.structuralAnalysis ?? data.syntax),
            wordStudies: this.toWordStudies(data.wordStudies ?? data.morphology),
            recognition: this.toRecognition(data.recognition),
            function: this.toFunction(data.function),
            timelessPrinciple: this.toTimelessPrinciple(data.timelessPrinciple),
            insight: this.toInsight(data.insight),
            totalTimeSeconds: data.totalTimeSeconds ?? 0,
            toolsConsulted: Array.isArray(data.toolsConsulted)
                ? data.toolsConsulted.map((t: any) => ({
                    tool: t.tool,
                    step: t.step,
                    invokedAt: this.toDate(t.invokedAt),
                    durationSeconds: t.durationSeconds ?? 0,
                } satisfies ToolUsage))
                : [],
            completed: Boolean(data.completed),
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
            openDoubts: Array.isArray(data.openDoubts) ? data.openDoubts : undefined,
        };
    }

    private toReading(data: any): ReadingStepData {
        if (!data) return { firstImpression: '', timeSpentSeconds: 0 };
        return {
            firstImpression: data.firstImpression ?? '',
            originalTextConsulted: data.originalTextConsulted ?? undefined,
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toContextGenre(data: any): ContextGenreStepData {
        if (!data) {
            return {
                genre: '',
                genreConfirmed: false,
                genreImplication: '',
                bookLocationNote: '',
                historicalContextConsulted: false,
                timeSpentSeconds: 0,
            };
        }
        return {
            genre: data.genre ?? '',
            genreConfirmed: Boolean(data.genreConfirmed),
            genreImplication: data.genreImplication ?? '',
            bookLocationNote: data.bookLocationNote ?? '',
            historicalContextConsulted: Boolean(data.historicalContextConsulted),
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toStructuralAnalysis(data: any): StructuralAnalysisStepData {
        if (!data) return { mainClause: { reference: '', pastorNote: '' }, timeSpentSeconds: 0 };
        return {
            mainClause: {
                reference: data.mainClause?.reference ?? '',
                pastorNote: data.mainClause?.pastorNote ?? '',
            },
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toWordStudies(data: any): WordStudiesStepData {
        if (!data) return { studies: [], timeSpentSeconds: 0 };
        // Back-compat: legacy `morphology` docs nested the array under
        // `wordStudies`; the renamed shape uses `studies`.
        const rawStudies = Array.isArray(data.studies)
            ? data.studies
            : Array.isArray(data.wordStudies)
              ? data.wordStudies
              : [];
        return {
            studies: rawStudies.map((w: any) => ({
                word: w.word ?? '',
                reference: w.reference ?? '',
                pastorDiscovery: w.pastorDiscovery ?? '',
                tutorInteractionId: w.tutorInteractionId ?? undefined,
                wordAnalysisId: w.wordAnalysisId ?? undefined,
                lemma: w.lemma ?? undefined,
                language: w.language ?? undefined,
            } satisfies WordStudy)),
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toTimelessPrinciple(data: any): TimelessPrincipleStepData {
        if (!data) return { principle: '', timeSpentSeconds: 0 };
        const report = data.verificationReport;
        return {
            principle: data.principle ?? '',
            verificationReport: report
                ? {
                      grounding: report.grounding ?? '',
                      eisegesisRisk: report.eisegesisRisk ?? 'low',
                      generalization: report.generalization ?? 'unknown',
                      notes: report.notes ?? '',
                      verifiedAt: report.verifiedAt ? this.toDate(report.verifiedAt) : new Date(),
                  }
                : undefined,
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toRecognition(data: any): RecognitionStepData {
        if (!data) return { parallels: [], timeSpentSeconds: 0 };
        return {
            parallels: Array.isArray(data.parallels)
                ? data.parallels.map((p: any) => ({
                    reference: p.reference ?? '',
                    relevanceNote: p.relevanceNote ?? '',
                    source: p.source ?? 'pastor-suggested',
                } satisfies ParallelRef))
                : [],
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toFunction(data: any): FunctionStepData {
        if (!data) return { originalAudienceFunction: '', timeSpentSeconds: 0 };
        return {
            originalAudienceFunction: data.originalAudienceFunction ?? '',
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toInsight(data: any): InsightStepData {
        if (!data) {
            return {
                centralIdea: '',
                observations: [],
                openQuestion: '',
                pastoralAnecdote: '',
                doxologicalApplication: '',
                pasteEvents: [],
                timeSpentSeconds: 0,
            };
        }
        return {
            centralIdea: data.centralIdea ?? '',
            observations: Array.isArray(data.observations) ? data.observations : [],
            openQuestion: data.openQuestion ?? '',
            pastoralAnecdote: data.pastoralAnecdote ?? '',
            doxologicalApplication: data.doxologicalApplication ?? '',
            pasteEvents: Array.isArray(data.pasteEvents)
                ? data.pasteEvents.map((p: any) => ({
                    step: p.step === 'timelessPrinciple' ? 'timelessPrinciple' : 'insight',
                    field: p.field,
                    charsCount: p.charsCount ?? 0,
                    at: this.toDate(p.at),
                } satisfies PasteEvent))
                : [],
            timeSpentSeconds: data.timeSpentSeconds ?? 0,
            completedAt: data.completedAt ? this.toDate(data.completedAt) : undefined,
        };
    }

    private toDate(value: any): Date {
        if (!value) return new Date();
        if (value instanceof Timestamp) return value.toDate();
        if (value instanceof Date) return value;
        if (typeof value?.toDate === 'function') return value.toDate();
        return new Date(value);
    }
}

/**
 * Firestore rejects `undefined` at any nesting level. Walks plain
 * objects + arrays and replaces undefined leaves with null. Preserves
 * Date / Timestamp instances unchanged so the calling serialisers can
 * keep converting them. Cheap — the seed payload is small (KB range).
 */
function scrubUndefined(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value;
    if (Array.isArray(value)) return value.map(scrubUndefined);
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = scrubUndefined(v);
        }
        return out;
    }
    return value;
}
