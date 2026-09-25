import type {
    CanonicalVerseAnalysis,
    ComposeVerseInput,
    ComposeVerseOutput,
    ComposerSourceMetadata,
    ExegeticalPaper,
    FormatterSourceMetadata,
    GlossaryTerm,
    IBibliographyReader,
    IExegeticalPaperRepository,
    ITermGlossaryRepository,
    IUserProseReader,
    IVoiceProfileRepository,
    IResourceContentReader,
    IStyleFormatter,
    IUserStyleGuideRepository,
    IVerseAcademicComposer,
    StyleGuideManifest,
    StyleGuideSnapshot,
    IPageNumberingReader,
} from '@dosfilos/domain';
import {
    documentSections,
    parseBriefQuestions,
    questionsForVerse,
    sectionBudgets,
    isCitableSourceType,
    replaceVerseSection,
    verseSectionKey,
    type AcademicVoiceSample,
} from '@dosfilos/domain';
import { buildPageLabeler } from './buildPageLabeler';
import { composerSourceOf } from './pinnedSourceContent';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';
import { loadAcademicVoiceSamples } from '../../services/exegesis/academicVoiceSamples';

export interface ComposeVerseAcademicProseInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /**
     * Qué corregir en esta pasada. Vacío la primera vez; con texto, es
     * una recomposición dirigida de ESE verso.
     */
    guidance?: string;
    /** Palabras que debería tener la prosa del verso, si el curso lo exige. */
    targetWords?: number;
}

export interface ComposeVerseAcademicProseOutput extends ComposeVerseOutput {
    /** ID of the version whose `markdown` was updated. */
    versionId: string;
    /**
     * Si la prosa nueva entró también en el trabajo ensamblado.
     *
     * `false` cuando no hay ensamblado todavía o cuando no se encontró la
     * sección de ese verso: entonces el ensamblado quedó como estaba y hay
     * que volver a ensamblar. Se informa en vez de pegar la prosa al
     * final, que dejaría el trabajo con dos versiones del mismo verso.
     */
    assemblyUpdated: boolean;
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
        /**
         * Datos de portada de las fuentes. Sin él se cita con la clave y el
         * nombre del archivo, y el modelo completa el resto inventándolo.
         */
        private bibliography?: IBibliographyReader,
        /**
         * El glosario del autor. Sin él la prosa sale con las palabras de
         * otro y el autor las tacha a mano, una por una, en cada entrega.
         */
        private glossaryRepository?: ITermGlossaryRepository,
        /**
         * Qué texto propio enseña cómo escribe el autor. Sin él la prosa
         * sale correcta y ajena, que es de lo que se quejó al leer la suya.
         */
        private voiceProfileRepository?: IVoiceProfileRepository,
        /**
         * Prosa del propio autor fuera de la biblioteca: sus sermones del
         * taller. Registro distinto —predicar no es escribir un trabajo—,
         * así que sólo entra si el autor lo pide.
         */
        private proseReader?: IUserProseReader,
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
            const glossary = await this.loadGlossary(input.ownerId);
            const voiceSamples = await this.loadVoiceSamples(input.ownerId);
            const manifest = await this.loadStyleManifest(input.ownerId, paper);

            const composerInput: ComposeVerseInput = {
                verseAnalysis: target.canonicalAnalysis,
                paperPassage: paper.passage,
                language: paper.displayLanguage,
                assignmentBrief: paper.assignmentBrief,
                styleGuideContent,
                styleGuideManifest: manifest,
                sources: await buildComposerSources(paper, this.bibliography),
                pageLabel: await buildPageLabeler(this.pageNumbering, paper, 'ComposeVerseAcademicProse'),
                ...(glossary.length > 0 ? { glossary } : {}),
                ...(voiceSamples.length > 0 ? { voiceSamples } : {}),
                // El presupuesto de ESTE versículo, derivado de la extensión
                // que exige la rúbrica y repartido entre los versículos del
                // trabajo. Sin esto el compositor no sabía que había un
                // límite: un trabajo de 2-3 páginas salió de 16.
                // La pregunta del encuadre que le toca a ESTE versículo.
                sectionQuestions: questionsForVerse(
                    parseBriefQuestions(paper.assignmentBrief),
                    step.verseRef!.chapterStart,
                    step.verseRef!.verseStart ?? 1,
                ).map(q => ({ number: q.number, text: q.text })),
                wordBudget: sectionBudgets(
                    paper.rubric?.expectedLength ?? null,
                    documentSections(paper.steps),
                    paper.rubric?.formatting ?? null,
                ).perVerse,
                // La forma de cita la decide la entrega, no el compositor: es
                // la misma que el exportador va a maquetar.
                ...(paper.rubric?.formatting?.citationForm
                    ? { citationForm: paper.rubric.formatting.citationForm }
                    : {}),
                ...(input.guidance?.trim() ? { guidance: input.guidance.trim() } : {}),
                ...(input.targetWords && input.targetWords > 0 ? { targetWords: input.targetWords } : {}),
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

            // Y, si el trabajo ya está ensamblado, la prosa nueva entra en
            // su sitio. Volver a componer el trabajo entero costaría una
            // llamada larga y reescribiría los versos que están bien.
            const assemblyUpdated = await this.spliceIntoAssembly(
                input.ownerId,
                paper,
                target.canonicalAnalysis,
                finalMarkdown,
            );

            return {
                ...raw,
                markdown: finalMarkdown,
                formatterStatus,
                versionId: target.id,
                assemblyUpdated,
            };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }


    /**
     * Mete la prosa del verso en el trabajo ensamblado, en su sección.
     *
     * Devuelve `false` si no hay ensamblado o si su sección no aparece
     * —un ensamblado escrito a mano, o con otros encabezados—. Ahí el
     * llamador avisa: pegar la prosa donde caiga deja el trabajo con el
     * verso dos veces.
     */
    private async spliceIntoAssembly(
        ownerId: string,
        paper: ExegeticalPaper,
        analysis: CanonicalVerseAnalysis,
        prose: string,
    ): Promise<boolean> {
        const assembled = paper.assembledMarkdown?.trim();
        if (!assembled) return false;

        const key = verseSectionKey(analysis, paper.displayLanguage);
        const next = replaceVerseSection(assembled, key, prose);
        if (next === null) {
            console.warn('[ComposeVerseAcademicProseUseCase] el ensamblado no trae la sección', key);
            return false;
        }
        if (next === assembled) return true;

        await this.paperRepository.updatePaper(ownerId, paper.id, { assembledMarkdown: next });
        return true;
    }

    /**
     * Las palabras que este autor no usa.
     *
     * Un fallo de lectura devuelve lista vacía: componer con el glosario
     * ausente deja una prosa que habrá que corregir a mano —molesto—; no
     * componer deja al autor sin verso —peor—.
     */
    private async loadGlossary(ownerId: string): Promise<GlossaryTerm[]> {
        if (!this.glossaryRepository) return [];
        try {
            const glosario = await this.glossaryRepository.getGlossary(ownerId);
            return [...(glosario?.terms ?? [])];
        } catch (err) {
            console.warn('[ComposeVerseAcademicProseUseCase] no se pudo leer el glosario:', err);
            return [];
        }
    }

    /**
     * Unos párrafos de la prosa del autor, de un texto que él declaró suyo.
     *
     * Delega en el servicio compartido: la introducción y la conclusión
     * necesitan exactamente las mismas muestras, y tres copias de esta lógica
     * serían tres criterios distintos sobre qué es la voz de una persona.
     */
    private loadVoiceSamples(ownerId: string): Promise<AcademicVoiceSample[]> {
        return loadAcademicVoiceSamples(ownerId, {
            voiceProfileRepository: this.voiceProfileRepository,
            contentReader: this.contentReader,
            proseReader: this.proseReader,
        });
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

function buildComposerSources(
    paper: ExegeticalPaper,
    bibliography?: IBibliographyReader,
): Promise<ComposerSourceMetadata[]> {
    return Promise.all(
        paper.sources
            .filter(s => isCitableSourceType(s.sourceType))
            .map(s => composerSourceOf(s, bibliography)),
    );
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
