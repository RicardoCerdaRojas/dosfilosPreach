import { describe, expect, it, vi } from 'vitest';
import { ResetRubricUseCase } from '../ResetRubricUseCase';
import type { IExegeticalPaperRepository } from '@dosfilos/domain';

/**
 * Los seis sermones de la serie de Jonás corrían con la rúbrica académica
 * —doce páginas, comentarios críticos como ancla, notas al pie— porque era la
 * única que el sistema sabía aplicar.
 */
const repo = () => {
    const setRubric = vi.fn(async (_o: string, _p: string, r: unknown) => r as never);
    return { repo: { setRubric } as unknown as IExegeticalPaperRepository, setRubric };
};

describe('ResetRubricUseCase — las dos rúbricas del sistema', () => {
    it('sin preajuste aplica la académica, como hacía cuando era la única', async () => {
        const { repo: r, setRubric } = repo();
        await new ResetRubricUseCase(r).execute({ ownerId: 'o', paperId: 'p' });
        const aplicada = setRubric.mock.calls[0]![2] as { expectedLength: { min: number } };
        expect(aplicada.expectedLength.min).toBeGreaterThan(5);
    });

    it('«preaching» aplica la de predicación', async () => {
        const { repo: r, setRubric } = repo();
        await new ResetRubricUseCase(r).execute({ ownerId: 'o', paperId: 'p', preset: 'preaching' });
        const a = setRubric.mock.calls[0]![2] as {
            expectedLength: { min: number; max: number };
            formatting: { citationForm: string };
            structuralExpectations: Array<{ section: string; emphasizedTypes: string[] }>;
        };
        expect(a.expectedLength).toEqual({ unit: 'pages', min: 3, max: 5 });
        expect(a.formatting.citationForm).toBe('parenthetical');
        // El cambio de fondo: el expositivo ancla el versículo.
        const verso = a.structuralExpectations.find(e => e.section === 'verse')!;
        expect(verso.emphasizedTypes[0]).toBe('commentary-expository');
    });

    it('cada aplicación lleva su propia fecha, no el centinela de la plantilla', async () => {
        const { repo: r, setRubric } = repo();
        await new ResetRubricUseCase(r).execute({ ownerId: 'o', paperId: 'p', preset: 'preaching' });
        const a = setRubric.mock.calls[0]![2] as { createdAt: Date };
        expect(a.createdAt.getTime()).toBeGreaterThan(0);
    });

    it('exige dueño y trabajo', async () => {
        const { repo: r } = repo();
        await expect(new ResetRubricUseCase(r).execute({ ownerId: '', paperId: 'p' })).rejects.toThrow();
        await expect(new ResetRubricUseCase(r).execute({ ownerId: 'o', paperId: '' })).rejects.toThrow();
    });
});
