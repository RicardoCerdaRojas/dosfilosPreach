import { describe, it, expect, vi } from 'vitest';
import type { AIProject } from '@dosfilos/domain';
import { UpdateProjectUseCase } from '../UpdateProjectUseCase';

/** Como Firestore sin `ignoreUndefinedProperties`: un undefined en cualquier nivel tumba la escritura. */
function rechazaUndefined(v: unknown, ruta = 'raíz'): void {
    if (v === undefined) throw new Error(`Firestore rechaza undefined en ${ruta}`);
    if (Array.isArray(v)) v.forEach((x, i) => rechazaUndefined(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) rechazaUndefined(x, `${ruta}.${k}`);
}

function repoCon(guardado: Partial<AIProject> | null) {
    return {
        getProject: vi.fn(async () => (guardado ? ({ id: 'p1', ...guardado } as AIProject) : null)),
        updateProject: vi.fn(async (_id: string, u: Record<string, unknown>) => { rechazaUndefined(u); return u; }),
    };
}
const escrito = (repo: ReturnType<typeof repoCon>) => repo.updateProject.mock.calls.at(-1)![1] as Record<string, any>;

const TIPOS = [{ id: 'wt_tp', label: 'TP Semanal' }];

describe('UpdateProjectUseCase — calendario del curso (courseOps)', () => {
    it('aplica las operaciones sobre el proyecto RELEÍDO, no sobre la caché de la página', async () => {
        // Otra pestaña ya guardó el TP #8 entregado; esta pestaña no lo sabe.
        const repo = repoCon({
            workTypes: TIPOS,
            courseSchedule: [{ id: 'e8', workTypeId: 'wt_tp', label: 'TP #8', deliveredAt: '2026-10-20T12:00:00.000Z' }],
        });
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            courseOps: [{ op: 'upsertEntry', entry: { id: 'e9', workTypeId: 'wt_tp', label: 'TP #9', dueDate: '2026-10-31', passage: undefined } }],
        });
        expect(repo.getProject).toHaveBeenCalledWith('p1');
        expect(escrito(repo).courseSchedule).toEqual([
            { id: 'e8', workTypeId: 'wt_tp', label: 'TP #8', deliveredAt: '2026-10-20T12:00:00.000Z' },
            { id: 'e9', workTypeId: 'wt_tp', label: 'TP #9', dueDate: '2026-10-31' },
        ]);
        expect(escrito(repo).feedbackPatterns).toEqual([]);
    });

    it('limpia a fondo: una devolución con undefined anidados llega sin ninguno', async () => {
        const repo = repoCon({ workTypes: TIPOS, courseSchedule: [{ id: 'e8', workTypeId: 'wt_tp', label: 'TP #8' }] });
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            courseOps: [{
                op: 'recordFeedback', entryId: 'e8',
                feedback: { text: 'Bien', grade: undefined, receivedAt: '2026-10-26T10:00:00Z', corrections: [{ patternName: 'Cierre doble', note: undefined, patternId: undefined }] },
            }],
        });
        const u = escrito(repo);
        expect(u.courseSchedule[0].feedback.corrections).toHaveLength(1);
        expect(u.feedbackPatterns).toEqual([{ id: expect.any(String), name: 'Cierre doble', decision: 'pending' }]);
    });

    it('un tipo que ya no está en el proyecto guardado deja la entrega sin tipo', async () => {
        const repo = repoCon({ workTypes: TIPOS });
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            courseOps: [{ op: 'upsertEntry', entry: { id: 'x', workTypeId: 'wt_borrado', label: 'Ensayo' } }],
        });
        expect(escrito(repo).courseSchedule).toEqual([{ id: 'x', workTypeId: '', label: 'Ensayo' }]);
    });

    it('sin proyecto, error: la página no puede creer que guardó', async () => {
        const repo = repoCon(null);
        await expect(new UpdateProjectUseCase(repo as never).execute('p1', { courseOps: [{ op: 'removeEntry', entryId: 'x' }] }))
            .rejects.toThrow(/no encontrado/);
        expect(repo.updateProject).not.toHaveBeenCalled();
    });

    it('el modo se escribe limpio y no obliga a leer; sin courseOps no toca las listas', async () => {
        const repo = repoCon({});
        await new UpdateProjectUseCase(repo as never).execute('p1', { courseScheduleMode: 'free' });
        expect(repo.getProject).not.toHaveBeenCalled();
        expect(escrito(repo)).toEqual({ courseScheduleMode: 'free' });
        await new UpdateProjectUseCase(repo as never).execute('p1', { courseScheduleMode: 'raro' as never });
        expect(escrito(repo)).toEqual({ courseScheduleMode: null });
        await new UpdateProjectUseCase(repo as never).execute('p1', { courseOps: [] });
        expect(escrito(repo)).not.toHaveProperty('courseSchedule');
    });
});
