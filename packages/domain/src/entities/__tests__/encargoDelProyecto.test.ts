import { describe, it, expect } from 'vitest';
import { chargeFromWorkProfile, cleanProjectCharge, hasProjectCharge } from '../AIProject';

/** ADR-046, etapa 1: el encargo del curso vive en el proyecto. */
describe('el encargo del proyecto', () => {
    const perfil = { id: 'tp', course: ' Griego NT ', rubricTemplateId: 'r1', briefTemplateId: null, styleGuideId: 'g1', exegeticalStrategy: 'free' as const, cover: { institution: 'TMS' } };

    it('se copia de un perfil de trabajo, con su rastro', () => {
        expect(chargeFromWorkProfile(perfil as never)).toEqual({
            workProfileId: 'tp', course: 'Griego NT', rubricTemplateId: 'r1', briefTemplateId: null,
            styleGuideId: 'g1', exegeticalStrategy: 'free', cover: { institution: 'TMS' },
        });
    });

    it('hay encargo si trae algo que heredar', () => {
        expect(hasProjectCharge({ charge: { styleGuideId: 'g1' } })).toBe(true);
        expect(hasProjectCharge({ charge: { course: '  ' } })).toBe(false);
        expect(hasProjectCharge({ charge: null })).toBe(false);
        expect(hasProjectCharge({})).toBe(false);
    });

    it('se guarda sin undefined ni texto vacío (Firestore los rechaza anidados)', () => {
        expect(cleanProjectCharge({ course: '  ', rubricTemplateId: undefined, styleGuideId: 'g1', exegeticalStrategy: 'dialectical' }))
            .toEqual({ course: null, styleGuideId: 'g1', exegeticalStrategy: 'dialectical' });
    });

    it('un perfil viejo sin plantilla de rúbrica no impone «la del sistema»', () => {
        expect(chargeFromWorkProfile({ ...perfil, rubricTemplateId: null } as never)).not.toHaveProperty('rubricTemplateId');
    });
});
