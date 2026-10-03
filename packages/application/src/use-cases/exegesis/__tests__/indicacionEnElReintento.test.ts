import { describe, it, expect, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, type PassageReference } from '@dosfilos/domain';

vi.mock('../../../services/ExegesisCreditReservation', () => ({
    ExegesisCreditReservation: {
        open: vi.fn().mockResolvedValue({ markLlmContacted: vi.fn(), refundIfPreLlm: vi.fn().mockResolvedValue(undefined) }),
    },
}));

const { ComposeConclusionFromAnalysesUseCase } = await import('../ComposeConclusionFromAnalysesUseCase');

/**
 * #25 del ejercicio de Jonás: «Regenerar con indicación» en la conclusión ahora
 * va por el compositor. Y su reintento correctivo (cuando se salta una fuente
 * asignada) REEMPLAZABA la indicación del pastor por la suya.
 */
const REF = { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 5 } as PassageReference;

function montar() {
    const version = { id: 'v', markdown: 'prosa', canonicalAnalysis: buildEmptyCanonicalVerseAnalysis(REF) };
    const paper = {
        id: 'p', ownerId: 'u', displayLanguage: 'es', passage: REF, assignmentBrief: null, styleGuideId: null, rubric: null,
        exegeticalStrategy: null,
        sources: [{ id: 's1', corpusId: 'c1', citationKey: 'Calvino', sourceType: 'commentary-critical', displayLabel: 'Calvino', excerpts: [], excerptRecipe: null, mode: 'full-document' }],
        steps: [
            { id: 'v1', kind: 'verse', order: 1, verseRef: REF, state: 'accepted', accepted: version, current: version },
            { id: 'c', kind: 'conclusion', order: 2, verseRef: null, state: 'pending', accepted: null, current: null },
        ],
        stepPlan: { perStep: { c: { pinnedSources: ['s1'] } }, defaults: {} },
    };
    const pedidos: Array<string | null> = [];
    const composer = {
        composeConclusion: vi.fn(async (input: { regenerationHint: string | null }) => {
            pedidos.push(input.regenerationHint);
            return { markdown: 'una conclusión sin la fuente', modelId: 'm', tokensUsed: 1 };
        }),
    };
    const repo = {
        getPaper: vi.fn(async () => paper),
        setStepState: vi.fn(async () => undefined),
        appendStepVersion: vi.fn(async () => ({ id: 'nueva' })),
    };
    const lector = { getTextContent: vi.fn(async () => 'texto de Calvino') };
    const uc = new ComposeConclusionFromAnalysesUseCase(repo as never, { getActiveStyleGuide: vi.fn(async () => null), getGuide: vi.fn(async () => null) } as never, lector as never, composer as never);
    return { uc, pedidos };
}

describe('el reintento correctivo suma su instrucción a la del pastor', () => {
    it('la indicación del pastor sigue en el reintento', async () => {
        const { uc, pedidos } = montar();
        await uc.execute({ ownerId: 'u', paperId: 'p', regenerationHint: 'Cierra con la pregunta abierta de 4:11.' });
        expect(pedidos).toHaveLength(2);
        expect(pedidos[0]).toBe('Cierra con la pregunta abierta de 4:11.');
        expect(pedidos[1]).toContain('Cierra con la pregunta abierta de 4:11.');
        expect(pedidos[1]).toContain('CRÍTICO');
    });

    it('sin indicación, el reintento lleva sólo la suya', async () => {
        const { uc, pedidos } = montar();
        await uc.execute({ ownerId: 'u', paperId: 'p', regenerationHint: null });
        expect(pedidos[1]!.startsWith('CRÍTICO')).toBe(true);
    });
});
