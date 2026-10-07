import type {
    CanonicalVerseAnalysis,
    ComposeDevotionalInput,
    ComposeDevotionalOutput,
    ComposeSermonInput,
    ComposeSermonOutput,
    ComposeStudyGuideInput,
    ComposeStudyGuideOutput,
    ComposerSourceMetadata,
    DevotionalAudience,
    ExegeticalPaper,
    IDevotionalComposer,
    IExegeticalPaperRepository,
    IResourceContentReader,
    ISermonComposer,
    IStudyGuideComposer,
    IUserStyleGuideRepository,
    PaperToSermonTone,
    StudyGuideAudience,
    StyleGuideManifest,
} from '@dosfilos/domain';
import { isCitableSourceType, briefWithExclusions } from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

/**
 * Three parallel ministry composer use cases — sermon, devotional,
 * study guide. They share so much orchestration that bundling them
 * here is cheaper than maintaining three nearly-identical files.
 *
 * Each use case:
 *   1. Loads paper.
 *   2. Validates accepted verse analyses exist.
 *   3. Resolves style guide (advisory for these formats).
 *   4. Builds the source registry.
 *   5. Calls the format-specific composer port.
 *   6. Returns the composed markdown — does NOT auto-persist.
 *      Caller (UI) decides whether to copy / download / save to a
 *      sermon record / etc.
 *
 * Persistence intentionally omitted at this layer:
 *   - Sermon: integrating with the existing sermon module is a
 *     larger workflow (sermon repository, deep links). v1 hands the
 *     markdown back; the user persists via existing sermon flows.
 *   - Devotional / study guide: no first-class entities yet. Markdown
 *     is for export.
 *
 * Hallucination guardrails are in the composers' prompts; sanitizing
 * citation keys here is unnecessary because ministry formats cite
 * sparingly or not at all.
 */

// ── Sermon ──────────────────────────────────────────────────────────────

export class ComposeSermonFromAnalysesUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private contentReader: IResourceContentReader,
        private composer: ISermonComposer,
    ) { }

    async execute(input: ComposeSermonFromAnalysesUseCaseInput): Promise<ComposeSermonOutput> {
        const ctx = await loadContext(this.paperRepository, this.styleGuideRepository, this.contentReader, input.ownerId, input.paperId);
        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'composeSermonFromAnalyses',
        );
        try {
            const composerInput: ComposeSermonInput = {
                paperPassage: ctx.paper.passage,
                language: ctx.paper.displayLanguage,
                assignmentBrief: briefWithExclusions(ctx.paper),
                verseAnalyses: ctx.verseAnalyses,
                styleGuideContent: ctx.styleGuideContent,
                styleGuideManifest: ctx.manifest,
                sources: ctx.composerSources,
                regenerationHint: input.regenerationHint ?? null,
                tone: input.tone,
            };
            reservation.markLlmContacted();
            return await this.composer.composeSermon(composerInput);
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

export interface ComposeSermonFromAnalysesUseCaseInput {
    ownerId: string;
    paperId: string;
    tone: PaperToSermonTone;
    regenerationHint?: string | null;
}

// ── Devotional ──────────────────────────────────────────────────────────

export class ComposeDevotionalFromAnalysesUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private contentReader: IResourceContentReader,
        private composer: IDevotionalComposer,
    ) { }

    async execute(input: ComposeDevotionalFromAnalysesUseCaseInput): Promise<ComposeDevotionalOutput> {
        const ctx = await loadContext(this.paperRepository, this.styleGuideRepository, this.contentReader, input.ownerId, input.paperId);
        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'composeDevotionalFromAnalyses',
        );
        try {
            const composerInput: ComposeDevotionalInput = {
                paperPassage: ctx.paper.passage,
                language: ctx.paper.displayLanguage,
                assignmentBrief: briefWithExclusions(ctx.paper),
                verseAnalyses: ctx.verseAnalyses,
                styleGuideContent: ctx.styleGuideContent,
                styleGuideManifest: ctx.manifest,
                sources: ctx.composerSources,
                regenerationHint: input.regenerationHint ?? null,
                audience: input.audience,
            };
            reservation.markLlmContacted();
            return await this.composer.composeDevotional(composerInput);
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

export interface ComposeDevotionalFromAnalysesUseCaseInput {
    ownerId: string;
    paperId: string;
    audience: DevotionalAudience;
    regenerationHint?: string | null;
}

// ── Study guide ─────────────────────────────────────────────────────────

export class ComposeStudyGuideFromAnalysesUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private styleGuideRepository: IUserStyleGuideRepository,
        private contentReader: IResourceContentReader,
        private composer: IStudyGuideComposer,
    ) { }

    async execute(input: ComposeStudyGuideFromAnalysesUseCaseInput): Promise<ComposeStudyGuideOutput> {
        const ctx = await loadContext(this.paperRepository, this.styleGuideRepository, this.contentReader, input.ownerId, input.paperId);
        const reservation = await ExegesisCreditReservation.open(
            input.ownerId,
            'composeStudyGuideFromAnalyses',
        );
        try {
            const composerInput: ComposeStudyGuideInput = {
                paperPassage: ctx.paper.passage,
                language: ctx.paper.displayLanguage,
                assignmentBrief: briefWithExclusions(ctx.paper),
                verseAnalyses: ctx.verseAnalyses,
                styleGuideContent: ctx.styleGuideContent,
                styleGuideManifest: ctx.manifest,
                sources: ctx.composerSources,
                regenerationHint: input.regenerationHint ?? null,
                audience: input.audience,
            };
            reservation.markLlmContacted();
            return await this.composer.composeStudyGuide(composerInput);
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

export interface ComposeStudyGuideFromAnalysesUseCaseInput {
    ownerId: string;
    paperId: string;
    audience: StudyGuideAudience;
    regenerationHint?: string | null;
}

// ── Shared context loader ───────────────────────────────────────────────

interface LoadedContext {
    paper: ExegeticalPaper;
    verseAnalyses: ReadonlyArray<CanonicalVerseAnalysis>;
    styleGuideContent: string;
    manifest: StyleGuideManifest | null;
    composerSources: ReadonlyArray<ComposerSourceMetadata>;
}

async function loadContext(
    paperRepository: IExegeticalPaperRepository,
    styleGuideRepository: IUserStyleGuideRepository,
    contentReader: IResourceContentReader,
    ownerId: string,
    paperId: string,
): Promise<LoadedContext> {
    if (!ownerId || !paperId) {
        throw new Error('Ministry composer use case: ownerId and paperId required');
    }
    const paper = await paperRepository.getPaper(ownerId, paperId);
    if (!paper) throw new Error(`Paper ${paperId} not found`);

    const verseAnalyses = paper.steps
        .filter(s => s.kind === 'verse' && s.accepted?.canonicalAnalysis)
        .sort((a, b) => a.order - b.order)
        .map(s => s.accepted!.canonicalAnalysis!);
    if (verseAnalyses.length === 0) {
        throw new Error(
            'Ministry composer: paper has no accepted verse analyses. ' +
            'Run AnalyzeVerseCanonicallyUseCase + accept for each verse step before composing for ministry.',
        );
    }

    let styleGuideContent = '';
    let manifest: StyleGuideManifest | null = null;
    if (paper.styleGuideId) {
        const guide = await styleGuideRepository.getGuide(ownerId, paper.styleGuideId);
        if (guide) {
            // El TEXTO se sigue leyendo de la guía viva: no se copia al
            // trabajo por tamaño. Las REGLAS vienen de la copia cuando
            // existe, que es lo que impide que editar la plantilla
            // cambie un trabajo ya entregado.
            styleGuideContent = (await contentReader.getTextContent(guide.corpusId)) ?? '';
        }
        manifest = paper.styleGuideSnapshot
            ? paper.styleGuideSnapshot.manifest
            : guide?.manifest ?? null;
    }

    const composerSources = paper.sources
        .filter(s => isCitableSourceType(s.sourceType))
        .map(s => {
            const key = s.citationKey ?? deriveCitationKey(s.displayLabel);
            return { citationKey: key, author: key, title: s.displayLabel };
        });

    return { paper, verseAnalyses, styleGuideContent, manifest, composerSources };
}

function deriveCitationKey(displayLabel: string): string {
    const trimmed = (displayLabel ?? '').trim();
    if (!trimmed) return 'Source';
    return trimmed.split(/[\s,;:.\-—]+/)[0] || 'Source';
}
