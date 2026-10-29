import { describe, expect, it, vi } from 'vitest';
import type { PageIndexEntry } from '@dosfilos/domain';
import { SelectSourcePagesUseCase } from '../SelectSourcePagesUseCase';

const PAGE_INDEX: PageIndexEntry[] = [
    { sheet: 60, chunkIndices: [100, 101], section: 'Introduction', firstLine: '', charCount: 1900 },
    { sheet: 61, chunkIndices: [102], section: null, firstLine: '', charCount: 2800 },
    // La hoja 62 no produjo fragmentos.
    { sheet: 63, chunkIndices: [103, 104], section: 'Jonah 1:1-3', firstLine: '', charCount: 4900 },
];

function makePaper(sources: unknown[] = []) {
    return {
        id: 'paper-1',
        passage: { bookId: 'JON', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 3 },
        displayLanguage: 'es' as const,
        assignmentBrief: null,
        sources,
    };
}

function makeDeps(paper: unknown) {
    const repo = {
        getPaper: vi.fn().mockResolvedValue(paper),
        addSource: vi.fn().mockResolvedValue({ id: 'source-new' }),
        updateSource: vi.fn().mockResolvedValue({ id: 'source-existing' }),
    };
    const reader = {
        readChunks: vi.fn().mockResolvedValue([
            { chunkIndex: 103, text: 'Comentario a 1:1.', page: 63, section: 'Jonah 1:1-3' },
            { chunkIndex: 100, text: 'Introducción al libro.', page: 60, section: 'Introduction' },
        ]),
    };
    return { repo, reader };
}

const BASE_INPUT = {
    ownerId: 'owner-1',
    paperId: 'paper-1',
    libraryResourceId: 'lib-1',
    displayLabel: 'The Minor Prophets',
    sourceType: 'commentary-expository' as const,
    pageIndex: PAGE_INDEX,
    proposedRanges: [{ start: 63, end: 63 }],
};

describe('SelectSourcePagesUseCase', () => {
    it('traduce las hojas elegidas a fragmentos y crea la fuente', async () => {
        const { repo, reader } = makeDeps(makePaper());
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        const result = await useCase.execute({
            ...BASE_INPUT,
            sheetRanges: [{ start: 63, end: 63 }, { start: 60, end: 61 }],
        });

        // Los tramos se funden y ordenan antes de resolver.
        expect(reader.readChunks).toHaveBeenCalledWith('lib-1', [{ start: 100, end: 104 }]);
        expect(repo.addSource).toHaveBeenCalledOnce();
        expect(result.sourceId).toBe('source-new');
        expect(result.excerptCount).toBe(2);
    });

    it('NO guarda el texto en el paper, solo la receta', async () => {
        // El texto de doce fuentes son ~514 KB contra un tope de documento de
        // 1 MiB, y ya no alimenta el prompt: cada paso pide lo suyo al corpus.
        const { repo, reader } = makeDeps(makePaper());
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        const result = await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 60, end: 63 }] });

        const created = repo.addSource.mock.calls[0]![2];
        expect(created.excerpts).toEqual([]);
        expect(created.excerptRecipe.sheetRanges).toEqual([{ start: 60, end: 63 }]);
        // Igual informa cuántos fragmentos implica la selección: es lo que
        // alimenta el medidor y la guardia de consistencia.
        expect(result.excerptCount).toBe(2);
    });

    it('persiste la receta con lo elegido y lo propuesto', async () => {
        const { repo, reader } = makeDeps(makePaper());
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 60, end: 63 }] });

        const created = repo.addSource.mock.calls[0]![2];
        expect(created.excerptSelectionMode).toBe('manual');
        expect(created.excerptRecipe.sheetRanges).toEqual([{ start: 60, end: 63 }]);
        expect(created.excerptRecipe.proposedRanges).toEqual([{ start: 63, end: 63 }]);
        expect(created.excerptRecipe.passageFingerprint).toBeTruthy();
    });

    it('registra que la selección se armó a mano', async () => {
        const { repo, reader } = makeDeps(makePaper());
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 60, end: 63 }] });

        expect(repo.addSource.mock.calls[0]![2].excerptSelectionMode).toBe('manual');
    });

    it('reusa la fuente cuando el documento ya estaba adjunto por el backref', async () => {
        const paper = makePaper([
            { id: 'source-existing', corpusId: 'otro', sourceLibraryResourceId: 'lib-1' },
        ]);
        const { repo, reader } = makeDeps(paper);
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 63, end: 63 }] });

        expect(repo.updateSource).toHaveBeenCalledOnce();
        expect(repo.addSource).not.toHaveBeenCalled();
    });

    it('reusa la fuente adjuntada por la ruta vieja, que no guarda backref', async () => {
        // Caso real: "agregar desde mi biblioteca" deja sourceLibraryResourceId
        // en null y el id en corpusId. Mirar solo el backref duplicaría el libro.
        const paper = makePaper([
            { id: 'source-legacy', corpusId: 'lib-1', sourceLibraryResourceId: null },
        ]);
        const { repo, reader } = makeDeps(paper);
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 63, end: 63 }] });

        expect(repo.updateSource).toHaveBeenCalledOnce();
        expect(repo.updateSource.mock.calls[0]![2]).toBe('source-legacy');
        expect(repo.addSource).not.toHaveBeenCalled();
    });

    it('informa las hojas elegidas que no traen texto', async () => {
        const { repo, reader } = makeDeps(makePaper());
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        // La hoja 62 no existe en el índice.
        const result = await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 60, end: 63 }] });

        expect(result.emptySheets).toBe(1);
    });

    it('rechaza una selección vacía', async () => {
        const { repo, reader } = makeDeps(makePaper());
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        await expect(useCase.execute({ ...BASE_INPUT, sheetRanges: [] })).rejects.toThrow();
        expect(reader.readChunks).not.toHaveBeenCalled();
    });
});

describe('SelectSourcePagesUseCase · consistencia', () => {
    it('marca incompleto cuando vuelven menos fragmentos de los pedidos', async () => {
        const { repo } = makeDeps(makePaper());
        // La selección implica 5 fragmentos (100-104); el lector devuelve 2.
        const reader = {
            readChunks: vi.fn().mockResolvedValue([
                { chunkIndex: 100, text: 'a', page: 60, section: null },
                { chunkIndex: 101, text: 'b', page: 60, section: null },
            ]),
        };
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        const result = await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 60, end: 63 }] });

        expect(result.expectedChunks).toBe(5);
        expect(result.excerptCount).toBe(2);
        expect(result.incomplete).toBe(true);
    });

    it('no marca incompleto cuando vuelve todo lo pedido', async () => {
        const { repo } = makeDeps(makePaper());
        // Las hojas 60-61 implican los fragmentos 100, 101 y 102: el lector
        // devuelve exactamente esos tres.
        const reader = {
            readChunks: vi.fn().mockResolvedValue([
                { chunkIndex: 100, text: 'a', page: 60, section: null },
                { chunkIndex: 101, text: 'b', page: 60, section: null },
                { chunkIndex: 102, text: 'c', page: 61, section: null },
            ]),
        };
        const useCase = new SelectSourcePagesUseCase(repo as never, reader as never);

        const result = await useCase.execute({ ...BASE_INPUT, sheetRanges: [{ start: 60, end: 61 }] });

        expect(result.expectedChunks).toBe(3);
        expect(result.incomplete).toBe(false);
    });
});

/**
 * «Agregar y fijar» de la revisión por pregunta (TP #8, A4; revisión de 8a):
 * suma sobre lo que el trabajo declara AHORA. Con la lista de la interfaz, un
 * segundo clic antes del refresco deshacía el primero.
 */
describe('SelectSourcePagesUseCase — sumar a lo que ya hay', () => {
    const existente = {
        id: 'source-existing',
        sourceLibraryResourceId: 'lib-1',
        corpusId: 'lib-1',
        excerpts: [],
        extractionFingerprint: 'huella-vieja',
        excerptRecipe: {
            sheetRanges: [{ start: 60, end: 61 }],
            proposedRanges: [{ start: 60, end: 60 }],
            pinnedRanges: [{ start: 60, end: 60 }],
            passageFingerprint: 'huella-vieja',
        },
    };

    it('suma la hoja y la fija sin perder lo que había, y conserva la huella', async () => {
        const { repo, reader } = makeDeps(makePaper([existente]));
        await new SelectSourcePagesUseCase(repo as never, reader as never).execute({
            ...BASE_INPUT,
            sheetRanges: [{ start: 63, end: 63 }],
            pinnedRanges: [{ start: 63, end: 63 }],
            proposedRanges: [],
            mergeWithExisting: true,
        });
        const patch = repo.updateSource.mock.calls[0]![3];
        expect(patch.excerptRecipe).toEqual({
            sheetRanges: [{ start: 60, end: 61 }, { start: 63, end: 63 }],
            proposedRanges: [{ start: 60, end: 60 }],
            pinnedRanges: [{ start: 60, end: 60 }, { start: 63, end: 63 }],
            passageFingerprint: 'huella-vieja',
        });
        expect(patch.extractionFingerprint).toBe('huella-vieja');
    });

    it('sin páginas elegidas a las que sumar, no reescribe la fuente', async () => {
        const { repo, reader } = makeDeps(makePaper([{ ...existente, excerptRecipe: null }]));
        await expect(new SelectSourcePagesUseCase(repo as never, reader as never).execute({
            ...BASE_INPUT, sheetRanges: [{ start: 63, end: 63 }], mergeWithExisting: true,
        })).rejects.toThrow();
        expect(repo.updateSource).not.toHaveBeenCalled();
    });
});

/**
 * TP #9 (Santiago 4:11-17, B20): quitar TODAS las páginas de Tuggy no se
 * podía guardar. Ahora se guarda la fuente vacía, con marca explícita.
 */
describe('SelectSourcePagesUseCase — guardar sin páginas', () => {
    const conPaginas = {
        id: 'source-existing',
        sourceLibraryResourceId: 'lib-1',
        corpusId: 'lib-1',
        excerpts: [],
        excerptRecipe: {
            sheetRanges: [{ start: 60, end: 61 }],
            proposedRanges: [{ start: 60, end: 60 }],
            pinnedRanges: [{ start: 60, end: 60 }],
            passageFingerprint: 'huella',
        },
    };

    const sinUndefined = (o: unknown): boolean =>
        o === undefined ? false
            : o === null || typeof o !== 'object' || o instanceof Date ? true
                : Object.values(o as Record<string, unknown>).every(sinUndefined);

    it('vacía la fuente que ya estaba: receta sin hojas ni fijadas, cero fragmentos, sin leer el libro', async () => {
        const { repo, reader } = makeDeps(makePaper([conPaginas]));
        const result = await new SelectSourcePagesUseCase(repo as never, reader as never).execute({
            ...BASE_INPUT, sheetRanges: [], pinnedRanges: [{ start: 60, end: 60 }], allowEmpty: true,
        });
        expect(reader.readChunks).not.toHaveBeenCalled();
        expect(repo.addSource).not.toHaveBeenCalled();
        const patch = repo.updateSource.mock.calls[0]![3];
        expect(patch.excerptRecipe.sheetRanges).toEqual([]);
        expect(patch.excerptRecipe.pinnedRanges).toEqual([]);
        expect(patch.excerpts).toEqual([]);
        expect(patch.mode).toBe('extracted-excerpts');
        expect(patch.extractedAt).toBeInstanceOf(Date);
        // Firestore no acepta undefined.
        expect(sinUndefined(patch)).toBe(true);
        expect(result).toMatchObject({ sourceId: 'source-existing', excerptCount: 0, emptySheets: 0, expectedChunks: 0, incomplete: false });
    });

    it('sin la marca, una lista vacía sigue siendo un error', async () => {
        const { repo, reader } = makeDeps(makePaper([conPaginas]));
        await expect(new SelectSourcePagesUseCase(repo as never, reader as never).execute({
            ...BASE_INPUT, sheetRanges: [],
        })).rejects.toThrow();
        expect(repo.updateSource).not.toHaveBeenCalled();
    });

    it('no crea una fuente vacía nueva', async () => {
        const { repo, reader } = makeDeps(makePaper());
        await expect(new SelectSourcePagesUseCase(repo as never, reader as never).execute({
            ...BASE_INPUT, sheetRanges: [], allowEmpty: true,
        })).rejects.toThrow();
        expect(repo.addSource).not.toHaveBeenCalled();
    });

    it('al sumar no se vacía nada aunque llegue la marca', async () => {
        const { repo, reader } = makeDeps(makePaper([{ ...conPaginas, excerptRecipe: { ...conPaginas.excerptRecipe, sheetRanges: [] } }]));
        await expect(new SelectSourcePagesUseCase(repo as never, reader as never).execute({
            ...BASE_INPUT, sheetRanges: [], allowEmpty: true, mergeWithExisting: true,
        })).rejects.toThrow();
        expect(repo.updateSource).not.toHaveBeenCalled();
    });
});
