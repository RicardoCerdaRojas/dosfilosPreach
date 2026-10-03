import { describe, it, expect, vi } from 'vitest';
import { rubricPreset } from '@dosfilos/domain';
import { CreateExegeticalPaperUseCase } from '../CreateExegeticalPaperUseCase';

/**
 * Jonás 4:5-11 nació con la rúbrica ACADÉMICA —doce páginas, notas al pie—
 * aunque es el estudio de un sermón de la serie.
 */
function montar(opts: { defaultTemplate?: boolean } = {}) {
    const rubricas: unknown[] = [];
    const repo = {
        createPaper: vi.fn(async () => ({ id: 'p1' })),
        setRubric: vi.fn(async (_o: string, _p: string, r: unknown) => { rubricas.push(r); return { id: 'p1', rubric: r }; }),
    };
    const plantillas = {
        getRubric: vi.fn(async (_o: string, id: string) => ({ id, rubric: { provenance: 'system-default', sourceRequirements: [{}], structuralExpectations: [] } })),
        getDefaultRubric: vi.fn(async () => (opts.defaultTemplate ? { id: 'curso', rubric: { provenance: 'system-default', sourceRequirements: [{}], structuralExpectations: [] } } : null)),
    };
    return { uc: new CreateExegeticalPaperUseCase(repo as never, plantillas as never), rubricas, plantillas };
}
const base = { ownerId: 'u', passage: { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 11 }, displayLanguage: 'es' as const, styleGuideId: null };

describe('un trabajo de una serie nace como estudio para predicar', () => {
    it('sin plantilla: la rúbrica de predicación', async () => {
        const { uc, rubricas } = montar();
        await uc.execute({ ...base, seriesId: 's1', pericopeId: 'p6' } as never);
        expect(rubricPreset(rubricas[0] as never)).toBe('preaching');
    });

    it('gana a la plantilla por defecto del usuario, que suele ser la de su curso', async () => {
        const { uc, rubricas, plantillas } = montar({ defaultTemplate: true });
        await uc.execute({ ...base, seriesId: 's1', pericopeId: 'p6' } as never);
        expect(rubricPreset(rubricas[0] as never)).toBe('preaching');
        expect(plantillas.getDefaultRubric).not.toHaveBeenCalled();
    });

    it('una plantilla elegida para la serie sí manda', async () => {
        const { uc, rubricas } = montar();
        await uc.execute({ ...base, seriesId: 's1', pericopeId: 'p6', rubricTemplateId: 'serie' } as never);
        expect((rubricas[0] as { sourceTemplateId: string }).sourceTemplateId).toBe('serie');
    });

    it('un trabajo suelto sigue como antes: la plantilla por defecto', async () => {
        const { uc, rubricas } = montar({ defaultTemplate: true });
        await uc.execute(base as never);
        expect((rubricas[0] as { sourceTemplateId: string }).sourceTemplateId).toBe('curso');
    });
});
