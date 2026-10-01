import { describe, it, expect } from 'vitest';
import { ExtractExcerptsForPaperUseCase } from '../ExtractExcerptsForPaperUseCase';

/**
 * El rol dialéctico se elige al agregar la fuente. Antes el diálogo no lo
 * dejaba elegir: lo deducía el tipo y sólo se veía como «· Técnica» después.
 */
function montar(fuentes: unknown[] = []) {
    const agregadas: Record<string, unknown>[] = [];
    const parches: Record<string, unknown>[] = [];
    const paper = {
        id: 'p1', displayLanguage: 'es', assignmentBrief: null, sources: fuentes,
        passage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 26 },
    };
    const repo = {
        getPaper: async () => paper,
        addSource: async (_o: string, _p: string, s: Record<string, unknown>) => { agregadas.push(s); return { id: `s${agregadas.length}` }; },
        updateSource: async (_o: string, _p: string, _id: string, patch: Record<string, unknown>) => { parches.push(patch); return {}; },
    };
    const extractor = { extract: async () => ({ excerptsByResource: { r1: [] } }) };
    return { uc: new ExtractExcerptsForPaperUseCase(repo as never, extractor as never), agregadas, parches };
}

const sel = { libraryResourceId: 'r1', sourceType: 'commentary-critical' as const, displayLabel: 'Ropes' };

describe('extraer fragmentos con el rol elegido', () => {
    it('una fuente nueva nace con el rol que eligió el autor', async () => {
        const { uc, agregadas } = montar();
        await uc.execute({ ownerId: 'u', paperId: 'p1', selections: [{ ...sel, chosenRole: 'anchor' }] }).catch(() => undefined);
        expect(agregadas[0]).toMatchObject({ chosenRole: 'anchor' });
    });

    it('sin rol elegido, no se escribe: lo deduce el tipo', async () => {
        const { uc, agregadas } = montar();
        await uc.execute({ ownerId: 'u', paperId: 'p1', selections: [sel] }).catch(() => undefined);
        expect(agregadas[0]).not.toHaveProperty('chosenRole');
    });

    it('al reemplazar una fuente existente, el rol elegido la actualiza', async () => {
        const { uc, parches } = montar([{ id: 'x', sourceLibraryResourceId: 'r1', excerpts: [] }]);
        await uc.execute({ ownerId: 'u', paperId: 'p1', selections: [{ ...sel, chosenRole: 'contrast' }] }).catch(() => undefined);
        expect(parches[0]).toMatchObject({ chosenRole: 'contrast' });
    });
});
