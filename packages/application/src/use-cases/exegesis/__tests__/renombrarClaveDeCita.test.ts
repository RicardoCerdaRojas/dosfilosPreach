import { describe, it, expect, vi } from 'vitest';
import { RenameCitationKeyUseCase } from '../RenameCitationKeyUseCase';
import { UpdateProjectSourceUseCase } from '../UpdateProjectSourceUseCase';

/** TP #6: la fuente pasó de «Aland» a «NA28» y lo generado siguió citando «Aland». */
function repo(citationKey: string | null = 'Aland') {
    const paper = { id: 'p', sources: [{ id: 'na', citationKey }, { id: 'ma', citationKey: 'Mayor' }] };
    return {
        getPaper: vi.fn().mockResolvedValue(paper),
        updateSource: vi.fn().mockResolvedValue({ id: 'na' }),
        renameCitationKey: vi.fn().mockResolvedValue(paper),
    };
}

describe('renombrar la clave de una fuente', () => {
    it('REGRESIÓN: propaga el renombre a lo ya generado', async () => {
        const r = repo('Aland');
        await new UpdateProjectSourceUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', sourceId: 'na', citationKey: ' NA28 ' });
        expect(r.renameCitationKey).toHaveBeenCalledWith('o', 'p', 'Aland', 'NA28');
    });

    it('sin cambio de clave, o sin clave anterior, no toca lo generado', async () => {
        const igual = repo('NA28');
        await new UpdateProjectSourceUseCase(igual as never).execute({ ownerId: 'o', paperId: 'p', sourceId: 'na', citationKey: 'NA28' });
        expect(igual.renameCitationKey).not.toHaveBeenCalled();
        const sinAnterior = repo(null);
        await new UpdateProjectSourceUseCase(sinAnterior as never).execute({ ownerId: 'o', paperId: 'p', sourceId: 'na', citationKey: 'NA28' });
        expect(sinAnterior.renameCitationKey).not.toHaveBeenCalled();
        const otroCampo = repo('Aland');
        await new UpdateProjectSourceUseCase(otroCampo as never).execute({ ownerId: 'o', paperId: 'p', sourceId: 'na', displayLabel: 'NA28' });
        expect(otroCampo.renameCitationKey).not.toHaveBeenCalled();
        expect(otroCampo.getPaper).not.toHaveBeenCalled();
    });
});

describe('corregir una clave huérfana', () => {
    it('sólo hacia la clave de una fuente del corpus', async () => {
        const r = repo('NA28');
        await new RenameCitationKeyUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', from: 'Aland', to: 'NA28' });
        expect(r.renameCitationKey).toHaveBeenCalledWith('o', 'p', 'Aland', 'NA28');
        await expect(new RenameCitationKeyUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', from: 'Aland', to: 'Nestle' }))
            .rejects.toThrow(/ninguna fuente/);
        expect(r.renameCitationKey).toHaveBeenCalledTimes(1);
    });
});
