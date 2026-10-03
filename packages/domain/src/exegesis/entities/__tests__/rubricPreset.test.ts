import { describe, it, expect } from 'vitest';
import { buildDefaultRubric, buildStrategyOnlyRubric, rubricPreset } from '../PaperRubric';
import { buildPreachingStudyRubric } from '../preachingStudyRubric';

/** Las dos rúbricas del sistema decían «Default del sistema» y no se distinguían. */
describe('rubricPreset', () => {
    it('cada rúbrica del sistema dice cuál es', () => {
        expect(rubricPreset(buildDefaultRubric())).toBe('academic');
        expect(rubricPreset(buildPreachingStudyRubric())).toBe('preaching');
        expect(rubricPreset(buildStrategyOnlyRubric())).toBe('strategy-only');
    });

    it('sobrevive a la edición: una de predicación editada sigue siendo de predicación', () => {
        expect(rubricPreset({ ...buildPreachingStudyRubric(), provenance: 'user-edited' })).toBe('preaching');
    });

    it('documentos anteriores al campo: se deduce del ancla mientras sea del sistema', () => {
        const { preset: _p, ...vieja } = buildPreachingStudyRubric();
        expect(rubricPreset(vieja as never)).toBe('preaching');
        const { preset: _q, ...academicaVieja } = buildDefaultRubric();
        expect(rubricPreset(academicaVieja as never)).toBe('academic');
        expect(rubricPreset({ ...vieja, provenance: 'extracted-from-document' } as never)).toBeNull();
    });

    it('la de predicación trae sus propias justificaciones, no las de la académica', () => {
        const verso = buildPreachingStudyRubric().structuralExpectations.find(e => e.section === 'verse')!;
        expect(verso.justificationKey).toBe('paperSetup.subSteps.plan.rubricJustificationPreaching.verse');
    });
});

describe('rubricPreset — plantillas del usuario (revisión adversarial de C1)', () => {
    it('una rúbrica sacada de una plantilla no hereda «preaching»', () => {
        const base = buildPreachingStudyRubric();
        expect(rubricPreset(base)).toBe('preaching');
        expect(rubricPreset({ ...base, provenance: 'from-template' })).toBeNull();
    });
});
