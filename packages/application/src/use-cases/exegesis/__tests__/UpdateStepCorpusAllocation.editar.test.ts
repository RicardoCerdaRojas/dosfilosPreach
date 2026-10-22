import { describe, expect, it, vi } from 'vitest';
import { UpdateStepCorpusAllocationUseCase } from '../UpdateStepCorpusAllocationUseCase';
import { planNoteForPrompt, type ExegeticalPaper, type IExegeticalPaperRepository, type StepSourcePlan } from '@dosfilos/domain';

/**
 * TP #8 (Santiago 4:1-10, 2026-10-21, fase 8a, B3):
 * - #23: al agregar a Kittel con «Editar», el fundador no supo qué rol
 *   ponerle, y en el corpus ya decía «contraste»;
 * - #24: cambió las fuentes de un paso y la justificación del planificador
 *   quedó nombrando roles de una lista que ya no era la del paso, y así
 *   llegaba al análisis.
 */
const trabajo = (note: string | null = 'Ancla: Mayor. Técnica: Tuggy.', extra: Record<string, unknown> = {}) => ({
    id: 'p8',
    sources: [
        { id: 'mayor', sourceType: 'commentary-critical', chosenRole: 'anchor' },
        { id: 'tuggy', sourceType: 'lexicon-technical' },
        { id: 'kittel', sourceType: 'theological-dictionary', chosenRole: 'contrast' },
        { id: 'wallace', sourceType: 'grammar-syntax' },
    ],
    steps: [{ id: 'v1', kind: 'verse' }],
    stepPlan: {
        perStep: {
            v1: {
                stepId: 'v1', kind: 'verse', pinnedSources: ['mayor', 'tuggy'],
                pinnedSourceRoles: { mayor: 'anchor', tuggy: 'technical' },
                suppressedSources: [], emphasis: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] },
                note, ...extra,
            },
        },
        defaults: {},
    },
}) as unknown as ExegeticalPaper;

const correr = async (paper: ExegeticalPaper, input: Record<string, unknown>) => {
    const setStepPlan = vi.fn(async (_o: string, _p: string, plan: StepSourcePlan) => plan as never);
    const repo = { getPaper: async () => paper, setStepPlan } as unknown as IExegeticalPaperRepository;
    await new UpdateStepCorpusAllocationUseCase(repo).execute({ ownerId: 'o', paperId: 'p8', stepId: 'v1', ...input } as never);
    return (setStepPlan.mock.calls[0]![2] as StepSourcePlan).perStep.v1!;
};

describe('editar el plan de un paso (B3)', () => {
    it('#23: la fuente que entra trae el rol que eligió el estudiante en el corpus', async () => {
        const e = await correr(trabajo(), { pinnedSources: ['mayor', 'tuggy', 'kittel'] });
        expect(e.pinnedSourceRoles).toEqual({ mayor: 'anchor', tuggy: 'technical', kittel: 'contrast' });
    });

    it('#23: sin rol elegido, el de su tipo', async () => {
        const e = await correr(trabajo(), { pinnedSources: ['mayor', 'wallace'] });
        expect(e.pinnedSourceRoles?.wallace).toBe('technical');
    });

    it('#23: un mapa de roles explícito manda (es el selector de rol)', async () => {
        const e = await correr(trabajo(), { pinnedSources: ['mayor', 'kittel'], pinnedSourceRoles: { mayor: 'anchor' } });
        expect(e.pinnedSourceRoles).toEqual({ mayor: 'anchor' });
    });

    it('#24: cambiar la lista marca la nota del planificador como anterior a la edición', async () => {
        const e = await correr(trabajo(), { pinnedSources: ['mayor', 'kittel'] });
        expect(e.sourcesEditedAfterNote).toBe(true);
        expect(planNoteForPrompt(e, 'es')).toBe('(El estudiante cambió las fuentes de este paso después de esta nota; manda la lista de fuentes.) Ancla: Mayor. Técnica: Tuggy.');
    });

    it('#24: cambiar sólo un rol no cambia la lista y no marca nada', async () => {
        const e = await correr(trabajo(), { pinnedSources: ['mayor', 'tuggy'], pinnedSourceRoles: { mayor: 'contrast', tuggy: 'technical' } });
        expect(e.sourcesEditedAfterNote).toBeUndefined();
        expect(planNoteForPrompt(e, 'es')).toBe('Ancla: Mayor. Técnica: Tuggy.');
    });

    it('#24: sin nota no hay nada que marcar; con una nota nueva del estudiante, tampoco', async () => {
        expect((await correr(trabajo(null), { pinnedSources: ['mayor'] })).sourcesEditedAfterNote).toBeUndefined();
        expect((await correr(trabajo(), { pinnedSources: ['mayor'], note: 'Mía.' })).sourcesEditedAfterNote).toBeUndefined();
    });

    it('#24: quitar una fuente también cambia la lista', async () => {
        expect((await correr(trabajo(), { pinnedSources: ['mayor'] })).sourcesEditedAfterNote).toBe(true);
    });

    it('#24: escribir una nota propia borra la marca', async () => {
        const e = await correr(trabajo('x', { sourcesEditedAfterNote: true }), { pinnedSources: ['mayor'], note: 'Mía.' });
        expect(e.sourcesEditedAfterNote).toBeUndefined();
    });

    it('#23: una fuente que ya estaba en el paso sin rol no recibe uno por la edición', async () => {
        const sinRol = trabajo('x', { pinnedSourceRoles: { mayor: 'anchor' } });
        const e = await correr(sinRol, { pinnedSources: ['mayor', 'tuggy', 'kittel'] });
        expect(e.pinnedSourceRoles?.tuggy).toBeUndefined();
        expect(e.pinnedSourceRoles?.kittel).toBe('contrast');
    });

    it('#24: la marca se conserva en las ediciones siguientes', async () => {
        const e = await correr(trabajo('x', { sourcesEditedAfterNote: true }), { pinnedSources: ['mayor', 'tuggy'] });
        expect(e.sourcesEditedAfterNote).toBe(true);
    });
});
