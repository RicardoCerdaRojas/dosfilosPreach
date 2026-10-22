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

/**
 * TP #7 (#15): el plan dejó a Robertson sólo en 3:13 y no en 3:18, cuya
 * pregunta era sobre el participio τοῖς ποιοῦσιν.
 */
describe('la pregunta de sintaxis lleva su gramática', () => {
    const fuentes = [
        { id: 'na28', sourceType: 'critical-apparatus', displayLabel: 'NA28', citationKey: 'NA28' },
        { id: 'wallace', sourceType: 'grammar-syntax', displayLabel: 'Greek Grammar Beyond the Basics', citationKey: 'Wallace' },
        { id: 'robertson', sourceType: 'grammar-syntax', displayLabel: 'A Grammar of the Greek NT', citationKey: 'Robertson' },
    ];

    it('si el planificador la dejó fuera, se agrega con rol técnico, saltando la excluida', async () => {
        const { useCase, paperRepository } = build(
            { sources: fuentes, excludedSources: [{ key: 'Wallace' }] },
            { v6: { pinnedSources: ['na28'], rationale: 'aparato' }, v7: { pinnedSources: ['na28'], rationale: 'x' } },
        );
        await useCase.execute({ ownerId: 'o', paperId: 'p' });
        const plan = paperRepository.setStepPlan.mock.calls[0]![2];
        // v7: «¿qué uso del dativo…?» es de sintaxis.
        expect(plan.perStep.v7.pinnedSources).toEqual(['na28', 'robertson']);
        expect(plan.perStep.v7.pinnedSourceRoles).toEqual({ robertson: 'technical' });
        // v6: «¿cómo se puntúa?» es de crítica textual, no se toca.
        expect(plan.perStep.v6.pinnedSources).toEqual(['na28']);
    });

    it('si ya lleva una gramática, no se agrega otra', async () => {
        const { useCase, paperRepository } = build(
            { sources: fuentes },
            { v7: { pinnedSources: ['wallace'], rationale: 'x' } },
        );
        await useCase.execute({ ownerId: 'o', paperId: 'p' });
        expect(paperRepository.setStepPlan.mock.calls[0]![2].perStep.v7.pinnedSources).toEqual(['wallace']);
    });
});

/**
 * TP #8 (Santiago 4:1-10, 2026-10-21, fase 8a, B1–B2): el planificador nunca
 * veía una hoja y dejó a Tuggy en un solo paso y a Kittel en otro, aunque los
 * dos tenían material para tres preguntas.
 */
describe('el plan reparte con la evidencia del corpus', () => {
    const tp8 = {
        passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 },
        assignmentBrief: '1. ¿Qué significa el sustantivo μέλεσιν (Stg. 4:1)?\n2. ¿Qué denota φονεύετε (Stg. 4:2)?\n3. ¿Qué significa αἰτεῖτε (Stg. 4:3)?',
        sources: [
            { id: 'mayor', sourceType: 'commentary-critical', displayLabel: 'Mayor', citationKey: 'Mayor', chosenRole: 'anchor' },
            { id: 'tuggy', sourceType: 'lexicon-technical', displayLabel: 'Tuggy', citationKey: 'Tuggy' },
            { id: 'kittel', sourceType: 'theological-dictionary', displayLabel: 'Kittel', citationKey: 'Kittel', chosenRole: 'contrast' },
        ],
        steps: [1, 2, 3].map(v => ({
            id: `v${v}`, kind: 'verse', order: v,
            verseRef: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: v, verseEnd: v },
        })),
    };
    const evidencia = [
        { question: 1, sourceId: 'tuggy', via: 'lemma' as const, term: 'μέλεσιν', sheets: [584, 585], snippets: [] },
        { question: 1, sourceId: 'mayor', via: 'verse' as const, sheets: [407], snippets: ['IV 1] NOTES 1. πόθεν πόλεμοι'] },
        { question: 2, sourceId: 'tuggy', via: 'lemma' as const, term: 'φονεύετε', sheets: [938], snippets: [] },
        { question: 3, sourceId: 'kittel', via: 'lemma' as const, term: 'αἰτεῖτε', sheets: [32], snippets: [] },
        { question: 3, sourceId: 'tuggy', via: 'verse' as const, sheets: [37], snippets: ['x'.repeat(500)] },
        // Una fuente que ya no está en el corpus no cuenta.
        { question: 3, sourceId: 'ropes', via: 'verse' as const, sheets: [12], snippets: [] },
    ];

    it('el planificador ve la evidencia bajo cada paso, el rol del corpus y el modo preguntas', async () => {
        const { useCase, planner } = build(tp8, {});
        await useCase.execute({ ownerId: 'o', paperId: 'p', evidence: evidencia });
        const entrada = planner.propose.mock.calls[0]![0];
        expect(entrada.questionsMode).toBe(true);
        expect(entrada.sources.find((s: { id: string }) => s.id === 'kittel').chosenRole).toBe('contrast');
        const v1 = entrada.steps.find((s: { id: string }) => s.id === 'v1');
        expect(v1.evidence).toEqual([
            { sourceId: 'tuggy', sheets: [584, 585], via: 'lemma', term: 'μέλεσιν' },
            { sourceId: 'mayor', sheets: [407], via: 'verse', line: 'IV 1] NOTES 1. πόθεν πόλεμοι' },
        ]);
        const v3 = entrada.steps.find((s: { id: string }) => s.id === 'v3');
        expect(v3.evidence.map((e: { sourceId: string }) => e.sourceId)).toEqual(['kittel', 'tuggy']);
        expect(v3.evidence[1].line).toHaveLength(300);
    });

    it('B1: lo que tiene evidencia entra al paso aunque el modelo lo haya dejado fuera, con su rol del corpus', async () => {
        const { useCase, paperRepository } = build(tp8, {
            v1: { pinnedSources: ['mayor'], pinnedSourceRoles: { mayor: 'anchor' }, rationale: 'Ancla: Mayor.' },
            v2: { pinnedSources: ['mayor'], pinnedSourceRoles: { mayor: 'anchor' }, rationale: 'Ancla: Mayor.' },
            v3: { pinnedSources: ['mayor', 'tuggy'], pinnedSourceRoles: { mayor: 'anchor', tuggy: 'contrast' }, rationale: 'x' },
        });
        await useCase.execute({ ownerId: 'o', paperId: 'p', evidence: evidencia });
        const plan = paperRepository.setStepPlan.mock.calls[0]![2].perStep;
        expect(plan.v1.pinnedSources).toEqual(['mayor', 'tuggy']);
        // Tuggy sin rol elegido: el de su tipo.
        expect(plan.v1.pinnedSourceRoles).toEqual({ mayor: 'anchor', tuggy: 'technical' });
        expect(plan.v1.note).toBe('Ancla: Mayor. También entra por sus páginas sobre la pregunta del paso: Tuggy.');
        expect(plan.v2.pinnedSources).toEqual(['mayor', 'tuggy']);
        // Kittel con el rol que el estudiante le dio; el rol que el modelo eligió para Tuggy se respeta.
        expect(plan.v3.pinnedSources).toEqual(['mayor', 'tuggy', 'kittel']);
        expect(plan.v3.pinnedSourceRoles).toEqual({ mayor: 'anchor', tuggy: 'contrast', kittel: 'contrast' });
        expect(plan.v3.pinnedSources).not.toContain('ropes');
    });

    it('un paso sin asignación del modelo igual recibe la evidencia', async () => {
        const { useCase, paperRepository } = build(tp8, {});
        await useCase.execute({ ownerId: 'o', paperId: 'p', evidence: evidencia });
        const plan = paperRepository.setStepPlan.mock.calls[0]![2].perStep;
        expect(plan.v2.pinnedSources).toEqual(['tuggy']);
    });

    it('dos evidencias de la misma fuente en un paso se juntan, y el renglón tiene tope', async () => {
        const { useCase, planner } = build(tp8, {});
        await useCase.execute({
            ownerId: 'o', paperId: 'p', evidence: [
                { question: 3, sourceId: 'mayor', via: 'verse', sheets: [411], snippets: [] },
                { question: 3, sourceId: 'mayor', via: 'verse', sheets: [411, 413], snippets: ['y'.repeat(400)] },
            ],
        });
        const v3 = planner.propose.mock.calls[0]![0].steps.find((s: { id: string }) => s.id === 'v3');
        expect(v3.evidence).toEqual([{ sourceId: 'mayor', sheets: [411, 413], via: 'verse', line: 'y'.repeat(300) }]);
    });

    it('sin evidencia, el plan queda como lo dejó el modelo', async () => {
        const { useCase, paperRepository } = build(tp8, { v1: { pinnedSources: ['mayor'], rationale: 'x' } });
        await useCase.execute({ ownerId: 'o', paperId: 'p' });
        expect(paperRepository.setStepPlan.mock.calls[0]![2].perStep.v1.pinnedSources).toEqual(['mayor']);
    });
});
