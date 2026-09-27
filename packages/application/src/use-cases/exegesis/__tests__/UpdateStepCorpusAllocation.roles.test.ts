import { describe, expect, it, vi } from 'vitest';
import { UpdateStepCorpusAllocationUseCase } from '../UpdateStepCorpusAllocationUseCase';
import type { ExegeticalPaper, IExegeticalPaperRepository, StepSourcePlan } from '@dosfilos/domain';

/**
 * Quitar una fuente de un paso borraba los roles de TODAS las demás. Lo
 * encontró el fundador editando Jonás 4:3: las tres insignias —ancla,
 * contraste, técnica— desaparecieron de golpe.
 *
 * Desde #698 el analizador LEE esos roles, así que perderlos en una edición
 * devuelve ese paso a reclasificar por su cuenta, y en silencio.
 */
const paper = (): ExegeticalPaper => ({
    id: 'p1',
    sources: [{ id: 'burt' }, { id: 'sasson' }, { id: 'bhq' }, { id: 'barrick' }],
    steps: [{ id: 's3', kind: 'verse' }],
    stepPlan: {
        perStep: {
            s3: {
                stepId: 's3', kind: 'verse',
                pinnedSources: ['burt', 'sasson', 'bhq'],
                pinnedSourceRoles: { burt: 'anchor', sasson: 'contrast', bhq: 'technical' },
                suppressedSources: ['ruido'],
                emphasis: { emphasizedTypes: ['commentary-expository'], deemphasizedTypes: [], citationOverrides: [] },
                note: 'la nota del plan',
            },
        },
        defaults: {},
    } as unknown as StepSourcePlan,
} as unknown as ExegeticalPaper);

const correr = async (pinnedSources: string[]) => {
    const setStepPlan = vi.fn(async (_o: string, _p: string, plan: StepSourcePlan) => plan as never);
    const repo = {
        getPaper: async () => paper(),
        setStepPlan,
    } as unknown as IExegeticalPaperRepository;
    await new UpdateStepCorpusAllocationUseCase(repo).execute({
        ownerId: 'o', paperId: 'p1', stepId: 's3', pinnedSources,
    });
    return (setStepPlan.mock.calls[0]![2] as StepSourcePlan).perStep.s3!;
};

describe('editar un paso no borra los roles de las fuentes que siguen', () => {
    it('cambiar una fuente conserva el rol de las otras dos', () => {
        // El caso exacto: se cambia BHQ por Barrick en Jonás 4:3.
        return correr(['burt', 'sasson', 'barrick']).then(e => {
            expect(e.pinnedSourceRoles?.burt).toBe('anchor');
            expect(e.pinnedSourceRoles?.sasson).toBe('contrast');
        });
    });

    it('la fuente que ENTRA queda sin rol, no hereda el de la que salió', async () => {
        // Heredarlo sería inventar una decisión que el plan no tomó.
        const e = await correr(['burt', 'sasson', 'barrick']);
        expect(e.pinnedSourceRoles?.barrick).toBeUndefined();
    });

    it('la que SALE no deja entrada huérfana', async () => {
        const e = await correr(['burt', 'sasson', 'barrick']);
        expect(e.pinnedSourceRoles?.bhq).toBeUndefined();
    });

    it('vaciar el paso no deja un mapa de roles vacío colgando', async () => {
        const e = await correr([]);
        expect(e.pinnedSourceRoles).toBeUndefined();
    });

    it('lo que ya se conservaba se sigue conservando', async () => {
        const e = await correr(['burt']);
        expect(e.note).toBe('la nota del plan');
        expect(e.suppressedSources).toEqual(['ruido']);
        expect(e.emphasis.emphasizedTypes).toEqual(['commentary-expository']);
    });
});
