import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, type PassageReference } from '@dosfilos/domain';

const reserva = { markLlmContacted: vi.fn(), refundIfPreLlm: vi.fn().mockResolvedValue(undefined) };
const open = vi.fn().mockResolvedValue(reserva);
vi.mock('../../../services/ExegesisCreditReservation', () => ({ ExegesisCreditReservation: { open: (...a: unknown[]) => open(...a) } }));
const { ProposeThesisUseCase, ReviewThesisUseCase } = await import('../ThesisAdvisorUseCases');

/** Etapa 3.3: proponer y revisar la tesis cobran, leen los análisis aceptados y la unidad anterior. */
const PSA = (vs: number, ve: number) => ({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: vs, verseEnd: ve }) as PassageReference;
const aceptado = (v: number) => ({ id: `v${v}`, kind: 'verse', order: v, verseRef: PSA(v, v), accepted: { canonicalAnalysis: buildEmptyCanonicalVerseAnalysis(PSA(v, v)) } });
const TI2 = { id: 'ti2', displayLanguage: 'es', passage: PSA(4, 6), projectId: 'ot603', assignmentBrief: 'Análisis sintáctico.', steps: [aceptado(4), aceptado(5)], sources: [], excludedSources: null };
const TI1 = { id: 'ti1', displayLanguage: 'es', passage: PSA(1, 3), projectId: 'ot603', archivedAt: null, steps: [], thesis: { text: 'Tesis del TI #1.', origin: 'student', approvedAt: new Date(), updatedAt: new Date() } };
const repo = (paper: object) => ({ getPaper: vi.fn(async () => paper), listPapers: vi.fn(async () => [TI1, paper]) });
beforeEach(() => { vi.clearAllMocks(); });

describe('ProposeThesisUseCase', () => {
    it('cobra «proposeThesis» y le pasa al modelo los análisis aceptados y la tesis de la unidad anterior', async () => {
        const advisor = { propose: vi.fn(async (_i: unknown) => ({ proposals: [{ thesis: 'T', support: [] }], modelId: 'm', tokensUsed: 1 })), review: vi.fn() };
        const r = await new ProposeThesisUseCase(repo(TI2) as never, advisor as never).execute({ ownerId: 'u', paperId: 'ti2' });
        expect(open).toHaveBeenCalledWith('u', 'proposeThesis');
        const datos = advisor.propose.mock.calls[0]![0] as { previousUnitThesis: string; briefings: string; passageLabel: string };
        expect(datos.previousUnitThesis).toBe('Tesis del TI #1.');
        expect(datos.passageLabel).toBe('Salmo 23:4-6');
        expect(datos.briefings.length).toBeGreaterThan(0);
        expect(r.proposals).toEqual([{ thesis: 'T', support: [] }]);
    });

    it('sin análisis aceptados no cobra ni llama', async () => {
        const advisor = { propose: vi.fn(), review: vi.fn() };
        await expect(new ProposeThesisUseCase(repo({ ...TI2, steps: [] }) as never, advisor as never).execute({ ownerId: 'u', paperId: 'ti2' })).rejects.toThrow(/aceptados/);
        expect(open).not.toHaveBeenCalled();
        expect(advisor.propose).not.toHaveBeenCalled();
    });

    it('si el modelo falla, devuelve lo reservado si no llegó a contactarlo', async () => {
        const advisor = { propose: vi.fn(async () => { throw new Error('red'); }), review: vi.fn() };
        await expect(new ProposeThesisUseCase(repo(TI2) as never, advisor as never).execute({ ownerId: 'u', paperId: 'ti2' })).rejects.toThrow('red');
        expect(reserva.refundIfPreLlm).toHaveBeenCalled();
    });
});

describe('ReviewThesisUseCase', () => {
    it('cobra «reviewThesis» y revisa la tesis dada (la del campo, aunque no esté guardada)', async () => {
        const advisor = { propose: vi.fn(), review: vi.fn(async (_i: unknown) => ({ criteria: [], suggestion: null, modelId: 'm', tokensUsed: 1 })) };
        await new ReviewThesisUseCase(repo(TI2) as never, advisor as never).execute({ ownerId: 'u', paperId: 'ti2', thesis: '  Mi tesis.  ' });
        expect(open).toHaveBeenCalledWith('u', 'reviewThesis');
        expect((advisor.review.mock.calls[0]![0] as { thesis: string }).thesis).toBe('Mi tesis.');
    });
    it('sin tesis que revisar, no cobra', async () => {
        const advisor = { propose: vi.fn(), review: vi.fn() };
        await expect(new ReviewThesisUseCase(repo(TI2) as never, advisor as never).execute({ ownerId: 'u', paperId: 'ti2', thesis: '  ' })).rejects.toThrow();
        expect(open).not.toHaveBeenCalled();
    });
});
