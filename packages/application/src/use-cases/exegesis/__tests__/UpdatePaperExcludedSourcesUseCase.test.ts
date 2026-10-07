import { describe, it, expect, vi } from 'vitest';
import { normalizeExcludedSources, UpdatePaperExcludedSourcesUseCase } from '../UpdatePaperExcludedSourcesUseCase';

/** La clave viaja a cada prompt que redacta: vacías o repetidas serían ruido. */
describe('las fuentes excluidas que se guardan', () => {
    it('sin vacías ni repetidas (sin importar acentos, mayúsculas ni espacios)', () => {
        expect(normalizeExcludedSources([
            { key: ' McCartney ', previousPaperTitle: 'TP #5' },
            { key: 'mccartney', previousPaperTitle: null },
            { key: '   ', previousPaperTitle: null },
            { key: 'Martín', previousPaperTitle: '  ' },
            { key: 'Martin', previousPaperTitle: null },
            { key: 'Carson   y  Moo', previousPaperTitle: null },
        ])).toEqual([
            { key: 'McCartney', previousPaperTitle: 'TP #5' },
            { key: 'Martín', previousPaperTitle: null },
            { key: 'Carson y Moo', previousPaperTitle: null },
        ]);
    });

    it('guarda `[]` (confirmado: no hay) y no `null`', async () => {
        const updatePaper = vi.fn().mockResolvedValue({});
        await new UpdatePaperExcludedSourcesUseCase({ updatePaper } as never)
            .execute({ ownerId: 'u', paperId: 'p', excludedSources: [] });
        expect(updatePaper).toHaveBeenCalledWith('u', 'p', { excludedSources: [] });
    });
});
