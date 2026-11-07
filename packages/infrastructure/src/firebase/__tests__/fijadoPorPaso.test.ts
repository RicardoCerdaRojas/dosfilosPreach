import { describe, expect, it, vi } from 'vitest';

/** PR 2, unidad 4: fijar hojas para un paso, en una transacción, sin `undefined` que Firestore rechace. */
let guardado: Record<string, unknown>;
const escrito = vi.fn();
vi.mock('../../config/firebase', () => ({ db: {}, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => vi.fn() }));
vi.mock('firebase/firestore', () => ({
    collection: () => ({}),
    doc: () => ({}),
    getDoc: async () => ({ exists: () => true, id: 'p', data: () => guardado }),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async () => ({ exists: () => true, id: 'p', data: () => guardado }),
        update: (_ref: unknown, data: Record<string, unknown>) => { escrito(data); guardado = { ...guardado, ...data }; },
    }),
}));
const { FirestoreExegeticalPaperRepository } = await import('../FirestoreExegeticalPaperRepository');
const repo = new FirestoreExegeticalPaperRepository();

const sinIndefinidos = (v: unknown): boolean => v === undefined ? false
    : Array.isArray(v) ? v.every(sinIndefinidos)
        : v && typeof v === 'object' && !(v instanceof Date) ? Object.values(v).every(sinIndefinidos) : true;

const base = () => ({
    ownerId: 'o',
    sources: [{ id: 'kittel' }, { id: 'wallace' }],
    steps: [{ id: 'v6', kind: 'verse' }],
    stepPlan: { perStep: {}, defaults: { verse: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] } }, updatedAt: new Date() },
});

describe('changeStepPinnedSheets', () => {
    it('crea la entrada del paso si no existe, y no escribe ningún `undefined`', async () => {
        guardado = base();
        const e = await repo.changeStepPinnedSheets('o', 'p', 'v6', 'kittel', { pin: true, sheets: [139, 137, 138] });
        expect(e.pinnedSheets).toEqual({ kittel: [{ start: 137, end: 139 }] });
        expect(e).toMatchObject({ stepId: 'v6', kind: 'verse', pinnedSources: [], suppressedSources: [] });
        expect(sinIndefinidos(escrito.mock.calls.at(-1)![0])).toBe(true);
    });

    it('suma una fuente sin tocar la otra ni el resto de la entrada', async () => {
        guardado = base();
        (guardado.stepPlan as { perStep: object }).perStep = { v6: { stepId: 'v6', kind: 'verse', pinnedSources: ['kittel'], suppressedSources: [], note: 'n', studentReading: 'mía', pinnedSheets: { kittel: [{ start: 137, end: 139 }] } } };
        const e = await repo.changeStepPinnedSheets('o', 'p', 'v6', 'wallace', { pin: true, sheets: [615, 616] });
        expect(e).toMatchObject({ note: 'n', studentReading: 'mía', pinnedSheets: { kittel: [{ start: 137, end: 139 }], wallace: [{ start: 615, end: 616 }] } });
    });

    it('REGRESIÓN (revisión del PR 2): el cambio se aplica sobre lo guardado, no sobre una copia vieja', async () => {
        guardado = base();
        await repo.changeStepPinnedSheets('o', 'p', 'v6', 'kittel', { pin: true, sheets: [137] });
        // Otra pestaña, que no vio lo anterior, fija otra hoja de la misma fuente.
        const e = await repo.changeStepPinnedSheets('o', 'p', 'v6', 'kittel', { pin: true, sheets: [143] });
        expect(e.pinnedSheets).toEqual({ kittel: [{ start: 137, end: 137 }, { start: 143, end: 143 }] });
    });

    it('REGRESIÓN (revisión del PR 2): escribir el plan entero conserva lo fijado guardado', async () => {
        guardado = base();
        await repo.changeStepPinnedSheets('o', 'p', 'v6', 'kittel', { pin: true, sheets: [137] });
        // El plan que propuso el planificador se leyó ANTES de fijar: no trae la hoja.
        const viejo = { perStep: { v6: { stepId: 'v6', kind: 'verse', pinnedSources: ['kittel'], suppressedSources: [], note: 'nuevo', emphasis: {} } }, defaults: {}, updatedAt: new Date() };
        await repo.setStepPlan('o', 'p', viejo as never);
        const plan = guardado.stepPlan as { perStep: Record<string, { note: string; pinnedSheets?: unknown }> };
        expect(plan.perStep.v6!.note).toBe('nuevo');
        expect(plan.perStep.v6!.pinnedSheets).toEqual({ kittel: [{ start: 137, end: 137 }] });
    });

    it('una lista vacía quita la fuente, y sin fuentes quita el campo', async () => {
        guardado = base();
        await repo.changeStepPinnedSheets('o', 'p', 'v6', 'kittel', { pin: true, sheets: [1] });
        const e = await repo.changeStepPinnedSheets('o', 'p', 'v6', 'kittel', { pin: false, sheets: [1] });
        expect(e.pinnedSheets).toBeUndefined();
    });

    it('rechaza un paso, una fuente o un dueño que no son del trabajo', async () => {
        guardado = base();
        await expect(repo.changeStepPinnedSheets('o', 'p', 'otro', 'kittel', { pin: true, sheets: [1] })).rejects.toThrow(/Step/);
        await expect(repo.changeStepPinnedSheets('o', 'p', 'v6', 'nadie', { pin: true, sheets: [1] })).rejects.toThrow(/Source/);
        await expect(repo.changeStepPinnedSheets('x', 'p', 'v6', 'kittel', { pin: true, sheets: [1] })).rejects.toThrow(/owned/);
    });
});
