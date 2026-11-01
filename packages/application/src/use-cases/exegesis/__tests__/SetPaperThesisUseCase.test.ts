import { describe, it, expect, vi } from 'vitest';
import type { ExegeticalPaper, IExegeticalPaperRepository, PaperThesis } from '@dosfilos/domain';
import { approvedThesisOf } from '@dosfilos/domain';
import { SetPaperThesisUseCase } from '../SetPaperThesisUseCase';

/** Etapa 3.2: solo una tesis aprobada con ESE texto llega a los compositores. */
function repo(thesis: PaperThesis | null) {
    let paper = { id: 'p', thesis } as unknown as ExegeticalPaper;
    const r = {
        getPaper: vi.fn(async () => paper),
        updatePaper: vi.fn(async (_o: string, _p: string, patch: Partial<ExegeticalPaper>) => { paper = { ...paper, ...patch }; return paper; }),
    };
    return { r: r as unknown as IExegeticalPaperRepository, actual: () => paper };
}
const AYER = new Date('2026-10-30');

describe('SetPaperThesisUseCase', () => {
    it('aprobar guarda la tesis con fecha; desde ahí la leen los compositores', async () => {
        const { r, actual } = repo(null);
        await new SetPaperThesisUseCase(r).execute({ ownerId: 'o', paperId: 'p', text: '  La tesis.  ', approve: true });
        expect(actual().thesis).toMatchObject({ text: 'La tesis.', origin: 'student' });
        expect(actual().thesis!.approvedAt).toBeInstanceOf(Date);
        expect(approvedThesisOf(actual())).toBe('La tesis.');
    });

    it('cambiar el texto de una tesis aprobada sin volver a aprobar la vuelve borrador', async () => {
        const { r, actual } = repo({ text: 'Vieja.', origin: 'student', approvedAt: AYER, updatedAt: AYER });
        await new SetPaperThesisUseCase(r).execute({ ownerId: 'o', paperId: 'p', text: 'Nueva.', approve: false });
        expect(actual().thesis!.approvedAt).toBeNull();
        expect(approvedThesisOf(actual())).toBeNull();
    });

    it('guardar el mismo texto conserva la aprobación', async () => {
        const { r, actual } = repo({ text: 'La misma.', origin: 'student', approvedAt: AYER, updatedAt: AYER });
        await new SetPaperThesisUseCase(r).execute({ ownerId: 'o', paperId: 'p', text: 'La misma.', approve: false });
        expect(actual().thesis!.approvedAt).toEqual(AYER);
    });

    it('una propuesta retocada queda como «edited»; vacía, se quita', async () => {
        const { r, actual } = repo({ text: 'Propuesta.', origin: 'proposed', approvedAt: null, updatedAt: AYER });
        await new SetPaperThesisUseCase(r).execute({ ownerId: 'o', paperId: 'p', text: 'Propuesta retocada.', approve: true });
        expect(actual().thesis!.origin).toBe('edited');
        await new SetPaperThesisUseCase(r).execute({ ownerId: 'o', paperId: 'p', text: '   ', approve: false });
        expect(actual().thesis).toBeNull();
    });
});
