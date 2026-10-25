import {
    BOOKS_WITH_ARAMAIC_SECTIONS,
    findBooksByAlias,
    normalizeAlias,
    type BibleBookId,
    type BookPanorama,
    type ExegeticalUnit,
    type FidelityInput,
    type FidelityReview,
    type IExpositoryAssistant,
    type IExpositoryAssistantCacheRepository,
    type MacroInput,
    type MacroSection,
    type MicroInput,
    type PanoramaInput,
    type PassResult,
    type PreachableInput,
    type PreachableUnit,
    type SuperMacroInput,
    type SuperMacroSection,
} from '@dosfilos/domain';

/**
 * Decorator that wraps an `IExpositoryAssistant` (typically the
 * Gemini implementation) with a transparent server-side cache for
 * the structural passes (Pases 1-3). Pases 4-5 pass through
 * unchanged — they involve homiletical interpretation that
 * shouldn't be shared across pastors.
 *
 * Cache lookup happens BEFORE the wrapped call. On miss, the
 * wrapped call runs and the result is upserted into the cache
 * fire-and-forget (the user gets the response immediately; the
 * cache write happens in the background, failures don't block).
 *
 * Trust model: when the cache returns a value, it is treated as
 * authoritative for that (book, language, pipelineVersion) tuple.
 * The decorator does NOT cross-validate (e.g. ensure the cached
 * macros were derived from the input panorama) — the cache
 * document is internally consistent because each entry was
 * written by a single pipeline run.
 *
 * Key resolution: the assistant input carries `book` as a display
 * name ("Filemón" / "Philemon"). The cache key needs the SBL
 * canonical id ("PHM"). Resolution via `findBooksByAlias` from
 * the bible canon helpers; on resolution failure (book name not
 * recognized) the decorator silently passes through to the wrapped
 * assistant — no caching, no error.
 */
export class CachedExpositoryAssistant implements IExpositoryAssistant {
    constructor(
        private readonly wrapped: IExpositoryAssistant,
        private readonly cacheRepo: IExpositoryAssistantCacheRepository,
        private readonly pipelineVersion: string,
    ) {}

    /**
     * v1.6 two-tier mode. NOT cached for v1.6 — super-macros are
     * canonical like panorama / macro / micro but cache schema in
     * `IExpositoryAssistantCacheRepository` doesn't have a slot for
     * them yet. Pass-through to the wrapped assistant. A v1.7 cache
     * schema extension can fold them in alongside the other passes.
     */
    async runSuperMacroStructure(input: SuperMacroInput): Promise<PassResult<SuperMacroSection[]>> {
        return this.wrapped.runSuperMacroStructure(input);
    }

    async runPanorama(input: PanoramaInput): Promise<PassResult<BookPanorama>> {
        // Sub-book scope: bypass the cache entirely. The cache key only
        // tracks bookId/language/version, so a Mateo 10 run would
        // otherwise return whole-book Mateo cached results.
        if (input.scopeKey) return this.wrapped.runPanorama(input);

        const bookId = this.resolveBookId(input.book);
        if (!bookId) return this.wrapped.runPanorama(input);

        const cached = await this.cacheRepo.get(bookId, input.displayLanguage, this.versionFor(bookId));
        if (cached?.panorama) {
            console.log('[CachedExpositoryAssistant] panorama cache HIT', { bookId, lang: input.displayLanguage });
            // Fire-and-forget: don't await, don't fail the response on bookkeeping errors.
            void this.cacheRepo.recordHit(bookId, input.displayLanguage, this.versionFor(bookId), 'panorama');
            return {
                payload: cached.panorama,
                modelId: cached.panoramaModelId ?? 'cached',
                tokensUsed: 0,
                passVersion: cached.panoramaPassVersion ?? `cached@${this.versionFor(bookId)}:panorama`,
            };
        }

        const result = await this.wrapped.runPanorama(input);
        void this.cacheRepo.upsertPanorama(
            bookId,
            input.displayLanguage,
            this.versionFor(bookId),
            result.payload,
            result.modelId,
            result.passVersion,
        );
        return result;
    }

    async runMacroStructure(input: MacroInput): Promise<PassResult<MacroSection[]>> {
        if (input.scopeKey) return this.wrapped.runMacroStructure(input);

        const bookId = this.resolveBookId(input.book);
        if (!bookId) return this.wrapped.runMacroStructure(input);

        const cached = await this.cacheRepo.get(bookId, input.displayLanguage, this.versionFor(bookId));
        if (cached?.macroSections) {
            console.log('[CachedExpositoryAssistant] macro cache HIT', { bookId, lang: input.displayLanguage });
            void this.cacheRepo.recordHit(bookId, input.displayLanguage, this.versionFor(bookId), 'macro');
            return {
                payload: cached.macroSections,
                modelId: cached.panoramaModelId ?? 'cached',
                tokensUsed: 0,
                passVersion: cached.macroPassVersion ?? `cached@${this.versionFor(bookId)}:macro`,
            };
        }

        const result = await this.wrapped.runMacroStructure(input);
        void this.cacheRepo.upsertMacro(
            bookId,
            input.displayLanguage,
            this.versionFor(bookId),
            result.payload,
            result.passVersion,
        );
        return result;
    }

    async runMicroStructure(input: MicroInput): Promise<PassResult<ExegeticalUnit[]>> {
        if (input.scopeKey) return this.wrapped.runMicroStructure(input);

        const bookId = this.resolveBookId(input.book);
        if (!bookId) return this.wrapped.runMicroStructure(input);

        const cached = await this.cacheRepo.get(bookId, input.displayLanguage, this.versionFor(bookId));
        if (cached?.exegeticalUnits) {
            console.log('[CachedExpositoryAssistant] micro cache HIT', { bookId, lang: input.displayLanguage });
            void this.cacheRepo.recordHit(bookId, input.displayLanguage, this.versionFor(bookId), 'micro');
            return {
                payload: cached.exegeticalUnits,
                modelId: cached.panoramaModelId ?? 'cached',
                tokensUsed: 0,
                passVersion: cached.microPassVersion ?? `cached@${this.versionFor(bookId)}:micro`,
            };
        }

        const result = await this.wrapped.runMicroStructure(input);
        void this.cacheRepo.upsertMicro(
            bookId,
            input.displayLanguage,
            this.versionFor(bookId),
            result.payload,
            result.passVersion,
        );
        return result;
    }

    // Pases 4 (preachable conversion) y 5 (fidelity review) NEVER
    // hit the cache — they're per-pastor homiletical decisions.
    // Pure pass-through to the wrapped assistant.

    async runPreachableConversion(input: PreachableInput): Promise<PassResult<PreachableUnit[]>> {
        return this.wrapped.runPreachableConversion(input);
    }

    async runFidelityReview(input: FidelityInput): Promise<PassResult<FidelityReview>> {
        return this.wrapped.runFidelityReview(input);
    }

    /**
     * La versión de caché de un libro. Esdras y Daniel llevan la suya desde
     * que el prompt avisa de sus secciones en arameo: sin esto, sus panoramas
     * ya guardados seguían saliendo como si todo el libro fuera hebreo. Subir
     * la versión de todo el planificador habría tirado la caché de los 66.
     */
    private versionFor(bookId: BibleBookId): string {
        return BOOKS_WITH_ARAMAIC_SECTIONS.has(bookId) ? `${this.pipelineVersion}+arameo` : this.pipelineVersion;
    }

    private resolveBookId(bookDisplay: string): BibleBookId | null {
        const matches = findBooksByAlias(normalizeAlias(bookDisplay));
        return matches.length > 0 ? matches[0]!.id : null;
    }
}
