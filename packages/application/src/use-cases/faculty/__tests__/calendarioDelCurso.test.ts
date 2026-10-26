import { describe, it, expect, vi } from 'vitest';
import type { AIProject, CourseRecord } from '@dosfilos/domain';
import { UpdateProjectUseCase } from '../UpdateProjectUseCase';

/** Como Firestore sin `ignoreUndefinedProperties`: un undefined en cualquier nivel tumba la escritura. */
function rechazaUndefined(v: unknown, ruta = 'raíz'): void {
    if (v === undefined) throw new Error(`Firestore rechaza undefined en ${ruta}`);
    if (Array.isArray(v)) v.forEach((x, i) => rechazaUndefined(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) rechazaUndefined(x, `${ruta}.${k}`);
}

type Mutar = (p: AIProject) => CourseRecord;

/**
 * Un repositorio con la transacción del curso como la de Firestore: lee,
 * aplica `mutate` y escribe; si `otraPestaña` está, escribe ANTES de que
 * esta transacción confirme y la obliga a repetirse sobre lo nuevo.
 */
function repoCon(inicial: Partial<AIProject> | null, otraPestaña?: (p: AIProject) => Partial<AIProject>) {
    let guardado = inicial ? ({ id: 'p1', ...inicial } as AIProject) : null;
    const repo = {
        escrituras: [] as Array<Record<string, any>>,
        getProject: vi.fn(async () => guardado),
        updateProject: vi.fn(async (_id: string, u: Record<string, unknown>) => {
            rechazaUndefined(u);
            repo.escrituras.push(u);
            return u;
        }),
        updateCourseRecord: vi.fn(async (_id: string, mutate: Mutar, alongside: Record<string, unknown> = {}) => {
            for (let intento = 0; ; intento++) {
                if (!guardado) throw new Error('updateCourseRecord: proyecto no encontrado');
                const leido = guardado;
                const r = mutate(leido);
                if (intento === 0 && otraPestaña) { guardado = { ...guardado, ...otraPestaña(guardado) }; continue; }
                const u = { ...alongside, courseSchedule: r.schedule, feedbackPatterns: r.patterns };
                rechazaUndefined(u);
                repo.escrituras.push(u);
                guardado = { ...leido, ...u } as AIProject;
                return guardado;
            }
        }),
    };
    return repo;
}
const escrito = (repo: ReturnType<typeof repoCon>) => repo.escrituras.at(-1)!;

const TIPOS = [{ id: 'wt_tp', label: 'TP Semanal' }];

describe('UpdateProjectUseCase — calendario del curso (courseOps)', () => {
    it('aplica las operaciones en la transacción, sobre el proyecto leído en ella, no sobre la caché de la página', async () => {
        // Otra pestaña ya guardó el TP #8 entregado; esta pestaña no lo sabe.
        const repo = repoCon({
            workTypes: TIPOS,
            courseSchedule: [{ id: 'e8', workTypeId: 'wt_tp', label: 'TP #8', deliveredAt: '2026-10-20T12:00:00.000Z' }],
        });
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            courseOps: [{ op: 'upsertEntry', entry: { id: 'e9', workTypeId: 'wt_tp', label: 'TP #9', dueDate: '2026-10-31', passage: undefined } }],
        });
        // La lectura es la de la transacción: ni getProject aparte ni updateProject.
        expect(repo.updateCourseRecord).toHaveBeenCalledTimes(1);
        expect(repo.getProject).not.toHaveBeenCalled();
        expect(repo.updateProject).not.toHaveBeenCalled();
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
        expect(repo.escrituras).toHaveLength(0);
    });

    it('dos pestañas a la vez: si la otra escribe entre la lectura y la escritura, se repite sobre lo nuevo', async () => {
        // Esta pestaña marca el TP #8 entregado; la otra registra la devolución del TP #7 en ese instante.
        const repo = repoCon(
            { workTypes: TIPOS, courseSchedule: [{ id: 'e7', workTypeId: 'wt_tp', label: 'TP #7' }, { id: 'e8', workTypeId: 'wt_tp', label: 'TP #8' }] },
            p => ({ courseSchedule: p.courseSchedule!.map(e => (e.id === 'e7' ? { ...e, feedback: { receivedAt: '2026-10-26T10:00:00.000Z', text: '', corrections: [], none: true } } : e)) }),
        );
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            courseOps: [{ op: 'markDelivered', entryId: 'e8' }],
        });
        expect(repo.escrituras).toHaveLength(1);
        const [e7, e8] = escrito(repo).courseSchedule;
        expect(e7.feedback.none).toBe(true);
        expect(typeof e8.deliveredAt).toBe('string');
    });

    it('el resto del cambio va en la misma transacción que las operaciones', async () => {
        const repo = repoCon({ workTypes: TIPOS });
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            courseScheduleMode: 'calendar',
            courseOps: [{ op: 'upsertEntry', entry: { id: 'e1', workTypeId: 'wt_tp', label: 'TP #1' } }],
        });
        expect(repo.updateProject).not.toHaveBeenCalled();
        expect(repo.updateCourseRecord.mock.calls[0]![2]).toEqual({ courseScheduleMode: 'calendar' });
        expect(escrito(repo)).toMatchObject({ courseScheduleMode: 'calendar', courseSchedule: [{ id: 'e1', workTypeId: 'wt_tp', label: 'TP #1' }] });
    });

    it('un reintento no mueve la fecha de «entregado»: la hora se fija una vez', async () => {
        const repo = repoCon({ workTypes: TIPOS, courseSchedule: [{ id: 'e8', workTypeId: 'wt_tp', label: 'TP #8' }] });
        await new UpdateProjectUseCase(repo as never).execute('p1', { courseOps: [{ op: 'markDelivered', entryId: 'e8' }] });
        const mutate = repo.updateCourseRecord.mock.calls[0]![1] as Mutar;
        const base = { id: 'p1', workTypes: TIPOS, courseSchedule: [{ id: 'e8', workTypeId: 'wt_tp', label: 'TP #8' }] } as AIProject;
        const primera = mutate(base).schedule[0]!.deliveredAt;
        await new Promise(r => setTimeout(r, 5));
        expect(mutate(base).schedule[0]!.deliveredAt).toBe(primera);
    });

    it('el modo se escribe limpio y no obliga a leer; sin courseOps no toca las listas', async () => {
        const repo = repoCon({});
        await new UpdateProjectUseCase(repo as never).execute('p1', { courseScheduleMode: 'free' });
        expect(repo.getProject).not.toHaveBeenCalled();
        expect(repo.updateCourseRecord).not.toHaveBeenCalled();
        expect(escrito(repo)).toEqual({ courseScheduleMode: 'free' });
        await new UpdateProjectUseCase(repo as never).execute('p1', { courseScheduleMode: 'raro' as never });
        expect(escrito(repo)).toEqual({ courseScheduleMode: null });
        await new UpdateProjectUseCase(repo as never).execute('p1', { courseOps: [] });
        expect(escrito(repo)).not.toHaveProperty('courseSchedule');
    });
});
