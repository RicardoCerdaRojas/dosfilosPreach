import { describe, it, expect, vi } from 'vitest';

vi.mock('@dosfilos/application', () => ({ seriesService: {}, exegesisService: {} }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const { exegesisDefaultsToSave, rubricIdFromOption } = await import('../exegesisDefaultsToSave');

/** Revisión adversarial de C1: volver a la rúbrica del sistema no borraba la plantilla. */
describe('rúbrica de la serie', () => {
    it('«sistema» se guarda como null, que el merge sí escribe', () => {
        const next = exegesisDefaultsToSave({ rubricId: rubricIdFromOption('__auto'), styleGuideId: undefined, sourceRefs: [] });
        expect(next).toHaveProperty('rubricTemplateId', null);
    });
    it('una plantilla se guarda con su id', () => {
        expect(exegesisDefaultsToSave({ rubricId: rubricIdFromOption('tpl-1'), styleGuideId: undefined, sourceRefs: [] }).rubricTemplateId).toBe('tpl-1');
    });
});
