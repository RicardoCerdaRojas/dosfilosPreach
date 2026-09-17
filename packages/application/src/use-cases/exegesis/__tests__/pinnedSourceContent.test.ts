import { describe, expect, it, vi } from 'vitest';
import type { ExegeticalPaper, PageNumbering } from '@dosfilos/domain';
import { buildComposerSourcesWithPinnedContent } from '../pinnedSourceContent';

/**
 * El contenido de una fuente asignada a la introducción, la conclusión o el
 * paper completo era el libro entero, y el compositor lo cortaba en sus
 * primeros 80.000 caracteres: en el comentario de Ross (900 páginas) eso es la
 * introducción general, nunca el Salmo 23. El contrato que importa a quien
 * compone: lo asignado llega como LAS HOJAS QUE EL PASTOR ELIGIÓ, rotuladas con
 * la página impresa que se va a citar.
 */
const ROSS = {
    id: 'src-ross',
    corpusId: 'lib-ross',
    sourceLibraryResourceId: 'lib-ross',
    sourceType: 'commentary-critical',
    citationKey: 'Ross',
    displayLabel: 'A Commentary on the Psalms',
    excerptRecipe: { sheetRanges: [{ start: 557, end: 568 }], proposedRanges: [], pinnedRanges: [], passageFingerprint: 'x' },
};
const CRAIGIE = { ...ROSS, id: 'src-craigie', corpusId: 'lib-craigie', sourceLibraryResourceId: 'lib-craigie', citationKey: 'Craigie', excerptRecipe: null };
const ORTIZ = { ...ROSS, id: 'src-ortiz', corpusId: 'lib-ortiz', sourceLibraryResourceId: 'lib-ortiz', citationKey: 'Ortiz', sourceType: 'lexicon-technical' };

const paper = { sources: [ROSS, CRAIGIE, ORTIZ] } as unknown as ExegeticalPaper;

// Ross: hoja 563 = p. 559 (desfase 4).
const NUMERACION_ROSS: PageNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 902, offset: -4 }] } as unknown as PageNumbering;

function readers() {
    return {
        contentReader: { getTextContent: vi.fn().mockResolvedValue('INICIO DEL LIBRO: prefacio, introducción general, Salmo 1…') },
        corpusReader: {
            readAdmitted: vi.fn().mockResolvedValue([
                { resourceId: 'lib-ross', chunkIndex: 1, text: '“Shepherd” is an active participle used substantively', sheet: 563, section: null, score: 1 },
                { resourceId: 'lib-ross', chunkIndex: 2, text: '   ', sheet: 564, section: null, score: 1 },
            ]),
        },
        pageNumbering: { numberingFor: vi.fn(async (id: string) => (id === 'lib-ross' ? NUMERACION_ROSS : null)) },
    };
}

describe('buildComposerSourcesWithPinnedContent', () => {
    it('una fuente asignada con receta trae SUS hojas, no el comienzo del libro (el defecto)', async () => {
        const r = readers();
        const [ross] = await buildComposerSourcesWithPinnedContent(paper, new Set(['src-ross']), r);

        expect(r.corpusReader.readAdmitted).toHaveBeenCalledWith({ resourceId: 'lib-ross', sheetRanges: ROSS.excerptRecipe.sheetRanges });
        expect(ross!.textContent).toContain('active participle used substantively');
        expect(ross!.textContent).not.toContain('INICIO DEL LIBRO');
        expect(r.contentReader.getTextContent).not.toHaveBeenCalledWith('lib-ross');
    });

    it('rotula cada fragmento con la página impresa, que es lo que se cita', async () => {
        const [ross] = await buildComposerSourcesWithPinnedContent(paper, new Set(['src-ross']), readers());
        expect(ross!.textContent).toContain('--- p. 559 ---');
    });

    it('descarta fragmentos vacíos', async () => {
        const [ross] = await buildComposerSourcesWithPinnedContent(paper, new Set(['src-ross']), readers());
        expect(ross!.textContent).not.toContain('--- p. 560 ---');
    });

    it('una fuente sin receta (adjuntada antes del selector) cae al texto completo', async () => {
        const r = readers();
        const out = await buildComposerSourcesWithPinnedContent(paper, new Set(['src-craigie']), r);
        const craigie = out.find(s => s.citationKey === 'Craigie')!;
        expect(craigie.textContent).toContain('INICIO DEL LIBRO');
        expect(r.corpusReader.readAdmitted).not.toHaveBeenCalled();
    });

    it('si la lectura por hojas falla, cae al texto completo en vez de dejar la fuente vacía', async () => {
        const r = readers();
        r.corpusReader.readAdmitted.mockRejectedValueOnce(new Error('callable caído'));
        const [ross] = await buildComposerSourcesWithPinnedContent(paper, new Set(['src-ross']), r);
        expect(ross!.textContent).toContain('INICIO DEL LIBRO');
    });

    it('sin lector por hojas se comporta como antes', async () => {
        const r = readers();
        const [ross] = await buildComposerSourcesWithPinnedContent(paper, new Set(['src-ross']), { contentReader: r.contentReader });
        expect(ross!.textContent).toContain('INICIO DEL LIBRO');
    });

    it('las fuentes no asignadas van sin contenido y no se leen', async () => {
        const r = readers();
        const out = await buildComposerSourcesWithPinnedContent(paper, new Set(['src-ross']), r);
        const ortiz = out.find(s => s.citationKey === 'Ortiz')!;
        expect(ortiz.isPinned).toBe(false);
        expect(ortiz.textContent).toBeUndefined();
        expect(r.corpusReader.readAdmitted).toHaveBeenCalledTimes(1);
    });
});
