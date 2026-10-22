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

function montar() {
    const agregadas: Array<Record<string, unknown>> = [];
    const repo = {
        createPaper: vi.fn(async () => ({ id: 'p1', sources: [] })),
        addSource: vi.fn(async (_o: string, _p: string, s: Record<string, unknown>) => { agregadas.push(s); return { id: `s${agregadas.length}`, ...s }; }),
        getPaper: vi.fn(async () => ({ id: 'p1', sources: agregadas })),
        setRubric: vi.fn(async () => ({ id: 'p1', sources: agregadas })),
    };
    const biblioteca = { findById: vi.fn(async (id: string) => (id === 'r-borrado' ? null : { id })) };
    return { uc: new CreateExegeticalPaperUseCase(repo as never, undefined, biblioteca), repo, agregadas };
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
});
