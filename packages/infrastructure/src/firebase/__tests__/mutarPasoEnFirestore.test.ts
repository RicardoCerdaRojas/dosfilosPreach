import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Lo que se escribe al intercambiar la prosa de una versión. */
let guardado: Record<string, unknown>;

vi.mock('../../config/firebase', () => ({ db: {}, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => vi.fn() }));
vi.mock('firebase/firestore', () => ({
    collection: () => ({}),
    doc: () => ({}),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async () => ({ exists: () => true, id: 'p', data: () => guardado }),
        update: (_ref: unknown, data: Record<string, unknown>) => { guardado = { ...guardado, ...data }; },
    }),
}));

const { FirestoreExegeticalPaperRepository, buildManualEditVersion } = await import('../FirestoreExegeticalPaperRepository');
const repo = new FirestoreExegeticalPaperRepository();

const version = (id: string, markdown: string) =>
    ({ id, markdown, origin: 'generated', parentVersionId: null, createdAt: new Date(2026, 9, 1) });

describe('los conteos que miden la prosa', () => {
    const conteos = { proseCitations: 3, proseCitationsWithIssues: 1, sourcesNamedWithoutCitation: 3, witnessClaimsWithoutCitation: 2, verified: 9 };

    beforeEach(() => {
        guardado = {
            ownerId: 'o',
            steps: [{
                id: 's', kind: 'verse', state: 'accepted', createdAt: new Date(), updatedAt: new Date(),
                versions: [{ ...version('v1', 'Nueva.'), verifications: conteos, previousProse: { markdown: 'Antes.' } }],
                currentId: 'v1',
                acceptedId: 'v1',
            }],
        };
    });

    it('no sobreviven al intercambio de prosa', async () => {
        await repo.swapStepVersionProse('o', 'p', 's', 'v1');
        const v = ((guardado.steps as Array<Record<string, unknown>>)[0]!.versions as Array<{ markdown: string; verifications: Record<string, unknown> }>)[0]!;
        expect(v.markdown).toBe('Antes.');
        expect(v.verifications.verified).toBe(9);
        for (const campo of ['proseCitations', 'proseCitationsWithIssues', 'sourcesNamedWithoutCitation', 'witnessClaimsWithoutCitation']) {
            expect(v.verifications).not.toHaveProperty(campo);
        }
    });

    it('una edición a mano tampoco los hereda', () => {
        const madre = { ...version('v1', 'x'), canonicalAnalysis: {}, verifications: conteos };
        expect(buildManualEditVersion(madre as never, 'y').verifications).toEqual({ verified: 9 });
    });
});

describe('devolver a revisión', () => {
    it('recuerda cuál estaba aceptada, y volver a ella la deja aceptada', async () => {
        guardado = {
            ownerId: 'o',
            steps: [{
                id: 's', kind: 'conclusion', state: 'accepted', createdAt: new Date(), updatedAt: new Date(),
                versions: [version('v1', 'Aceptada.'), version('v2', 'Otra.')],
                currentId: 'v1',
                acceptedId: 'v1',
            }],
        };
        await repo.reopenStep('o', 'p', 's');
        const paso = () => (guardado.steps as Array<Record<string, unknown>>)[0]!;
        expect(paso().acceptedId).toBeNull();
        expect(paso().lastAcceptedVersionId).toBe('v1');
        await repo.moveToStepVersion('o', 'p', 's', 'v2');
        expect(paso().state).toBe('awaiting-review');
        const r = await repo.moveToStepVersion('o', 'p', 's', 'v1');
        expect(paso().acceptedId).toBe('v1');
        expect(r.state).toBe('accepted');
    });

    it('reabrir dos veces no borra cuál estaba aceptada', async () => {
        guardado = {
            ownerId: 'o',
            steps: [{
                id: 's', kind: 'conclusion', state: 'accepted', createdAt: new Date(), updatedAt: new Date(),
                versions: [version('v1', 'Aceptada.')],
                currentId: 'v1',
                acceptedId: 'v1',
            }],
        };
        await repo.reopenStep('o', 'p', 's');
        await repo.reopenStep('o', 'p', 's');
        expect((guardado.steps as Array<Record<string, unknown>>)[0]!.lastAcceptedVersionId).toBe('v1');
    });
});
