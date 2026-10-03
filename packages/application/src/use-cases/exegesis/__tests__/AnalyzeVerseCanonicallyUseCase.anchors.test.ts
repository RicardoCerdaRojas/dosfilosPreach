import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, EMPTY_STEP_SOURCE_PLAN } from '@dosfilos/domain';
import type {
    CanonicalVerseAnalysis,
    ExegeticalPaper,
    ExegeticalStep,
    PageNumbering,
    ProjectSource,
    ProjectSourceExcerpt,
    PassageReference,
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

const { AnalyzeVerseCanonicallyUseCase } = await import('../AnalyzeVerseCanonicallyUseCase');

/**
 * La cadena ancla → estampado, punta a punta.
 *
 * Todos los casos de acá salieron de un trabajo real que se entregó con diez
 * de once citas apuntando a la hoja del PDF y diciendo «p.». El dominio tenía
 * tests; el CABLEADO no, y fue exactamente donde aparecieron los defectos —uno
 * por cada camino que se olvidó de resolver el ancla—.
 *
 * Lo que estos tests protegen es una sola frase: el modelo nunca debe recibir
 * un número de hoja rotulado como página impresa.
 */
const NOW = new Date('2026-01-01T00:00:00Z');
const VERSE: PassageReference = { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 9, verseEnd: 9 };

/** Adamson: la hoja 32 imprime la 28. Verificado contra el ejemplar. */
const ADAMSON: PageNumbering = {
    origin: 'confirmed',
    segments: [{ fromSheet: 1, toSheet: 240, offset: -4 }],
};
/** Mayor: 316 hojas de introducción en romanos, después −278. */
const MAYOR: PageNumbering = {
    origin: 'confirmed',
    segments: [
        { fromSheet: 1, toSheet: 316, offset: null },
        { fromSheet: 317, toSheet: 540, offset: -278 },
    ],
};

function makeSource(
    citationKey: string,
    resourceId: string,
    excerpts: ProjectSourceExcerpt[] = [],
): ProjectSource {
    return {
        id: `src-${citationKey}`,
        paperId: 'paper-1',
        corpusId: resourceId,
        sourceType: 'commentary' as SourceType,
        displayLabel: `${citationKey} — obra`,
        citationKey,
        order: 0,
        mode: 'extracted-excerpts',
        excerptSelectionMode: 'semantic',
        // Sin receta: es el caso de los papers reales, y el que obliga a
        // inlinear los extractos guardados en vez de consultar el corpus.
        excerpts,
        sourceLibraryResourceId: resourceId,
        extractedAt: NOW,
        extractionFingerprint: 'fp',
        createdAt: NOW,
    } as ProjectSource;
}

function excerpt(sourceLocation: string, extra: Partial<ProjectSourceExcerpt> = {}): ProjectSourceExcerpt {
    return {
        text: 'El hermano de condición humilde se gloría en su exaltación.',
        sourceLocation,
        relevanceScore: 0.9,
        userEdited: false,
        editedAt: null,
        ...extra,
    } as ProjectSourceExcerpt;
}

function makePaper(sources: ProjectSource[]): ExegeticalPaper {
    const step: ExegeticalStep = {
        id: 'step-1', paperId: 'paper-1', kind: 'verse', verseRef: VERSE, order: 1,
        state: 'pending', current: null, accepted: null, versions: [],
        createdAt: NOW, updatedAt: NOW,
    };
    return {
        id: 'paper-1', ownerId: 'owner-1', createdAt: NOW, updatedAt: NOW,
        passage: VERSE, displayLanguage: 'es', assignmentBrief: null, styleGuideId: null,
        sources, rubric: null, stepPlan: EMPTY_STEP_SOURCE_PLAN, phase: 'in-progress',
        steps: [step], currentStepId: 'step-1', assembledMarkdown: null, archivedAt: null,
    };
}

/** Un análisis que cita a cada clave con el número que el modelo copió del ancla. */
function analysisCiting(cites: Array<{ key: string; page: number }>): CanonicalVerseAnalysis {
    return {
        ...buildEmptyCanonicalVerseAnalysis(VERSE),
        commentatorEngagement: cites.map(c => ({
            sourceKey: c.key,
            page: c.page,
            role: 'anchor' as const,
            position: 'Interpreta la exaltación del humilde.',
            verbatimQuote: '',
        })),
    };
}

function buildUseCase(opts: {
    paper: ExegeticalPaper;
    analysis: CanonicalVerseAnalysis;
    numberings: Record<string, PageNumbering | null>;
}) {
    const appended: CanonicalVerseAnalysis[] = [];
    const paperRepository = {
        getPaper: vi.fn().mockResolvedValue(opts.paper),
        setStepState: vi.fn().mockResolvedValue(undefined),
        appendStepVersion: vi.fn(async (_o: unknown, _p: unknown, _s: unknown, v: { canonicalAnalysis: CanonicalVerseAnalysis }) => {
            appended.push(v.canonicalAnalysis);
            return opts.paper;
        }),
    };
    const analyzer = { analyzeVerse: vi.fn().mockResolvedValue({ analysis: opts.analysis, tokensUsed: 10 }) };
    const pageNumbering = {
        numberingFor: vi.fn(async (resourceId: string) => opts.numberings[resourceId] ?? null),
    };
    const useCase = new AnalyzeVerseCanonicallyUseCase(
        paperRepository as never,
        { getActiveStyleGuide: vi.fn().mockResolvedValue(null) } as never,
        { getTextContent: vi.fn().mockResolvedValue('') } as never,
        analyzer as never,
        undefined as never,
        undefined as never,
        pageNumbering as never,
    );
    return { useCase, analyzer, appended };
}

const anchorsSentFor = (analyzer: { analyzeVerse: { mock: { calls: unknown[][] } } }, key: string): string[] => {
    const sources = (analyzer.analyzeVerse.mock.calls[0]![0] as {
        sources: Array<{ citationKey: string; excerptAnchors?: string[] }>;
    }).sources;
    return sources.find(s => s.citationKey === key)?.excerptAnchors ?? [];
};

describe('AnalyzeVerseCanonicallyUseCase — el ancla que ve el modelo', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('rotula la pagina impresa, no la hoja del archivo', async () => {
        const paper = makePaper([makeSource('Adamson', 'res-adamson', [excerpt('p. 32')])]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting([{ key: 'Adamson', page: 28 }]),
            numberings: { 'res-adamson': ADAMSON },
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        // La hoja 32 imprime la 28. Decirle «p. 32» al modelo produce una cita
        // falsa, no un rotulo impreciso: el lector va a una pagina distinta.
        expect(anchorsSentFor(analyzer, 'Adamson')).toEqual(['p. 28']);
    });

    it('dice hoja cuando el recurso no declara numeracion', async () => {
        const paper = makePaper([makeSource('Wallace', 'res-wallace', [excerpt('p. 55')])]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting([{ key: 'Wallace', page: 55 }]),
            numberings: { 'res-wallace': null },
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(anchorsSentFor(analyzer, 'Wallace')).toEqual(['hoja 55']);
    });

    it('en un tramo sin numeracion arabiga ofrece la hoja, no el vacio', async () => {
        // Las primeras 316 hojas de Mayor no declaran folio. El ancla se
        // quedaba en «§ Intro» y el modelo tenia que escribir un numero de
        // pagina igual: mirese el `page: 0` de este mismo fixture, que era el
        // sintoma copiado del comportamiento real.
        //
        // Pasó tal cual en el estudio de Jonás 4: Farfán, con numeracion
        // confirmada y un solo tramo sin folio, volvio citado en «p. 0».
        const paper = makePaper([makeSource('Mayor', 'res-mayor', [excerpt('p. 100, § Intro')])]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting([{ key: 'Mayor', page: 0 }]),
            numberings: { 'res-mayor': MAYOR },
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(anchorsSentFor(analyzer, 'Mayor')).toEqual(['hoja 100, § Intro']);
    });

    it('prefiere la hoja guardada aparte sobre el rotulo ya formateado', async () => {
        const paper = makePaper([
            makeSource('Adamson', 'res-adamson', [excerpt('p. 999', { sheet: 32 } as never)]),
        ]);
        const { useCase, analyzer } = buildUseCase({
            paper,
            analysis: analysisCiting([{ key: 'Adamson', page: 28 }]),
            numberings: { 'res-adamson': ADAMSON },
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(anchorsSentFor(analyzer, 'Adamson')).toEqual(['p. 28']);
    });
});

describe('AnalyzeVerseCanonicallyUseCase — que clase de numero quedo guardado', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('marca impresa la cita a una fuente con numeracion, y hoja a la que no', async () => {
        const paper = makePaper([
            makeSource('Adamson', 'res-adamson', [excerpt('p. 32')]),
            makeSource('Wallace', 'res-wallace', [excerpt('p. 55')]),
        ]);
        const { useCase, appended } = buildUseCase({
            paper,
            analysis: analysisCiting([
                { key: 'Adamson', page: 28 },
                { key: 'Wallace', page: 55 },
            ]),
            numberings: { 'res-adamson': ADAMSON, 'res-wallace': null },
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const porClave = Object.fromEntries(
            appended[0]!.commentatorEngagement.map(c => [c.sourceKey, c.pageKind]),
        );
        // Se deduce de lo que el caso de uso le dio a leer al modelo, no se le
        // pregunta: el modelo copia el rotulo que recibe sin cuestionarlo, y
        // esa obediencia es lo que produjo el defecto.
        expect(porClave).toEqual({ Adamson: 'printed', Wallace: 'sheet' });
    });

    it('sin lector de numeracion no promete nada: todo queda como hoja', async () => {
        const paper = makePaper([makeSource('Adamson', 'res-adamson', [excerpt('p. 32')])]);
        const { useCase, appended } = buildUseCase({
            paper,
            analysis: analysisCiting([{ key: 'Adamson', page: 32 }]),
            numberings: {},
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(appended[0]!.commentatorEngagement[0]!.pageKind).toBe('sheet');
    });
});

describe('AnalyzeVerseCanonicallyUseCase — la cita por sección sobrevive al saneado', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    /** Wallace confirmado sin folios: se cita por sección («§ 2.3»), con página 0. */
    const SIN_FOLIOS: PageNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 711, offset: null }] };

    it('página 0 con sección no es «el modelo se calló la página»', async () => {
        // Revisión adversarial de E3: el saneado tiraba toda cita con página
        // 0 de una fuente con anclas, y «§ 2.3» cuenta como ancla. La cita por
        // sección nunca llegaba al análisis guardado.
        const paper = makePaper([makeSource('Wallace', 'res-wallace', [excerpt('§ 2.3', { sheet: 87 } as never)])]);
        const analysis = analysisCiting([{ key: 'Wallace', page: 0 }]);
        (analysis.commentatorEngagement[0] as { locator?: string }).locator = '2.3';
        const { useCase, appended } = buildUseCase({ paper, analysis, numberings: { 'res-wallace': SIN_FOLIOS } });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        const [cita] = appended[0]!.commentatorEngagement;
        expect(cita).toMatchObject({ sourceKey: 'Wallace', page: 0, pageKind: 'section', locator: '2.3' });
    });

    it('página 0 SIN sección de una fuente con anclas sigue saliendo', async () => {
        const paper = makePaper([makeSource('Wallace', 'res-wallace', [excerpt('§ 2.3', { sheet: 87 } as never)])]);
        const { useCase, appended } = buildUseCase({
            paper,
            analysis: analysisCiting([{ key: 'Wallace', page: 0 }]),
            numberings: { 'res-wallace': SIN_FOLIOS },
        });

        await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });

        expect(appended[0]!.commentatorEngagement).toEqual([]);
    });
});
