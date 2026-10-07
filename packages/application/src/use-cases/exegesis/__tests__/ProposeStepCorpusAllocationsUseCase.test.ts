import { describe, it, expect, vi } from 'vitest';
import { ProposeStepCorpusAllocationsUseCase } from '../ProposeStepCorpusAllocationsUseCase';

/**
 * TP #6 (Santiago 3:1-12): el encuadre dejaba 3:2, 3:6 y 3:7, y el plan de
 * uso repartió fuentes en los doce versículos más la introducción y la
 * conclusión; además, regenerar podía dejar «sin rol» lo ya clasificado.
 */
const verso = (id: string, verse: number, includeInDocument?: boolean) => ({
    id, kind: 'verse', order: verse,
    verseRef: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: verse, verseEnd: verse },
    ...(includeInDocument === undefined ? {} : { includeInDocument }),
});

function build(extra: Record<string, unknown> = {}, allocations: Record<string, unknown> = {}) {
    const paper = {
        id: 'p', displayLanguage: 'es', phase: 'configuring', excludedSources: null,
        passage: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 1, verseEnd: 12 },
        assignmentBrief: '1. En 3:6, ¿cómo se puntúa la frase?\n2. En 3:7, ¿qué uso del dativo es τῇ φύσει?',
        sources: [{ id: 'na28', sourceType: 'critical-apparatus', displayLabel: 'NA28', citationKey: 'NA28' }],
        steps: [
            verso('v5', 5, false),
            verso('v6', 6, true),
            verso('v7', 7, true),
            { id: 'intro', kind: 'introduction', order: 0, verseRef: null, includeInDocument: false },
            { id: 'asm', kind: 'assembly', order: 99, verseRef: null },
        ],
        stepPlan: { perStep: {}, defaults: {}, updatedAt: new Date() },
        ...extra,
    };
    const planner = { propose: vi.fn().mockResolvedValue({ allocations }) };
    const paperRepository = {
        getPaper: vi.fn().mockResolvedValue(paper),
        setStepPlan: vi.fn().mockImplementation(async (_o: string, _p: string, plan: unknown) => ({ ...paper, stepPlan: plan })),
    };
    return { useCase: new ProposeStepCorpusAllocationsUseCase(paperRepository as never, planner as never), planner, paperRepository };
}

describe('el plan de uso respeta el encuadre', () => {
    it('REGRESIÓN: sólo planifica los pasos que van al documento, con sus preguntas', async () => {
        const { useCase, planner } = build();
        await useCase.execute({ ownerId: 'o', paperId: 'p' });
        const steps = planner.propose.mock.calls[0]![0].steps as Array<{ id: string; questions?: string[] }>;
        expect(steps.map(s => s.id)).toEqual(['v6', 'v7']);
        expect(steps[0]!.questions?.[0]).toMatch(/puntúa/);
        expect(steps[1]!.questions?.[0]).toMatch(/dativo/);
    });

    it('REGRESIÓN: regenerar no le quita el rol a una fuente que el planificador devuelve sin rol', async () => {
        const { useCase, paperRepository } = build(
            { stepPlan: { perStep: { v6: { stepId: 'v6', kind: 'verse', pinnedSources: ['na28'], pinnedSourceRoles: { na28: 'technical' }, suppressedSources: [], note: null } }, defaults: {}, updatedAt: new Date() } },
            { v6: { pinnedSources: ['na28'], rationale: 'aparato' } },
        );
        await useCase.execute({ ownerId: 'o', paperId: 'p' });
        const plan = paperRepository.setStepPlan.mock.calls[0]![2];
        expect(plan.perStep.v6.pinnedSourceRoles).toEqual({ na28: 'technical' });
    });

    it('el rol que el planificador propone gana sobre el anterior', async () => {
        const { useCase, paperRepository } = build(
            { stepPlan: { perStep: { v6: { stepId: 'v6', kind: 'verse', pinnedSources: ['na28'], pinnedSourceRoles: { na28: 'technical' }, suppressedSources: [], note: null } }, defaults: {}, updatedAt: new Date() } },
            { v6: { pinnedSources: ['na28'], pinnedSourceRoles: { na28: 'anchor' }, rationale: 'x' } },
        );
        await useCase.execute({ ownerId: 'o', paperId: 'p' });
        expect(paperRepository.setStepPlan.mock.calls[0]![2].perStep.v6.pinnedSourceRoles).toEqual({ na28: 'anchor' });
    });
});
