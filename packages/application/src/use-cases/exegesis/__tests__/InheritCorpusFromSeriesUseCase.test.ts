import { describe, expect, it, vi } from 'vitest';
import { InheritCorpusFromSeriesUseCase } from '../InheritCorpusFromSeriesUseCase';

/**
 * Lo que decide QUÉ heredar está probado aparte, en el dominio. Acá se prueba
 * el cableado: que se busque a los hermanos, que se escriba una fuente por
 * recurso, y que lo que llega escrito no arrastre nada del pasaje anterior.
 */

function fuente(over: Record<string, unknown> = {}) {
    return {
        id: 's1',
        corpusId: 'corpus-viejo',
        sourceType: 'commentary-critical',
        chosenRole: 'anchor',
        displayLabel: 'Sasson, Jonah',
        citationKey: 'Sasson1990',
        order: 0,
        mode: 'extracted-excerpts',
        excerpts: [{ text: 'sobre Jonás 2', sourceLocation: 'p. 155' }],
        excerptSelectionMode: 'structural',
        excerptRecipe: { sheets: [155] },
        sourceLibraryResourceId: 'lib-sasson',
        extractedAt: new Date('2026-09-01'),
        extractionFingerprint: 'huella-de-jonas-2',
        createdAt: new Date('2026-09-01'),
        ...over,
    };
}

/** La biblioteca del usuario: por defecto tiene los dos libros de la serie. */
function makeBiblioteca(ids = ['lib-sasson', 'lib-stuart']) {
    return { findByUserId: vi.fn().mockResolvedValue(ids.map(id => ({ id }))) };
}

function makeRepo(actual: unknown, todos: unknown[]) {
    let creadas = 0;
    return {
        // El trabajo actual, o el hermano cuando se lo pide por id.
        getPaper: vi.fn().mockImplementation(async (_o: string, id: string) =>
            (todos as Array<{ id: string }>).find(t => t.id === id && t !== actual && id !== (actual as { id: string }).id) ?? actual),
        listPaperSummaries: vi.fn().mockResolvedValue(todos),
        addSource: vi.fn().mockImplementation(async (_o, _p, s) => ({ ...s, id: `nueva-${creadas++}` })),
    };
}

const JONAS_3 = { id: 'p3', seriesId: 'serie-jonas', sources: [] as unknown[] };
const JONAS_2 = {
    id: 'p2',
    seriesId: 'serie-jonas',
    sources: [fuente(), fuente({ id: 's2', sourceLibraryResourceId: 'lib-stuart', displayLabel: 'Stuart, Hosea–Jonah', chosenRole: null, citationKey: null })],
};

describe('InheritCorpusFromSeriesUseCase', () => {
    it('propone el corpus del hermano de serie', async () => {
        const repo = makeRepo(JONAS_3, [JONAS_3, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        const p = await uc.proponer('owner-1', 'p3');

        expect(p?.origenId).toBe('p2');
        expect(p?.fuentes.map(f => f.sourceLibraryResourceId)).toEqual(['lib-sasson', 'lib-stuart']);
    });

    it('calla cuando el trabajo no pertenece a una serie', async () => {
        const suelto = { id: 'p9', seriesId: null, sources: [] };
        const repo = makeRepo(suelto, [suelto, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        expect(await uc.proponer('owner-1', 'p9')).toBeNull();
        // Y ni siquiera sale a pedir el resumen: no hay serie por la cual buscar.
        expect(repo.listPaperSummaries).not.toHaveBeenCalled();
    });

    it('escribe las fuentes SIN fragmentos ni huella del pasaje anterior', async () => {
        const repo = makeRepo(JONAS_3, [JONAS_3, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        await uc.aplicar({ ownerId: 'owner-1', paperId: 'p3' });

        expect(repo.addSource).toHaveBeenCalledTimes(2);
        for (const [, , escrita] of repo.addSource.mock.calls) {
            expect(escrita.corpusId).toBe('corpus-viejo');
            expect(escrita.mode).toBe('full-document');
            expect(escrita.excerpts).toEqual([]);
            expect(escrita.excerptSelectionMode).toBeNull();
            expect(escrita.excerptRecipe).toBeNull();
            expect(escrita.extractedAt).toBeNull();
            expect(escrita.extractionFingerprint).toBeNull();
        }
    });

    it('conserva la clasificación y la clave de cita, que es de lo que se trata', async () => {
        const repo = makeRepo(JONAS_3, [JONAS_3, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        await uc.aplicar({ ownerId: 'owner-1', paperId: 'p3' });

        const primera = repo.addSource.mock.calls[0][2];
        expect(primera.sourceType).toBe('commentary-critical');
        expect(primera.chosenRole).toBe('anchor');
        expect(primera.citationKey).toBe('Sasson1990');
        expect(primera.displayLabel).toBe('Sasson, Jonah');
    });

    it('trae sólo lo pedido cuando se destilda parte de la propuesta', async () => {
        const repo = makeRepo(JONAS_3, [JONAS_3, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        const { creadas } = await uc.aplicar({
            ownerId: 'owner-1', paperId: 'p3',
            soloEstos: ['lib-stuart'],
        });

        expect(creadas).toHaveLength(1);
        expect(repo.addSource.mock.calls[0][2].sourceLibraryResourceId).toBe('lib-stuart');
    });

    it('numera en orden a partir de lo que el trabajo ya tiene', () => {
        // El `order` lo fija este caso de uso: el repositorio escribe el que
        // se le pasa. Si se repitiera, dos fuentes quedarían en la misma
        // posición de la lista.
        const repo = makeRepo({ ...JONAS_3, sources: [{}, {}] }, [JONAS_3, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        return uc.aplicar({ ownerId: 'owner-1', paperId: 'p3' }).then(() => {
            expect(repo.addSource.mock.calls.map(c => c[2].order)).toEqual([2, 3]);
        });
    });

    it('no vuelve a traer lo que el trabajo ya tiene aunque la pantalla lo pida', async () => {
        // Entre que se mostró la tarjeta y se aceptó, alguien adjuntó Sasson a mano.
        const yaConSasson = { ...JONAS_3, sources: [fuente({ id: 'manual' })] };
        const repo = makeRepo(yaConSasson, [yaConSasson, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        const { creadas } = await uc.aplicar({
            ownerId: 'owner-1', paperId: 'p3',
            soloEstos: ['lib-sasson', 'lib-stuart'],
        });

        expect(creadas).toHaveLength(1);
        expect(repo.addSource.mock.calls[0][2].sourceLibraryResourceId).toBe('lib-stuart');
    });

    it('reapunta el corpus que ya estaba ingerido, sin volver a subir el libro', async () => {
        const repo = makeRepo(JONAS_3, [JONAS_3, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        await uc.aplicar({ ownerId: 'owner-1', paperId: 'p3' });

        // El mismo corpus del trabajo de origen: el texto ya está adentro.
        expect(repo.addSource.mock.calls[0][2].corpusId).toBe('corpus-viejo');
    });

    it('no ofrece un libro que ya no está en la biblioteca del usuario', () => {
        // El trabajo de origen lo tiene adjunto, pero el recurso fue borrado:
        // heredarlo dejaría una fuente que no se puede abrir ni citar.
        const repo = makeRepo(JONAS_3, [JONAS_3, JONAS_2]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca(['lib-stuart']) as never);

        return uc.proponer('owner-1', 'p3').then(p => {
            expect(p?.fuentes.map(f => f.sourceLibraryResourceId)).toEqual(['lib-stuart']);
        });
    });
});

/**
 * Las hojas fijadas del hermano (la introducción del libro, por ejemplo) son
 * lo único de su receta que sirve en el pasaje nuevo: sus demás páginas son de
 * otra perícopa.
 */
describe('InheritCorpusFromSeriesUseCase — hojas fijadas del hermano', () => {
    it('devuelve, por fuente creada, las hojas que el hermano tenía fijadas', async () => {
        const conIntro = {
            ...JONAS_2,
            sources: [
                fuente({ excerptRecipe: { sheetRanges: [{ start: 150, end: 160 }], proposedRanges: [], pinnedRanges: [{ start: 3, end: 9 }], passageFingerprint: '' } }),
                fuente({ id: 's2', sourceLibraryResourceId: 'lib-stuart', excerptRecipe: null }),
            ],
        };
        const repo = makeRepo(JONAS_3, [JONAS_3, conIntro]);
        const uc = new InheritCorpusFromSeriesUseCase(repo as never, makeBiblioteca() as never);

        const { creadas, fijadasDelHermano } = await uc.aplicar({ ownerId: 'owner-1', paperId: 'p3' });

        const sasson = creadas.find(c => c.sourceLibraryResourceId === 'lib-sasson')!;
        expect(fijadasDelHermano[sasson.id]).toEqual([{ start: 3, end: 9 }]);
        // Sin fijadas en el hermano, nada: ni sus páginas de otra perícopa.
        const stuart = creadas.find(c => c.sourceLibraryResourceId === 'lib-stuart')!;
        expect(fijadasDelHermano[stuart.id]).toBeUndefined();
        // Y la fuente sigue llegando sin receta: las páginas las propone quien hereda.
        expect(repo.addSource.mock.calls[0][2].excerptRecipe).toBeNull();
    });
});
