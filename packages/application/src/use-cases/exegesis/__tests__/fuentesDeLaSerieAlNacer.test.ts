import { describe, it, expect, vi } from 'vitest';
import { paperDefaultsFromSeries } from '@dosfilos/domain';
import { CreateExegeticalPaperUseCase } from '../CreateExegeticalPaperUseCase';

/**
 * Etapa 0 (2026-10-22): la «Configuración exegética» de una serie guardaba
 * fuentes por defecto y el trabajo nacía con `sources: []`: se aceptaban y
 * se descartaban. En producción, la serie de Mateo es la única que tiene
 * esa configuración (leído el 2026-10-22).
 */
const defaults = {
    styleGuideId: null,
    sourceRefs: [
        { libraryResourceId: 'r-carson', corpusId: 'r-carson', displayLabel: 'Carson, Matthew', sourceType: 'commentary-critical', mode: 'full-document' },
        { libraryResourceId: 'r-bdag', corpusId: 'r-bdag', displayLabel: 'BDAG', sourceType: 'lexicon-technical', mode: 'full-document' },
        { libraryResourceId: 'r-borrado', corpusId: 'r-borrado', displayLabel: 'Ya no está', sourceType: 'grammar-syntax', mode: 'full-document' },
        { libraryResourceId: 'r-carson', corpusId: 'r-carson', displayLabel: 'Carson, Matthew', sourceType: 'commentary-critical', mode: 'full-document' },
    ],
};

function montar(opts: { falla?: string; lecturaFalla?: boolean } = {}) {
    const agregadas: Array<Record<string, unknown>> = [];
    const repo = {
        createPaper: vi.fn(async () => ({ id: 'p1', sources: [] })),
        addSource: vi.fn(async (_o: string, _p: string, s: Record<string, unknown>) => {
            if (s.sourceLibraryResourceId === opts.falla) throw new Error('transacción caída');
            agregadas.push(s); return { id: `s${agregadas.length}`, ...s };
        }),
        getPaper: vi.fn(async () => ({ id: 'p1', sources: agregadas })),
        // Devuelve el trabajo SIN fuentes: las trae la relectura final.
        setRubric: vi.fn(async () => ({ id: 'p1', sources: [] })),
    };
    const biblioteca = { findById: vi.fn(async (id: string) => {
        if (opts.lecturaFalla) throw new Error('sin red');
        return id === 'r-borrado' ? null : { id };
    }) };
    return { uc: new CreateExegeticalPaperUseCase(repo as never, undefined, biblioteca), repo, agregadas, biblioteca };
}
const base = { ownerId: 'u', passage: { bookId: 'MAT', chapterStart: 10, chapterEnd: 10, verseStart: 1, verseEnd: 15 }, displayLanguage: 'es' as const, seriesId: 's-mateo', pericopeId: 'p1' };

describe('un trabajo de una serie nace con las fuentes por defecto de la serie', () => {
    it('agrega cada libro una vez, sin fragmentos, y no los que ya no están en la biblioteca', async () => {
        const { uc, agregadas } = montar();
        const paper = await uc.execute({ ...base, ...paperDefaultsFromSeries(defaults as never) } as never);
        expect(agregadas.map(s => s.sourceLibraryResourceId)).toEqual(['r-carson', 'r-bdag']);
        expect(agregadas[0]).toMatchObject({ corpusId: 'r-carson', sourceType: 'commentary-critical', order: 0, mode: 'full-document', excerpts: [], extractedAt: null, citationKey: null });
        expect(agregadas[1]).toMatchObject({ order: 1 });
        expect(paper.sources).toHaveLength(2);
    });

    it('sin fuentes por defecto no agrega nada ni relee el trabajo', async () => {
        const { uc, repo } = montar();
        await uc.execute(base as never);
        expect(repo.addSource).not.toHaveBeenCalled();
        expect(repo.getPaper).not.toHaveBeenCalled();
    });

    it('la rúbrica se pone antes que las fuentes, y una fuente que falla no tumba la creación', async () => {
        const { uc, repo, agregadas } = montar({ falla: 'r-carson' });
        const paper = await uc.execute({ ...base, ...paperDefaultsFromSeries(defaults as never) } as never);
        expect(repo.setRubric.mock.invocationCallOrder[0]!).toBeLessThan(repo.addSource.mock.invocationCallOrder[0]!);
        expect(agregadas.map(s => s.sourceLibraryResourceId)).toEqual(['r-bdag']);
        expect(paper.sources).toHaveLength(1);
    });

    it('un error al leer la biblioteca no es «se borró»: la fuente se agrega', async () => {
        const { uc, agregadas } = montar({ lecturaFalla: true });
        await uc.execute({ ...base, ...paperDefaultsFromSeries(defaults as never) } as never);
        expect(agregadas.map(s => s.sourceLibraryResourceId)).toEqual(['r-carson', 'r-bdag', 'r-borrado']);
    });

    it('los trabajos de una serie creados a la vez preguntan una sola vez por cada libro', async () => {
        const { uc, biblioteca } = montar();
        const entrada = { ...base, ...paperDefaultsFromSeries(defaults as never) } as never;
        await Promise.all([uc.execute(entrada), uc.execute(entrada), uc.execute(entrada)]);
        expect(biblioteca.findById).toHaveBeenCalledTimes(3);
    });

    it('el modo es siempre documento entero', async () => {
        const { uc, agregadas } = montar();
        const conFragmentos = { ...defaults, sourceRefs: [{ ...defaults.sourceRefs[0]!, mode: 'extracted-excerpts' }] };
        await uc.execute({ ...base, ...paperDefaultsFromSeries(conFragmentos as never) } as never);
        expect(agregadas[0]).toMatchObject({ mode: 'full-document' });
    });

    it('el proyecto de origen se guarda solo si es del dueño, y la portada nace con el trabajo (ADR-046)', async () => {
        const repo = { createPaper: vi.fn(async (d: Record<string, unknown>) => ({ id: 'p1', sources: [], ...d })), setRubric: vi.fn(async () => ({ id: 'p1' })), getPaper: vi.fn(), addSource: vi.fn() };
        const proyectos = { getProject: vi.fn(async (id: string) => ({ propio: { id: 'propio', userId: 'u' }, ajeno: { id: 'ajeno', userId: 'otro' } } as Record<string, { id: string; userId: string }>)[id] ?? null) };
        const uc = new CreateExegeticalPaperUseCase(repo as never, undefined, undefined, proyectos);
        await uc.execute({ ...base, projectId: 'propio', cover: { institution: 'TMS' } } as never);
        expect(repo.createPaper.mock.calls[0]![0]).toMatchObject({ projectId: 'propio', cover: { institution: 'TMS' } });
        await uc.execute({ ...base, projectId: 'ajeno' } as never);
        expect(repo.createPaper.mock.calls[1]![0]).toMatchObject({ projectId: null });
    });
});
