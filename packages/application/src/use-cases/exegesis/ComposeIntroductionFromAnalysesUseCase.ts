import type {
    CanonicalVerseAnalysis,
    ComposeIntroductionInput,
    ComposerSourceMetadata,
    ExegeticalPaper,
    ExegeticalStep,
    ExegeticalStepVersion,
    FormatterSourceMetadata,
    IBibliographyReader,
    IExegeticalPaperRepository,
    IIntroductionComposer,
    IResourceContentReader,
    IStyleFormatter,
    IUserProseReader,
    IUserStyleGuideRepository,
    IVoiceProfileRepository,
    ICuratedCorpusReader,
    IPageNumberingReader,
    StyleGuideManifest,
    StyleGuideSnapshot,
} from '@dosfilos/domain';
import {
    EMPTY_VERIFICATION_SUMMARY,
    documentSections,
    sectionBudgets,
    isCitableSourceType,
} from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';
import { buildComposerSourcesWithPinnedContent, deriveCitationKey } from './pinnedSourceContent';
import { loadAcademicVoiceSamples } from '../../services/exegesis/academicVoiceSamples';

/**
 * Composes the introduction section LAST in the academic flow —
 * after both verse analyses AND the conclusion are accepted.
 *
 * Pipeline:
 *   1. Load paper + locate intro step (kind='introduction').
 *   2. Validate every verse step has accepted `canonicalAnalysis`.
 *   3. Validate the conclusion step has an accepted markdown
 *      version (the introduction reads it to know the thesis).
 *   4. Resolve style guide.
 *   5. Build composer + formatter source metadata.
 *   6. Call `IIntroductionComposer`.
 *   7. Apply `IStyleFormatter` post-process when manifest available.
 *   8. Append the markdown as a new version of the intro step.
 *
 * Failures: state rolls back on the intro step.
 */
export class ComposeIntroductionFromAnalysesUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private contentReader: IResourceContentReader,
        private composer: IIntroductionComposer,
        private styleFormatter?: IStyleFormatter,
        /** Numeración impresa, para rotular con su página las hojas de las fuentes asignadas. */
        private pageNumbering?: IPageNumberingReader,
        /**
         * Lee las hojas elegidas de cada fuente asignada. Sin él, el contenido
         * de una fuente asignada es el libro entero (ver `pinnedSourceContent`).
         */
        private corpusReader?: ICuratedCorpusReader,
        /** Datos de portada de las fuentes, para no inventar la bibliografía. */
        private bibliography?: IBibliographyReader,
        /**
         * El perfil de voz del autor. Llega hasta acá por la misma razón que
         * llegaba al compositor de versículos: cómo abre y cómo cierra un
         * trabajo es lo que más se lee, y salían con la voz del modelo.
         */
        private voiceProfileRepository?: IVoiceProfileRepository,
        /** Sermones del taller, cuando el autor eligió usarlos como muestra. */
        private proseReader?: IUserProseReader,
    ) { }

    async execute(input: ComposeIntroductionFromAnalysesUseCaseInput): Promise<ExegeticalStepVersion> {
        if (!input.ownerId || !input.paperId) {
            throw new Error('ComposeIntroductionFromAnalysesUseCase: ownerId and paperId required');
        }

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const introStep = paper.steps.find(s => s.kind === 'introduction');
        if (!introStep) {
            throw new Error('Paper has no introduction step. Run seedSteps first.');
        }

        const verseAnalyses = collectAcceptedVerseAnalyses(paper);
        if (verseAnalyses.length === 0) {
            throw new Error(
                'ComposeIntroductionFromAnalysesUseCase: paper has no accepted verse analyses. ' +
                'Run AnalyzeVerseCanonicallyUseCase + accept for each verse step before composing the introduction.',
            );
        }

        const conclusionStep = paper.steps.find(s => s.kind === 'conclusion');
        const acceptedConclusion = conclusionStep?.accepted?.markdown ?? '';
        if (!acceptedConclusion.trim()) {
            throw new Error(
                'ComposeIntroductionFromAnalysesUseCase: the introduction is composed LAST. ' +
                'Compose and accept the conclusion before composing the introduction.',
            );
        }

        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'composeIntroductionFromAnalyses',
        );

        await this.paperRepository.setStepState(input.ownerId, input.paperId, introStep.id, 'generating');

        try {
            const styleGuideContent = await this.loadStyleGuideContent(input.ownerId, paper.styleGuideId);
            const manifest = await this.loadStyleManifest(input.ownerId, paper);

            // Plan-pinned sources for the introduction step. Composer
            // treats them as a contract.
            const pinnedIds = new Set(
                paper.stepPlan.perStep[introStep.id]?.pinnedSources ?? [],
            );
            const pinnedSourceKeys = paper.sources
                .filter(s => pinnedIds.has(s.id) && s.citationKey)
                .map(s => s.citationKey!);

            const composerSources = await buildComposerSourcesWithPinnedContent(
                paper,
                pinnedIds,
                { contentReader: this.contentReader, corpusReader: this.corpusReader, pageNumbering: this.pageNumbering, bibliography: this.bibliography },
            );
            const citableSources = buildFormatterSources(paper);

            // Una sola lectura del perfil: el reintento por fuentes asignadas
            // reusa este mismo input y no debe volver a leer la biblioteca.
            const voiceSamples = await loadAcademicVoiceSamples(input.ownerId, {
                voiceProfileRepository: this.voiceProfileRepository,
                contentReader: this.contentReader,
                proseReader: this.proseReader,
            });
            const composerInput: ComposeIntroductionInput = {
                paperPassage: paper.passage,
                language: paper.displayLanguage,
                assignmentBrief: paper.assignmentBrief,
                verseAnalyses,
                acceptedConclusionMarkdown: acceptedConclusion,
                styleGuideContent,
                styleGuideManifest: manifest,
                sources: composerSources,
                pinnedSourceKeys,
                paperRubric: paper.rubric ?? null,
                exegeticalStrategy: paper.exegeticalStrategy ?? null,
                voiceSamples,
                wordBudget: sectionBudgets(
                    paper.rubric?.expectedLength ?? null,
                    documentSections(paper.steps),
                    paper.rubric?.formatting ?? null,
                ).introduction,
                // La forma de cita la decide la entrega, no el compositor: es
                // la misma que el exportador va a maquetar.
                ...(paper.rubric?.formatting?.citationForm
                    ? { citationForm: paper.rubric.formatting.citationForm }
                    : {}),
                regenerationHint: input.regenerationHint ?? null,
            };

            reservation.markLlmContacted();
            let result = await this.composer.composeIntroduction(composerInput);

            // Post-validation retry: if the composer skipped any
            // pinned sources, fire one corrective regen with an
            // explicit hint. Single retry — further enforcement should
            // escalate to schema-level constraints.
            const missing = pinnedSourceKeys.filter(
                key => !result.markdown.toLowerCase().includes(key.toLowerCase()),
            );
            if (missing.length > 0) {
                console.warn('[exegesis] intro composer missed pinned keys, retrying once:', missing);
                const retryHint = paper.displayLanguage === 'en'
                    ? `CRITICAL: your previous output skipped pinned sources [${missing.join(', ')}]. You MUST cite each one at least once in this introduction. Use the source content provided in the registry to ground the citation. Do NOT substitute another source.`
                    : `CRÍTICO: tu salida anterior se saltó las fuentes asignadas [${missing.join(', ')}]. DEBES citar cada una al menos una vez en esta introducción. Usá el contenido de la fuente provisto en el registro para anclar la cita. NO sustituyas por otra fuente.`;
                try {
                    const retryResult = await this.composer.composeIntroduction({
                        ...composerInput,
                        regenerationHint: retryHint,
                    });
                    const stillMissing = pinnedSourceKeys.filter(
                        key => !retryResult.markdown.toLowerCase().includes(key.toLowerCase()),
                    );
                    if (stillMissing.length === 0 || stillMissing.length < missing.length) {
                        result = retryResult;
                    }
                } catch (retryErr) {
                    console.warn('[exegesis] intro retry failed:', retryErr);
                }
            }

            const finalMarkdown = await this.applyFormatter(result.markdown, manifest, citableSources);

            const parentVersionId = introStep.current?.id ?? null;
            return await this.paperRepository.appendStepVersion(
                input.ownerId,
                input.paperId,
                introStep.id,
                {
                    markdown: finalMarkdown,
                    origin: 'generated',
                    parentVersionId,
                    modelId: result.modelId,
                    regenerationHint: input.regenerationHint ?? null,
                    tokensUsed: result.tokensUsed,
                    verifications: { ...EMPTY_VERIFICATION_SUMMARY },
                },
            );
        } catch (err) {
            try {
                await this.paperRepository.setStepState(input.ownerId, input.paperId, introStep.id, 'failed');
            } catch (rollbackErr) {
                console.error('[ComposeIntroductionFromAnalysesUseCase] roll-back to failed errored:', rollbackErr);
            }
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
     * Las reglas de estilo de ESTE trabajo: manda la copia que se llevó
     * al adjuntar la guía. Sólo se mira la guía viva cuando no hay
     * copia —papers anteriores a esta regla—.
     */
    private async loadStyleManifest(
        ownerId: string,
        paper: { styleGuideId: string | null; styleGuideSnapshot?: StyleGuideSnapshot | null },
    ): Promise<StyleGuideManifest | null> {
        if (paper.styleGuideSnapshot) return paper.styleGuideSnapshot.manifest;
        const styleGuideId = paper.styleGuideId;
        if (!styleGuideId) return null;
        const guide = await this.styleGuideRepository.getGuide(ownerId, styleGuideId);
        return guide?.manifest ?? null;
    }

    private async applyFormatter(
        rawMarkdown: string,
        manifest: StyleGuideManifest | null,
        citableSources: ReadonlyArray<FormatterSourceMetadata>,
    ): Promise<string> {
        if (!this.styleFormatter || !manifest || citableSources.length === 0) return rawMarkdown;
        try {
            const formatted = this.styleFormatter.format({
                markdown: rawMarkdown,
                manifest,
                citableSources,
                priorFootnoteAnchors: [],
            });
            if (formatted.warnings.length > 0) {
                console.warn('[ComposeIntroductionFromAnalysesUseCase] formatter warnings:', formatted.warnings);
            }
            return formatted.markdown;
        } catch (err) {
            console.error('[ComposeIntroductionFromAnalysesUseCase] formatter threw, returning raw markdown:', err);
            return rawMarkdown;
        }
    }
}

// ── Shared helpers ──────────────────────────────────────────────────────

function collectAcceptedVerseAnalyses(paper: ExegeticalPaper): CanonicalVerseAnalysis[] {
    return paper.steps
        .filter((s: ExegeticalStep) => s.kind === 'verse' && s.accepted?.canonicalAnalysis)
        .sort((a, b) => a.order - b.order)
        .map(s => s.accepted!.canonicalAnalysis!);
}

function buildComposerSources(paper: ExegeticalPaper): ComposerSourceMetadata[] {
    return paper.sources
        .filter(s => isCitableSourceType(s.sourceType))
        .map(s => {
            const key = s.citationKey ?? deriveCitationKey(s.displayLabel);
            return { citationKey: key, author: key, title: s.displayLabel };
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


export interface ComposeIntroductionFromAnalysesUseCaseInput {
    ownerId: string;
    paperId: string;
    regenerationHint?: string | null;
}
