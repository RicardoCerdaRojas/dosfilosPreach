import { describe, it, expect } from 'vitest';
import { buildDefaultRubric, buildPreachingStudyRubric } from '@dosfilos/domain';
import { expectationJustification, rubricLabel } from '../rubricLabel';

const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}(${JSON.stringify(opts)})` : key);

describe('rubricLabel', () => {
    it('la de predicación se nombra como tal, no como «Default del sistema»', () => {
        expect(rubricLabel(buildPreachingStudyRubric(), t)).toContain('paperSetup.subSteps.rubric.preset.preaching');
    });
    it('editada, lo dice', () => {
        expect(rubricLabel({ ...buildPreachingStudyRubric(), provenance: 'user-edited' }, t)).toContain('presetEdited');
    });
});

describe('expectationJustification', () => {
    it('la de predicación no toma la justificación de la académica', () => {
        const r = buildPreachingStudyRubric();
        const verso = r.structuralExpectations.find(e => e.section === 'verse')!;
        expect(expectationJustification(r, 'verse', verso, t)).toBe('paperSetup.subSteps.plan.rubricJustificationPreaching.verse');
        const sinClave = { ...verso, justificationKey: undefined };
        expect(expectationJustification(r, 'verse', sinClave, t)).toBe(verso.justification);
    });
    it('la académica vieja sigue con su respaldo localizado', () => {
        const r = buildDefaultRubric();
        const verso = { ...r.structuralExpectations.find(e => e.section === 'verse')!, justificationKey: undefined };
        expect(expectationJustification(r, 'verse', verso, t)).toBe('paperSetup.subSteps.plan.rubricJustification.verse');
    });
});
