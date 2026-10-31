import { describe, it, expect, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, type PassageReference } from '@dosfilos/domain';

vi.mock('../../../services/ExegesisCreditReservation', () => ({
    ExegesisCreditReservation: {
        open: vi.fn().mockResolvedValue({ markLlmContacted: vi.fn(), refundIfPreLlm: vi.fn().mockResolvedValue(undefined) }),
    },
}));
const { ComposeConclusionFromAnalysesUseCase } = await import('../ComposeConclusionFromAnalysesUseCase');
const { ComposeIntroductionFromAnalysesUseCase } = await import('../ComposeIntroductionFromAnalysesUseCase');

/** Etapa 3.2: el caso de uso le pasa al compositor la tesis APROBADA, no un borrador. */
const REF = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 4 } as PassageReference;
async function tesisQueRecibe(thesis: unknown) {
    const version = { id: 'v', markdown: 'prosa', canonicalAnalysis: buildEmptyCanonicalVerseAnalysis(REF) };
    const paper = {
        id: 'p', ownerId: 'u', displayLanguage: 'es', passage: REF, assignmentBrief: null, styleGuideId: null, rubric: null,
        exegeticalStrategy: null, sources: [], thesis,
        steps: [
            { id: 'v1', kind: 'verse', order: 1, verseRef: REF, state: 'accepted', accepted: version, current: version },
            { id: 'c', kind: 'conclusion', order: 2, verseRef: null, state: 'pending', accepted: null, current: null },
        ],
        stepPlan: { perStep: {}, defaults: {} },
    };
    let recibida: string | null | undefined;
    const composer = { composeConclusion: vi.fn(async (input: { approvedThesis?: string | null }) => { recibida = input.approvedThesis; return { markdown: 'conclusión', modelId: 'm', tokensUsed: 1 }; }) };
    const repo = { getPaper: vi.fn(async () => paper), setStepState: vi.fn(async () => undefined), appendStepVersion: vi.fn(async () => ({ id: 'n' })) };
    const uc = new ComposeConclusionFromAnalysesUseCase(repo as never, { getActiveStyleGuide: vi.fn(async () => null), getGuide: vi.fn(async () => null) } as never, { getTextContent: vi.fn(async () => '') } as never, composer as never);
    await uc.execute({ ownerId: 'u', paperId: 'p', regenerationHint: null });
    return recibida;
}

describe('la tesis llega al compositor de la conclusión', () => {
    it('aprobada: llega su texto', async () => {
        expect(await tesisQueRecibe({ text: 'La tesis.', origin: 'student', approvedAt: new Date(), updatedAt: new Date() })).toBe('La tesis.');
    });
    it('borrador o sin tesis: no llega', async () => {
        expect(await tesisQueRecibe({ text: 'Borrador.', origin: 'student', approvedAt: null, updatedAt: new Date() })).toBeNull();
        expect(await tesisQueRecibe(undefined)).toBeNull();
    });
});

describe('la tesis llega al compositor de la introducción', () => {
    it('aprobada: llega su texto', async () => {
        const version = { id: 'v', markdown: 'prosa', canonicalAnalysis: buildEmptyCanonicalVerseAnalysis(REF) };
        const paper = {
            id: 'p', ownerId: 'u', displayLanguage: 'es', passage: REF, assignmentBrief: null, styleGuideId: null, rubric: null,
            exegeticalStrategy: null, sources: [],
            thesis: { text: 'La tesis.', origin: 'student', approvedAt: new Date(), updatedAt: new Date() },
            steps: [
                { id: 'v1', kind: 'verse', order: 1, verseRef: REF, state: 'accepted', accepted: version, current: version },
                { id: 'c', kind: 'conclusion', order: 2, verseRef: null, state: 'accepted', accepted: { id: 'cv', markdown: '## Conclusión\n\nTexto.' }, current: null },
                { id: 'i', kind: 'introduction', order: 3, verseRef: null, state: 'pending', accepted: null, current: null },
            ],
            stepPlan: { perStep: {}, defaults: {} },
        };
        let recibida: string | null | undefined;
        const composer = { composeIntroduction: vi.fn(async (input: { approvedThesis?: string | null }) => { recibida = input.approvedThesis; return { markdown: 'introducción', modelId: 'm', tokensUsed: 1 }; }) };
        const repo = { getPaper: vi.fn(async () => paper), setStepState: vi.fn(async () => undefined), appendStepVersion: vi.fn(async () => ({ id: 'n' })) };
        const uc = new ComposeIntroductionFromAnalysesUseCase(repo as never, { getActiveStyleGuide: vi.fn(async () => null), getGuide: vi.fn(async () => null) } as never, { getTextContent: vi.fn(async () => '') } as never, composer as never);
        await uc.execute({ ownerId: 'u', paperId: 'p', regenerationHint: null });
        expect(recibida).toBe('La tesis.');
    });
});
