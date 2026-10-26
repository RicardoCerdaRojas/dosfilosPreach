import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

/**
 * ADR-046, etapa 1b: un curso tiene datos comunes y varios tipos de trabajo,
 * cada uno copiado de un perfil o armado a mano.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.label ? `${k}:${o.label}` : k) }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [
    { id: 'tp', displayName: 'TP Semanal', course: 'Griego NT', rubricTemplateId: 'r1', briefTemplateId: 'b1', styleGuideId: 'g1', exegeticalStrategy: 'dialectical', cover: { institution: 'TMS' } },
    { id: 'pf', displayName: 'Paper final', rubricTemplateId: 'r2', briefTemplateId: null, styleGuideId: null, exegeticalStrategy: 'free' },
] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [{ id: 'r1', displayName: 'TP Semanal Griego NT' }, { id: 'r2', displayName: 'Paper' }] }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [{ id: 'b1', displayName: 'TP' }] }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({ useUserStyleGuides: () => ({ guides: [{ id: 'g1', displayName: 'Guía TMS' }] }) }));
const { ProjectWorkTypesCard, withRubric } = await import('../ProjectWorkTypesCard');
const { ProjectCourseCard } = await import('../ProjectCourseCard');
const { ProjectSetupCards } = await import('../ProjectSetupCards');

const curso = { id: 'p', userId: 'u', title: 'NT785', color: 'amber', type: 'course' };
beforeEach(cleanup);

describe('ProjectWorkTypesCard', () => {
    it('dos perfiles distintos son dos tipos de trabajo del mismo curso', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<ProjectWorkTypesCard project={curso as never} onSave={onSave} saving={false} />);
        const agregar = screen.getByLabelText('workTypes.addFromProfile');
        fireEvent.change(agregar, { target: { value: 'tp' } });
        fireEvent.change(agregar, { target: { value: 'pf' } });
        fireEvent.click(screen.getByText('workTypes.save'));
        const tipos = onSave.mock.calls[0]![0];
        expect(tipos.map((x: { label: string }) => x.label)).toEqual(['TP Semanal', 'Paper final']);
        expect(tipos[0]).toMatchObject({ workProfileId: 'tp', rubricTemplateId: 'r1', styleGuideId: 'g1', cover: { institution: 'TMS' } });
        expect(tipos[1]).toMatchObject({ workProfileId: 'pf', rubricTemplateId: 'r2', exegeticalStrategy: 'free' });
        expect(new Set(tipos.map((x: { id: string }) => x.id)).size).toBe(2);
    });

    it('uno a mano se nombra y su rúbrica tiene tres estados', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<ProjectWorkTypesCard project={curso as never} onSave={onSave} saving={false} />);
        fireEvent.click(screen.getByText('workTypes.addEmpty'));
        fireEvent.change(screen.getByLabelText('workTypes.label'), { target: { value: 'Ensayo' } });
        fireEvent.change(screen.getByLabelText('workTypes.rubric'), { target: { value: '__system' } });
        fireEvent.click(screen.getByText('workTypes.save'));
        const [ensayo] = onSave.mock.calls[0]![0];
        expect(ensayo).toMatchObject({ label: 'Ensayo', rubricTemplateId: null });
        expect(ensayo.exegeticalStrategy).toBeUndefined();
    });

    it('cambiar la rúbrica borra «el curso no da rúbrica» (se dijo de la anterior); elegir la misma, no', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const confirmado = { id: 'a', label: 'TP', rubricTemplateId: null, rubricConfirmed: true };
        render(<ProjectWorkTypesCard project={{ ...curso, workTypes: [confirmado] } as never} onSave={onSave} saving={false} />);
        fireEvent.click(screen.getByText('workTypes.edit'));
        fireEvent.change(screen.getByLabelText('workTypes.rubric'), { target: { value: 'r1' } });
        fireEvent.click(screen.getByText('workTypes.save'));
        const [tipo] = onSave.mock.calls[0]![0];
        expect(tipo).toEqual({ id: 'a', label: 'TP', rubricTemplateId: 'r1' });
        expect('rubricConfirmed' in tipo).toBe(false);
        expect(withRubric(confirmado as never, null)).toBe(confirmado);
    });

    it('cada tipo guarda su método (capa 3)', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<ProjectWorkTypesCard project={{ ...curso, workTypes: [{ id: 'a', label: 'TP' }] } as never} onSave={onSave} saving={false} />);
        fireEvent.click(screen.getByText('workTypes.edit'));
        fireEvent.change(screen.getByLabelText('method.label'), { target: { value: 'mixed' } });
        fireEvent.click(screen.getByText('workTypes.save'));
        expect(onSave).toHaveBeenCalledWith([{ id: 'a', label: 'TP', exegeticalMethod: 'mixed' }]);
    });

    it('sin nombre no se guarda', () => {
        const onSave = vi.fn();
        render(<ProjectWorkTypesCard project={curso as never} onSave={onSave} saving={false} />);
        fireEvent.click(screen.getByText('workTypes.addEmpty'));
        fireEvent.change(screen.getByLabelText('workTypes.label'), { target: { value: '  ' } });
        expect(screen.getByText('workTypes.save').closest('button')).toBeDisabled();
        expect(screen.getByText('workTypes.labelRequired')).toBeInTheDocument();
    });

    it('quitar un tipo lo saca de lo que se guarda', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const conDos = { ...curso, workTypes: [{ id: 'a', label: 'TP' }, { id: 'b', label: 'Paper final', rubricTemplateId: 'r2' }] };
        render(<ProjectWorkTypesCard project={conDos as never} onSave={onSave} saving={false} />);
        // El resumen muestra la rúbrica sin abrir el tipo.
        expect(screen.getByText('Paper')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('workTypes.remove:TP'));
        fireEvent.click(screen.getByText('workTypes.save'));
        expect(onSave).toHaveBeenCalledWith([{ id: 'b', label: 'Paper final', rubricTemplateId: 'r2' }]);
    });

    it('la guía vacía de un tipo dice que usa la del curso, y «ninguna» si el curso no tiene', () => {
        render(<ProjectWorkTypesCard project={{ ...curso, courseInfo: { styleGuideId: 'g1' }, workTypes: [{ id: 'a', label: 'TP' }] } as never} onSave={vi.fn()} saving={false} />);
        fireEvent.click(screen.getByText('workTypes.edit'));
        const guia = screen.getByLabelText('workTypes.styleGuide') as HTMLSelectElement;
        expect(within(guia).getByText('workTypes.styleGuideCourse')).toBeInTheDocument();
        expect(guia.value).toBe('');
        cleanup();
        render(<ProjectWorkTypesCard project={{ ...curso, workTypes: [{ id: 'a', label: 'TP' }] } as never} onSave={vi.fn()} saving={false} />);
        fireEvent.click(screen.getByText('workTypes.edit'));
        expect(within(screen.getByLabelText('workTypes.styleGuide')).queryByText('workTypes.styleGuideCourse')).toBeNull();
    });
});

describe('ProjectCourseCard', () => {
    it('el curso guarda su nombre y su guía', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<ProjectCourseCard project={curso as never} onSave={onSave} saving={false} />);
        fireEvent.change(screen.getByLabelText('course.course'), { target: { value: 'NT785 - Exégesis de Santiago' } });
        fireEvent.change(screen.getByLabelText('course.styleGuide'), { target: { value: 'g1' } });
        fireEvent.click(screen.getByText('course.save'));
        expect(onSave).toHaveBeenCalledWith({ course: 'NT785 - Exégesis de Santiago', styleGuideId: 'g1' });
    });

    it('en un proyecto que no es curso, solo la guía', () => {
        render(<ProjectCourseCard project={{ ...curso, type: 'study' } as never} onSave={vi.fn()} saving={false} />);
        expect(screen.queryByLabelText('course.course')).toBeNull();
        expect(screen.getByText('course.titleProject')).toBeInTheDocument();
    });
});

describe('ProjectSetupCards', () => {
    it('solo la tarjeta que guarda muestra que guarda (las dos usan la misma mutación)', async () => {
        let terminar!: () => void;
        const onSave = vi.fn(() => new Promise<void>(r => { terminar = r; }));
        render(<ProjectSetupCards project={{ ...curso, workTypes: [{ id: 'a', label: 'TP' }] } as never} onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('course.course'), { target: { value: 'NT785' } });
        fireEvent.click(screen.getByText('course.save'));
        expect(onSave).toHaveBeenCalledWith({ courseInfo: { course: 'NT785' } });
        expect(screen.getByText('course.save').closest('button')!.querySelector('.animate-spin')).not.toBeNull();
        expect(screen.getByText('workTypes.save').closest('button')!.querySelector('.animate-spin')).toBeNull();
        terminar();
        await waitFor(() => expect(screen.getByText('course.save').closest('button')!.querySelector('.animate-spin')).toBeNull());
    });

    it('cada tarjeta avisa si tiene cambios sin guardar', () => {
        render(<ProjectSetupCards project={{ ...curso, workTypes: [{ id: 'a', label: 'TP' }] } as never} onSave={vi.fn()} />);
        expect(screen.queryByText('unsaved')).toBeNull();
        fireEvent.change(screen.getByLabelText('course.course'), { target: { value: 'NT785' } });
        expect(screen.getAllByText('unsaved')).toHaveLength(1);
        fireEvent.click(screen.getByText('workTypes.addEmpty'));
        expect(screen.getAllByText('unsaved')).toHaveLength(2);
    });
});
