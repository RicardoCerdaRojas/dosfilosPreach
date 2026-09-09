import type {
    CanonicalVerseAnalysis,
    ComposeAcademicPaperInput,
    ComposeAcademicPaperOutput,
    ComposerSourceMetadata,
    ExegeticalPaper,
    FormatterSourceMetadata,
    IAcademicComposer,
    IExegeticalPaperRepository,
    IResourceContentReader,
    IStyleFormatter,
    IUserStyleGuideRepository,
    StyleGuideManifest,
    StyleGuideSnapshot,
    IPageNumberingReader,
} from '@dosfilos/domain';
import { enforceAnalysisCoverage, isCitableSourceType } from '@dosfilos/domain';
import { buildPageLabeler } from './buildPageLabeler';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

/**
 * Composes a TMS-style academic paper from a paper's accepted verse
 * analyses.
 *
 * Pipeline:
 *   1. Load paper, collect accepted `CanonicalVerseAnalysis` from
 *      verse steps in canonical order.
 *   2. Resolve the style guide (content + structured manifest) for
 *      mandatory style adherence at the prompt layer.
 *   3. Build the composer source registry + the formatter citable-
 *      source metadata (two representations of the same paper.sources
 *      data, one for each downstream consumer).
 *   4. Call `IAcademicComposer.composeAcademicPaper` to produce the
 *      raw markdown.
 *   5. When a manifest is available, run the existing
 *      `IStyleFormatter` post-process to rewrite citations per the
 *      style guide's templates (ibid handling, full vs short, page
 *      formats). Idempotent — safe to run on already-formatted output.
 *   6. Return the final markdown plus formatter status (applied /
 *      skipped / error).
 *
 * Failure semantics:
 *   - Paper not found → throw.
 *   - Paper has no accepted verse analyses → throw with explicit
 *     message ("paper not ready for composition").
 *   - Composer throws → bubbles up; caller decides retry policy.
 *   - Formatter throws → swallowed; we return the composer's raw
 *     markdown with `formatterStatus: 'error'` and log the failure.
 *     Rationale: a formatting hiccup should not block the user from
 *     getting the substantive composition.
 *
 * Style-guide enforcement:
 *   - Always attempts both layers when a guide is configured.
 *   - When NO guide is configured, the composer's prompt declares the
 *     fallback explicitly (TMS / Turabian) and the formatter is
 *     bypassed. Logged as a warning so the user is aware.
 */
export class ComposeAcademicPaperUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private contentReader: IResourceContentReader,
        private composer: IAcademicComposer,
        // Optional. When omitted (or when no manifest is attached),
        // the deterministic post-format step is skipped and the
        // composer's raw output is returned.
        private styleFormatter?: IStyleFormatter,
        /**
         * Numeración impresa de cada fuente. Opcional: sin ella el paper
         * rotula las hojas como tales, que es lo honesto cuando no se sabe.
         */
        private pageNumbering?: IPageNumberingReader,
    ) { }


    async execute(input: ComposeAcademicPaperUseCaseInput): Promise<ComposeAcademicPaperOutput> {
        if (!input.ownerId || !input.paperId) {
            throw new Error('ComposeAcademicPaperUseCase: ownerId and paperId required');
        }

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        // ── Collect accepted analyses ────────────────────────────────
        const verseAnalyses = collectAcceptedVerseAnalyses(paper);
        if (verseAnalyses.length === 0) {
            throw new Error(
                'ComposeAcademicPaperUseCase: paper has no accepted verse analyses. ' +
                'Run AnalyzeVerseCanonicallyUseCase + accept the result for each verse step before composing.',
            );
        }

        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'composeAcademicPaper',
        );

        try {
            // ── Resolve style guide (content + manifest) ─────────────────
            const styleGuideContent = await this.loadStyleGuideContent(input.ownerId, paper.styleGuideId);
            const manifest = await this.loadStyleManifest(input.ownerId, paper);

            if (!paper.styleGuideId) {
                console.warn(
                    `[ComposeAcademicPaperUseCase] Paper ${paper.id} has no style guide attached. ` +
                    'Falling back to TMS / Turabian conventions in prompt; deterministic formatter bypassed.',
                );
            } else if (!manifest) {
                console.warn(
                    `[ComposeAcademicPaperUseCase] Paper ${paper.id} has style guide ${paper.styleGuideId} ` +
                    'but no extracted manifest. Prompt layer active; deterministic formatter bypassed.',
                );
            }

            // ── Compose ──────────────────────────────────────────────────
            // Union of pinned source keys across every step of the
            // plan. The academic composer must cite each at least
            // once across the full output (intro / verses /
            // conclusion / footnotes). Empty when no plan was set.
            const pinnedIdSet = new Set<string>();
            for (const entry of Object.values(paper.stepPlan.perStep)) {
                for (const id of entry.pinnedSources) pinnedIdSet.add(id);
            }
            const pinnedSourceKeys = paper.sources
                .filter(s => pinnedIdSet.has(s.id) && s.citationKey)
                .map(s => s.citationKey!);

            // ── Build the source registry for the composer ───────────────
            // Pinned sources get textContent loaded so the composer
            // has material to ground citations even when verse
            // analyses didn't engage them. Unpinned sources stay as
            // bibliographic shells (author/title only).
            const composerSources = await buildComposerSourcesWithPinnedContent(
                paper,
                pinnedIdSet,
                this.contentReader,
            );

            // ── Build citable sources for the deterministic formatter ───
            const citableSources = buildFormatterSources(paper);

            // ── Traducir hoja del archivo a página impresa ───────────────
            // El análisis guarda el número de HOJA; el profesor lee el
            // libro de papel. Medido sobre esta biblioteca: dos obras
            // coinciden, tres se desvían (−2, −4 y −40) y tres no lo
            // declaran. Donde no se puede medir se rotula «hoja» y se
            // dice: convertir a ciegas mandaría a la página equivocada
            // con la confianza de un dato verificado.
            const pageLabel = await buildPageLabeler(this.pageNumbering, paper, 'ComposeAcademicPaper');

            const composerInput: ComposeAcademicPaperInput = {
                paperPassage: paper.passage,
                paperTitle: paper.title ?? null,
                language: paper.displayLanguage,
                assignmentBrief: paper.assignmentBrief,
                verseAnalyses,
                pageLabel,
                styleGuideContent,
                styleGuideManifest: manifest,
                sources: composerSources,
                pinnedSourceKeys,
                paperRubric: paper.rubric ?? null,
                exegeticalStrategy: paper.exegeticalStrategy ?? null,
            };
            reservation.markLlmContacted();
            let raw = await this.composer.composeAcademicPaper(composerInput);

            // Post-validation retry on missing pinned keys.
            // ComposeAcademicPaperInput has no regenerationHint slot,
            // so the corrective directive is appended to assignmentBrief.
            const missing = pinnedSourceKeys.filter(
                key => !raw.markdown.toLowerCase().includes(key.toLowerCase()),
            );
            if (missing.length > 0) {
                console.warn('[exegesis] academic composer missed pinned keys, retrying once:', missing);
                try {
                    const correction = paper.displayLanguage === 'en'
                        ? `\n\n[CORRECTIVE PASS] Your previous output skipped pinned sources [${missing.join(', ')}]. Cite each one at least once across the paper using the source content provided in the registry.`
                        : `\n\n[PASE CORRECTIVO] Tu salida anterior se saltó las fuentes asignadas [${missing.join(', ')}]. Citá cada una al menos una vez en el paper usando el contenido provisto en el registro.`;
                    const retryResult = await this.composer.composeAcademicPaper({
                        ...composerInput,
                        assignmentBrief: (composerInput.assignmentBrief ?? '') + correction,
                    });
                    const stillMissing = pinnedSourceKeys.filter(
                        key => !retryResult.markdown.toLowerCase().includes(key.toLowerCase()),
                    );
                    if (stillMissing.length === 0 || stillMissing.length < missing.length) {
                        raw = retryResult;
                    }
                } catch (retryErr) {
                    console.warn('[exegesis] academic retry failed:', retryErr);
                }
            }

            // ── Lo estructurado se publica, lo decida el modelo o no ────
            // El compositor escribe la prosa; acá se comprueba verso
            // por verso que la prosa diga lo que el análisis afirmó, y
            // el verso que salió incompleto se publica con el render
            // determinista. Medido sobre Santiago 1:1-5: dieciocho
            // campos producidos y aceptados, tres publicados, quince
            // descartados sin que el paper lo declarara.
            const enforced = enforceAnalysisCoverage({
                markdown: raw.markdown,
                verseAnalyses,
                language: paper.displayLanguage,
                pageLabel,
                citableKeys: composerSources.map(s => s.citationKey).filter(Boolean),
            });
            if (enforced.coverage.renderedVerses.length > 0) {
                console.warn('[exegesis] el compositor descartó análisis; se publica el render determinista', {
                    paperId: paper.id,
                    versos: enforced.coverage.renderedVerses,
                    itemsRecuperados: enforced.coverage.recoveredItemLabels.length,
                    troceoFallido: enforced.coverage.sectioningFailed,
                });
            }
            raw = { ...raw, markdown: enforced.markdown, coverage: enforced.coverage };

            // ── Apply the deterministic post-formatter when possible ─────
            let finalOutput: ComposeAcademicPaperOutput;
            if (this.styleFormatter && manifest && citableSources.length > 0) {
                try {
                    const formatted = this.styleFormatter.format({
                        markdown: raw.markdown,
                        manifest,
                        citableSources,
                        // Composition is single-shot over the whole paper
                        // — no cross-step prior anchors. Each citation is
                        // either a first occurrence or a subsequent
                        // occurrence within the same composition, decided
                        // by sequence within the markdown.
                        priorFootnoteAnchors: [],
                    });
                    if (formatted.warnings.length > 0) {
                        console.warn('[ComposeAcademicPaperUseCase] formatter warnings:', formatted.warnings);
                    }
                    finalOutput = {
                        ...raw,
                        markdown: formatted.markdown,
                        formatterStatus: 'applied',
                    };
                } catch (err) {
                    console.error('[ComposeAcademicPaperUseCase] formatter threw, returning raw markdown:', err);
                    finalOutput = { ...raw, formatterStatus: 'error' };
                }
            } else {
                finalOutput = { ...raw, formatterStatus: 'skipped' };
            }

            // ── Optional persistence ────────────────────────────────────
            // Persist the composed markdown on `paper.assembledMarkdown`
            // when the caller opted in. This is the canonical "save the
            // assembled paper" surface — overwrites prior assembly.
            // Composition output is large; persisting on every run would
            // bloat history without proportional benefit. The caller (UI)
            // exposes a dedicated "Save to paper" CTA so the user
            // explicitly chooses when a composition is the canonical one.
            if (input.persist) {
                try {
                    await this.paperRepository.updatePaper(input.ownerId, input.paperId, {
                        assembledMarkdown: finalOutput.markdown,
                    });
                } catch (err) {
                    console.error('[ComposeAcademicPaperUseCase] persist failed:', err);
                    // Persistence failure must not lose the composition.
                    // Return the markdown so the user can still copy /
                    // download / retry. The caller surfaces the persist
                    // failure as a warning, not as a hard error.
                    throw new ComposeAcademicPaperPersistError(
                        'Composition completed but could not be saved to the paper. The markdown is in the error payload — copy or download before retrying.',
                        finalOutput,
                    );
                }
            }

            return finalOutput;
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private async loadStyleGuideContent(ownerId: string, styleGuideId: string | null): Promise<string> {
        if (!styleGuideId) return '';
        const guide = await this.styleGuideRepository.getGuide(ownerId, styleGuideId);
        if (!guide) return '';
        return (await this.contentReader.getTextContent(guide.corpusId)) ?? '';
    }

    /**
     * Las reglas de estilo de ESTE trabajo.
     *
     * Manda la copia que el trabajo se llevó al adjuntar la guía. Sólo
     * se mira la guía viva cuando no hay copia —papers anteriores a
     * esta regla—, que es como venían funcionando. Un trabajo entregado
     * no puede cambiar de reglas porque alguien editó la plantilla
     * después.
     */
    private async loadStyleManifest(
        ownerId: string,
        paper: { styleGuideId: string | null; styleGuideSnapshot?: StyleGuideSnapshot | null },
    ): Promise<StyleGuideManifest | null> {
        if (paper.styleGuideSnapshot) return paper.styleGuideSnapshot.manifest;
        if (!paper.styleGuideId) return null;
        const guide = await this.styleGuideRepository.getGuide(ownerId, paper.styleGuideId);
        return guide?.manifest ?? null;
    }
}

/**
 * Collects accepted `CanonicalVerseAnalysis` from verse-kind steps,
 * sorted by step order. Filters out:
 *   - non-verse steps (intro, conclusion, assembly)
 *   - steps without an accepted version
 *   - steps whose accepted version is from the legacy markdown path
 *     (no `canonicalAnalysis` populated)
 */
function collectAcceptedVerseAnalyses(paper: ExegeticalPaper): CanonicalVerseAnalysis[] {
    return paper.steps
        .filter(s => s.kind === 'verse' && s.accepted?.canonicalAnalysis)
        .sort((a, b) => a.order - b.order)
        .map(s => s.accepted!.canonicalAnalysis!);
}

/**
 * Builds the composer's source registry from the paper's project
 * sources. v1 populates the fields we have on `ProjectSource`;
 * publisher/city/year/edition stay undefined until library_resource
 * metadata gets surfaced through the source.
 */
async function buildComposerSourcesWithPinnedContent(
    paper: ExegeticalPaper,
    pinnedIds: ReadonlySet<string>,
    contentReader: IResourceContentReader,
): Promise<ComposerSourceMetadata[]> {
    const citable = paper.sources.filter(s => isCitableSourceType(s.sourceType));
    return Promise.all(citable.map(async s => {
        const key = s.citationKey ?? deriveCitationKey(s.displayLabel);
        const isPinned = pinnedIds.has(s.id);
        const base: ComposerSourceMetadata = {
            citationKey: key,
            author: key,
            title: s.displayLabel,
            isPinned,
        };
        if (!isPinned) return base;
        try {
            const text = await contentReader.getTextContent(s.corpusId);
            return { ...base, textContent: text ?? '' };
        } catch (err) {
            console.warn('[compose] failed to load pinned source textContent:', s.corpusId, err);
            return base;
        }
    }));
}

function buildComposerSources(paper: ExegeticalPaper): ComposerSourceMetadata[] {
    return paper.sources
        .filter(s => isCitableSourceType(s.sourceType))
        .map(s => {
            const key = s.citationKey ?? deriveCitationKey(s.displayLabel);
            return {
                citationKey: key,
                author: key,
                title: s.displayLabel,
            };
        });
}

/**
 * Builds the deterministic formatter's citable-source metadata from
 * the same project sources. Mirrors `GenerateStepUseCase.buildCitableSourceMetadata`
 * for behavioral parity.
 */
function buildFormatterSources(paper: ExegeticalPaper): FormatterSourceMetadata[] {
    return paper.sources
        .filter(s => isCitableSourceType(s.sourceType))
        .map(s => {
            const key = s.citationKey ?? deriveCitationKey(s.displayLabel);
            return {
                corpusId: s.corpusId,
                citationKey: key,
                fullAuthor: key,
                authorSurnameFirst: key,
                fullTitle: s.displayLabel,
                shortTitle: s.displayLabel,
                publisher: null,
                city: null,
                year: null,
                volume: null,
            };
        });
}

/**
 * Derives a stable short citation key from a display label when the
 * student didn't set one. Mirrors the heuristic used in
 * GenerateStepUseCase: take the first significant word.
 */
function deriveCitationKey(displayLabel: string): string {
    const trimmed = (displayLabel ?? '').trim();
    if (!trimmed) return 'Source';
    return trimmed.split(/[\s,;:.\-—]+/)[0] || 'Source';
}

export interface ComposeAcademicPaperUseCaseInput {
    ownerId: string;
    paperId: string;
    /**
     * When true, the composed markdown is persisted on
     * `paper.assembledMarkdown`. Default false — caller's surface
     * (copy / download dialog) usually doesn't auto-save; users
     * explicitly opt in via a "Save to paper" CTA.
     */
    persist?: boolean;
}

/**
 * Thrown when the composition succeeded but persisting it on the
 * paper failed. The caller still has the markdown via `output` so
 * the work isn't lost — they can copy or download from the dialog
 * even though the paper.assembledMarkdown didn't update.
 */
export class ComposeAcademicPaperPersistError extends Error {
    readonly output: ComposeAcademicPaperOutput;
    readonly isPersistError = true as const;
    constructor(message: string, output: ComposeAcademicPaperOutput) {
        super(message);
        this.name = 'ComposeAcademicPaperPersistError';
        this.output = output;
    }
}
