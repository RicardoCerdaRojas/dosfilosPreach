import { describe, it, expect } from 'vitest';
import { paperIsDelivered } from '../paperDelivery';
import { buildDefaultRubric } from '../../entities/PaperRubric';
import { buildPreachingStudyRubric } from '../../entities/preachingStudyRubric';

describe('paperIsDelivered', () => {
    it('un estudio para predicar no se entrega', () => {
        expect(paperIsDelivered({ rubric: buildPreachingStudyRubric() })).toBe(false);
        expect(paperIsDelivered({ rubric: { ...buildPreachingStudyRubric(), provenance: 'user-edited' } })).toBe(false);
    });
    it('un trabajo académico, de plantilla o sin rúbrica sí', () => {
        expect(paperIsDelivered({ rubric: buildDefaultRubric() })).toBe(true);
        expect(paperIsDelivered({ rubric: { ...buildDefaultRubric(), preset: null, provenance: 'from-template' } })).toBe(true);
        expect(paperIsDelivered({ rubric: null })).toBe(true);
    });
});
