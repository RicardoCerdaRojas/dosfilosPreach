import { describe, it, expect, vi } from 'vitest';
import { buildDefaultStyleManifest, type AIProject, type CourseRecord } from '@dosfilos/domain';
import { AddRuleToStyleGuideUseCase, AddRuleToStyleGuideError } from '../AddRuleToStyleGuideUseCase';
import { ImportPreviousWorksUseCase } from '../ImportPreviousWorksUseCase';

/** Como Firestore sin `ignoreUndefinedProperties`: un undefined en cualquier nivel tumba la escritura. */
function rechazaUndefined(v: unknown, ruta = 'raíz'): void {
    if (v === undefined) throw new Error(`Firestore rechaza undefined en ${ruta}`);
    if (Array.isArray(v)) v.forEach((x, i) => rechazaUndefined(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object' && !(v instanceof Date)) for (const [k, x] of Object.entries(v)) rechazaUndefined(x, `${ruta}.${k}`);
}

/**
 * Un repositorio de proyectos que guarda en memoria: lo escrito se relee.
 * `updateCourseRecord` es la transacción del curso; `antesDeConfirmar` simula
 * otra pestaña que escribe entre la lectura y la escritura (se repite).
 */
function proyectos(inicial: Partial<AIProject>) {
    let guardado = { id: 'curso', userId: 'u1', ...inicial } as AIProject;
    let antesDeConfirmar: Partial<AIProject> | null = null;
    return {
        actual: () => guardado,
        cambiarPorFuera: (p: Partial<AIProject>) => { guardado = { ...guardado, ...p }; },
        cambiarDuranteLaTransaccion: (p: Partial<AIProject>) => { antesDeConfirmar = p; },
        getProject: vi.fn(async () => guardado),
        updateProject: vi.fn(async (_id: string, u: Record<string, unknown>) => {
            rechazaUndefined(u);
            guardado = { ...guardado, ...u } as AIProject;
            return guardado;
        }),
        updateCourseRecord: vi.fn(async (_id: string, mutate: (p: AIProject) => CourseRecord, alongside: Record<string, unknown> = {}) => {
            for (;;) {
                const r = mutate(guardado);
                if (antesDeConfirmar) { guardado = { ...guardado, ...antesDeConfirmar }; antesDeConfirmar = null; continue; }
                const u = { ...alongside, courseSchedule: r.schedule, feedbackPatterns: r.patterns };
                rechazaUndefined(u);
                guardado = { ...guardado, ...u } as AIProject;
                return guardado;
            }
        }),
    };
}

/** Un doble que falla con cualquier método que no se declaró: «no hace nada más». */
function soloCon<T extends object>(metodos: T): T {
    return new Proxy(metodos, {
        get(obj, k) {
            if (k in obj) return (obj as Record<string | symbol, unknown>)[k];
            if (k === 'then') return undefined;
            throw new Error(`método inesperado: ${String(k)}`);
        },
    });
}

const PATRON = { id: 'fp1', name: 'Cierre doble', decision: 'pending' as const };

describe('AddRuleToStyleGuideUseCase — «Pasar a tu guía»', () => {
    function montar(reglas: string[] | null, patrones = [PATRON]) {
        const manifest = reglas === null ? null : { ...buildDefaultStyleManifest(), additionalRules: reglas };
        const guia = { id: 'g1', ownerId: 'u1', displayName: 'TP Semanal', manifest };
        const guias = {
            getGuide: vi.fn(async () => guia),
            setManifest: vi.fn(async (_o: string, _g: string, m: unknown) => ({ ...guia, manifest: m })),
        };
        const projects = proyectos({ feedbackPatterns: patrones });
        const uc = new AddRuleToStyleGuideUseCase(guias as never, projects as never, () => new Date('2026-10-26T15:00:00Z'));
        return { uc, guias, projects };
    }
    const input = { ownerId: 'u1', projectId: 'curso', patternId: 'fp1', guideId: 'g1', ruleText: '  No cerrar dos veces la conclusión. ' };

    it('agrega la regla al manifiesto por el camino del editor y registra la decisión', async () => {
        const { uc, guias, projects } = montar(['Citar con «»']);
        const r = await uc.execute(input);
        expect(r.added).toBe(true);
        const m = guias.setManifest.mock.calls[0]![2] as { additionalRules: string[]; provenance: string };
        expect(m.additionalRules).toEqual(['Citar con «»', 'No cerrar dos veces la conclusión.']);
        expect(m.provenance).toBe('user-edited');
        expect(projects.actual().feedbackPatterns).toEqual([{
            id: 'fp1', name: 'Cierre doble', decision: 'guide', guideId: 'g1',
            ruleText: 'No cerrar dos veces la conclusión.', decidedAt: '2026-10-26T15:00:00.000Z',
        }]);
    });

    it('no duplica: la misma regla con otras mayúsculas, tildes o punto ya está', async () => {
        const { uc, guias, projects } = montar(['no cerrar dos veces la conclusion']);
        const r = await uc.execute(input);
        expect(r.added).toBe(false);
        expect(guias.setManifest).not.toHaveBeenCalled();
        expect(projects.actual().feedbackPatterns![0]!.decision).toBe('guide');
    });

    it('registra la decisión sobre el proyecto releído: no pisa patrones de otra pestaña', async () => {
        const { uc, projects } = montar([]);
        // Otra pestaña agregó un patrón después de que esta página cargó.
        projects.cambiarPorFuera({ feedbackPatterns: [PATRON, { id: 'fp2', name: 'FDA', decision: 'pending' }] });
        await uc.execute(input);
        expect(projects.actual().feedbackPatterns!.map(p => p.id)).toEqual(['fp1', 'fp2']);
    });

    it('la decisión va por la transacción del curso: otra pestaña que escribe en medio no se pierde', async () => {
        const { uc, projects } = montar([]);
        projects.cambiarDuranteLaTransaccion({ feedbackPatterns: [PATRON, { id: 'fp3', name: 'Gramática', decision: 'pending' }] });
        await uc.execute(input);
        expect(projects.updateCourseRecord).toHaveBeenCalledTimes(1);
        expect(projects.updateProject).not.toHaveBeenCalled();
        expect(projects.actual().feedbackPatterns!.map(p => [p.id, p.decision])).toEqual([['fp1', 'guide'], ['fp3', 'pending']]);
    });

    it('errores claros: guía sin manifiesto, regla vacía, patrón ajeno, guía llena', async () => {
        const sinManifiesto = montar(null);
        await expect(sinManifiesto.uc.execute(input)).rejects.toMatchObject({ code: 'guide-without-manifest' });
        expect(sinManifiesto.projects.updateProject).not.toHaveBeenCalled();
        expect(sinManifiesto.projects.updateCourseRecord).not.toHaveBeenCalled();
        await expect(montar([]).uc.execute({ ...input, ruleText: ' . ' })).rejects.toMatchObject({ code: 'empty-rule' });
        await expect(montar([], []).uc.execute(input)).rejects.toMatchObject({ code: 'pattern-not-found' });
        const llena = montar(Array.from({ length: 200 }, (_, i) => `Regla ${i}`));
        await expect(llena.uc.execute(input)).rejects.toBeInstanceOf(AddRuleToStyleGuideError);
        await expect(llena.uc.execute(input)).rejects.toMatchObject({ code: 'guide-full' });
    });
});

describe('ImportPreviousWorksUseCase — «Traer los trabajos anteriores»', () => {
    function montar(papers: Record<string, Record<string, unknown>>, proyecto: Partial<AIProject> = {}) {
        const setProjectLinks = vi.fn(async (_o: string, id: string, change: Record<string, unknown>) => ({ ...papers[id], ...change }));
        // Solo leer y vincular: nada de encargo, rúbrica, guía ni fuentes.
        const paperRepo = soloCon({
            getPaper: vi.fn(async (_o: string, id: string) => (papers[id] ? { id, ownerId: 'u1', linkedProjectIds: [], ...papers[id] } : null)),
            setProjectLinks,
        });
        const projects = proyectos({ workTypes: [{ id: 'wt_tp', label: 'TP Semanal', styleGuideId: 'g1' }], ...proyecto });
        let n = 0;
        const uc = new ImportPreviousWorksUseCase(paperRepo as never, projects as never, () => `cs${++n}`);
        return { uc, setProjectLinks, projects };
    }

    it('un estudio suelto pasa a ser del curso con su tipo, en UNA escritura, sin reaplicar el encargo', async () => {
        const { uc, setProjectLinks, projects } = montar({ tp3: { title: 'Stg 1:19-27', projectId: null, rubric: { x: 1 } } });
        const r = await uc.execute({
            ownerId: 'u1', projectId: 'curso',
            works: [{ paperId: 'tp3', workTypeId: 'wt_tp', label: 'TP #3', dueDate: '2026-08-29', deliveredAt: '2026-08-29T20:00:00Z', passage: undefined }],
        });
        expect(setProjectLinks).toHaveBeenCalledTimes(1);
        expect(setProjectLinks).toHaveBeenCalledWith('u1', 'tp3', { projectId: 'curso', workTypeId: 'wt_tp' });
        expect(r.results).toEqual([{ paperId: 'tp3', status: 'origin-set', entryId: 'cs1' }]);
        expect(projects.actual().courseSchedule).toEqual([{
            id: 'cs1', workTypeId: 'wt_tp', label: 'TP #3', dueDate: '2026-08-29',
            paperId: 'tp3', deliveredAt: '2026-08-29T20:00:00.000Z', imported: true,
        }]);
    });

    it('un estudio de OTRO proyecto de origen no se mueve: queda vinculado y lo avisa', async () => {
        const { uc, setProjectLinks } = montar({ tp4: { projectId: 'otro', projectWorkTypeId: 'wt_x' } });
        const r = await uc.execute({ ownerId: 'u1', projectId: 'curso', works: [{ paperId: 'tp4', workTypeId: 'wt_tp', label: 'TP #4' }] });
        expect(setProjectLinks).toHaveBeenCalledWith('u1', 'tp4', { link: 'curso' });
        expect(r.results[0]!.status).toBe('linked');
    });

    it('vinculado al curso y suelto: el origen sale de los vínculos en la misma escritura', async () => {
        const { uc, setProjectLinks } = montar({ tp5: { projectId: null, linkedProjectIds: ['curso'] } });
        await uc.execute({ ownerId: 'u1', projectId: 'curso', works: [{ paperId: 'tp5', workTypeId: 'wt_tp', label: 'TP #5' }] });
        expect(setProjectLinks).toHaveBeenCalledWith('u1', 'tp5', { projectId: 'curso', workTypeId: 'wt_tp', unlink: 'curso' });
    });

    it('ya del curso: solo pone el tipo si cambió; con entrada en el calendario no crea otra', async () => {
        const { uc, setProjectLinks, projects } = montar(
            { tp6: { projectId: 'curso', projectWorkTypeId: 'wt_tp' }, tp7: { projectId: 'curso' } },
            { courseSchedule: [{ id: 'e6', workTypeId: 'wt_tp', label: 'TP #6', paperId: 'tp6' }] },
        );
        const r = await uc.execute({
            ownerId: 'u1', projectId: 'curso',
            works: [{ paperId: 'tp6', workTypeId: 'wt_tp', label: 'TP #6' }, { paperId: 'tp7', workTypeId: 'wt_tp', label: '' }, { paperId: 'nada', workTypeId: 'wt_tp', label: 'X' }],
        });
        expect(setProjectLinks).toHaveBeenCalledTimes(1);
        expect(setProjectLinks).toHaveBeenCalledWith('u1', 'tp7', { workTypeId: 'wt_tp' });
        expect(r.results).toEqual([
            { paperId: 'tp6', status: 'already-origin', entryId: 'e6' },
            { paperId: 'tp7', status: 'already-origin', entryId: 'cs1' },
            { paperId: 'nada', status: 'not-found', entryId: null },
        ]);
        expect(projects.actual().courseSchedule!.map(e => e.id)).toEqual(['e6', 'cs1']);
    });

    it('un tipo que no existe en el curso rechaza todo antes de escribir', async () => {
        const { uc, setProjectLinks, projects } = montar({ tp3: {}, tp4: {} });
        await expect(uc.execute({
            ownerId: 'u1', projectId: 'curso',
            works: [{ paperId: 'tp3', workTypeId: 'wt_tp', label: 'TP #3' }, { paperId: 'tp4', workTypeId: 'wt_borrado', label: 'TP #4' }],
        })).rejects.toThrow(/no existe/);
        expect(setProjectLinks).not.toHaveBeenCalled();
        expect(projects.updateProject).not.toHaveBeenCalled();
        expect(projects.updateCourseRecord).not.toHaveBeenCalled();
    });

    it('un proyecto ajeno, archivado o en la papelera se rechaza', async () => {
        for (const p of [{ userId: 'otro' }, { archivedAt: new Date() }, { deletedAt: new Date() }]) {
            const { uc } = montar({ tp3: {} }, p as Partial<AIProject>);
            await expect(uc.execute({ ownerId: 'u1', projectId: 'curso', works: [{ paperId: 'tp3', workTypeId: 'wt_tp', label: 'TP #3' }] }))
                .rejects.toThrow(/no disponible/);
        }
    });
});
