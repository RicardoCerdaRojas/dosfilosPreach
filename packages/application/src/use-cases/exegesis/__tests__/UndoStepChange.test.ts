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

const montar = (step: ExegeticalStep, after: ExegeticalStep, assembledMarkdown: string | null = ENSAMBLE, assignmentBrief: string | null = null) => {
    const repo = {
        getPaper: vi.fn().mockResolvedValue({ id: 'p', displayLanguage: 'es', assembledMarkdown, assignmentBrief, passage: REF, steps: [step] }),
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
        const r = await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: { kind: 'prose', versionId: 'v1' } });
        expect(repo.swapStepVersionProse).toHaveBeenCalledWith('o', 'p', 's', 'v1');
        expect(repo.moveToStepVersion).not.toHaveBeenCalled();
        const escrito = repo.updatePaper.mock.calls[0]![2].assembledMarkdown as string;
        expect(escrito).toContain('Prosa original.');
        expect(escrito).not.toContain('Prosa recompuesta.');
        expect(escrito).toContain('Intro.');
        expect(r.documentBehind).toBe(false);
    });

    const conclusion = () => {
        const v1 = { id: 'v1', markdown: 'Antes.', parentVersionId: null };
        const v2 = { id: 'v2', markdown: 'Después.', parentVersionId: 'v1' };
        return { id: 's', kind: 'conclusion', verseRef: null, state: 'awaiting-review', order: 5, versions: [v1, v2], current: v2, accepted: v1 } as unknown as ExegeticalStep;
    };

    it('la conclusión regenerada vuelve a su versión anterior; no toca el documento', async () => {
        const step = conclusion();
        const { useCase, repo } = montar(step, { ...step, current: step.accepted, state: 'accepted' } as never);
        const r = await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: { kind: 'version', versionId: 'v2', targetVersionId: 'v1' } });
        expect(repo.moveToStepVersion).toHaveBeenCalledWith('o', 'p', 's', 'v1');
        expect(repo.updatePaper).not.toHaveBeenCalled();
        expect(r.documentBehind).toBe(false);
    });

    it('si la versión a la vista ya no es la de la pantalla, no hace nada', async () => {
        const step = conclusion();
        const { useCase, repo } = montar(step, step);
        await expect(useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: { kind: 'version', versionId: 'otra', targetVersionId: 'v1' } })).rejects.toThrow(STEP_HISTORY_STALE);
        expect(repo.moveToStepVersion).not.toHaveBeenCalled();
    });

    it('si el destino ya no es el que la pantalla ofrecía, no hace nada', async () => {
        const step = conclusion();
        const { useCase, repo } = montar(step, step);
        await expect(useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: { kind: 'version', versionId: 'v2', targetVersionId: 'otra' } })).rejects.toThrow(STEP_HISTORY_STALE);
        expect(repo.moveToStepVersion).not.toHaveBeenCalled();
    });

    it('sin nada que deshacer, no hace nada', async () => {
        const v = { id: 'v1', markdown: 'x', parentVersionId: null };
        const step = { id: 's', kind: 'conclusion', state: 'accepted', versions: [v], current: v, accepted: v } as unknown as ExegeticalStep;
        const { useCase, repo } = montar(step, step);
        await expect(useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: { kind: 'prose', versionId: 'v1' } })).rejects.toThrow(/nada que deshacer/);
        expect(repo.swapStepVersionProse).not.toHaveBeenCalled();
    });

    it('la versión es la misma pero el movimiento ya es otro: la pantalla estaba vieja', async () => {
        // El segundo clic de Deshacer, con los datos sin recargar.
        const v0 = { id: 'v0', markdown: 'Primera.', parentVersionId: null };
        const v1 = { id: 'v1', markdown: 'Original.', canonicalAnalysis: analisis, parentVersionId: 'v0', previousProse: { markdown: 'Recompuesta.', undone: true } };
        const step = { id: 's', kind: 'verse', verseRef: REF, state: 'accepted', versions: [v0, v1], current: v1, accepted: v1 } as unknown as ExegeticalStep;
        const { useCase, repo } = montar(step, step);
        await expect(useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: { kind: 'prose', versionId: 'v1' } })).rejects.toThrow(STEP_HISTORY_STALE);
        expect(repo.moveToStepVersion).not.toHaveBeenCalled();
    });

    describe('un versículo que responde dos preguntas', () => {
        const BRIEF = '1. ¿Qué significa la vara en Salmo 23:4?\n2. ¿Por qué el salmista habla del valle en Salmo 23:4?';
        const PREGUNTA_1 = '¿Qué significa la vara en Salmo 23:4?';
        const PREGUNTA_2 = '¿Por qué el salmista habla del valle en Salmo 23:4?';
        const conProsa = (markdown: string, guardada: string) => {
            const v = { id: 'v1', markdown, canonicalAnalysis: analisis, parentVersionId: null, previousProse: { markdown: guardada } };
            return { id: 's', kind: 'verse', verseRef: REF, state: 'accepted', order: 1, versions: [v], current: v, accepted: v } as unknown as ExegeticalStep;
        };
        const conDeshecha = (step: ExegeticalStep, markdown: string) => {
            const v = { ...step.accepted!, markdown };
            return { ...step, versions: [v], current: v, accepted: v } as never;
        };
        const NUEVA = `## ${PREGUNTA_1}\n\nRespuesta nueva uno.\n\n## ${PREGUNTA_2}\n\nRespuesta nueva dos.`;
        const prosa = { kind: 'prose', versionId: 'v1' } as const;

        it('una prosa sin los títulos de sus preguntas no se los lleva del documento', async () => {
            const step = conProsa(NUEVA, 'Original sin títulos.');
            const { useCase, repo } = montar(step, conDeshecha(step, 'Original sin títulos.'), `# T\n\n${NUEVA}\n`, BRIEF);
            const r = await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: prosa });
            expect(repo.updatePaper).not.toHaveBeenCalled();
            expect(r.documentBehind).toBe(true);
        });

        it('la prosa restaurada entra con los títulos exactos de sus preguntas', async () => {
            const vieja = '## Sobre la vara\n\nRespuesta vieja uno.\n\n## Sobre el valle\n\nRespuesta vieja dos.';
            const step = conProsa(NUEVA, vieja);
            const { useCase, repo } = montar(step, conDeshecha(step, vieja), `# T\n\n${NUEVA}\n`, BRIEF);
            const r = await useCase.execute({ ownerId: 'o', paperId: 'p', stepId: 's', action: 'undo', expected: prosa });
            const escrito = repo.updatePaper.mock.calls[0]![2].assembledMarkdown as string;
            expect(escrito).toContain(`## ${PREGUNTA_1}`);
            expect(escrito).toContain(`## ${PREGUNTA_2}`);
            expect(escrito).toContain('Respuesta vieja dos.');
            expect(escrito).not.toContain('Sobre el valle');
            expect(r.documentBehind).toBe(false);
        });
    });
});
