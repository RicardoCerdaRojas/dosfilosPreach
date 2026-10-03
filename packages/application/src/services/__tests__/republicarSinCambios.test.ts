import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicationUnchangedError, SermonEntity } from '@dosfilos/domain';

/**
 * Re-publicar sin cambios no crea otra copia (#2 del ejercicio de Jonás): en la
 * serie, 1:4-16 y 3:1-10 quedaron con dos copias publicadas iguales.
 */
const repo = vi.hoisted(() => ({
    findById: vi.fn(),
    findByDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
}));
vi.mock('@dosfilos/infrastructure', () => ({
    FirebaseSermonRepository: class {
        findById = repo.findById;
        findByDraftId = repo.findByDraftId;
        create = repo.create;
        update = repo.update;
    },
    AnalyticsService: class {},
}));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), getFirestore: vi.fn(), setDoc: vi.fn() }));

import { SermonService } from '../SermonService';

const borrador = (content: string) =>
    SermonEntity.create({
        id: 'b1', userId: 'u1', title: 'La huida', content, status: 'working',
        wizardProgress: { currentStep: 3, passage: 'Jonás 1:4-16', lastSaved: new Date() },
    } as never);
const copia = (id: string, content: string) =>
    SermonEntity.create({ id, userId: 'u1', title: 'La huida', content, status: 'published', sourceSermonId: 'b1' } as never);

beforeEach(() => {
    Object.values(repo).forEach(f => f.mockReset());
    repo.create.mockImplementation(async (s: SermonEntity) => s);
    repo.update.mockImplementation(async (s: SermonEntity) => s);
});

describe('SermonService — re-publicar', () => {
    it('igual a la última copia: no crea otra y dice cuál es', async () => {
        repo.findById.mockResolvedValue(borrador('Jonás huye.'));
        repo.findByDraftId.mockResolvedValue([copia('c2', 'Jonás huye.'), copia('c1', 'viejo')]);
        const svc = new SermonService();
        const error = await svc.publishSermonAsCopy('b1').catch(e => e);
        expect(error).toBeInstanceOf(PublicationUnchangedError);
        expect(error.copyId).toBe('c2');
        expect(repo.create).not.toHaveBeenCalled();
        expect(await svc.publicationStatus('b1')).toEqual({ change: 'unchanged', version: 3, lastCopyId: 'c2' });
    });

    it('distinta: crea la versión nueva', async () => {
        repo.findById.mockResolvedValue(borrador('Jonás huye. Y Dios lo alcanza.'));
        repo.findByDraftId.mockResolvedValue([copia('c1', 'Jonás huye.')]);
        const svc = new SermonService();
        expect(await svc.publicationStatus('b1')).toEqual({ change: 'changed', version: 2, lastCopyId: 'c1' });
        await svc.publishSermonAsCopy('b1');
        expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('la primera publicación', async () => {
        repo.findById.mockResolvedValue(borrador('Jonás huye.'));
        repo.findByDraftId.mockResolvedValue([]);
        const svc = new SermonService();
        expect(await svc.publicationStatus('b1')).toEqual({ change: 'first', version: 1, lastCopyId: null });
        await svc.publishSermonAsCopy('b1');
        expect(repo.create).toHaveBeenCalledTimes(1);
    });
});

describe('SermonService — si no se puede comparar', () => {
    it('publica igual', async () => {
        repo.findById.mockResolvedValue(borrador('Jonás huye.'));
        repo.findByDraftId.mockRejectedValue(new Error('índice faltante'));
        await new SermonService().publishSermonAsCopy('b1');
        expect(repo.create).toHaveBeenCalledTimes(1);
    });
});
