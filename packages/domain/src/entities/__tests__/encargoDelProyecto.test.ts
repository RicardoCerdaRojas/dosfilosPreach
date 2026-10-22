import { describe, it, expect } from 'vitest';
import {
    cleanProjectCourseInfo,
    cleanProjectWorkTypes,
    defaultWorkTypeId,
    hasProjectCharge,
    LEGACY_WORK_TYPE_ID,
    projectWorkTypes,
    resolveProjectCharge,
    workTypeFromProfile,
} from '../AIProject';

/**
 * ADR-046, etapa 1b: un curso tiene datos comunes (nombre, guía) y varios
 * tipos de trabajo (TP semanal, paper final), cada uno con su rúbrica.
 */
describe('los tipos de trabajo del proyecto', () => {
    const perfil = { id: 'tp', displayName: ' TP Semanal ', course: 'Griego NT', rubricTemplateId: 'r1', briefTemplateId: null, styleGuideId: 'g1', exegeticalStrategy: 'free' as const, cover: { institution: 'TMS' } };
    const tp = { id: 'tp1', label: 'TP Semanal', rubricTemplateId: 'r-tp', styleGuideId: null, exegeticalStrategy: 'dialectical' as const, cover: { assignmentTitle: 'Trabajo práctico' } };
    const paper = { id: 'pf', label: 'Paper final', rubricTemplateId: 'r-paper', styleGuideId: 'g-paper' };
    const curso = { course: 'NT785', styleGuideId: 'g-curso' };

    it('se copia de un perfil de trabajo, con su nombre y su rastro', () => {
        expect(workTypeFromProfile(perfil as never, 'x')).toEqual({
            id: 'x', label: 'TP Semanal', workProfileId: 'tp', rubricTemplateId: 'r1', briefTemplateId: null,
            styleGuideId: 'g1', exegeticalStrategy: 'free', cover: { institution: 'TMS' },
        });
    });

    it('un perfil viejo sin plantilla de rúbrica no impone «la del sistema»', () => {
        expect(workTypeFromProfile({ ...perfil, rubricTemplateId: null } as never, 'x')).not.toHaveProperty('rubricTemplateId');
    });

    it('el estudio hereda el curso y su tipo; la guía del tipo gana sobre la del curso', () => {
        const p = { courseInfo: curso, workTypes: [tp, paper] };
        expect(resolveProjectCharge(p, 'pf')).toEqual({ course: 'NT785', rubricTemplateId: 'r-paper', styleGuideId: 'g-paper' });
        // El TP no tiene guía propia: usa la del curso.
        expect(resolveProjectCharge(p, 'tp1')).toMatchObject({ rubricTemplateId: 'r-tp', styleGuideId: 'g-curso', exegeticalStrategy: 'dialectical' });
        expect(resolveProjectCharge(p, 'tp1')).not.toHaveProperty('id');
    });

    it('sin tipo elegido, solo los datos del curso', () => {
        expect(resolveProjectCharge({ courseInfo: curso, workTypes: [tp, paper] }, null)).toEqual({ course: 'NT785', styleGuideId: 'g-curso' });
        expect(resolveProjectCharge({ courseInfo: null, workTypes: [] }, null)).toBeNull();
        // El nombre del curso solo no se hereda en nada (revisión de la etapa 1b).
        expect(resolveProjectCharge({ courseInfo: { course: 'NT785' }, workTypes: [tp] }, null)).toBeNull();
        // Un tipo elegido siempre hereda, aunque esté vacío.
        expect(resolveProjectCharge({ workTypes: [{ id: 'e', label: 'Ensayo' }] }, 'e')).toEqual({});
        expect(resolveProjectCharge({ courseInfo: curso, workTypes: [tp] }, 'borrado')).toEqual({ course: 'NT785', styleGuideId: 'g-curso' });
    });

    it('el tipo se elige solo cuando hay uno; con dos decide quien crea', () => {
        expect(defaultWorkTypeId({ workTypes: [tp] })).toBe('tp1');
        expect(defaultWorkTypeId({ workTypes: [tp, paper] })).toBeNull();
        expect(defaultWorkTypeId({ workTypes: [] })).toBeNull();
    });

    it('hay algo que heredar con datos del curso o con algún tipo', () => {
        expect(hasProjectCharge({ courseInfo: { styleGuideId: 'g' } })).toBe(true);
        expect(hasProjectCharge({ workTypes: [paper] })).toBe(true);
        expect(hasProjectCharge({ courseInfo: { course: '  ' }, workTypes: [] })).toBe(false);
        expect(hasProjectCharge({})).toBe(false);
    });

    it('el encargo de la etapa 1 se lee como datos del curso y un tipo', () => {
        const viejo = { charge: { course: 'Griego NT', rubricTemplateId: 'r1', styleGuideId: 'g1' } };
        expect(projectWorkTypes(viejo)).toEqual([{ id: LEGACY_WORK_TYPE_ID, label: 'Griego NT', rubricTemplateId: 'r1', styleGuideId: 'g1' }]);
        expect(resolveProjectCharge(viejo, defaultWorkTypeId(viejo))).toEqual({ course: 'Griego NT', rubricTemplateId: 'r1', styleGuideId: 'g1' });
        // Guardar los tipos nuevos reemplaza la lectura del viejo.
        expect(projectWorkTypes({ ...viejo, workTypes: [] })).toEqual([]);
    });

    it('se guardan sin undefined, sin nombre vacío y sin ids repetidos', () => {
        expect(cleanProjectWorkTypes([
            { ...tp, briefTemplateId: undefined, label: ' TP ' },
            { ...paper, label: '   ' },
            { ...tp, label: 'Otro con el mismo id' },
        ])).toEqual([{ ...tp, label: 'TP' }]);
        expect(cleanProjectCourseInfo({ course: '  ', styleGuideId: undefined })).toEqual({ course: null });
    });
});
