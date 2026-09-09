import type {
    AnalyzeVerseInput,
    CanonicalVerseAnalysis,
    ExegeticalPaper,
    ExegeticalStep,
    ExegeticalStepVersion,
    ExegesisSourceContext,
    ICanonicalVerseAnalyzer,
    ICuratedCorpusRetriever,
    CuratedCorpusResult,
    IExegeticalPaperRepository,
    IOriginalLanguageBibleProvider,
    IResourceContentReader,
    IUserStyleGuideRepository,
    PassageReference,
    ProjectSource,
    SourceCitation,
    IPageNumberingReader,
    PageNumbering,
} from '@dosfilos/domain';
import {
    EMPTY_VERIFICATION_SUMMARY,
    computeRubricCompliance,
    formatPassageReference,
    citationAnchorFor,
    relabelExcerptAnchor,
    verifyAttributedQuotes,
} from '@dosfilos/domain';
import { loadSourceNumberings } from './sourceNumberings';
import { stampCitationPageKind } from './stampCitationPageKind';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

/**
 * Generates a `CanonicalVerseAnalysis` for one verse step — the
 * analysis stage of the two-stage architecture.
 *
 * Coexists with `GenerateStepUseCase` during the migration:
 *   - `GenerateStepUseCase` produces markdown (legacy / interim path
 *     the current UI consumes).
 *   - `AnalyzeVerseCanonicallyUseCase` produces structured `CanonicalVerseAnalysis`
 *     (target path; composers downstream emit format-specific
 *     markdown from it).
 *
 * Both append to the same `ExegeticalStep.versions` history. New
 * analysis versions carry both `markdown` (initially empty until the
 * composer runs) and `canonicalAnalysis` (the structured payload).
 *
 * Sanitization: the LLM may hallucinate source keys that don't exist
 * in the configured corpus. This use case scrubs every `sourceKey`
 * reference in the structured payload against the actual sources on
 * the paper, dropping any unmatched references rather than
 * propagating fabricated citations.
 *
 * Errors:
 *   - Missing paper / step → throws.
 *   - Step kind not 'verse' → throws (this use case is verse-specific
 *     by design; intro and conclusion compose from accepted verse
 *     analyses, handled by composer use cases).
 *   - Analyzer throws → state rolls back to 'failed', error
 *     re-thrown so the UI's retry affordance kicks in.
 */
export class AnalyzeVerseCanonicallyUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private contentReader: IResourceContentReader,
        private analyzer: ICanonicalVerseAnalyzer,
        // Optional: when wired, the use case loads the verse's
        // original-language text (Greek for NT via SBL GNT, Hebrew for
        // OT via WLC) and threads it into the analyzer prompt so the
        // model isn't guessing the base text from training memory.
        private originalLanguageProvider?: IOriginalLanguageBibleProvider,
        /**
         * Cuando está cableado, las fuentes con receta dejan de inlinear su
         * corpus entero y piden solo el material que habla de ESTE versículo.
         * Sin él, el caso de uso se comporta como antes — que es lo que hace
         * falta para los papers viejos, cuyas fuentes no tienen receta.
         */
        private corpusRetriever?: ICuratedCorpusRetriever,
        /**
         * Traduce la hoja del archivo al número que el libro imprime. Sin él
         * las anclas dicen «hoja N» y el análisis cita hojas rotuladas como
         * tales — incompleto, pero verdadero. Con él dicen «p. N», que es lo
         * que un trabajo académico necesita.
         */
        private pageNumbering?: IPageNumberingReader,
    ) { }

    async execute(input: AnalyzeVerseCanonicallyUseCaseInput): Promise<ExegeticalStepVersion> {
        if (!input.ownerId || !input.paperId || !input.stepId) {
            throw new Error('AnalyzeVerseCanonicallyUseCase: ownerId, paperId, stepId required');
        }

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);
        const step = paper.steps.find(s => s.id === input.stepId);
        if (!step) throw new Error(`Step ${input.stepId} not found`);
        if (step.kind !== 'verse') {
            throw new Error(
                `AnalyzeVerseCanonicallyUseCase only handles 'verse' kind. Got '${step.kind}'. ` +
                `Introduction and conclusion are produced by composer use cases over accepted verse analyses.`,
            );
        }
        if (!step.verseRef) {
            throw new Error(`Verse step ${input.stepId} has no verseRef`);
        }

        // Reserve exégesis credits BEFORE any state mutation so
        // InsufficientExegesisCreditsError aborts cleanly without
        // leaving the step stuck in 'generating'.
        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'analyzeVerseCanonically',
        );

        await this.paperRepository.setStepState(input.ownerId, input.paperId, input.stepId, 'generating');

        try {
            const styleGuideContent = await this.loadStyleGuideContent(input.ownerId, paper.styleGuideId);
            // Loaded BEFORE the sources: the verse's own words are what
            // make the corpus query find anything in a lexicon.
            const originalLanguageText = await this.loadOriginalLanguageText(step.verseRef);
            // Se resuelve acá y no dentro de `loadSourceContexts` porque el
            // estampado posterior necesita saber, por fuente, si el número
            // que el modelo copió es página impresa u hoja del archivo.
            const numberings = await loadSourceNumberings(
                this.pageNumbering,
                [...paper.sources].sort((a, b) => a.order - b.order),
            );
            const sources = await this.loadSourceContexts(
                paper, step.id, step.verseRef!, originalLanguageText, numberings,
            );
            const priorAcceptedAnalyses = collectPriorAcceptedAnalyses(paper, step);
            const stepEmphasis = paper.stepPlan.defaults.verse ?? null;

            const missingSourceTypes = paper.rubric
                ? computeRubricCompliance(
                    paper.sources.map(s => s.sourceType),
                    paper.rubric,
                ).requirements.filter(r => !r.satisfied && r.required > 0).map(r => ({
                    sourceType: r.sourceType,
                    minimum: r.required,
                    have: r.have,
                }))
                : [];

            const analyzerInput: AnalyzeVerseInput = {
                paperPassage: paper.passage,
                verseRef: step.verseRef,
                originalLanguageText,
                language: paper.displayLanguage,
                assignmentBrief: paper.assignmentBrief,
                stepEmphasis,
                styleGuideContent,
                sources,
                priorAcceptedAnalyses,
                regenerationHint: input.regenerationHint ?? null,
                missingSourceTypes,
            };

            reservation.markLlmContacted();
            const rawResult = await this.analyzer.analyzeVerse(analyzerInput);
            // El modelo copió el número del ancla; acá se registra QUÉ copió.
            // Sin esto una cita a un libro sin calibrar sale con la hoja del
            // archivo y aspecto de página impresa, que es el defecto entero.
            const result = {
                ...rawResult,
                analysis: stampCitationPageKind(rawResult.analysis, paper.sources, numberings),
            };

            // Sanitize hallucinated source keys. The valid set is the
            // sources that CONTRIBUTED TEXT to this step, not every
            // source configured on the paper.
            //
            // The difference is the whole guard. A source whose corpus
            // returned nothing used to enter the prompt with an empty
            // body and a live citation key, and any claim invented
            // against it passed this filter untouched — the key was
            // configured, so it was "valid". That is how a real paper
            // ended up attributing a position to a theological
            // dictionary it had not read one line of, on a page number
            // taken from the selection recipe. Presence in the
            // configuration is not evidence the model saw the source.
            const validKeys = new Set(
                sources
                    .map(s => s.citationKey)
                    .filter((k): k is string => Boolean(k && k.trim())),
            );
            // Sources whose chunks arrived with a page anchor. Citing
            // one of these with page 0 means the model dropped a page
            // number it was given.
            const anchoredKeys = new Set(
                sources
                    .filter(s => s.citationKey && (s.excerptAnchors?.some(a => a.trim()) ?? false))
                    .map(s => s.citationKey!),
            );
            const sanitizedAnalysis = sanitizeSourceReferences(result.analysis, validKeys, anchoredKeys);

            // Second guard, on a different question. The first asks
            // "is this key one we gave you?"; this one asks "is this
            // quote in the text we gave you?". A model can satisfy the
            // first while inventing the sentence it rests on.
            const verified = verifyAttributedQuotes(
                sanitizedAnalysis,
                new Map(
                    sources
                        .filter(s => s.citationKey)
                        .map(s => [s.citationKey!, stripAnchorSeparators(s.textContent)]),
                ),
            );
            if (verified.dropped.length > 0) {
                // Flat text, not an object: a console prints an object
                // collapsed, and a collapsed log is a log nobody reads.
                // Telling a fabricated quote from a matcher that is too
                // strict needs the quote in front of you, copyable.
                const verseLabel = formatPassageReference(step.verseRef, paper.displayLanguage);
                for (const d of verified.dropped) {
                    console.warn(
                        `[AnalyzeVerseCanonically] ${verseLabel} — cita textual retirada: `
                        + `${d.sourceKey} p.${d.page} (${d.surface}) — no está en el texto de la fuente. `
                        + `La atribución se conserva.\n`
                        + `  CITA: ${d.quote.slice(0, 300)}`,
                    );
                }
            }

            const parentVersionId = step.current?.id ?? null;
            return await this.paperRepository.appendStepVersion(
                input.ownerId,
                input.paperId,
                input.stepId,
                {
                    // Markdown stays empty for now — composers fill it
                    // in a separate step. Existing UI surfaces that
                    // expect markdown will need to either (a) consume
                    // the structured analysis directly via study mode
                    // or (b) trigger a composer to render markdown
                    // for paper view.
                    markdown: '',
                    origin: 'generated',
                    parentVersionId,
                    modelId: result.modelId,
                    regenerationHint: input.regenerationHint ?? null,
                    tokensUsed: result.tokensUsed,
                    verifications: { ...EMPTY_VERIFICATION_SUMMARY },
                    canonicalAnalysis: verified.analysis,
                },
            );
        } catch (err) {
            try {
                await this.paperRepository.setStepState(input.ownerId, input.paperId, input.stepId, 'failed');
            } catch (rollbackErr) {
                console.error('[AnalyzeVerseCanonicallyUseCase] failed to roll state back to failed:', rollbackErr);
            }
            // Refund the reservation when the failure happened BEFORE
            // the LLM was contacted. Post-LLM failures (Gemini error,
            // parse failure, persist hiccup) keep the charge — the
            // tokens were spent for real.
            await reservation.refundIfPreLlm();
            throw err;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /**
     * Loads the original-language text for the verse range and returns
     * it as a single string. Returns null when no provider is wired,
     * the provider doesn't support the book, or the fetch fails — the
     * analyzer falls back to whatever it knows from training.
     */
    /**
     * Le pide al corpus el material de este versículo.
     *
     * Solo participan las fuentes con receta: son las que declaran qué hojas
     * admitió el trabajo, y sin ese recorte la consulta traería páginas que el
     * usuario dejó afuera.
     *
     * Un fallo devuelve `null` y el caso de uso cae al camino anterior. Un paso
     * con el corpus viejo es peor que uno con el material justo; un paso que no
     * se genera es peor que los dos.
     */
    private async retrieveCurated(
        paper: ExegeticalPaper,
        verseRef: PassageReference,
        originalLanguageText: string | null,
    ): Promise<CuratedCorpusResult | null> {
        if (!this.corpusRetriever) return null;
        const scopes = paper.sources
            .filter(s => (s.excerptRecipe?.sheetRanges.length ?? 0) > 0)
            .map(s => ({
                resourceId: s.sourceLibraryResourceId ?? s.corpusId,
                sheetRanges: s.excerptRecipe!.sheetRanges,
                pinnedRanges: s.excerptRecipe!.pinnedRanges,
            }));
        if (scopes.length === 0) return null;

        const label = formatPassageReference(verseRef, paper.displayLanguage);
        const brief = paper.assignmentBrief?.trim().slice(0, 500) ?? '';
        // The verse's own words lead the query.
        //
        // Without them the query was the reference plus the assignment
        // brief — no Greek at all — and a lexicon does not index by
        // Bible reference, it indexes by word. Santiago 1:1 only ever
        // worked by accident: the dictionary page for δοῦλος happens to
        // print "cf. Stg. 1:1", so the reference matched the page. For
        // 1:2 nothing matched, and the retriever returned the previous
        // verse's pages while every aggregate counter said it had
        // answered.
        const greek = originalLanguageText?.trim() ?? '';
        const query = [label, greek, brief].filter(Boolean).join(' — ');
        try {
            return await this.corpusRetriever.retrieve({
                userId: paper.ownerId,
                query,
                sources: scopes,
                budgetChars: CORPUS_BUDGET_CHARS,
            });
        } catch (err) {
            console.warn('[AnalyzeVerseCanonically] el corpus no respondió; se usa lo guardado', {
                error: (err as Error).message,
            });
            return null;
        }
    }

    private async loadOriginalLanguageText(verseRef: PassageReference): Promise<string | null> {
        if (!this.originalLanguageProvider) return null;
        const provider = this.originalLanguageProvider;
        if (!provider.supports(verseRef.bookId)) return null;
        try {
            const verses = await provider.getChapterContent(verseRef.bookId, verseRef.chapterStart);
            const start = (verseRef.verseStart ?? 1) - 1;
            const end = verseRef.verseEnd ?? verseRef.verseStart ?? verses.length;
            const slice = verses.slice(start, end);
            if (slice.length === 0) return null;
            const numbered = slice.map((text, i) => {
                const v = (verseRef.verseStart ?? 1) + i;
                return `${verseRef.chapterStart}:${v} ${text}`;
            });
            return numbered.join(' ');
        } catch (err) {
            console.warn('[AnalyzeVerseCanonicallyUseCase] original-language load failed:', err);
            return null;
        }
    }

    private async loadStyleGuideContent(ownerId: string, styleGuideId: string | null): Promise<string> {
        if (!styleGuideId) return '';
        const guide = await this.styleGuideRepository.getGuide(ownerId, styleGuideId);
        if (!guide) return '';
        return (await this.contentReader.getTextContent(guide.corpusId)) ?? '';
    }

    /**
     * El material que este paso le manda al modelo.
     *
     * Dos regímenes conviviendo a propósito. Las fuentes con receta consultan
     * el corpus y traen lo que habla del versículo; las que no la tienen —papers
     * anteriores al selector— siguen inlineando lo que siempre inlinearon.
     * Migrar por uso y no por lote es lo que deja publicar esto sin tocar
     * trabajos a medio hacer.
     */
    private async loadSourceContexts(
        paper: ExegeticalPaper,
        stepId: string,
        verseRef: PassageReference,
        originalLanguageText: string | null,
        numberings: ReadonlyMap<string, PageNumbering | null>,
    ): Promise<ExegesisSourceContext[]> {
        const curated = await this.retrieveCurated(paper, verseRef, originalLanguageText);
        // Mirrors GenerateStepUseCase.loadSourceContexts: pin-aware,
        // primary-first ordering, and async content fetch via the
        // injected `IResourceContentReader` for full-document sources.
        // Curated-excerpt sources concatenate their pre-reviewed
        // chunks inline with anchor separators so the analyzer can
        // cite using the exact anchors the user accepted.
        const pinnedIds = new Set(paper.stepPlan.perStep[stepId]?.pinnedSources ?? []);
        const sorted = [...paper.sources].sort((a, b) => a.order - b.order);

        const contexts: ExegesisSourceContext[] = [];
        const silent: ProjectSource[] = [];
        for (const source of sorted) {
            const priority: 'primary' | 'secondary' = pinnedIds.has(source.id) ? 'primary' : 'secondary';
            const retrieved = curated?.byResource[source.sourceLibraryResourceId ?? source.corpusId];
            if (retrieved) {
                // Mismos separadores con ancla que el camino anterior: el
                // prompt y el verificador de citas no tienen por qué notar de
                // dónde salió el fragmento.
                const numbering = numberings.get(source.id) ?? null;
                const anchor = (c: { sheet: number | null; section: string | null }) =>
                    citationAnchorFor(c, numbering);
                const textContent = retrieved
                    .map(c => `--- ${anchor(c)} ---\n${c.text}`)
                    .join('\n\n');
                contexts.push({
                    corpusId: source.corpusId,
                    sourceType: source.sourceType,
                    displayLabel: source.displayLabel,
                    citationKey: source.citationKey,
                    textContent,
                    excerptAnchors: retrieved.map(anchor),
                    priority,
                });
                continue;
            }
            if (source.mode === 'extracted-excerpts') {
                // Reaching here means the corpus returned nothing for
                // this source: either the retriever failed, or it had
                // no chunk for this verse within the budget. The
                // stored `excerpts` are empty by design (the recipe is
                // persisted, not the text — see SelectSourcePagesUseCase),
                // so this path yields an empty body for any paper built
                // with the page selector.
                // Las anclas guardadas dicen «p. N» sobre la HOJA del
                // archivo: las escribió el extractor antes de que existiera la
                // numeración del recurso. Reetiquetarlas acá es lo que hace
                // que un trabajo ya empezado cite la página impresa sin tener
                // que volver a extraer sus fuentes.
                const storedNumbering = numberings.get(source.id) ?? null;
                const anchorOf = (e: { sourceLocation: string }) =>
                    relabelExcerptAnchor(e.sourceLocation, storedNumbering);
                const textContent = source.excerpts
                    .map(e => `--- ${anchorOf(e)} ---\n${e.text}`)
                    .join('\n\n');
                const excerptAnchors = source.excerpts.map(anchorOf);
                if (!textContent.trim()) {
                    silent.push(source);
                    continue;
                }
                contexts.push({
                    corpusId: source.corpusId,
                    sourceType: source.sourceType,
                    displayLabel: source.displayLabel,
                    citationKey: source.citationKey,
                    textContent,
                    excerptAnchors,
                    priority,
                });
            } else {
                // 'full-document' (or legacy without `mode`): pull the
                // full extracted text via the content reader.
                const text = await this.contentReader.getTextContent(source.corpusId);
                if (!text?.trim()) {
                    silent.push(source);
                    continue;
                }
                contexts.push({
                    corpusId: source.corpusId,
                    sourceType: source.sourceType,
                    displayLabel: source.displayLabel,
                    citationKey: source.citationKey,
                    textContent: text,
                    priority,
                });
            }
        }

        // A source that contributed no text is not offered to the
        // model at all. Listing it with an empty body is an invitation
        // to cite from memory: the key looks available, the shelf is
        // bare, and nothing downstream can tell the difference.
        if (silent.length > 0) {
            console.warn(
                `[AnalyzeVerseCanonically] ${formatPassageReference(verseRef, paper.displayLanguage)} — `
                + `fuentes sin texto, fuera del prompt y de las citas válidas: `
                + silent.map(s => s.citationKey ?? s.displayLabel).join(', '),
            );
        }

        // Primary first — same convention as GenerateStepUseCase so
        // the analyzer's prompt sees pinned sources before the rest.
        contexts.sort((a, b) => {
            const aPrimary = a.priority === 'primary' ? 0 : 1;
            const bPrimary = b.priority === 'primary' ? 0 : 1;
            return aPrimary - bPrimary;
        });
        return contexts;
    }
}

/**
 * Walks every `sourceKey` field in the analysis and drops references
 * to keys not present in the configured corpus. Same hallucination
 * salvaguarda used in v1.5 for excerpt extraction — applied here at
 * the citation graph of the structured analysis.
 *
 * Pure: returns a new analysis; never mutates the input.
 */
/**
 * Quita los rótulos `--- p. 57 ---` que separan los fragmentos dentro
 * del texto de una fuente.
 *
 * Sirven para que el modelo sepa de qué página salió cada trozo, pero
 * en la verificación son ruido puesto por nosotros en medio de la
 * prosa: dos fragmentos contiguos de la misma página quedan partidos
 * por un rótulo, y una cita que cruza ese límite —que en el documento
 * original es texto corrido— no coincide con nada. Pasó con dos citas
 * verdaderas de dos comentarios distintos.
 */
function stripAnchorSeparators(text: string): string {
    return text.replace(/^---.*---$/gm, ' ');
}

function sanitizeSourceReferences(
    analysis: CanonicalVerseAnalysis,
    validKeys: Set<string>,
    /**
     * Keys whose retrieved chunks arrived with page anchors. For these,
     * `page: 0` is not "the work has no pagination" (the schema's
     * intended meaning) — it is the model declining to say where it
     * read something it was handed with the page attached. "Kittel,
     * p. 0" survives every other check and cannot be looked up, which
     * makes it worse than no citation: it reads as verified.
     */
    anchoredKeys: Set<string> = new Set(),
): CanonicalVerseAnalysis {
    const cleanCitations = (citations: ReadonlyArray<SourceCitation>): SourceCitation[] =>
        citations.filter(c =>
            validKeys.has(c.sourceKey)
            && !(c.page <= 0 && anchoredKeys.has(c.sourceKey)));

    return {
        ...analysis,
        lexicalAnalyses: analysis.lexicalAnalyses.map(la => ({
            ...la,
            generalSemanticRange: {
                ...la.generalSemanticRange,
                sources: cleanCitations(la.generalSemanticRange.sources),
            },
            loadingSources: cleanCitations(la.loadingSources),
        })),
        historicalContext: analysis.historicalContext.map(hc => ({
            ...hc,
            sources: cleanCitations(hc.sources),
        })),
        oldTestamentLinks: analysis.oldTestamentLinks.map(otl => ({
            ...otl,
            sources: cleanCitations(otl.sources),
        })),
        // Drop commentator engagements whose sourceKey doesn't match
        // a configured source — those would render as unverifiable
        // citations downstream.
        commentatorEngagement: analysis.commentatorEngagement.filter(ce =>
            validKeys.has(ce.sourceKey)
            && !(ce.page <= 0 && anchoredKeys.has(ce.sourceKey))),
        // Translation cruxes can keep entries even if some commentator
        // positions reference invalid keys (we just drop those
        // positions). The crux itself remains usable.
        translationCruxes: analysis.translationCruxes.map(tc => ({
            ...tc,
            commentatorPositions: tc.commentatorPositions.filter(cp =>
                validKeys.has(cp.sourceKey)
                && !(cp.page <= 0 && anchoredKeys.has(cp.sourceKey))),
        })),
        footnoteExtensions: analysis.footnoteExtensions.map(fe => ({
            ...fe,
            sources: cleanCitations(fe.sources),
        })),
    };
}

/**
 * Collects prior accepted analyses from earlier verse steps for
 * inter-verse continuity. Skips intro/conclusion (those are not
 * verse analyses) and skips steps without an accepted version that
 * carries `canonicalAnalysis`.
 */
function collectPriorAcceptedAnalyses(
    paper: ExegeticalPaper,
    currentStep: ExegeticalStep,
): CanonicalVerseAnalysis[] {
    return paper.steps
        .filter(s => s.order < currentStep.order && s.kind === 'verse' && s.accepted?.canonicalAnalysis)
        .map(s => s.accepted!.canonicalAnalysis!);
}

export interface AnalyzeVerseCanonicallyUseCaseInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /** Optional hint when the user re-triggers analysis. */
    regenerationHint?: string | null;
}

/**
 * Cuánto del prompt puede ocupar el corpus de un paso.
 *
 * Es un presupuesto para el CORPUS, no para el prompt: las instrucciones
 * metodológicas, la guía de estilo, el texto base y los análisis previos
 * ocupan el resto, y `fitPromptToCap` recorta después si algo se desmadra.
 * Dejar la mitad del tope para el corpus da margen para todo lo demás sin que
 * el recorte final tenga que morder material que el paso sí necesitaba.
 */
const CORPUS_BUDGET_CHARS = 100_000;

