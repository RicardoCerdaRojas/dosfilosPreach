import { useMutation } from '@tanstack/react-query';
import { seriesService } from '@dosfilos/application';
import type {
    BibleBookId,
    BookPanorama,
    ExegeticalUnit,
    FidelityReview,
    MacroSection,
    PassResult,
    PassageReference,
    PreachableUnit,
    AssistantVerseInput,
    SuperMacroSection,
} from '@dosfilos/domain';

/**
 * Hook that exposes the v1.5 expository assistant pipeline as 5
 * staged React Query mutations. The wizard owns the workflow state
 * (loaded verses + accumulated pass outputs) and calls these
 * mutations sequentially, observing each completion before
 * launching the next.
 *
 * Verse loading is exposed as a synchronous helper (NOT a mutation)
 * because it's pure JSON lookup with no I/O latency — wrapping it
 * in useMutation would just add a render cycle for no benefit.
 */
export function useExpositoryAssistant() {
    const loadVerses = (input: {
        bookId: BibleBookId;
        displayLanguage: 'es' | 'en';
        scope?: PassageReference;
    }) => seriesService.loadBookVersesForExpository(input);

    const runPanorama = useMutation({
        mutationFn: async (input: PanoramaInput): Promise<PassResult<BookPanorama>> => {
            const payload: Parameters<typeof seriesService.expositoryPasses.runPanorama>[0] = {
                book: input.book,
                displayLanguage: input.displayLanguage,
                verses: input.verses,
            };
            if (input.targetPreachableCount !== undefined) payload.targetPreachableCount = input.targetPreachableCount;
            if (input.sourceLanguage !== undefined) payload.sourceLanguage = input.sourceLanguage;
            if (input.scopeKey) payload.scopeKey = input.scopeKey;
            return seriesService.expositoryPasses.runPanorama(payload);
        },
    });

    const runSuperMacro = useMutation({
        mutationFn: async (input: SuperMacroHookInput): Promise<PassResult<SuperMacroSection[]>> => {
            const payload: Parameters<typeof seriesService.expositoryPasses.runSuperMacroStructure>[0] = {
                book: input.book,
                displayLanguage: input.displayLanguage,
                verses: input.verses,
                panorama: input.panorama,
            };
            if (input.sourceLanguage !== undefined) payload.sourceLanguage = input.sourceLanguage;
            if (input.scopeKey) payload.scopeKey = input.scopeKey;
            return seriesService.expositoryPasses.runSuperMacroStructure(payload);
        },
    });

    const runMacro = useMutation({
        mutationFn: async (input: MacroInput): Promise<PassResult<MacroSection[]>> => {
            const payload: Parameters<typeof seriesService.expositoryPasses.runMacroStructure>[0] = {
                book: input.book,
                displayLanguage: input.displayLanguage,
                verses: input.verses,
                panorama: input.panorama,
            };
            if (input.superMacroSections) payload.superMacroSections = input.superMacroSections;
            if (input.sourceLanguage !== undefined) payload.sourceLanguage = input.sourceLanguage;
            if (input.scopeKey) payload.scopeKey = input.scopeKey;
            return seriesService.expositoryPasses.runMacroStructure(payload);
        },
    });

    const runMicro = useMutation({
        mutationFn: async (input: MicroInput): Promise<PassResult<ExegeticalUnit[]>> => {
            const payload: Parameters<typeof seriesService.expositoryPasses.runMicroStructure>[0] = {
                book: input.book,
                displayLanguage: input.displayLanguage,
                verses: input.verses,
                panorama: input.panorama,
                macroSections: input.macroSections,
            };
            if (input.sourceLanguage !== undefined) payload.sourceLanguage = input.sourceLanguage;
            if (input.scopeKey) payload.scopeKey = input.scopeKey;
            return seriesService.expositoryPasses.runMicroStructure(payload);
        },
    });

    const runPreachable = useMutation({
        mutationFn: async (input: PreachableInput): Promise<PassResult<PreachableUnit[]>> => {
            const payload: Parameters<typeof seriesService.expositoryPasses.runPreachableConversion>[0] = {
                book: input.book,
                displayLanguage: input.displayLanguage,
                verses: input.verses,
                panorama: input.panorama,
                macroSections: input.macroSections,
                exegeticalUnits: input.exegeticalUnits,
            };
            if (input.targetPreachableCount !== undefined) payload.targetPreachableCount = input.targetPreachableCount;
            if (input.sourceLanguage !== undefined) payload.sourceLanguage = input.sourceLanguage;
            if (input.scopeKey) payload.scopeKey = input.scopeKey;
            if (input.strictMode === true) payload.strictMode = true;
            // «Refinar» del Pase 5: sin esto la observación se perdía aquí.
            if (input.regenerationHint?.trim()) payload.regenerationHint = input.regenerationHint;
            return seriesService.expositoryPasses.runPreachableConversion(payload);
        },
    });

    const runFidelity = useMutation({
        mutationFn: async (input: FidelityInput): Promise<PassResult<FidelityReview>> => {
            const payload: Parameters<typeof seriesService.expositoryPasses.runFidelityReview>[0] = {
                book: input.book,
                displayLanguage: input.displayLanguage,
                verses: input.verses,
                panorama: input.panorama,
                macroSections: input.macroSections,
                exegeticalUnits: input.exegeticalUnits,
                preachableUnits: input.preachableUnits,
            };
            if (input.sourceLanguage !== undefined) payload.sourceLanguage = input.sourceLanguage;
            if (input.scopeKey) payload.scopeKey = input.scopeKey;
            return seriesService.expositoryPasses.runFidelityReview(payload);
        },
    });

    return {
        loadVerses,
        runPanorama,
        runSuperMacro,
        runMacro,
        runMicro,
        runPreachable,
        runFidelity,
    };
}

interface BaseInput {
    book: string;
    displayLanguage: 'es' | 'en';
    verses: AssistantVerseInput[];
    /** v1.6: original-language source tag for the verses, threaded
     * through to the prompt builders so the model knows what it's
     * reading (real Greek/Hebrew vs translation surrogate). */
    sourceLanguage?: 'greek' | 'hebrew' | 'translation';
    /** v1.7 sub-book scope marker — when set, cache wrapper bypasses
     * the whole-book cache. */
    scopeKey?: string;
}

interface PanoramaInput extends BaseInput {
    targetPreachableCount?: number;
}

interface SuperMacroHookInput extends BaseInput {
    panorama: BookPanorama;
}

interface MacroInput extends BaseInput {
    panorama: BookPanorama;
    /** v1.6 two-tier mode — when set, macros nest under these super-macros. */
    superMacroSections?: SuperMacroSection[];
}

interface MicroInput extends BaseInput {
    panorama: BookPanorama;
    macroSections: MacroSection[];
}

interface PreachableInput extends BaseInput {
    panorama: BookPanorama;
    macroSections: MacroSection[];
    exegeticalUnits: ExegeticalUnit[];
    targetPreachableCount?: number;
    strictMode?: boolean;
    /** Las observaciones abiertas del Pase 5 que «Refinar» devuelve al Pase 4. */
    regenerationHint?: string;
}

interface FidelityInput extends BaseInput {
    panorama: BookPanorama;
    macroSections: MacroSection[];
    exegeticalUnits: ExegeticalUnit[];
    preachableUnits: PreachableUnit[];
}
