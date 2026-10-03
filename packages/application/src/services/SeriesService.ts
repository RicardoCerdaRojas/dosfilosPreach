import {
    FirebaseSeriesRepository,
    FirestoreExpositoryAssistantCacheRepository,
    GeminiExpositoryAssistant,
    GeminiPericopeDetector,
    GeminiPlanGenerator,
    EXPOSITORY_PIPELINE_VERSION,
    MorphhbOriginalLanguageProvider,
    RVR1960Repository,
    ASVRepository,
    SBLGNTBibleProvider,
} from '@dosfilos/infrastructure';
import {
    SermonSeriesEntity,
    findBooksByAlias,
    getBookById,
    paperDefaultsFromSeries,
    type BibleBookId,
    type IBibleVersionRepository,
    type IOriginalLanguageBibleProvider,
    type PassageReference,
    type PlannedSermon,
    type PlannedSermonExpositoryEnrichment,
    type PlannedSermonStatus,
    type SeriesExegesisDefaults,
    type SyntacticUnit,
} from '@dosfilos/domain';
import { DetectPericopesUseCase } from '../use-cases/exegesis/DetectPericopesUseCase';
import { exegesisService } from './ExegesisService';
import { sermonService } from './SermonService';
import {
    loadBookVerses,
    type LoadBookVersesResult,
} from '../use-cases/exegesis/expository/loadBookVerses';
import { RunExpositoryPassesUseCase } from '../use-cases/exegesis/expository/RunExpositoryPassesUseCase';
import { CachedExpositoryAssistant } from './expository/CachedExpositoryAssistant';
import { LibraryService } from './LibraryService';

export class SeriesService {
    private seriesRepository: FirebaseSeriesRepository;
    private libraryService: LibraryService;
    public detectPericopes: DetectPericopesUseCase;
    public detectPericopesEn: DetectPericopesUseCase;
    /** v1.5 expository assistant pipeline orchestrator. */
    public expositoryPasses: RunExpositoryPassesUseCase;
    private bibleRepoEs: IBibleVersionRepository;
    private bibleRepoEn: IBibleVersionRepository;
    private greekProvider: IOriginalLanguageBibleProvider;
    private hebrewProvider: IOriginalLanguageBibleProvider;

    constructor() {
        this.seriesRepository = new FirebaseSeriesRepository();
        this.libraryService = new LibraryService();

        // Pericope assistant — composition root. We wire one use case per
        // bible source so the caller picks language at the call site
        // (the wizard exposes both via a single `detect({ ..., displayLanguage })`
        // entry point that routes to the right instance). v1.5 will fold
        // both into a single use case once the bible repository abstracts
        // language selection internally.
        const exegesisModelId =
            (import.meta as any).env?.VITE_GEMINI_VISION_MODEL_ID || 'gemini-2.5-pro';
        const detector = new GeminiPericopeDetector(exegesisModelId);
        this.bibleRepoEs = new RVR1960Repository();
        this.bibleRepoEn = new ASVRepository();
        this.detectPericopes = new DetectPericopesUseCase(this.bibleRepoEs, detector);
        this.detectPericopesEn = new DetectPericopesUseCase(this.bibleRepoEn, detector);

        // v1.6 original-language sources for the expository assistant.
        // Single-instance per provider — internal in-memory cache lives
        // at the instance, so sharing maximizes hit rate within a
        // session.
        this.greekProvider = new SBLGNTBibleProvider();
        this.hebrewProvider = new MorphhbOriginalLanguageProvider();

        // v1.5 expository assistant — single GeminiExpositoryAssistant
        // instance shared across all 5 passes. The wizard loads verses
        // once via `loadBookVersesForExpository` and threads them into
        // each pass call.
        //
        // v1.6: wrap with CachedExpositoryAssistant so Pases 1-3
        // (panorama / macro / micro) hit a Firestore cache keyed by
        // (book, language, pipelineVersion). Two pastors studying the
        // same book in the same language only pay the LLM cost once
        // for the canonical structural analysis. Pases 4-5 pass
        // through unchanged (per-pastor homiletical decisions).
        const geminiExpositoryAssistant = new GeminiExpositoryAssistant(exegesisModelId);
        const expositoryCacheRepo = new FirestoreExpositoryAssistantCacheRepository();
        const cachedExpositoryAssistant = new CachedExpositoryAssistant(
            geminiExpositoryAssistant,
            expositoryCacheRepo,
            EXPOSITORY_PIPELINE_VERSION,
        );
        this.expositoryPasses = new RunExpositoryPassesUseCase(cachedExpositoryAssistant);
    }

    /**
     * Loads the verse-by-verse text for the v1.5 expository pipeline.
     * Selects the bible repository by display language so callers
     * don't need to know which translation backs each language.
     */
    async loadBookVersesForExpository(input: {
        bookId: BibleBookId;
        displayLanguage: 'es' | 'en';
        scope?: PassageReference;
    }): Promise<LoadBookVersesResult> {
        // Dispatch original-language source by testament. NT goes
        // to SBLGNT (Greek), OT goes to morphhb/WLC (Hebrew). Books
        // that don't fit either ('mixed' edge cases) get translation
        // only via the loadBookVerses fallback path.
        const book = getBookById(input.bookId);
        const originalProvider =
            book?.testament === 'NT'
                ? this.greekProvider
                : book?.testament === 'OT'
                  ? this.hebrewProvider
                  : undefined;

        return loadBookVerses({
            bookId: input.bookId,
            displayLanguage: input.displayLanguage,
            bibleRepository: input.displayLanguage === 'en' ? this.bibleRepoEn : this.bibleRepoEs,
            ...(originalProvider ? { originalLanguageProvider: originalProvider } : {}),
            ...(input.scope ? { scope: input.scope } : {}),
        });
    }

    /**
     * Dispatches to the right `DetectPericopesUseCase` based on the
     * caller's display language so the wizard reads the verses from the
     * matching translation (RVR for ES, ASV for EN).
     */
    async runPericopeAssistant(input: {
        bookId: import('@dosfilos/domain').BibleBookId;
        displayLanguage: 'es' | 'en';
        targetPericopeCount?: number;
    }) {
        const useCase = input.displayLanguage === 'en' ? this.detectPericopesEn : this.detectPericopes;
        return useCase.execute(input);
    }

    private async retry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await operation();
        } catch (error: any) {
            // Retry on network errors or specific firebase offline errors
            if (retries > 0 && (error.code === 'unavailable' || error.message?.includes('offline') || error.message?.includes('network'))) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.retry(operation, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    async createSeries(data: {
        userId: string;
        title: string;
        description: string;
        startDate?: Date;
        endDate?: Date;
        coverUrl?: string;
    }): Promise<SermonSeriesEntity> {
        try {
            const series = SermonSeriesEntity.create({
                userId: data.userId,
                title: data.title,
                description: data.description,
                startDate: data.startDate,
                endDate: data.endDate,
                coverUrl: data.coverUrl,
                type: 'manual',
                resourceIds: [],
                sermonIds: [],
                draftIds: []
            });
            return await this.retry(() => this.seriesRepository.create(series));
        } catch (error: any) {
            throw new Error(error.message || 'Error al crear la serie');
        }
    }

    async updateSeries(
        id: string,
        data: Partial<{
            title: string;
            description: string;
            startDate?: Date;
            endDate?: Date;
            coverUrl: string;
            sermonIds: string[];
        }>
    ): Promise<SermonSeriesEntity> {
        try {
            const series = await this.retry(() => this.seriesRepository.findById(id));
            if (!series) {
                throw new Error('Serie no encontrada');
            }
            const updatedSeries = series.update(data);
            return await this.retry(() => this.seriesRepository.update(updatedSeries));
        } catch (error: any) {
            throw new Error(error.message || 'Error al actualizar la serie');
        }
    }

    async deleteSeries(id: string): Promise<void> {
        try {
            await this.retry(() => this.seriesRepository.delete(id));
        } catch (error: any) {
            throw new Error(error.message || 'Error al eliminar la serie');
        }
    }

    /**
     * Set the series-level exegesis defaults (rubric template, style
     * guide, initial corpus) that NEW auto-created papers will
     * inherit. Existing papers are NOT mutated by this call —
     * snapshot semantics mean the pastor owns each paper's copy
     * after creation. A separate mass-update affordance is offered
     * from the UI when defaults change and uncustomized papers exist.
     */
    async updateExegesisDefaults(
        seriesId: string,
        defaults: SeriesExegesisDefaults,
    ): Promise<SermonSeriesEntity> {
        try {
            const series = await this.retry(() => this.seriesRepository.findById(seriesId));
            if (!series) {
                throw new Error('Serie no encontrada');
            }
            const next = series.update({
                metadata: {
                    ...series.metadata,
                    exegesisDefaults: defaults,
                },
            });
            return await this.retry(() => this.seriesRepository.update(next));
        } catch (error: any) {
            throw new Error(error.message || 'Error al guardar la configuración exegética');
        }
    }

    async getSeries(id: string): Promise<SermonSeriesEntity | null> {
        try {
            return await this.retry(() => this.seriesRepository.findById(id));
        } catch (error: any) {
            throw new Error(error.message || 'Error al obtener la serie');
        }
    }

    async getUserSeries(userId: string): Promise<SermonSeriesEntity[]> {
        try {
            return await this.retry(() => this.seriesRepository.findByUserId(userId));
        } catch (error: any) {
            throw new Error(error.message || 'Error al obtener las series');
        }
    }

    async addSermonToSeries(seriesId: string, sermonId: string): Promise<void> {
        try {
            const series = await this.retry(() => this.seriesRepository.findById(seriesId));
            if (!series) {
                throw new Error('Serie no encontrada');
            }
            const updatedSeries = series.addSermon(sermonId);
            await this.retry(() => this.seriesRepository.update(updatedSeries));
        } catch (error: any) {
            throw new Error(error.message || 'Error al agregar sermón a la serie');
        }
    }

    async removeSermonFromSeries(seriesId: string, sermonId: string): Promise<void> {
        try {
            const series = await this.retry(() => this.seriesRepository.findById(seriesId));
            if (!series) {
                throw new Error('Serie no encontrada');
            }
            const updatedSeries = series.removeSermon(sermonId);
            await this.retry(() => this.seriesRepository.update(updatedSeries));
        } catch (error: any) {
            throw new Error(error.message || 'Error al remover sermón de la serie');
        }
    }
    async generateSeriesObjective(
        userId: string,
        request: {
            type: 'thematic' | 'expository';
            topicOrBook: string;
            subtopicsOrRange?: string;
            startDate?: Date;
            endDate?: Date;
            frequency?: 'weekly' | 'biweekly' | 'monthly';
            contextResourceIds: string[];
            plannerNotes?: string; // Additional context/notes from chat conversation
            language?: string;
        }
    ) {
        try {
            // Fetch User Resources
            const userResources = await this.retry(() => this.libraryService.getUserResources(userId));
            const selectedUserResources = userResources.filter(r => request.contextResourceIds.includes(r.id));

            // Fetch Core Resources (Always included)
            const coreResources = await this.retry(() => this.libraryService.getCoreResources());

            // Merge resources (Core first, then User)
            const allResources = [...coreResources, ...selectedUserResources];


            const generator = new GeminiPlanGenerator();
            return await generator.generateSeriesObjective({
                ...request,
                subtopicsOrRange: request.subtopicsOrRange,
                plannerNotes: request.plannerNotes,
                numberOfSermons: 0, // Not needed for objective
                startDate: request.startDate, // Not needed for objective but passed if exists
                contextResources: allResources,
                language: request.language
            });
        } catch (error: any) {
            throw new Error(error.message || 'Error al generar objetivo');
        }
    }

    async generateSeriesStructure(
        userId: string,
        request: {
            type: 'thematic' | 'expository';
            topicOrBook: string;
            subtopicsOrRange?: string;
            numberOfSermons?: number;
            startDate?: Date;
            endDate?: Date;
            frequency?: 'weekly' | 'biweekly' | 'monthly';
            contextResourceIds: string[];
            language?: string;
        },
        objective: { title: string; description: string; objective: string }
    ) {
        try {
            // Fetch User Resources
            const userResources = await this.retry(() => this.libraryService.getUserResources(userId));
            const selectedUserResources = userResources.filter(r => request.contextResourceIds.includes(r.id));

            // Fetch Core Resources (Always included)
            const coreResources = await this.retry(() => this.libraryService.getCoreResources());

            // Merge resources (Core first, then User)
            const allResources = [...coreResources, ...selectedUserResources];


            const generator = new GeminiPlanGenerator();
            return await generator.generateSeriesStructure({
                ...request,
                contextResources: allResources,
                language: request.language
            }, objective);
        } catch (error: any) {
            throw new Error(error.message || 'Error al generar estructura');
        }
    }

    async createSeriesFromPlan(
        userId: string,
        plan: {
            series: Partial<SermonSeriesEntity>;
            sermons: {
                title: string;
                description: string;
                passage?: string;
                week: number;
                // Pericope-assistant-driven fields (Phase 3). All optional —
                // legacy callers (manual SeriesForm, thematic planner) keep
                // working unchanged.
                paperId?: string;
                syntacticUnit?: SyntacticUnit;
                status?: PlannedSermonStatus;
                /**
                 * v1.5 expository pipeline output. Captured per
                 * preachable unit and persisted on the planned sermon
                 * so SeriesDetail / paper / Faculty contexts can
                 * surface the propositions and pastoral aim without
                 * re-querying the assistant.
                 */
                expositoryEnrichment?: PlannedSermonExpositoryEnrichment;
            }[];
            frequency?: 'weekly' | 'biweekly' | 'monthly' | 'flexible';
            expositoryAssistant?: {
                version?: string;
                status?: 'pending' | 'running' | 'reviewed';
            };
            /**
             * Display language for any ExegeticalPaper auto-created from a
             * pericope. Pass `'es'` or `'en'` from the wizard caller so
             * paper UIs render in the correct locale. Defaults to 'es' if
             * omitted — falls back rather than throwing because legacy
             * callers (manual SeriesForm) don't pass this field and don't
             * trigger auto-creation either (no syntacticUnit).
             */
            displayLanguage?: 'es' | 'en';
        }
    ): Promise<SermonSeriesEntity> {
        try {
            const startDate = plan.series.startDate ? new Date(plan.series.startDate) : undefined;
            const frequency = plan.frequency || 'weekly';

            // Pre-generate the series id so we can stamp it on each auto-
            // created paper (denormalized back-reference). Auto paper
            // creation happens BEFORE the series doc is persisted, so the
            // id has to be known upfront. We then pass the same id into
            // `SermonSeriesEntity.create` so the saved series matches.
            const seriesId = crypto.randomUUID();

            // Create planned sermons with calculated dates (stored as metadata, NOT actual sermons)
            const plannedSermonsInitial: PlannedSermon[] = plan.sermons.map((sermonData) => {
                let scheduledDate: Date | undefined;

                if (startDate && frequency !== 'flexible') {
                    scheduledDate = new Date(startDate);
                    const weekOffset = sermonData.week - 1;

                    if (frequency === 'weekly') {
                        scheduledDate.setDate(scheduledDate.getDate() + (weekOffset * 7));
                    } else if (frequency === 'biweekly') {
                        scheduledDate.setDate(scheduledDate.getDate() + (weekOffset * 14));
                    } else if (frequency === 'monthly') {
                        scheduledDate.setMonth(scheduledDate.getMonth() + weekOffset);
                    }
                }

                return {
                    id: crypto.randomUUID(),
                    week: sermonData.week,
                    title: sermonData.title,
                    description: sermonData.description,
                    passage: sermonData.passage || '', // Ensure passage exists
                    scheduledDate: scheduledDate,
                    paperId: sermonData.paperId,
                    syntacticUnit: sermonData.syntacticUnit,
                    status: sermonData.status,
                    expositoryEnrichment: sermonData.expositoryEnrichment,
                    // draftId is omitted until user starts developing
                };
            });

            // Auto-create one ExegeticalPaper per pericope that has a
            // syntacticUnit and doesn't already carry a paperId. Eliminates
            // the manual "Crear paper" loop in SeriesDetail.PericopeSection —
            // the pastor finalizes the series and lands with N paper drafts
            // ready to refine. Best-effort: a failed paper per pericope is
            // logged + the pericope keeps `paperId` undefined so the manual
            // "Crear paper" button in SeriesDetail still works as a retry.
            const plannedSermons = await this.autoCreatePapersForPericopes(
                userId,
                seriesId,
                plannedSermonsInitial,
                plan.displayLanguage ?? 'es',
                plan.series.metadata?.exegesisDefaults,
            );

            // Merge pericope-assistant metadata into expository without
            // clobbering pre-existing fields (book, chapterRange) the
            // caller may have set.
            const incomingMetadata = plan.series.metadata ?? {};
            const expository = plan.expositoryAssistant
                ? {
                      ...incomingMetadata.expository,
                      pericopeAssistantVersion: plan.expositoryAssistant.version,
                      pericopeAssistantStatus: plan.expositoryAssistant.status,
                  }
                : incomingMetadata.expository;

            // 1. Create Series Entity with planned sermons in metadata.
            //    Use the pre-generated `seriesId` so it matches the back-
            //    references already stamped on auto-created papers.
            const series = SermonSeriesEntity.create({
                id: seriesId,
                userId,
                title: plan.series.title!,
                description: plan.series.description!,
                startDate: startDate,
                type: plan.series.type!,
                metadata: {
                    ...incomingMetadata,
                    expository,
                    plannedSermons: plannedSermons
                },
                resourceIds: plan.series.resourceIds || [],
                sermonIds: [],
                draftIds: []
            });

            // 2. Save Series first to obtain series.id (sermon placeholders
            //    need it as foreign key + the series must exist before any
            //    sermon points to it).
            const persistedSeries = await this.retry(() => this.seriesRepository.create(series));

            // 3. Spawn one SermonEntity placeholder (status='draft') per
            //    planned sermon. Closes the "Continuar sermón" loop:
            //    SeriesDetail surfaces a button that opens the draft wizard
            //    on a real Sermon doc instead of an empty shell. Best-effort
            //    — a failed placeholder keeps `draftId` undefined and falls
            //    back to the existing on-demand creation path.
            const plannedWithDrafts = await this.autoCreateSermonPlaceholders(
                userId,
                persistedSeries.id,
                plannedSermons,
            );

            const newDraftIds = plannedWithDrafts
                .map((p) => p.draftId)
                .filter((id): id is string => Boolean(id));

            if (newDraftIds.length === 0) {
                return persistedSeries;
            }

            // 4. Patch series with enriched planned sermons + draftIds.
            const enrichedSeries = persistedSeries.update({
                metadata: {
                    ...persistedSeries.metadata,
                    plannedSermons: plannedWithDrafts,
                },
                draftIds: [...(persistedSeries.draftIds ?? []), ...newDraftIds],
            });

            return await this.retry(() => this.seriesRepository.update(enrichedSeries));
        } catch (error: any) {
            throw new Error(error.message || 'Error al guardar el plan');
        }
    }

    /**
     * For each PlannedSermon that has a `syntacticUnit` and no `paperId` yet,
     * create an ExegeticalPaper seeded with the pericope's passage + title +
     * the assistant's justification as the assignmentBrief. Returns the
     * planned sermons with `paperId` + `status: 'paper-in-progress'` stamped
     * on the ones that succeeded.
     *
     * Best-effort semantics: a failed paper for one pericope is logged but
     * does NOT abort the series finalization. The pericope keeps `paperId`
     * undefined and the user retries via the existing manual "Crear paper"
     * button in SeriesDetail.PericopeSection.
     *
     * Parallel via Promise.all — paper creation is independent per pericope.
     * Romanos at 30+ pericopes is the practical upper bound; if that pressures
     * Firestore rate limits, batch it. v1 keeps it simple.
     */
    private async autoCreatePapersForPericopes<T extends {
        id: string;
        title: string;
        syntacticUnit?: SyntacticUnit;
        paperId?: string;
        status?: PlannedSermonStatus;
    }>(
        userId: string,
        seriesId: string,
        plannedSermons: T[],
        displayLanguage: 'es' | 'en',
        exegesisDefaults?: SeriesExegesisDefaults,
    ): Promise<T[]> {
        // Series-level defaults seed each auto-created paper so the
        // pastor doesn't reconfigure rubric/style/corpus per pericope.
        // Snapshot semantics: paper inherits and then owns its copy —
        // editing series defaults later doesn't touch existing papers.
        const defaults = paperDefaultsFromSeries(exegesisDefaults);
        const enriched = await Promise.all(
            plannedSermons.map(async (planned) => {
                if (!planned.syntacticUnit || planned.paperId) return planned;
                const passage = this.syntacticUnitToPassage(planned.syntacticUnit);
                if (!passage) {
                    console.warn(
                        `[SeriesService] Cannot resolve book for pericope ${planned.id}; skipping auto paper creation`,
                    );
                    return planned;
                }
                try {
                    const paper = await exegesisService.createPaper.execute({
                        ownerId: userId,
                        passage,
                        displayLanguage,
                        title: planned.title,
                        assignmentBrief: planned.syntacticUnit.justification ?? null,
                        ...defaults,
                        // Denormalized back-reference so the sermon-
                        // generation use case can patch this series'
                        // planned-sermon entry without an O(N) scan.
                        seriesId,
                        pericopeId: planned.id,
                    });
                    return {
                        ...planned,
                        paperId: paper.id,
                        status: 'paper-in-progress' as PlannedSermonStatus,
                    };
                } catch (err) {
                    console.error(
                        `[SeriesService] auto paper creation failed for pericope ${planned.id}:`,
                        err,
                    );
                    return planned;
                }
            }),
        );
        return enriched;
    }

    /**
     * For each PlannedSermon that doesn't already carry a `draftId`, create
     * a minimal SermonEntity (status='draft', empty content) so SeriesDetail
     * can route "Continuar sermón" directly to the draft wizard on a real
     * Firestore doc. Stamps `draftId` + `status: 'sermon-in-progress'` on
     * the planned sermon when successful.
     *
     * Best-effort: failures are logged + the planned sermon keeps `draftId`
     * undefined. The existing on-demand path (`createSermonFromPlanned`)
     * still works as a retry from SeriesDetail.
     *
     * Parallel via Promise.all — sermon creation is independent per pericope.
     */
    private async autoCreateSermonPlaceholders<T extends {
        id: string;
        title: string;
        passage: string;
        scheduledDate?: Date;
        paperId?: string;
        draftId?: string;
        status?: PlannedSermonStatus;
    }>(
        userId: string,
        seriesId: string,
        plannedSermons: T[],
    ): Promise<T[]> {
        return Promise.all(
            plannedSermons.map(async (planned) => {
                if (planned.draftId) return planned;
                // Las perícopas con paper reciben su sermón por el CTA
                // "Llevar al estudio" del planificador (o por la
                // vinculación del wizard al abrirlo). Un marcador vacío
                // acá haría que la fila muestre "Abrir borrador" —porque
                // ya existe draftId— y abra un wizard en blanco. Saltarlo
                // deja que el planificador ofrezca "Llevar al estudio"
                // hasta que el pastor lo dispare.
                if (planned.paperId) return planned;
                // SermonEntity validates title >= 5 chars. Pad short pericope
                // titles with the passage so we never throw on tiny labels
                // like "Salmo 1".
                const safeTitle =
                    planned.title.trim().length >= 5
                        ? planned.title
                        : `${planned.title} — ${planned.passage}`.trim();
                try {
                    const sermon = await sermonService.createSermon({
                        userId,
                        title: safeTitle,
                        content: '',
                        bibleReferences: planned.passage ? [planned.passage] : [],
                        status: 'draft',
                        seriesId,
                        scheduledDate: planned.scheduledDate,
                        sourcePaperId: planned.paperId,
                        // Seed wizardProgress so SermonWizard's resume path
                        // recognizes the draft and lands the pastor on step 0
                        // with the passage pre-filled instead of the
                        // "no progress" fallback.
                        wizardProgress: {
                            currentStep: 0,
                            passage: planned.passage,
                            lastSaved: new Date(),
                            planId: seriesId,
                        },
                    });
                    return {
                        ...planned,
                        draftId: sermon.id,
                        // Only advance status if the pericope hasn't reached
                        // a later stage already (paper-done > paper-in-progress).
                        status:
                            planned.status === 'sermon-done'
                                ? planned.status
                                : ('sermon-in-progress' as PlannedSermonStatus),
                    };
                } catch (err) {
                    console.error(
                        `[SeriesService] auto sermon placeholder failed for pericope ${planned.id}:`,
                        err,
                    );
                    return planned;
                }
            }),
        );
    }

    /**
     * Resolves a `SyntacticUnit` into the canonical `PassageReference` shape
     * the exegesis use cases expect. Mirrors the converter in
     * `SeriesDetail.syntacticUnitToPassage` — kept duplicated here (service
     * side, no domain coupling on the web util) until the next refactor lifts
     * it into a shared domain helper. Returns null when the book alias can't
     * be resolved (shouldn't happen for assistant-produced units, defensive
     * against manual edits).
     */
    private syntacticUnitToPassage(unit: SyntacticUnit): PassageReference | null {
        const matches = findBooksByAlias(unit.book.toLowerCase().trim());
        if (matches.length === 0) return null;
        const book = matches[0]!;
        return {
            bookId: book.id,
            chapterStart: unit.chapterStart,
            verseStart: unit.verseStart,
            chapterEnd: unit.chapterEnd,
            verseEnd: unit.verseEnd,
        };
    }

    // Legacy method kept for compatibility or full-auto mode if needed
    async generatePlan(
        userId: string,
        request: {
            type: 'thematic' | 'expository';
            topicOrBook: string;
            subtopicsOrRange?: string;
            numberOfSermons: number;
            startDate: Date;
            contextResourceIds: string[];
        }
    ): Promise<SermonSeriesEntity> {
        try {
            // 1. Fetch context resources
            const userResources = await this.retry(() => this.libraryService.getUserResources(userId));
            const contextResources = userResources.filter(r => request.contextResourceIds.includes(r.id));

            // 2. Generate Plan Structure

            const generator = new GeminiPlanGenerator();
            const plan = await generator.generatePlan({
                ...request,
                contextResources
            });

            return this.createSeriesFromPlan(userId, {
                series: {
                    ...plan.series,
                    resourceIds: request.contextResourceIds
                },
                sermons: plan.sermons
            });
        } catch (error: any) {
            throw new Error(error.message || 'Error al generar el plan de predicación');
        }
    }
}

export const seriesService = new SeriesService();
