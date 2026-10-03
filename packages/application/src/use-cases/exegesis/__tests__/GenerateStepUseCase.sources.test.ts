import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CURATED_CORPUS_BUDGET_CHARS, EMPTY_STEP_SOURCE_PLAN, WHOLE_DOCUMENT_RANGE } from '@dosfilos/domain';
import type {
    ExegeticalPaper,
    ExegeticalStep,
    PassageReference,
    ProjectSource,
    SourceType,
} from '@dosfilos/domain';

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

const { GenerateStepUseCase } = await import('../GenerateStepUseCase');

/**
 * El gemelo de `AnalyzeVerseCanonicallyUseCase.sources`.
 *
 * Los dos casos de uso arman el mismo bloque de fuentes con el mismo
 * respaldo, y el defecto vivía igual en los dos. Un arreglo probado en uno
 * solo deja la mitad del sistema con la conducta vieja.
 */
const NOW = new Date('2026-01-01T00:00:00Z');
const VERSE: PassageReference = { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 1 };

function makeSource(
    citationKey: string,
    resourceId: string,
    overrides: Partial<ProjectSource> = {},
): ProjectSource {
    return {
        id: `src-${citationKey}`,
        paperId: 'paper-1',
        corpusId: resourceId,
        sourceType: 'commentary-expository' as SourceType,
        displayLabel: `${citationKey} — obra`,
        citationKey,
        order: 0,
        mode: 'full-document',
        excerptSelectionMode: null,
        excerptRecipe: {
            sheetRanges: [{ start: 98, end: 102 }],
            proposedRanges: [],
            pinnedRanges: [],
            passageFingerprint: 'fp',
        },
        excerpts: [],
        sourceLibraryResourceId: resourceId,
        extractedAt: NOW,
        extractionFingerprint: 'fp',
        createdAt: NOW,
        ...overrides,
    } as ProjectSource;
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
        title: 'Enojado con la Gracia de Dios',
        createdAt: NOW,
        updatedAt: NOW,
        passage: VERSE,
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
    } as ExegeticalPaper;
}

function buildUseCase(opts: {
    paper: ExegeticalPaper;
    retrievedFor: string[];
    emptyFor?: string[];
    fullText?: string;
}) {
    const paperRepository = {
        getPaper: vi.fn().mockResolvedValue(opts.paper),
        setStepState: vi.fn().mockResolvedValue(undefined),
        appendStepVersion: vi.fn().mockResolvedValue(opts.paper),
    };
    const orchestrator = {
        generateStep: vi.fn().mockResolvedValue({ markdown: 'prosa', tokensUsed: 10 }),
    };
    const corpusRetriever = {
        retrieve: vi.fn().mockResolvedValue({
            byResource: {
                ...Object.fromEntries((opts.emptyFor ?? []).map(id => [id, []])),
                ...Object.fromEntries(opts.retrievedFor.map(id => [
                    id,
                    [{ text: 'texto real de la fuente', sheet: 100, section: null }],
                ])),
            },
        }),
    };
    const useCase = new GenerateStepUseCase(
        paperRepository as never,
        { getActiveStyleGuide: vi.fn().mockResolvedValue(null) } as never,
        { getTextContent: vi.fn().mockResolvedValue(opts.fullText ?? '') } as never,
        orchestrator as never,
        undefined,
        undefined,
        corpusRetriever as never,
    );
    return { useCase, orchestrator, retriever: corpusRetriever };
}

describe('GenerateStepUseCase — una fuente con receta y sin fragmentos', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('pide al corpus el mismo tope que el medidor muestra', async () => {
        // El medidor del corpus (`corpusFootprint`) promete que las hojas
        // elegidas aportan como mucho este tope por paso. Si el paso pidiera
        // otro número, el medidor volvería a mentir como en #730.
        const paper = makePaper([makeSource('McComiskey', 'res-a')]);
        const { useCase, retriever } = buildUseCase({ paper, retrievedFor: ['res-a'] });
        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });
        expect(CURATED_CORPUS_BUDGET_CHARS).toBeGreaterThan(0);
        expect(retriever.retrieve.mock.calls[0][0].budgetChars).toBe(CURATED_CORPUS_BUDGET_CHARS);
    });

    const ejecutar = () => ({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

    it('no entra al prompt cuando el corpus la devuelve con arreglo vacío', async () => {
        const paper = makePaper([makeSource('McComiskey', 'res-a'), makeSource('Sasson', 'res-b')]);
        const { useCase, orchestrator } = buildUseCase({
            paper,
            retrievedFor: ['res-a'],
            emptyFor: ['res-b'],
        });

        await useCase.execute(ejecutar());

        const enviadas = orchestrator.generateStep.mock.calls[0][0].sources;
        expect(enviadas.map((s: { citationKey: string }) => s.citationKey)).toEqual(['McComiskey']);
    });

    it('tampoco cae al documento entero: la curaduría manda', async () => {
        const paper = makePaper([makeSource('McComiskey', 'res-a'), makeSource('Sasson', 'res-b')]);
        const { useCase, orchestrator } = buildUseCase({
            paper,
            retrievedFor: ['res-a'],
            emptyFor: ['res-b'],
            fullText: 'PORTADA · ÍNDICE · PREFACIO — las primeras hojas del libro entero',
        });

        await useCase.execute(ejecutar());

        const enviadas = orchestrator.generateStep.mock.calls[0][0].sources;
        expect(JSON.stringify(enviadas)).not.toContain('PORTADA');
    });

    it('una fuente SIN receta sigue usando el documento entero', async () => {
        const suelta = makeSource('Directa', 'res-c', { excerptRecipe: null });
        const { useCase, orchestrator } = buildUseCase({
            paper: makePaper([suelta]),
            retrievedFor: [],
            fullText: 'el extracto que el autor subió a mano',
        });

        await useCase.execute(ejecutar());

        const enviadas = orchestrator.generateStep.mock.calls[0][0].sources;
        expect(enviadas.map((s: { citationKey: string }) => s.citationKey)).toEqual(['Directa']);
        expect(enviadas[0].textContent).toContain('subió a mano');
    });
});

/** Ver la prueba hermana del analizador: lo heredado sin páginas viajaba desde la portada. */
describe('GenerateStepUseCase — se busca por paso también sin páginas', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('un documento completo se consulta en el libro entero y viaja lo encontrado', async () => {
        const heredada = makeSource('Burt', 'res-burt', { sourceType: 'commentary-expository', mode: 'full-document', excerptRecipe: null });
        const { useCase, orchestrator, retriever } = buildUseCase({
            paper: makePaper([heredada]),
            retrievedFor: ['res-burt'],
            fullText: 'PORTADA · PRÓLOGO',
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(retriever.retrieve.mock.calls[0][0].sources[0].sheetRanges).toEqual([WHOLE_DOCUMENT_RANGE]);
        const enviada = orchestrator.generateStep.mock.calls[0][0].sources[0];
        expect(enviada.textContent).not.toContain('PORTADA');
    });
});
