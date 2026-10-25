import { describe, it, expect, vi } from 'vitest';
import { EMPTY_STEP_SOURCE_PLAN, type ExegeticalPaper, type PassageReference } from '@dosfilos/domain';
import { CreateExegeticalPaperUseCase } from '../CreateExegeticalPaperUseCase';

vi.mock('../../../services/ProcessingBalanceService', () => ({
    processingBalanceService: {
        consumeExegesis: vi.fn().mockResolvedValue(undefined),
        refundExegesis: vi.fn().mockResolvedValue(undefined),
    },
    InsufficientExegesisCreditsError: class extends Error { },
}));
vi.mock('../../../services/exegesisPricingTracker', () => ({ fireExegesisPricingEvent: vi.fn() }));

const { GenerateStepUseCase } = await import('../GenerateStepUseCase');

/**
 * El lugar de la perícopa en su serie viaja como campo del estudio, del
 * nacimiento al prompt del paso, sin pasar por el encargo
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, §2 paso 9).
 */
const PASAJE: PassageReference = { bookId: 'EZR', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 5 };
const lugar = { position: 2, total: 3, previous: { passage: 'Esdras 3:1-13', title: 'El altar' } };

function nacer() {
    const repo = {
        createPaper: vi.fn(async () => ({ id: 'p1' })),
        setRubric: vi.fn(async () => ({ id: 'p1' })),
    };
    const plantillas = { getRubric: vi.fn(), getDefaultRubric: vi.fn(async () => null) };
    return { uc: new CreateExegeticalPaperUseCase(repo as never, plantillas as never), repo };
}
const base = { ownerId: 'u', passage: PASAJE, displayLanguage: 'es' as const, styleGuideId: null };

describe('CreateExegeticalPaperUseCase — seriesPlacement', () => {
    it('un estudio de serie nace con su lugar, limpio', async () => {
        const { uc, repo } = nacer();
        await uc.execute({ ...base, seriesId: 's1', pericopeId: 'r2', seriesPlacement: { ...lugar, previous: { passage: ' Esdras 3:1-13 ', title: 'El altar' } } });
        expect((repo.createPaper.mock.calls[0] as unknown[])[0]).toMatchObject({ seriesPlacement: lugar });
    });

    it('sin serie, o con un lugar inválido, no escribe la clave (Firestore rechaza undefined)', async () => {
        const { uc, repo } = nacer();
        await uc.execute({ ...base, seriesPlacement: lugar });
        await uc.execute({ ...base, seriesId: 's1', pericopeId: 'r2', seriesPlacement: { position: 9, total: 3 } });
        await uc.execute({ ...base, seriesId: 's1', pericopeId: 'r2', seriesPlacement: null });
        for (const [draft] of repo.createPaper.mock.calls as unknown as Array<[Record<string, unknown>]>) {
            expect('seriesPlacement' in draft).toBe(false);
        }
    });
});

function paso(paper: Partial<ExegeticalPaper>) {
    const NOW = new Date('2026-01-01T00:00:00Z');
    const completo = {
        id: 'p1', ownerId: 'u', title: 'La oposición', createdAt: NOW, updatedAt: NOW,
        passage: PASAJE, displayLanguage: 'es', assignmentBrief: 'La oposición nace de un rechazo.',
        styleGuideId: null, sources: [], rubric: null, stepPlan: EMPTY_STEP_SOURCE_PLAN, phase: 'in-progress',
        steps: [{ id: 'st', paperId: 'p1', kind: 'verse', verseRef: PASAJE, order: 1, state: 'pending', current: null, accepted: null, versions: [], createdAt: NOW, updatedAt: NOW }],
        currentStepId: 'st', assembledMarkdown: null, archivedAt: null,
        ...paper,
    } as ExegeticalPaper;
    const orchestrator = { generateStep: vi.fn().mockResolvedValue({ markdown: 'prosa', tokensUsed: 1 }) };
    const uc = new GenerateStepUseCase(
        { getPaper: vi.fn().mockResolvedValue(completo), setStepState: vi.fn(), appendStepVersion: vi.fn().mockResolvedValue(completo) } as never,
        { getActiveStyleGuide: vi.fn().mockResolvedValue(null) } as never,
        { getTextContent: vi.fn().mockResolvedValue('') } as never,
        orchestrator as never,
    );
    return { uc, orchestrator };
}

describe('GenerateStepUseCase — seriesPlacement', () => {
    it('llega al orquestador aparte del encargo, que queda intacto', async () => {
        const { uc, orchestrator } = paso({ seriesPlacement: lugar });
        await uc.execute({ ownerId: 'u', paperId: 'p1', stepId: 'st' });
        const entrada = orchestrator.generateStep.mock.calls[0]![0];
        expect(entrada.seriesPlacement).toEqual(lugar);
        expect(entrada.assignmentBrief).not.toMatch(/Perícopa|El altar/);
    });

    it('un estudio suelto no manda la clave: la entrada es la de siempre', async () => {
        const { uc, orchestrator } = paso({});
        await uc.execute({ ownerId: 'u', paperId: 'p1', stepId: 'st' });
        expect('seriesPlacement' in orchestrator.generateStep.mock.calls[0]![0]).toBe(false);
    });
});
