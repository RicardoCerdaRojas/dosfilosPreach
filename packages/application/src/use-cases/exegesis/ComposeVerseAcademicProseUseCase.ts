import type {
    ComposeVerseInput,
    ComposeVerseOutput,
    ComposerSourceMetadata,
    ExegeticalPaper,
    FormatterSourceMetadata,
    IExegeticalPaperRepository,
    IResourceContentReader,
    IStyleFormatter,
    IUserStyleGuideRepository,
    IVerseAcademicComposer,
    StyleGuideManifest,
    StyleGuideSnapshot,
    IPageNumberingReader,
} from '@dosfilos/domain';
import { isCitableSourceType } from '@dosfilos/domain';
import { buildPageLabeler } from './buildPageLabeler';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

export interface ComposeVerseAcademicProseInput {
    ownerId: string;
    paperId: string;
    stepId: string;
}

export interface ComposeVerseAcademicProseOutput extends ComposeVerseOutput {
    /** ID of the version whose `markdown` was updated. */
    versionId: string;
}

/**
 * Per-verse academic-prose composer. Reads one verse's accepted (or
 * current) `CanonicalVerseAnalysis`, composes 1-3 paragraphs of
 * academic prose, applies the deterministic style formatter when a
 * manifest is configured, and PERSISTS the result on that version's
 * `markdown` field.
 *
 * Why persist (vs the whole-paper composer's transient default):
 *   - Per-verse prose is small, idempotent, and the user explicitly
 *     opted into composing it. Re-paying the LLM cost on every page
 *     visit is wasteful.
 *   - Storing it on the version (not the step) means re-analyzing the
 *     verse correctly invalidates the prose: a new version starts with
 *     `markdown: ''` and the user re-composes only when ready.
 *   - The whole-paper composer can read this prose via the version's
 *     `markdown` field as a fast-path render hint when re-composing
 *     the assembly (future optimization).
 *
 * Failure semantics mirror `ComposeAcademicPaperUseCase`:
 *   - Step missing or has no canonical analysis → throw with explicit
 *     message; the UI suggests running the analyzer first.
 *   - Composer throws → bubble.
 *   - Formatter throws → swallowed; raw composer output is persisted
 *     with `formatterStatus: 'error'`.
 *   - Persistence throws → bubble (small payload, simple write — no
 *     "save it elsewhere" fallback).
 */
export class ComposeVerseAcademicProseUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private contentReader: IResourceContentReader,
        private composer: IVerseAcademicComposer,
        private styleFormatter?: IStyleFormatter,
        /**
         * Numeración impresa de las fuentes. Sin ella la prosa rotula según
         * lo que guardó el análisis; con ella, además, convierte las hojas de
         * los análisis anteriores a la calibración.
         */
        private pageNumbering?: IPageNumberingReader,
    ) { }

    async execute(input: ComposeVerseAcademicProseInput): Promise<ComposeVerseAcademicProseOutput> {
        if (!input.ownerId || !input.paperId || !input.stepId) {
            throw new Error('ComposeVerseAcademicProseUseCase: ownerId, paperId, stepId required');
        }

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const step = paper.steps.find(s => s.id === input.stepId);
        if (!step) throw new Error(`Step ${input.stepId} not found`);
        if (step.kind !== 'verse') {
            throw new Error('ComposeVerseAcademicProseUseCase: step kind must be "verse"');
        }

        const target = step.accepted ?? step.current;
        if (!target) {
            throw new Error('ComposeVerseAcademicProseUseCase: step has no accepted or current version');
        }
        if (!target.canonicalAnalysis) {
            throw new Error(
                'ComposeVerseAcademicProseUseCase: target version has no canonical analysis. ' +
                'Run "Análisis canónico" on this verse first.',
            );
        }

        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'composeVerseAcademicProse',
        );

        try {
            const styleGuideContent = await this.loadStyleGuideContent(input.ownerId, paper.styleGuideId);
            const manifest = await this.loadStyleManifest(input.ownerId, paper);

            const composerInput: ComposeVerseInput = {
                verseAnalysis: target.canonicalAnalysis,
                paperPassage: paper.passage,
                language: paper.displayLanguage,
                assignmentBrief: paper.assignmentBrief,
                styleGuideContent,
                styleGuideManifest: manifest,
                sources: buildComposerSources(paper),
                pageLabel: await buildPageLabeler(this.pageNumbering, paper, 'ComposeVerseAcademicProse'),
            };
            reservation.markLlmContacted();
            const raw = await this.composer.composeVerse(composerInput);

            // Optional deterministic style formatter — same pattern as
            // the whole-paper composer.
            let finalMarkdown = raw.markdown;
            let formatterStatus: 'applied' | 'skipped' | 'error' = 'skipped';
            const citableSources = buildFormatterSources(paper);
            if (this.styleFormatter && manifest && citableSources.length > 0) {
                try {
                    const formatted = this.styleFormatter.format({
                        markdown: raw.markdown,
                        manifest,
                        citableSources,
                        priorFootnoteAnchors: [],
                    });
                    if (formatted.warnings.length > 0) {
                        console.warn('[ComposeVerseAcademicProseUseCase] formatter warnings:', formatted.warnings);
                    }
                    finalMarkdown = formatted.markdown;
                    formatterStatus = 'applied';
                } catch (err) {
                    console.error('[ComposeVerseAcademicProseUseCase] formatter threw, persisting raw:', err);
                    formatterStatus = 'error';
                }
            }

            await this.paperRepository.setStepVersionMarkdown(
                input.ownerId,
                input.paperId,
                input.stepId,
                target.id,
                finalMarkdown,
            );

            return {
                ...raw,
                markdown: finalMarkdown,
                formatterStatus,
                versionId: target.id,
            };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }

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

function deriveCitationKey(displayLabel: string): string {
    const trimmed = (displayLabel ?? '').trim();
    if (!trimmed) return 'Source';
    return trimmed.split(/[\s,;:.\-—]+/)[0] || 'Source';
}
