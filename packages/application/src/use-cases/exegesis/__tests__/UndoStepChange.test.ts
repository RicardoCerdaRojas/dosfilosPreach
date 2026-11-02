import { describe, expect, it, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, type ExegeticalStep } from '@dosfilos/domain';
import { STEP_HISTORY_STALE, UndoStepChangeUseCase } from '../UndoStepChangeUseCase';

/** Deshacer «Regenerar»: no cobra, y lo restaurado vuelve también al documento. */
const REF = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 4 };
const analisis = { ...buildEmptyCanonicalVerseAnalysis(REF as never), reference: REF };
const ENSAMBLE = '## Introducción\n\nIntro.\n\n### Salmo 23:4\n\nProsa recompuesta.\n\n## Conclusión\n\nFin.';

const versoRecompuesto = () => {
    const v = { id: 'v1', markdown: 'Prosa recompuesta.', canonicalAnalysis: analisis, parentVersionId: null, previousProse: { markdown: 'Prosa original.' } };
    return { id: 's', kind: 'verse', verseRef: REF, state: 'accepted', order: 1, versions: [v], current: v, accepted: v } as unknown as ExegeticalStep;
};

const montar = (step: ExegeticalStep, after: ExegeticalStep, assembledMarkdown: string | null = ENSAMBLE) => {
    const repo = {
        getPaper: vi.fn().mockResolvedValue({ id: 'p', displayLanguage: 'es', assembledMarkdown, assignmentBrief: null, passage: REF, steps: [step] }),
        swapStepVersionProse: vi.fn().mockResolvedValue(after),
        moveToStepVersion: vi.fn().mockResolvedValue(after),
        updatePaper: vi.fn().mockResolvedValue(undefined),
    };
    return { repo, useCase: new UndoStepChangeUseCase(repo as never) };
};

describe('UndoStepChangeUseCase', () => {
    it('un versículo recompuesto recupera su prosa, y esa prosa vuelve a su sección del documento', async () => {
        const step = versoRecompuesto();
        const v = { ...step.accepted!, markdown: 'Prosa original.', previousProse: { markdown: 'Prosa recompuesta.', undone: true } };
        const { useCase, repo } = montar(step, { ...step, versions: [v], current: v, accepted: v } as never);
        const r = await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', fromVersionId: 'v1' });
        expect(repo.swapStepVersionProse).toHaveBeenCalledWith('o', 'p', 's', 'v1');
        expect(repo.moveToStepVersion).not.toHaveBeenCalled();
        const escrito = repo.updatePaper.mock.calls[0]![2].assembledMarkdown as string;
        expect(escrito).toContain('Prosa original.');
        expect(escrito).not.toContain('Prosa recompuesta.');
        expect(escrito).toContain('Intro.');
        expect(r.assemblyUpdated).toBe(true);
    });

    const conclusion = () => {
        const v1 = { id: 'v1', markdown: 'Antes.', parentVersionId: null };
        const v2 = { id: 'v2', markdown: 'Después.', parentVersionId: 'v1' };
        return { id: 's', kind: 'conclusion', verseRef: null, state: 'awaiting-review', order: 5, versions: [v1, v2], current: v2, accepted: v1 } as unknown as ExegeticalStep;
    };

    it('la conclusión regenerada vuelve a su versión anterior; no toca el documento', async () => {
        const step = conclusion();
        const { useCase, repo } = montar(step, { ...step, current: step.accepted, state: 'accepted' } as never);
        const r = await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', fromVersionId: 'v2' });
        expect(repo.moveToStepVersion).toHaveBeenCalledWith('o', 'p', 's', 'v1', 'undo', true);
        expect(repo.updatePaper).not.toHaveBeenCalled();
        expect(r.assemblyUpdated).toBe(false);
    });

    it('si la versión a la vista ya no es la de la pantalla, no hace nada', async () => {
        const step = conclusion();
        const { useCase, repo } = montar(step, step);
        await expect(useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', fromVersionId: 'otra' })).rejects.toThrow(STEP_HISTORY_STALE);
        expect(repo.moveToStepVersion).not.toHaveBeenCalled();
    });

    it('sin nada que deshacer, no hace nada', async () => {
        const v = { id: 'v1', markdown: 'x', parentVersionId: null };
        const step = { id: 's', kind: 'conclusion', state: 'accepted', versions: [v], current: v, accepted: v } as unknown as ExegeticalStep;
        const { useCase, repo } = montar(step, step);
        await expect(useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', fromVersionId: 'v1' })).rejects.toThrow(/nada que deshacer/);
        expect(repo.swapStepVersionProse).not.toHaveBeenCalled();
    });

    it('una versión con citas sin revisar no vuelve como aceptada', async () => {
        const conAlarma = {
            ...analisis,
            commentatorEngagement: [{ sourceKey: 'Ross', page: 5, position: 'p', engagement: 'e' }],
        };
        const v1 = { id: 'v1', markdown: 'Antes.', parentVersionId: null, canonicalAnalysis: conAlarma, citationVerdicts: [{ offset: 0, status: 'not-found', origin: 'analysis' }] };
        const v2 = { id: 'v2', markdown: 'Después.', parentVersionId: 'v1', canonicalAnalysis: analisis };
        const step = { id: 's', kind: 'verse', verseRef: REF, state: 'accepted', versions: [v1, v2], current: v2, accepted: v2 } as unknown as ExegeticalStep;
        const { useCase, repo } = montar(step, step, null);
        await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', fromVersionId: 'v2' });
        expect(repo.moveToStepVersion).toHaveBeenCalledWith('o', 'p', 's', 'v1', 'undo', false);
    });

    it('el ensamble aceptado vuelve a ser el documento', async () => {
        const v1 = { id: 'v1', markdown: 'Documento viejo.', parentVersionId: null };
        const v2 = { id: 'v2', markdown: 'Documento nuevo.', parentVersionId: 'v1' };
        const step = { id: 's', kind: 'assembly', verseRef: null, state: 'accepted', versions: [v1, v2], current: v2, accepted: v2 } as unknown as ExegeticalStep;
        const { useCase, repo } = montar(step, { ...step, current: v1, accepted: v1 } as never);
        await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', fromVersionId: 'v2' });
        expect(repo.updatePaper).toHaveBeenCalledWith('o', 'p', { assembledMarkdown: 'Documento viejo.' });
    });
});
