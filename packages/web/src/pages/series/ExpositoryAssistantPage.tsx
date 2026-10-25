import {
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Link,
    useNavigate,
    useSearchParams,
} from 'react-router-dom';
import {
    useQueryClient,
} from '@tanstack/react-query';
import {
    toast,
} from 'sonner';
import {
    AlertTriangle,
    ArrowLeft,
    Loader2,
} from 'lucide-react';
import {
    MethodologyPresentation,
} from '@/components/expository/MethodologyPresentation';
import {
    useTranslation,
} from '@/i18n';
import {
    useFirebase,
} from '@/context/firebase-context';
import {
    parseLocalDate,
} from '@/lib/dateUtils';
import {
    useExpositoryAssistant,
} from '@/hooks/series/useExpositoryAssistant';
import {
    useFacultyProjects,
} from '@/hooks/faculty/useFacultyProjects';
import {
    clearExpositoryDraft,
    loadExpositoryDraft,
    saveExpositoryDraft,
} from '@/hooks/series/expositoryDraftStorage';
import {
    seriesService,
} from '@dosfilos/application';
import {
    formatPassageReference,
    getAllBooks,
    wholeBookPassage,
    type AssistantVerseInput,
    type BibleBookId,
    type BookPanorama,
    type ExegeticalUnit,
    type FidelityReview,
    type MacroSection,
    type AIProject,
    type PassResult,
    type PassageReference,
    type PreachableUnit,
    type SuperMacroSection,
} from '@dosfilos/domain';
import {
    FidelityResult,
} from './expository/FidelityResult';
import {
    CollapsedStrip,
    PassCard,
} from './expository/PassCard';
import {
    MacroResult,
    MicroResult,
    PanoramaResult,
} from './expository/PassResults';
import {
    PreachableResult,
} from './expository/PreachableResult';
import {
    CreateSeriesCard,
    SetupCard,
    toastErrorMessage,
} from './expository/SetupCard';
import {
    RefinePreachableCta,
    StrictContinueCta,
} from './expository/ctas';
import {
    derivePassState,
    formatRangeForReader,
} from './expository/passState';
import { useExpositoryViewPrefs } from './expository/useExpositoryViewPrefs';
import { buildPassInput, sourceLanguageFromLoaded } from './expository/passInput';
import { ProjectSeriesBanner, ProjectUnavailableNotice } from './components/ProjectSeriesBanner';
import { ProjectSeriesSources } from './components/ProjectSeriesSources';
import {
    PROJECT_SOURCES_PENDING,
    type ProjectSeriesSourcesState,
    activeProjectById,
    buildSeriesPlan,
    initialBookFor,
    projectEntryState,
    shouldRestoreDraft,
} from './utils/serieDesdeProyecto';

/**
 * v1.5 expository assistant wizard.
 *
 * The expository wizard at /dashboard/plans/pericope. Runs
 * the 5-pass pipeline (panorama → macro → micro → preachable →
 * fidelity) with staged UI feedback — each pass appears as a card
 * with state pending / running / done / error and renders its
 * result inline as soon as it lands.
 *
 * D.2 wires Pases 1 (panorama) and 2 (macroestructura). On "Iniciar
 * análisis" we load verses synchronously and then auto-chain
 * panorama → macro; D.3 will continue the chain into micro →
 * preachable → fidelity.
 *
 * Workflow state lives in component state because v1.5 does not
 * persist intermediate runs server-side — only the final
 * SermonSeries does. D.4 will add localStorage draft persistence
 * so a tab close mid-run is recoverable.
 */
/** El nombre del libro en el idioma de la pantalla; el id si no se encuentra. */
function bookName(
    books: ReadonlyArray<{ id: BibleBookId; nameEs: string; nameEn: string }>,
    id: BibleBookId,
    lang: 'es' | 'en',
): string {
    const b = books.find((x) => x.id === id);
    return b ? (lang === 'en' ? b.nameEn : b.nameEs) : id;
}

export function ExpositoryAssistantPage() {
    const { t, i18n } = useTranslation('series');
    const navigate = useNavigate();
    const { user } = useFirebase();
    const lang: 'es' | 'en' = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';

    const allBooks = useMemo(() => getAllBooks(), []);
    const [bookId, setBookId] = useState<BibleBookId>('2PE');
    // El libro sobre el que corrieron los pases. La bibliografía heredada y
    // el borrador lo usan a él, no al selector: analizar Nehemías y después
    // tocar el selector no puede hacer que la serie herede comentarios de Esdras.
    const [analyzedBookId, setAnalyzedBookId] = useState<BibleBookId | null>(null);

    // Abierto desde un proyecto (`?projectId=&book=`, etapa 3 de ADR-046).
    // Sin parámetros, todo sigue como siempre.
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const projectIdParam = searchParams.get('projectId');
    const bookParam = searchParams.get('book');
    const { projects, isLoadingProjects } = useFacultyProjects();
    const project = useMemo(() => activeProjectById(projects, projectIdParam), [projects, projectIdParam]);
    const projectState = projectEntryState({ projectIdParam, loading: isLoadingProjects || !user?.uid, project });
    const projectBooks = useMemo(() => project?.bibliographyCriteria?.bibleBooks ?? [], [project]);
    const [bookChoiceRequired, setBookChoiceRequired] = useState(false);
    const [projectSources, setProjectSources] = useState<ProjectSeriesSourcesState>(PROJECT_SOURCES_PENDING);
    const [targetCount, setTargetCount] = useState<number | ''>('');

    // v1.7 scope picker. Default = "whole book" (preserves legacy UX —
    // a fresh visit lands on a working configuration). Switching to
    // "passage" reveals a PassagePicker that captures cap único / rango
    // caps / verse range / cross-chapter ranges. The effective scope
    // threads into loadBookVerses (verse filter) + every pass via
    // scopeKey (cache bypass — sub-book runs shouldn't collide with
    // whole-book cache).
    const [scopeMode, setScopeMode] = useState<'whole-book' | 'passage'>('whole-book');
    const [passageScope, setPassageScope] = useState<PassageReference | null>(null);
    const [scopeError, setScopeError] = useState<string | null>(null);
    const effectiveScope: PassageReference | null = useMemo(() => {
        if (scopeMode === 'whole-book') return wholeBookPassage(bookId);
        return passageScope;
    }, [scopeMode, bookId, passageScope]);
    const isWholeBook = scopeMode === 'whole-book';
    const scopeKey = useMemo(() => {
        if (!effectiveScope || isWholeBook) return undefined;
        return formatPassageReference(effectiveScope, lang);
    }, [effectiveScope, isWholeBook, lang]);
    // When the user picks a passage with a different book, sync bookId
    // so downstream prompts agree (book pickers + scope agree on the
    // source). Silent — no toast, no warning.
    useEffect(() => {
        if (scopeMode !== 'passage' || !passageScope) return;
        if (passageScope.bookId !== bookId) setBookId(passageScope.bookId);
    }, [scopeMode, passageScope, bookId]);

    // Run state — accumulates as each pass completes.
    const [verses, setVerses] = useState<AssistantVerseInput[] | null>(null);
    const [bookDisplay, setBookDisplay] = useState<string | null>(null);
    const [sourceLanguageInState, setSourceLanguageInState] = useState<'greek' | 'hebrew' | 'translation' | null>(null);
    const [panorama, setPanorama] = useState<BookPanorama | null>(null);
    const [macroSections, setMacroSections] = useState<MacroSection[] | null>(null);
    // v1.6 item 3: two-tier mode for long books. When enabled, a
    // super-macro pass (Pase 2a) runs between panorama and macro and
    // the macro pass nests each macro under one of the super-macros.
    const [twoTierMode, setTwoTierMode] = useState(false);
    const [superMacroSections, setSuperMacroSections] = useState<SuperMacroSection[] | null>(null);
    // v1.6 item 2: strict mode. When enabled the pipeline stops after
    // Pase 3, the pastor confirms per-unit that an exegetical paper
    // exists, and Pase 4 runs only when every unit is confirmed. The
    // preachable prompt swaps its "panoramic hypothesis" framing for
    // an authoritative voice.
    const [strictMode, setStrictMode] = useState(false);
    const [unitsConfirmedHavePapers, setUnitsConfirmedHavePapers] = useState<Set<string>>(new Set());
    const toggleUnitHasPaper = (unitId: string) => {
        setUnitsConfirmedHavePapers((prev) => {
            const next = new Set(prev);
            if (next.has(unitId)) next.delete(unitId);
            else next.add(unitId);
            return next;
        });
    };
    const [exegeticalUnits, setExegeticalUnits] = useState<ExegeticalUnit[] | null>(null);
    const [preachableUnits, setPreachableUnits] = useState<PreachableUnit[] | null>(null);
    const [fidelityReview, setFidelityReview] = useState<FidelityReview | null>(null);

    // Series-creation form state — populated once preachable units land.
    const [seriesTitle, setSeriesTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'flexible'>('weekly');
    const [creatingSeries, setCreatingSeries] = useState(false);

    // Preferencias de LECTURA — no dicen nada del libro que se divide.
    const vista = useExpositoryViewPrefs();
    const {
        textZoom, setTextZoom, zoomClassName,
        collapsedPasses, setCollapsedPasses, togglePass,
        methodologyOpen, setMethodologyOpen,
    } = vista;
    // Pase 5 issue triage. Indices into fidelityReview.issues. The
    // two sets are mutually exclusive (toggling one removes the
    // other) — an issue is either acted upon or actively dismissed,
    // never both. Persists with the draft so triage decisions
    // survive a tab close.
    const [addressedIssues, setAddressedIssues] = useState<Set<number>>(new Set());
    const [ignoredIssues, setIgnoredIssues] = useState<Set<number>>(new Set());
    const toggleIssueAddressed = (idx: number) => {
        setAddressedIssues((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
        setIgnoredIssues((prev) => {
            if (!prev.has(idx)) return prev;
            const next = new Set(prev);
            next.delete(idx);
            return next;
        });
    };
    const toggleIssueIgnored = (idx: number) => {
        setIgnoredIssues((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
        setAddressedIssues((prev) => {
            if (!prev.has(idx)) return prev;
            const next = new Set(prev);
            next.delete(idx);
            return next;
        });
    };

    const assistant = useExpositoryAssistant();

    // Hydrate from localStorage on mount. Restoring a draft skips the
    // setup form back to where the pastor was, so they can continue
    // reviewing the analysis without re-running the pipeline.
    // Con proyecto se espera a saber si sigue activo: su borrador vive en su
    // propia clave, y un borrador suelto (o de otro libro) no se restaura.
    const [hydrated, setHydrated] = useState(false);
    // La clave del borrador se fija al hidratar: si el proyecto se archiva a
    // mitad de camino, el análisis no pasa a pisar el borrador suelto.
    const [draftScope, setDraftScope] = useState<string | null>(null);
    useEffect(() => {
        if (hydrated || projectState === 'loading') return;
        const scope = project?.id ?? null;
        setDraftScope(scope);
        const stored = loadExpositoryDraft(scope);
        const draft = stored && shouldRestoreDraft(stored, { projectId: scope, bookParam }) ? stored : null;
        if (!draft && (projectIdParam || bookParam)) {
            const inicial = initialBookFor({
                bookParam,
                projectBooks,
                allBookIds: allBooks.map((b) => b.id),
                hasProject: Boolean(project),
            });
            setBookId(inicial.bookId);
            setBookChoiceRequired(inicial.mustChoose);
        }
        if (draft) {
            setBookId(draft.bookId);
            setAnalyzedBookId(draft.bookId);
            if (draft.targetPreachableCount !== undefined) {
                setTargetCount(draft.targetPreachableCount);
            }
            setVerses(draft.verses);
            setBookDisplay(draft.bookDisplay);
            if (draft.panorama) setPanorama(draft.panorama);
            if (draft.macroSections) setMacroSections(draft.macroSections);
            if (draft.exegeticalUnits) setExegeticalUnits(draft.exegeticalUnits);
            if (draft.preachableUnits) setPreachableUnits(draft.preachableUnits);
            if (draft.fidelityReview) setFidelityReview(draft.fidelityReview);
            if (draft.addressedIssueIndices) setAddressedIssues(new Set(draft.addressedIssueIndices));
            if (draft.ignoredIssueIndices) setIgnoredIssues(new Set(draft.ignoredIssueIndices));
            toast.success(t('expository.toast.draftRestored') as string);
        }
        setHydrated(true);
    }, [hydrated, t, projectState, project, projectIdParam, bookParam, projectBooks, allBooks]);

    // Persist a draft whenever any pass output lands. Keeps the
    // localStorage entry in sync without an explicit "save" button.
    useEffect(() => {
        if (!hydrated || !verses || !bookDisplay) return;
        saveExpositoryDraft({
            bookId: analyzedBookId ?? bookId,
            ...(draftScope ? { projectId: draftScope } : {}),
            displayLanguage: lang,
            bookDisplay,
            ...(typeof targetCount === 'number' ? { targetPreachableCount: targetCount } : {}),
            verses,
            ...(panorama ? { panorama } : {}),
            ...(macroSections ? { macroSections } : {}),
            ...(exegeticalUnits ? { exegeticalUnits } : {}),
            ...(preachableUnits ? { preachableUnits } : {}),
            ...(fidelityReview ? { fidelityReview } : {}),
            ...(addressedIssues.size > 0 ? { addressedIssueIndices: Array.from(addressedIssues) } : {}),
            ...(ignoredIssues.size > 0 ? { ignoredIssueIndices: Array.from(ignoredIssues) } : {}),
        }, draftScope);
    }, [hydrated, draftScope, analyzedBookId, bookId, lang, bookDisplay, targetCount, verses, panorama, macroSections, exegeticalUnits, preachableUnits, fidelityReview, addressedIssues, ignoredIssues]);

    // Pre-fill the series-creation form once preachable units are
    // available — saves the pastor a manual title entry in the
    // common case. Sub-book scope = use the formatted passage
    // (e.g. "Mateo 10", "Romanos 1:18-3:20") so the title reflects
    // the actual fragment, not the whole book.
    useEffect(() => {
        if (!preachableUnits || !bookDisplay || seriesTitle) return;
        const subjectLabel = effectiveScope && !isWholeBook
            ? formatPassageReference(effectiveScope, lang)
            : bookDisplay;
        setSeriesTitle(t('expository.create.defaultTitle', { book: subjectLabel }) as string);
    }, [preachableUnits, bookDisplay, seriesTitle, effectiveScope, isWholeBook, lang, t]);

    const handleStart = async () => {
        // Antes de hidratar no se sabe en qué clave guardar el borrador.
        if (!hydrated) return;
        // Gate the run on a valid scope. Whole-book always passes;
        // passage mode needs a parsed PassageReference.
        if (!effectiveScope) {
            setScopeError(t('expository.setup.scope.passageHelper') as string);
            return;
        }
        setScopeError(null);

        // Reset prior run state if the pastor restarts. El libro analizado
        // también: si la nueva carga falla, el aviso de «cambiaste el libro»
        // no puede seguir hablando de un análisis que ya se borró.
        setAnalyzedBookId(null);
        setPanorama(null);
        setSuperMacroSections(null);
        setMacroSections(null);
        setExegeticalUnits(null);
        setPreachableUnits(null);
        setFidelityReview(null);
        // Triage decisions are scoped to a specific review run —
        // a fresh review will produce different issues, so old
        // triage no longer applies.
        setAddressedIssues(new Set());
        setIgnoredIssues(new Set());

        let loaded;
        try {
            loaded = await assistant.loadVerses({
                bookId,
                displayLanguage: lang,
                ...(isWholeBook ? {} : { scope: effectiveScope }),
            });
        } catch (err: any) {
            console.error('[expository] loadVerses failed:', err);
            toast.error(err?.message ?? (t('expository.toast.loadFailed') as string));
            return;
        }

        // Min-verses guard — analysis on a 1-2 verse fragment produces
        // garbage. 5 is the floor for syntactic chunking to be
        // meaningful.
        const MIN_VERSES = 5;
        if (loaded.verses.length < MIN_VERSES) {
            const msg = t('expository.setup.scope.minVersesError', { min: MIN_VERSES }) as string;
            setScopeError(msg);
            toast.error(msg);
            return;
        }

        setVerses(loaded.verses);
        setBookDisplay(loaded.book);
        setAnalyzedBookId(bookId);

        // Surface the source (original-language vs translation
        // fallback) so the pastor knows what the model is reading.
        // The toast is informative on success, warning on fallback —
        // the methodology's credibility depends on the pastor knowing
        // whether they're seeing original Greek/Hebrew or surrogate
        // translation analysis.
        if (loaded.source === 'translation' && loaded.fallbackReason) {
            toast.warning(
                t('expository.toast.translationFallback', {
                    reason: loaded.fallbackReason,
                }) as string,
            );
        } else if (loaded.source !== 'translation') {
            toast.success(
                t(`expository.toast.sourceLoaded.${loaded.source}`) as string,
            );
        }

        // Map the load result's source tag onto the assistant
        // input's sourceLanguage. Lets the prompts emit the right
        // preamble (original-greek / original-hebrew / translation
        // surrogate) so the model knows what it's reading.
        const sourceLanguage =
            sourceLanguageFromLoaded(loaded.source);
        setSourceLanguageInState(sourceLanguage);
        const baseInput = buildPassInput({
            book: loaded.book,
            displayLanguage: lang,
            verses: loaded.verses,
            sourceLanguage,
            ...(scopeKey ? { scopeKey } : {}),
        });
        const targetOpt = typeof targetCount === 'number' ? { targetPreachableCount: targetCount } : {};

        // Run the 5 passes in sequence via nested onSuccess. Each
        // nesting level adds one pass; failures at any level surface
        // a toast and stop the chain (the pastor sees the failed
        // card and can restart).
        // Helper closure: kicks off the macro pass + downstream chain.
        // Called either directly (single-tier) or after the super-macro
        // pass lands (two-tier).
        const runMacroAndDownstream = (
            panoramaResult: PassResult<BookPanorama>,
            supers: SuperMacroSection[] | undefined,
        ) => {
            assistant.runMacro.mutate(
                {
                    ...baseInput,
                    panorama: panoramaResult.payload,
                    ...(supers && supers.length > 0 ? { superMacroSections: supers } : {}),
                },
                {
                    onSuccess: (macroResult) => {
                        setMacroSections(macroResult.payload);
                        runMicroAndDownstream(panoramaResult, macroResult);
                    },
                    onError: (err: any) => {
                        console.error('[expository] runMacro failed:', err);
                        toast.error(toastErrorMessage(err, t, 'expository.toast.macroFailed'));
                    },
                },
            );
        };

        const runMicroAndDownstream = (
            panoramaResult: PassResult<BookPanorama>,
            macroResult: PassResult<MacroSection[]>,
        ) => {
            assistant.runMicro.mutate(
                {
                    ...baseInput,
                    panorama: panoramaResult.payload,
                    macroSections: macroResult.payload,
                },
                {
                    onSuccess: (microResult) => {
                        setExegeticalUnits(microResult.payload);
                        // v1.6 strict mode: STOP after Pase 3. The pastor
                        // confirms per-unit that an exegetical paper
                        // exists, then clicks "Continuar (Pase 4)" which
                        // triggers `handleRunPreachableStrict` below.
                        if (strictMode) {
                            toast.success(t('expository.toast.strictAwaitingPapers') as string);
                            return;
                        }
                        runPreachableAndDownstream(panoramaResult, macroResult, microResult);
                    },
                    onError: (err: any) => {
                        console.error('[expository] runMicro failed:', err);
                        toast.error(toastErrorMessage(err, t, 'expository.toast.microFailed'));
                    },
                },
            );
        };

        const runPreachableAndDownstream = (
            panoramaResult: PassResult<BookPanorama>,
            macroResult: PassResult<MacroSection[]>,
            microResult: PassResult<ExegeticalUnit[]>,
        ) => {
            assistant.runPreachable.mutate(
                {
                    ...baseInput,
                    ...targetOpt,
                    panorama: panoramaResult.payload,
                    macroSections: macroResult.payload,
                    exegeticalUnits: microResult.payload,
                    ...(strictMode ? { strictMode: true } : {}),
                },
                {
                    onSuccess: (preachableResult) => {
                        setPreachableUnits(preachableResult.payload);
                        assistant.runFidelity.mutate(
                            {
                                ...baseInput,
                                panorama: panoramaResult.payload,
                                macroSections: macroResult.payload,
                                exegeticalUnits: microResult.payload,
                                preachableUnits: preachableResult.payload,
                            },
                            {
                                onSuccess: (fidelityResult) => {
                                    setFidelityReview(fidelityResult.payload);
                                    toast.success(t('expository.toast.pipelineDone') as string);
                                },
                                onError: (err: any) => {
                                    console.error('[expository] runFidelity failed:', err);
                                    toast.error(toastErrorMessage(err, t, 'expository.toast.fidelityFailed'));
                                },
                            },
                        );
                    },
                    onError: (err: any) => {
                        console.error('[expository] runPreachable failed:', err);
                        toast.error(toastErrorMessage(err, t, 'expository.toast.preachableFailed'));
                    },
                },
            );
        };

        assistant.runPanorama.mutate(
            { ...baseInput, ...targetOpt },
            {
                onSuccess: (panoramaResult) => {
                    setPanorama(panoramaResult.payload);

                    if (twoTierMode) {
                        // Pase 2a — super-macros first, then macros nest under them.
                        assistant.runSuperMacro.mutate(
                            { ...baseInput, panorama: panoramaResult.payload },
                            {
                                onSuccess: (smResult) => {
                                    setSuperMacroSections(smResult.payload);
                                    runMacroAndDownstream(panoramaResult, smResult.payload);
                                },
                                onError: (err: any) => {
                                    console.error('[expository] runSuperMacro failed:', err);
                                    toast.error(toastErrorMessage(err, t, 'expository.toast.superMacroFailed'));
                                },
                            },
                        );
                    } else {
                        runMacroAndDownstream(panoramaResult, undefined);
                    }
                },
                onError: (err: any) => {
                    console.error('[expository] runPanorama failed:', err);
                    toast.error(toastErrorMessage(err, t, 'expository.toast.panoramaFailed'));
                },
            },
        );
    };

    /**
     * Pase 4 refine: feeds Pase 5's unaddressed/non-ignored issues
     * back into the preachable converter as `regenerationHint` and
     * chains a fresh Pase 5 over the new output. The methodology
     * principle: the fidelity review is advisory — pastor decides
     * which concerns to fold back into the proposal. Addressed or
     * ignored issues are skipped so refinement only fires on what's
     * still open.
     */
    const handleRefinePreachable = () => {
        if (!fidelityReview || !panorama || !macroSections || !exegeticalUnits) return;
        if (!bookId || !bookDisplay) return;

        const openIssues = fidelityReview.issues
            .map((issue, idx) => ({ issue, idx }))
            .filter(({ idx }) => !addressedIssues.has(idx) && !ignoredIssues.has(idx))
            .map(({ issue }) => issue);

        if (openIssues.length === 0) {
            toast.info(t('expository.toast.noOpenIssues') as string);
            return;
        }

        const isSpanish = lang === 'es';
        const hint = openIssues.map((issue, idx) => {
            const severityLabel = isSpanish
                ? { info: 'info', warning: 'advertencia', critical: 'crítico' }[issue.severity]
                : issue.severity;
            const anchor = issue.unitId
                ? (isSpanish ? `unidad ${issue.unitId}` : `unit ${issue.unitId}`)
                : (isSpanish ? 'general' : 'global');
            const lines = [
                `${idx + 1}. [${severityLabel}] (${anchor}) ${issue.description}`,
            ];
            if (issue.recommendation && issue.recommendation.trim()) {
                lines.push(
                    isSpanish
                        ? `   Recomendación: ${issue.recommendation.trim()}`
                        : `   Recommendation: ${issue.recommendation.trim()}`,
                );
            }
            return lines.join('\n');
        }).join('\n\n');

        // EL IDIOMA DEL TEXTO, NO EL DEL PAPER. Acá decía
        // `lang === 'es' ? 'es' : 'en'`, que es el idioma en que se ESCRIBE el
        // paper — y ni 'es' ni 'en' están en el contrato, que admite
        // `greek | hebrew | translation`. El prompt usa este dato para decidir si
        // cita sintaxis directamente o la aproxima desde una traducción: al
        // refinar, esa información se perdía. Se manda también `scopeKey`, sin
        // el cual un refinamiento sobre un fragmento puede recibir lo cacheado
        // del libro entero.
        const baseInput = buildPassInput({
            book: bookDisplay ?? '',
            displayLanguage: lang,
            verses,
            sourceLanguage: sourceLanguageInState ?? 'translation',
            ...(scopeKey ? { scopeKey } : {}),
        });
        const targetOpt = targetCount ? { targetPreachableCount: targetCount } : {};

        assistant.runPreachable.mutate(
            {
                ...baseInput,
                ...targetOpt,
                panorama,
                macroSections,
                exegeticalUnits,
                regenerationHint: hint,
            },
            {
                onSuccess: (preachableResult) => {
                    setPreachableUnits(preachableResult.payload);
                    // Refresh fidelity over the new output. Reset issue
                    // triage — old indices no longer correspond to new
                    // issues, and the pastor needs a clean slate to
                    // review what the refinement produced.
                    setFidelityReview(null);
                    setAddressedIssues(new Set());
                    setIgnoredIssues(new Set());

                    assistant.runFidelity.mutate(
                        {
                            ...baseInput,
                            panorama,
                            macroSections,
                            exegeticalUnits,
                            preachableUnits: preachableResult.payload,
                        },
                        {
                            onSuccess: (fidelityResult) => {
                                setFidelityReview(fidelityResult.payload);
                                toast.success(t('expository.toast.refineDone') as string);
                            },
                            onError: (err: any) => {
                                console.error('[expository] refine runFidelity failed:', err);
                                toast.error(toastErrorMessage(err, t, 'expository.toast.fidelityFailed'));
                            },
                        },
                    );
                },
                onError: (err: any) => {
                    console.error('[expository] refine runPreachable failed:', err);
                    toast.error(toastErrorMessage(err, t, 'expository.toast.preachableFailed'));
                },
            },
        );
    };

    /**
     * Approach A — pastor-driven regroup. Three structural actions
     * (merge with next, split at verse, revalidate fidelity) let the
     * pastor restructure the preachable units without re-running the
     * whole pipeline. The methodology guard is post-hoc: Phase 5 audits
     * the manual regroup when the pastor clicks "Re-validar fidelidad".
     *
     * Propositions on merged/split units are seeded with a placeholder
     * "Refinar" prefix so the pastor knows they need an edit pass — we
     * deliberately don't call the LLM here to keep merge/split cheap
     * and instant. v1.5 / Approach B can add focused proposition
     * regeneration if real usage proves the seed text inadequate.
     */
    const handleMergePreachable = (idA: string) => {
        setPreachableUnits((prev) => {
            if (!prev) return prev;
            const idx = prev.findIndex((u) => u.id === idA);
            if (idx < 0 || idx >= prev.length - 1) return prev;
            const a = prev[idx]!;
            const b = prev[idx + 1]!;
            const merged: PreachableUnit = {
                id: crypto.randomUUID(),
                title: `${a.title} + ${b.title}`,
                passage: `${bookDisplay ?? ''} ${formatRangeForReader(bookId, {
                    chapterStart: a.chapterStart,
                    verseStart: a.verseStart,
                    chapterEnd: b.chapterEnd,
                    verseEnd: b.verseEnd,
                })}`.trim(),
                chapterStart: a.chapterStart,
                verseStart: a.verseStart,
                chapterEnd: b.chapterEnd,
                verseEnd: b.verseEnd,
                sourcedExegeticalUnitIds: [
                    ...a.sourcedExegeticalUnitIds,
                    ...b.sourcedExegeticalUnitIds,
                ],
                // Concatenate text cleanly — no inline markers in content.
                // The "needs refinement" signal lives in the per-card
                // banner driven by `modifiedByPastor`, not in the body
                // text (which would leak to exports / planned sermons).
                exegeticalProposition: `${a.exegeticalProposition}\n\n${b.exegeticalProposition}`,
                homileticalProposition: `${a.homileticalProposition}\n\n${b.homileticalProposition}`,
                pastoralObjective: `${a.pastoralObjective}\n\n${b.pastoralObjective}`,
                order: a.order,
                modifiedByPastor: true,
            };
            const next = [
                ...prev.slice(0, idx),
                merged,
                ...prev.slice(idx + 2),
            ].map((u, i) => ({ ...u, order: i }));
            return next;
        });
        toast.success(t('expository.toast.mergeDone') as string);
    };

    const handleSplitPreachable = (id: string, atVerse: number) => {
        setPreachableUnits((prev) => {
            if (!prev) return prev;
            const idx = prev.findIndex((u) => u.id === id);
            if (idx < 0) return prev;
            const u = prev[idx]!;
            // v1 constraint: split point must land inside a single
            // chapter and produce two valid halves. Cross-chapter splits
            // (e.g. ch1:5 → ch1:7 + ch1:8..ch2:end) are deferred to
            // Approach B together with smarter UI affordances.
            if (u.chapterStart !== u.chapterEnd) {
                toast.error(t('expository.toast.splitCrossChapter') as string);
                return prev;
            }
            if (atVerse <= u.verseStart || atVerse >= u.verseEnd) {
                toast.error(t('expository.toast.splitOutOfRange') as string);
                return prev;
            }
            // Both halves inherit the original propositions verbatim —
            // pastor refines them. Clean text (no inline markers); the
            // refinement signal lives in the per-card banner.
            const firstHalf: PreachableUnit = {
                ...u,
                id: crypto.randomUUID(),
                title: `${u.title} (1)`,
                passage: `${bookDisplay ?? ''} ${formatRangeForReader(bookId, {
                    chapterStart: u.chapterStart,
                    verseStart: u.verseStart,
                    chapterEnd: u.chapterStart,
                    verseEnd: atVerse,
                })}`.trim(),
                verseEnd: atVerse,
                chapterEnd: u.chapterStart,
                modifiedByPastor: true,
            };
            const secondHalf: PreachableUnit = {
                ...u,
                id: crypto.randomUUID(),
                title: `${u.title} (2)`,
                passage: `${bookDisplay ?? ''} ${formatRangeForReader(bookId, {
                    chapterStart: u.chapterStart,
                    verseStart: atVerse + 1,
                    chapterEnd: u.chapterEnd,
                    verseEnd: u.verseEnd,
                })}`.trim(),
                verseStart: atVerse + 1,
                modifiedByPastor: true,
            };
            const next = [
                ...prev.slice(0, idx),
                firstHalf,
                secondHalf,
                ...prev.slice(idx + 1),
            ].map((p, i) => ({ ...p, order: i }));
            return next;
        });
        toast.success(t('expository.toast.splitDone') as string);
    };

    const handleRevalidateFidelity = () => {
        if (!panorama || !macroSections || !exegeticalUnits || !preachableUnits) return;
        if (!bookId || !bookDisplay) return;

        setFidelityReview(null);
        setAddressedIssues(new Set());
        setIgnoredIssues(new Set());

        // Make sure Phase 5 is expanded so the loading spinner + new
        // result are visible without the pastor having to hunt for them.
        setCollapsedPasses((prev) => {
            if (!prev.has(5)) return prev;
            const next = new Set(prev);
            next.delete(5);
            return next;
        });

        // Scroll into view immediately (after the expand state has
        // rendered). The mutation runs in parallel — pastor sees the
        // card with a "Re-validando…" spinner from the moment they
        // pressed the button, not at the end.
        requestAnimationFrame(() => {
            const el = document.getElementById('expository-pass-5');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        // Note: the fidelity reviewer sees the manually-regrouped units
        // directly via `preachableUnits`. Boundary changes + merged
        // propositions are visible in the prompt input, so the model
        // will naturally flag a regroup that breaks the methodology
        // (separated exhortation/fundamento, broken parallelism, etc.).
        // FidelityInput doesn't expose a `regenerationHint` slot yet;
        // adding one is a follow-up if natural detection proves weak.
        assistant.runFidelity.mutate(
            {
                book: bookDisplay,
                displayLanguage: lang,
                verses,
                ...(sourceLanguageInState ? { sourceLanguage: sourceLanguageInState } : {}),
                ...(scopeKey ? { scopeKey } : {}),
                panorama,
                macroSections,
                exegeticalUnits,
                preachableUnits,
            },
            {
                onSuccess: (fidelityResult) => {
                    setFidelityReview(fidelityResult.payload);
                    toast.success(t('expository.toast.revalidateDone') as string);
                },
                onError: (err: any) => {
                    console.error('[expository] revalidate fidelity failed:', err);
                    toast.error(toastErrorMessage(err, t, 'expository.toast.fidelityFailed'));
                },
            },
        );
    };

    /**
     * v1.6 strict mode: manual trigger for Pase 4 + 5 after the pastor
     * has confirmed an exegetical paper exists for every unit. Fires
     * runPreachable with `strictMode: true` so the prompt drops the
     * "preliminary hypothesis" framing.
     */
    const handleContinueStrictPase4 = () => {
        if (!panorama || !macroSections || !exegeticalUnits || verses.length === 0 || !bookId || !bookDisplay) return;
        const allConfirmed = exegeticalUnits.every((u) => unitsConfirmedHavePapers.has(u.id));
        if (!allConfirmed) {
            toast.error(t('expository.toast.strictAllUnitsRequired') as string);
            return;
        }

        const baseInput = buildPassInput({
            book: bookDisplay ?? '',
            displayLanguage: lang,
            verses,
            sourceLanguage: sourceLanguageInState ?? 'translation',
            ...(scopeKey ? { scopeKey } : {}),
        });
        const targetOpt = typeof targetCount === 'number' ? { targetPreachableCount: targetCount } : {};

        assistant.runPreachable.mutate(
            {
                ...baseInput,
                ...targetOpt,
                panorama,
                macroSections,
                exegeticalUnits,
                strictMode: true,
            },
            {
                onSuccess: (preachableResult) => {
                    setPreachableUnits(preachableResult.payload);
                    assistant.runFidelity.mutate(
                        {
                            ...baseInput,
                            panorama,
                            macroSections,
                            exegeticalUnits,
                            preachableUnits: preachableResult.payload,
                        },
                        {
                            onSuccess: (fidelityResult) => {
                                setFidelityReview(fidelityResult.payload);
                                toast.success(t('expository.toast.pipelineDone') as string);
                            },
                            onError: (err: any) => {
                                console.error('[expository] strict runFidelity failed:', err);
                                toast.error(toastErrorMessage(err, t, 'expository.toast.fidelityFailed'));
                            },
                        },
                    );
                },
                onError: (err: any) => {
                    console.error('[expository] strict runPreachable failed:', err);
                    toast.error(toastErrorMessage(err, t, 'expository.toast.preachableFailed'));
                },
            },
        );
    };

    const handleCreateSeries = async () => {
        if (!user?.uid || !preachableUnits || preachableUnits.length === 0 || !bookDisplay) return;
        if (!seriesTitle.trim()) {
            toast.error(t('expository.toast.titleRequired') as string);
            return;
        }
        // La serie exige 3 letras (SermonSeriesEntity): avisar aquí evita
        // crear los estudios y que la serie falle después.
        if (seriesTitle.trim().length < 3) {
            toast.error(t('expository.toast.titleTooShort') as string);
            return;
        }
        // Sin la biblioteca no se sabe qué heredan los estudios.
        if (project && projectSources.libraryLoading) return;

        setCreatingSeries(true);
        try {
            // El proyecto pudo archivarse en otra pestaña mientras se
            // analizaba: se vuelve a leer la lista justo antes de crear.
            let vigente: AIProject | null = null;
            if (project) {
                // La misma clave que useFacultyProjects.
                const clave = ['faculty', 'projects', user.uid];
                await queryClient.refetchQueries({ queryKey: clave, exact: true });
                vigente = activeProjectById(queryClient.getQueryData<AIProject[]>(clave) ?? projects, project.id);
                if (!vigente) toast.warning(t('expository.project.unavailable') as string);
            }
            const plan = buildSeriesPlan({
                title: seriesTitle,
                description: t('expository.create.defaultDescription', {
                    book: bookDisplay,
                    count: preachableUnits.length,
                }) as string,
                startDate: parseLocalDate(startDate),
                frequency,
                bookDisplay,
                preachableUnits,
                exegeticalUnits,
                panorama,
                displayLanguage: lang,
                ...(vigente
                    ? {
                        project: {
                            projectId: vigente.id,
                            sources: projectSources.sources,
                            excludedResourceIds: projectSources.excludedResourceIds,
                        },
                    }
                    : {}),
            });
            const series = await seriesService.createSeriesFromPlan(user.uid, plan);

            // La lista de planes y el panel del proyecto leen estas cachés.
            queryClient.invalidateQueries({ queryKey: ['series'] });
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user.uid] });
            clearExpositoryDraft(draftScope);
            // Count papers + sermon drafts actually created so the toast
            // reflects reality (some may have failed silently; user retries
            // from SeriesDetail).
            const plannedFinal = series.metadata?.plannedSermons ?? [];
            const paperCount = plannedFinal.filter((p) => Boolean(p.paperId)).length;
            const draftCount = plannedFinal.filter((p) => Boolean(p.draftId)).length;
            const toastMsg =
                paperCount > 0 && draftCount > 0
                    ? (t('expository.toast.seriesCreatedWithPapersAndDrafts', {
                          paperCount,
                          draftCount,
                      }) as string)
                    : paperCount > 0
                        ? (t('expository.toast.seriesCreatedWithPapers', { count: paperCount }) as string)
                        : (t('expository.toast.seriesCreated') as string);
            toast.success(
                vigente
                    ? (t('expository.project.createdInProject', { title: vigente.title }) as string)
                    : toastMsg,
            );
            navigate(`/dashboard/plans/${series.id}`);
        } catch (err: any) {
            console.error('[expository] createSeries failed:', err);
            toast.error(err?.message ?? (t('expository.toast.createFailed') as string));
        } finally {
            setCreatingSeries(false);
        }
    };

    const panoramaState = derivePassState(assistant.runPanorama.isPending, panorama, assistant.runPanorama.isError);
    const macroState = derivePassState(assistant.runMacro.isPending, macroSections, assistant.runMacro.isError);
    const microState = derivePassState(assistant.runMicro.isPending, exegeticalUnits, assistant.runMicro.isError);
    const preachableState = derivePassState(assistant.runPreachable.isPending, preachableUnits, assistant.runPreachable.isError);
    const fidelityState = derivePassState(assistant.runFidelity.isPending, fidelityReview, assistant.runFidelity.isError);

    const isRunning =
        assistant.runPanorama.isPending ||
        assistant.runMacro.isPending ||
        assistant.runMicro.isPending ||
        assistant.runPreachable.isPending ||
        assistant.runFidelity.isPending;

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-zinc-950/50 overflow-y-auto">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center gap-3">
                    <Link
                        to="/dashboard/plans"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        aria-label={t('expository.back') as string}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 font-serif truncate">
                            {t('expository.title')}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('expository.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            <main className={`flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6 ${zoomClassName}`}>
                {project && projectState === 'ok' && (
                    <ProjectSeriesBanner project={project} bookId={analyzedBookId ?? bookId} projectBooks={projectBooks} />
                )}
                {projectState === 'unavailable' && <ProjectUnavailableNotice />}
                <SetupCard
                    bookId={bookId}
                    onBookIdChange={(id) => {
                        setBookId(id);
                        setBookChoiceRequired(false);
                    }}
                    targetCount={targetCount}
                    onTargetCountChange={setTargetCount}
                    twoTierMode={twoTierMode}
                    onTwoTierModeChange={setTwoTierMode}
                    strictMode={strictMode}
                    onStrictModeChange={setStrictMode}
                    lang={lang}
                    allBooks={allBooks}
                    isRunning={isRunning}
                    onStart={handleStart}
                    textZoom={textZoom}
                    onTextZoomChange={setTextZoom}
                    onOpenMethodology={() => setMethodologyOpen(true)}
                    scopeMode={scopeMode}
                    onScopeModeChange={(next) => {
                        setScopeMode(next);
                        setScopeError(null);
                        // Reset autosuggested title so the next run picks up
                        // the new scope.
                        setSeriesTitle('');
                    }}
                    passageScope={passageScope}
                    onPassageScopeChange={(ref) => {
                        setPassageScope(ref);
                        // Elegir un pasaje también elige su libro.
                        if (ref) setBookChoiceRequired(false);
                        setScopeError(null);
                        setSeriesTitle('');
                    }}
                    scopeError={scopeError}
                    bookChoiceRequired={bookChoiceRequired}
                    t={t}
                />
                {analyzedBookId && bookId !== analyzedBookId && (
                    // El selector cambió después de analizar: la serie, sus
                    // obras y el borrador siguen siendo del libro analizado.
                    <p
                        role="status"
                        className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-subtle-foreground"
                    >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        {t('expository.setup.bookChanged', {
                            analyzed: bookName(allBooks, analyzedBookId, lang),
                            book: bookName(allBooks, bookId, lang),
                        })}
                    </p>
                )}

                <MethodologyPresentation
                    open={methodologyOpen}
                    onOpenChange={setMethodologyOpen}
                />

                {/* Collapsed-passes strip. Renders only when at least
                    one pass is contracted to a chip. The chips share
                    `view-transition-name` with their corresponding
                    PassCard slot, so toggling collapse triggers a
                    card↔chip morph (Mac-genie-like) where supported. */}
                {collapsedPasses.size > 0 && (
                    <CollapsedStrip
                        collapsedPasses={collapsedPasses}
                        passes={[
                            { index: 1, key: 'panorama', state: panoramaState },
                            { index: 2, key: 'macro', state: macroState },
                            { index: 3, key: 'micro', state: microState },
                            { index: 4, key: 'preachable', state: preachableState },
                            { index: 5, key: 'fidelity', state: fidelityState },
                        ]}
                        onExpand={togglePass}
                        t={t}
                    />
                )}

                {!collapsedPasses.has(1) && (
                    <PassCard
                        index={1}
                        title={t('expository.passes.panorama.title') as string}
                        subtitle={t('expository.passes.panorama.subtitle') as string}
                        state={panoramaState}
                        onCollapse={() => togglePass(1)}
                        t={t}
                    >
                        {panorama && <PanoramaResult panorama={panorama} t={t} />}
                    </PassCard>
                )}

                {!collapsedPasses.has(2) && (
                    <PassCard
                        index={2}
                        title={t('expository.passes.macro.title') as string}
                        subtitle={t('expository.passes.macro.subtitle') as string}
                        state={macroState}
                        onCollapse={() => togglePass(2)}
                        t={t}
                    >
                        {macroSections && bookDisplay && (
                            <MacroResult sections={macroSections} bookId={bookId} bookDisplay={bookDisplay} t={t} />
                        )}
                    </PassCard>
                )}

                {!collapsedPasses.has(3) && (
                    <PassCard
                        index={3}
                        title={t('expository.passes.micro.title') as string}
                        subtitle={t('expository.passes.micro.subtitle') as string}
                        state={microState}
                        onCollapse={() => togglePass(3)}
                        t={t}
                    >
                        {exegeticalUnits && macroSections && bookDisplay && (
                            <>
                                <MicroResult
                                    units={exegeticalUnits}
                                    macros={macroSections}
                                    bookId={bookId}
                                    bookDisplay={bookDisplay}
                                    strictMode={strictMode}
                                    unitsConfirmedHavePapers={unitsConfirmedHavePapers}
                                    onToggleHasPaper={toggleUnitHasPaper}
                                    t={t}
                                />
                                {strictMode && !preachableUnits && (
                                    <StrictContinueCta
                                        units={exegeticalUnits}
                                        confirmed={unitsConfirmedHavePapers}
                                        isRunning={assistant.runPreachable.isPending || assistant.runFidelity.isPending}
                                        onContinue={handleContinueStrictPase4}
                                        t={t}
                                    />
                                )}
                            </>
                        )}
                    </PassCard>
                )}

                {!collapsedPasses.has(4) && (
                    <PassCard
                        index={4}
                        title={t('expository.passes.preachable.title') as string}
                        subtitle={t('expository.passes.preachable.subtitle') as string}
                        state={preachableState}
                        onCollapse={() => togglePass(4)}
                        t={t}
                    >
                        {preachableUnits && bookDisplay && (
                            <PreachableResult
                                units={preachableUnits}
                                bookId={bookId}
                                bookDisplay={bookDisplay}
                                strictMode={strictMode}
                                onUnitChange={(id, patch) => {
                                    setPreachableUnits((prev) =>
                                        prev
                                            ? prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
                                            : prev,
                                    );
                                }}
                                onMerge={handleMergePreachable}
                                onSplit={handleSplitPreachable}
                                onRevalidate={handleRevalidateFidelity}
                                isRevalidating={assistant.runFidelity.isPending}
                                t={t}
                            />
                        )}
                    </PassCard>
                )}

                {!collapsedPasses.has(5) && (
                    <div id="expository-pass-5">
                    <PassCard
                        index={5}
                        title={t('expository.passes.fidelity.title') as string}
                        subtitle={t('expository.passes.fidelity.subtitle') as string}
                        state={fidelityState}
                        onCollapse={() => togglePass(5)}
                        t={t}
                    >
                        {assistant.runFidelity.isPending && (
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 px-3 py-2.5 text-[12px] text-slate-700 dark:text-slate-200">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>{t('expository.results.fidelity.revalidating')}</span>
                            </div>
                        )}
                        {fidelityReview && (
                            <>
                                <FidelityResult
                                    review={fidelityReview}
                                    preachableUnits={preachableUnits ?? []}
                                    addressedIssues={addressedIssues}
                                    ignoredIssues={ignoredIssues}
                                    onToggleAddressed={toggleIssueAddressed}
                                    onToggleIgnored={toggleIssueIgnored}
                                    t={t}
                                />
                                <RefinePreachableCta
                                    review={fidelityReview}
                                    addressedIssues={addressedIssues}
                                    ignoredIssues={ignoredIssues}
                                    isRefining={assistant.runPreachable.isPending || assistant.runFidelity.isPending}
                                    onRefine={handleRefinePreachable}
                                    t={t}
                                />
                            </>
                        )}
                    </PassCard>
                    </div>
                )}

                {/* Create-series card — appears once preachable units are ready.
                    The pastor can create the series even before fidelity review
                    completes (the review is advisory, not blocking). */}
                {preachableUnits && preachableUnits.length > 0 && (
                    <CreateSeriesCard
                        seriesTitle={seriesTitle}
                        onSeriesTitleChange={setSeriesTitle}
                        startDate={startDate}
                        onStartDateChange={setStartDate}
                        frequency={frequency}
                        onFrequencyChange={setFrequency}
                        preachableUnits={preachableUnits}
                        creating={creatingSeries}
                        onCreate={handleCreateSeries}
                        createBlocked={Boolean(project) && projectSources.libraryLoading}
                        t={t}
                    >
                        {project && (
                            <ProjectSeriesSources
                                project={project}
                                bookId={analyzedBookId ?? bookId}
                                preachableUnits={preachableUnits}
                                exegeticalUnits={exegeticalUnits}
                                onChange={setProjectSources}
                            />
                        )}
                    </CreateSeriesCard>
                )}
            </main>
        </div>
    );
}

// ── Refine preachable CTA ──────────────────────────────────────────────
//
// Sits at the bottom of the Pase 5 card. When the fidelity review has
// any non-ignored, non-addressed issues, surfaces a single button that
// re-runs Pase 4 with those issues serialized as a `regenerationHint`,
// then chains a fresh Pase 5 over the new preachable units. One round
// trip from "the reviewer flagged something" to "the proposal answers
// the flag".
