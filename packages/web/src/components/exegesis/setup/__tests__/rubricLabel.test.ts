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

/** TP #7 (#4): el encabezado decía «Desde plantilla» sin decir cuál. */
describe('rubricLabel con plantilla', () => {
    const plantillas = [{ id: 'tx', displayName: 'TP Semanal Griego NT' }];
    const deLaPlantilla = { ...buildDefaultRubric(), provenance: 'from-template' as const, sourceTemplateId: 'tx' };
    it('dice el nombre de la plantilla', () => {
        expect(rubricLabel(deLaPlantilla, t, plantillas)).toBe('TP Semanal Griego NT');
    });
    it('editada después de aplicarla, también', () => {
        expect(rubricLabel({ ...deLaPlantilla, provenance: 'user-edited' }, t, plantillas)).toContain('TP Semanal Griego NT');
    });
    it('si la plantilla ya no existe, el rótulo de siempre', () => {
        expect(rubricLabel(deLaPlantilla, t, [])).toBe('paperSetup.subSteps.rubric.provenance.from-template');
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
