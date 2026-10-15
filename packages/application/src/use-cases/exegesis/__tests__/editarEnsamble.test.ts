import { describe, it, expect, vi } from 'vitest';
import { SaveStepEditUseCase } from '../SaveStepEditUseCase';

/**
 * TP #7, leído en producción: las tres ediciones del Ensamble (18:16, 18:31,
 * 18:38) quedaron en el paso y la exportación seguía con la versión generada
 * de las 18:05, porque `assembledMarkdown` sólo se escribía al ACEPTAR.
 */
const repo = (kind: string) => ({
    saveManualEdit: vi.fn().mockResolvedValue({ id: 's', kind, accepted: { markdown: 'TEXTO EDITADO' } }),
    updatePaper: vi.fn().mockResolvedValue(undefined),
    setPhase: vi.fn().mockResolvedValue(undefined),
});

describe('editar el ensamble actualiza el documento que se exporta', () => {
    it('el ensamble editado pasa a ser el documento', async () => {
        const r = repo('assembly');
        await new SaveStepEditUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', stepId: 's', markdown: 'TEXTO EDITADO' });
        expect(r.updatePaper).toHaveBeenCalledWith('o', 'p', { assembledMarkdown: 'TEXTO EDITADO' });
        expect(r.setPhase).toHaveBeenCalledWith('o', 'p', 'assembled');
    });
    it('editar un versículo no toca el documento', async () => {
        const r = repo('verse');
        await new SaveStepEditUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', stepId: 's', markdown: 'x' });
        expect(r.updatePaper).not.toHaveBeenCalled();
    });
});

describe('un ensamble vaciado no reemplaza al documento', () => {
    it('no escribe un documento vacío', async () => {
        const r = { saveManualEdit: vi.fn().mockResolvedValue({ id: 's', kind: 'assembly', accepted: { markdown: '  ' } }), updatePaper: vi.fn(), setPhase: vi.fn() };
        await new SaveStepEditUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', stepId: 's', markdown: '  ' });
        expect(r.updatePaper).not.toHaveBeenCalled();
    });
});
