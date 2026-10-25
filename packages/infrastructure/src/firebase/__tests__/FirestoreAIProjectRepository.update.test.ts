import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El encuadre se escribe por campo, con rutas con punto, en UN solo
 * `updateDoc`: así el formulario no pisa el registro de la hipótesis ni la
 * revisión, y los libros del encuadre no pisan el resto de los criterios.
 * `null` borra con `deleteField()`; Firestore rechaza `undefined`.
 */
const BORRAR = { __borrar: true };
const escrituras: Array<Record<string, unknown>> = [];
let leido: Record<string, unknown> = { title: 'P' };

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: () => ({}),
    doc: () => ({}),
    deleteField: () => BORRAR,
    arrayUnion: (...xs: unknown[]) => ({ __union: xs }),
    updateDoc: async (_ref: unknown, data: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(data)) if (v === undefined) throw new Error(`undefined en ${k}`);
        escrituras.push(data);
    },
    getDoc: async () => ({ exists: () => true, id: 'p1', data: () => leido }),
    getDocs: async () => ({ docs: [{ id: 'p1', data: () => leido }] }),
    setDoc: async () => undefined,
    deleteDoc: async () => undefined,
    query: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
}));

const { FirestoreAIProjectRepository } = await import('../FirestoreAIProjectRepository');
const repo = new FirestoreAIProjectRepository();

beforeEach(() => { escrituras.length = 0; leido = { title: 'P' }; });

describe('FirestoreAIProjectRepository.updateProject — encuadre por campo', () => {
    it('escribe framing.<campo> por cada clave y null con deleteField(), en un solo updateDoc', async () => {
        await repo.updateProject('p1', { framingPatch: { centralIdea: 'Dios cumple', occasion: null, genre: 'law' } });
        expect(escrituras).toHaveLength(1);
        const d = escrituras[0]!;
        expect(d['framing.centralIdea']).toBe('Dios cumple');
        expect(d['framing.occasion']).toBe(BORRAR);
        expect(d['framing.genre']).toBe('law');
        expect(typeof d['framing.updatedAt']).toBe('string');
        expect(d).not.toHaveProperty('framing');
        // No toca el registro ni la revisión que no vinieron.
        expect(d).not.toHaveProperty(['framing.hypothesisLog']);
        expect(d).not.toHaveProperty(['framing.revision']);
    });

    it('los libros van por bibliographyCriteria.bibleBooks, en el mismo updateDoc que el encuadre', async () => {
        await repo.updateProject('p1', { bibleBooks: ['EZR', 'NEH'], framingPatch: { centralIdea: 'x' } });
        expect(escrituras).toHaveLength(1);
        expect(escrituras[0]!['bibliographyCriteria.bibleBooks']).toEqual(['EZR', 'NEH']);
        expect(escrituras[0]).not.toHaveProperty('bibliographyCriteria');
    });

    it('con los criterios enteros, los libros van adentro: Firestore rechaza el campo y su ruta juntos', async () => {
        await repo.updateProject('p1', { bibliographyCriteria: { inclusion: 'i' }, bibleBooks: ['EZR'] });
        expect(escrituras[0]!.bibliographyCriteria).toEqual({ inclusion: 'i', bibleBooks: ['EZR'] });
        expect(escrituras[0]).not.toHaveProperty(['bibliographyCriteria.bibleBooks']);
    });

    it('sin cambios de encuadre no escribe framing.updatedAt', async () => {
        await repo.updateProject('p1', { title: 'Otro', icon: undefined });
        expect(Object.keys(escrituras[0]!).sort()).toEqual(['title', 'updatedAt']);
    });
});

describe('FirestoreAIProjectRepository.updateProject — nota de contexto', () => {
    it("'' o null la borran con deleteField(); ausente no la toca", async () => {
        await repo.updateProject('p1', { contextNote: null });
        expect(escrituras[0]!.contextNote).toBe(BORRAR);
        await repo.updateProject('p1', { contextNote: '  ' });
        expect(escrituras[1]!.contextNote).toBe(BORRAR);
        await repo.updateProject('p1', { contextNote: ' Iglesia ' });
        expect(escrituras[2]!.contextNote).toBe('Iglesia');
        await repo.updateProject('p1', { title: 'T' });
        expect(escrituras[3]).not.toHaveProperty('contextNote');
    });
});

describe('FirestoreAIProjectRepository — registro con arrayUnion (C7)', () => {
    const entrada = { id: 'hl_1', at: '2026-10-25T10:00:00.000Z', source: 'study' as const, studyId: 's1', verdict: 'confirms' as const, note: 'n' };

    it('una anotación va con arrayUnion, sin leer ni reescribir el registro', async () => {
        await repo.updateProject('p1', { hypothesisAppend: entrada });
        const d = escrituras[0]!;
        expect(d['framing.hypothesisLog']).toEqual({ __union: [entrada] });
        expect(typeof d['framing.updatedAt']).toBe('string');
    });

    it('si el mismo cambio reescribe el registro, la anotación va al final de ese arreglo (una sola ruta)', async () => {
        const viejo = { ...entrada, id: 'hl_0' };
        await repo.updateProject('p1', { framingPatch: { hypothesisLog: [viejo] }, hypothesisAppend: entrada });
        expect(escrituras[0]!['framing.hypothesisLog']).toEqual([viejo, entrada]);
    });

    it('al leer, el registro se recorta a las 200 más recientes', async () => {
        const log = Array.from({ length: 205 }, (_, i) => ({ ...entrada, id: `e${i}` }));
        leido = { title: 'P', framing: { centralIdea: 'x', hypothesisLog: log } };
        const p = await repo.getProject('p1');
        expect(p!.framing!.hypothesisLog).toHaveLength(200);
        expect(p!.framing!.hypothesisLog![0]!.id).toBe('e5');
        expect(p!.framing!.centralIdea).toBe('x');
        const [lista] = await repo.getUserProjects('u');
        expect(lista!.framing!.hypothesisLog).toHaveLength(200);
        // Sin encuadre no inventa uno.
        leido = { title: 'P' };
        expect(await repo.getProject('p1')).not.toHaveProperty('framing');
    });
});
