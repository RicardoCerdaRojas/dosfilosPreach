import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, EMPTY_STEP_SOURCE_PLAN } from '@dosfilos/domain';
import type {
    CanonicalVerseAnalysis,
    ExegeticalPaper,
    ExegeticalStep,
    ProjectSource,
    PassageReference,
    SourceType,
} from '@dosfilos/domain';

// The use case reserves exégesis credits before touching state, and
// the reservation goes through the Firestore-backed balance service.
// Neither is under test here.
vi.mock('../../../services/ProcessingBalanceService', () => ({
    processingBalanceService: {
        consumeExegesis: vi.fn().mockResolvedValue(undefined),
        refundExegesis: vi.fn().mockResolvedValue(undefined),
    },
    InsufficientExegesisCreditsError: class extends Error { },
}));
vi.mock('../../../services/exegesisPricingTracker', () => ({
    fireExegesisPricingEvent: vi.fn(),
}));

const { AnalyzeVerseCanonicallyUseCase } = await import('../AnalyzeVerseCanonicallyUseCase');

const NOW = new Date('2026-01-01T00:00:00Z');
const VERSE: PassageReference = { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 1 };

function makeSource(citationKey: string, resourceId: string): ProjectSource {
    return {
        id: `src-${citationKey}`,
        paperId: 'paper-1',
        corpusId: resourceId,
        sourceType: 'theological-dictionary' as SourceType,
        displayLabel: `${citationKey} — obra`,
        citationKey,
        order: 0,
        mode: 'extracted-excerpts',
        excerptSelectionMode: 'semantic',
        // The page selector persists the recipe and NOT the text
        // (SelectSourcePagesUseCase), so `excerpts` is empty for every
        // paper built with it. The text must come from the corpus.
        excerptRecipe: {
            sheetRanges: [{ start: 148, end: 151 }],
            proposedRanges: [],
            pinnedRanges: [],
            passageFingerprint: 'fp',
        },
        excerpts: [],
        sourceLibraryResourceId: resourceId,
        extractedAt: NOW,
        extractionFingerprint: 'fp',
        createdAt: NOW,
    };
}

function makeStep(): ExegeticalStep {
    return {
        id: 'step-1',
        paperId: 'paper-1',
        kind: 'verse',
        verseRef: VERSE,
        order: 1,
        state: 'pending',
        current: null,
        accepted: null,
        versions: [],
        createdAt: NOW,
        updatedAt: NOW,
    };
}

function makePaper(sources: ProjectSource[]): ExegeticalPaper {
    return {
        id: 'paper-1',
        ownerId: 'owner-1',
        createdAt: NOW,
        updatedAt: NOW,
        passage: { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 5 },
        displayLanguage: 'es',
        assignmentBrief: null,
        styleGuideId: null,
        sources,
        rubric: null,
        stepPlan: EMPTY_STEP_SOURCE_PLAN,
        phase: 'in-progress',
        steps: [makeStep()],
        currentStepId: 'step-1',
        assembledMarkdown: null,
        archivedAt: null,
    };
}

/** An analysis that cites both sources on its lexical entry. */
function analysisCiting(keys: string[]): CanonicalVerseAnalysis {
    return {
        ...buildEmptyCanonicalVerseAnalysis(VERSE),
        lexicalAnalyses: [{
            term: 'δοῦλος',
            lemma: 'δοῦλος',
            gloss: 'siervo',
            generalSemanticRange: {
                glosses: ['esclavo', 'siervo'],
                sources: keys.map(k => ({ sourceKey: k, page: 149, locator: '' })),
            },
            verseSpecificLoading: 'Auto-designación de honor.',
            loadingSources: [],
        }],
    };
}

function buildUseCase(opts: {
    paper: ExegeticalPaper;
    analysis: CanonicalVerseAnalysis;
    retrievedFor: string[];
    /** Whether retrieved chunks carry a page anchor. Default true. */
    anchored?: boolean;
    /** Original-language text for the verse, threaded into the query. */
    greek?: string;
    /** Chunk texts returned per retrieved source. */
    chunks?: string[];
    /**
     * Fuentes que el corpus devuelve con arreglo VACÍO, no ausente.
     * Es la forma real: `CallableCuratedCorpusRetriever` siembra
     * `byResource[resourceId] = []` para toda fuente con receta antes
     * de repartir los fragmentos.
     */
    emptyFor?: string[];
    /** Lo que el lector de contenido entrega para el documento entero. */
    fullText?: string;
}) {
    const appended: CanonicalVerseAnalysis[] = [];
    const paperRepository = {
        getPaper: vi.fn().mockResolvedValue(opts.paper),
        setStepState: vi.fn().mockResolvedValue(undefined),
        appendStepVersion: vi.fn(async (_o, _p, _s, version) => {
            appended.push(version.canonicalAnalysis);
            return opts.paper;
        }),
    };
    const analyzer = {
        analyzeVerse: vi.fn().mockResolvedValue({ analysis: opts.analysis, tokensUsed: 10 }),
    };
    const corpusRetriever = {
        retrieve: vi.fn().mockResolvedValue({
            byResource: {
                ...Object.fromEntries((opts.emptyFor ?? []).map(id => [id, []])),
                ...Object.fromEntries(
                opts.retrievedFor.map(id => [
                    id,
                    (opts.chunks ?? ['texto real de la fuente']).map(text => ({
                        text,
                        sheet: opts.anchored === false ? null : 149,
                        section: null,
                    })),
                ]),
            ),
            },
        }),
    };
    const originalLanguageProvider = opts.greek
        ? {
            supports: () => true,
            getChapterContent: vi.fn().mockResolvedValue([opts.greek]),
        }
        : undefined;
    const useCase = new AnalyzeVerseCanonicallyUseCase(
        paperRepository as never,
        { getActiveStyleGuide: vi.fn().mockResolvedValue(null) } as never,
        { getTextContent: vi.fn().mockResolvedValue(opts.fullText ?? '') } as never,
        analyzer as never,
        originalLanguageProvider as never,
        corpusRetriever as never,
    );
    return { useCase, analyzer, appended, retriever: corpusRetriever };
}

describe('AnalyzeVerseCanonicallyUseCase — sources that contributed no text', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('keeps a source out of the prompt when the corpus returned nothing for it', async () => {
        const paper = makePaper([makeSource('Tuggy', 'res-a'), makeSource('Kittel', 'res-b')]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting(['Tuggy']),
            retrievedFor: ['res-a'],
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const sentSources = analyzer.analyzeVerse.mock.calls[0][0].sources;
        expect(sentSources.map((s: { citationKey: string }) => s.citationKey)).toEqual(['Tuggy']);
        // An empty body next to a live citation key is an invitation to
        // cite from memory.
        expect(sentSources.every((s: { textContent: string }) => s.textContent.trim().length > 0)).toBe(true);
    });

    it('drops a citation against a source the model never saw', async () => {
        const paper = makePaper([makeSource('Tuggy', 'res-a'), makeSource('Kittel', 'res-b')]);
        const { useCase, appended } = buildUseCase({
            paper,
            // The model cites both — including the one whose text never
            // arrived. This is the real failure: a page number lifted
            // from the selection recipe, prose supplied from priors.
            analysis: analysisCiting(['Tuggy', 'Kittel']),
            retrievedFor: ['res-a'],
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const keys = appended[0].lexicalAnalyses[0].generalSemanticRange.sources.map(s => s.sourceKey);
        expect(keys).toEqual(['Tuggy']);
        expect(keys).not.toContain('Kittel');
    });

    it('still admits citations against sources that did contribute text', async () => {
        const paper = makePaper([makeSource('Tuggy', 'res-a'), makeSource('Kittel', 'res-b')]);
        const { useCase, appended } = buildUseCase({
            paper,
            analysis: analysisCiting(['Tuggy', 'Kittel']),
            retrievedFor: ['res-a', 'res-b'],
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const keys = appended[0].lexicalAnalyses[0].generalSemanticRange.sources.map(s => s.sourceKey);
        expect(keys).toEqual(['Tuggy', 'Kittel']);
    });
});

describe('AnalyzeVerseCanonicallyUseCase — citations with no page', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('drops a citation with page 0 against a source that arrived page-anchored', async () => {
        const paper = makePaper([makeSource('Kittel', 'res-b')]);
        const analysis = analysisCiting(['Kittel']);
        // The model was handed "p. 149" and cited page 0 anyway.
        analysis.lexicalAnalyses[0].generalSemanticRange.sources = [
            { sourceKey: 'Kittel', page: 0, locator: '' },
        ];
        const { useCase, appended } = buildUseCase({ paper, analysis, retrievedFor: ['res-b'] });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        // "Kittel, p. 0" cannot be looked up, and reads as verified.
        expect(appended[0].lexicalAnalyses[0].generalSemanticRange.sources).toEqual([]);
    });

    it('keeps a page-0 citation when the source contributed no anchors', async () => {
        const paper = makePaper([makeSource('Kittel', 'res-b')]);
        const analysis = analysisCiting(['Kittel']);
        analysis.lexicalAnalyses[0].generalSemanticRange.sources = [
            { sourceKey: 'Kittel', page: 0, locator: '' },
        ];
        // No anchors: page 0 may legitimately mean "this work has no
        // pagination", which is what the schema reserves it for.
        const { useCase, appended } = buildUseCase({
            paper, analysis, retrievedFor: ['res-b'], anchored: false,
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(appended[0].lexicalAnalyses[0].generalSemanticRange.sources).toHaveLength(1);
    });
});

describe('AnalyzeVerseCanonicallyUseCase — la consulta al corpus', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('lleva el texto griego del versículo, no solo la referencia', async () => {
        const paper = makePaper([makeSource('Kittel', 'res-b')]);
        const greek = 'Πᾶσαν χαρὰν ἡγήσασθε, ἀδελφοί μου, ὅταν πειρασμοῖς περιπέσητε ποικίλοις';
        const { useCase, retriever } = buildUseCase({
            paper,
            analysis: analysisCiting(['Kittel']),
            retrievedFor: ['res-b'],
            greek,
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        // A lexicon indexes by word, not by Bible reference. Without the
        // Greek the query was the reference plus a generic brief, and
        // the retriever returned the previous verse's pages.
        const { query } = retriever.retrieve.mock.calls[0][0];
        expect(query).toContain('πειρασμοῖς');
        expect(query).toContain('χαρὰν');
    });
});

describe('AnalyzeVerseCanonicallyUseCase — citas a través de fragmentos', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('no descarta una cita que cruza el rótulo entre dos fragmentos', async () => {
        const paper = makePaper([makeSource('Adamson', 'res-a')]);
        const analysis = analysisCiting(['Adamson']);
        analysis.commentatorEngagement = [{
            sourceKey: 'Adamson',
            page: 57,
            role: 'anchor',
            position: 'No distingue interna de externa.',
            // Spans the boundary between two chunks of the same page.
            verbatimQuote: 'primera mitad de la oración segunda mitad de la oración',
        }];
        const { useCase, appended } = buildUseCase({
            paper,
            analysis,
            retrievedFor: ['res-a'],
            chunks: ['primera mitad de la oración', 'segunda mitad de la oración'],
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(appended[0].commentatorEngagement).toHaveLength(1);
    });
});

/**
 * El arreglo vacío no es la ausencia.
 *
 * El caso de arriba deja la fuente FUERA de `byResource`, y con esa forma
 * el guard funcionaba. El retriever real no hace eso: siembra
 * `byResource[resourceId] = []` para cada fuente con receta y después
 * reparte. Un arreglo vacío es verdadero en JavaScript, así que la fuente
 * entraba al prompt con el cuerpo vacío y la clave de cita a la vista
 * —exactamente el estante pelado que el guard existe para evitar—.
 *
 * Medido en Jonás 4:1: once fuentes de biblioteca sin receta, cero
 * comentaristas en el análisis y tres citas inventadas, una de ellas con
 * `page: 0` y locator «tentative page, not provided».
 */
describe('AnalyzeVerseCanonicallyUseCase — una fuente con receta y sin fragmentos', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('no entra al prompt cuando el corpus la devuelve con arreglo vacío', async () => {
        const paper = makePaper([makeSource('Tuggy', 'res-a'), makeSource('Kittel', 'res-b')]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting(['Tuggy']),
            retrievedFor: ['res-a'],
            emptyFor: ['res-b'],
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const sentSources = analyzer.analyzeVerse.mock.calls[0][0].sources;
        expect(sentSources.map((s: { citationKey: string }) => s.citationKey)).toEqual(['Tuggy']);
    });

    it('tampoco cae al documento entero: la curaduría manda', async () => {
        // Es el defecto que costó el análisis de Jonás 4:1. Las fuentes
        // estaban en `full-document`, así que al no traer fragmentos la rama
        // de respaldo inlineaba el LIBRO COMPLETO, recortado a
        // 220.000 / 11 ≈ 20.000 caracteres: las primeras siete páginas
        // impresas. El modelo vio el frente de once libros y citó desde ahí.
        const kittel = { ...makeSource('Kittel', 'res-b'), mode: 'full-document' as const };
        const paper = makePaper([makeSource('Tuggy', 'res-a'), kittel]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting(['Tuggy']),
            retrievedFor: ['res-a'],
            emptyFor: ['res-b'],
            fullText: 'PORTADA · ÍNDICE · PREFACIO — las primeras hojas del libro entero',
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const sentSources = analyzer.analyzeVerse.mock.calls[0][0].sources;
        expect(sentSources.map((s: { citationKey: string }) => s.citationKey)).toEqual(['Tuggy']);
        expect(JSON.stringify(sentSources)).not.toContain('PORTADA');
    });

    it('una fuente SIN receta sigue usando el documento entero', async () => {
        // La carga directa de un extracto acotado (Caso 3 de v1.5) no tiene
        // receta y nunca la tuvo: ahí el documento entero ES la curaduría.
        const suelta = {
            ...makeSource('Directa', 'res-c'),
            mode: 'full-document' as const,
            excerptRecipe: null,
        };
        const paper = makePaper([suelta]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting(['Directa']),
            retrievedFor: [],
            fullText: 'el extracto que el autor subió a mano',
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const sentSources = analyzer.analyzeVerse.mock.calls[0][0].sources;
        expect(sentSources.map((s: { citationKey: string }) => s.citationKey)).toEqual(['Directa']);
        expect(sentSources[0].textContent).toContain('subió a mano');
    });
});
