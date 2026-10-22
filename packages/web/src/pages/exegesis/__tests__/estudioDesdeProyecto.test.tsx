import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * ADR-046, etapa 1: un estudio nace dentro de su proyecto y hereda el
 * encargo del curso. No se sugiere el último proyecto usado (decisión del
 * fundador, 2026-10-22): solo viene puesto si se llegó desde el proyecto.
 */
const createPaper = vi.fn().mockResolvedValue({ id: 'nuevo' });
const curso = {
    id: 'teo2', title: 'Teología II – Cristología', userId: 'u1',
    charge: { rubricTemplateId: 'rub-tms', briefTemplateId: null, styleGuideId: 'guia-tms', exegeticalStrategy: 'free', cover: { institution: 'TMS', date: 'SEPTIEMBRE 2026' }, course: 'Teología II' },
};
let perfiles: unknown[] = [];

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
let proyectos: unknown[] = [];
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: proyectos }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: perfiles, defaultProfile: perfiles[0] ?? null }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ createPaper: { isPending: false, mutateAsync: createPaper } }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [], defaultBrief: null }) }));
vi.mock('@/components/exegesis/PassagePicker', () => ({
    PassagePicker: ({ onChange }: { onChange: (r: unknown, e: unknown) => void }) => {
        useEffect(() => onChange({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 }, null), []);
        return <div>pasaje</div>;
    },
}));
vi.mock('@/components/exegesis/setup/RubricTemplatePicker', () => ({ RubricTemplatePicker: () => <div>rúbrica</div> }));
vi.mock('@/components/exegesis/setup/AssignmentBriefPicker', () => ({ AssignmentBriefPicker: () => <div>consigna</div> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { ExegesisCreatePage } = await import('../ExegesisCreatePage');

beforeEach(() => { cleanup(); vi.clearAllMocks(); perfiles = []; proyectos = [curso, { id: 'otro', title: 'Otro', userId: 'u1' }]; });
const crear = () => fireEvent.click(screen.getByText('create.submit'));

describe('crear un estudio desde un proyecto', () => {
    it('llegando desde el curso, nace en él con su encargo y su portada en la misma creación', async () => {
        render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
        expect((screen.getByLabelText('create.project.label') as HTMLSelectElement).value).toBe('teo2');
        expect(screen.getByText('create.project.chargeApplied')).toBeInTheDocument();
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        const input = createPaper.mock.calls[0]![0];
        expect(input).toMatchObject({ projectId: 'teo2', styleGuideId: 'guia-tms', rubricTemplateId: 'rub-tms', exegeticalStrategy: 'free' });
        expect(input.cover).toMatchObject({ institution: 'TMS' });
    });

    it('el encargo del curso gana sobre el perfil por defecto', async () => {
        perfiles = [{ id: 'perfil', displayName: 'Otro curso', rubricTemplateId: 'rub-otro', briefTemplateId: null, styleGuideId: 'guia-otra', exegeticalStrategy: 'dialectical', isDefault: true }];
        render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0]).toMatchObject({ styleGuideId: 'guia-tms', rubricTemplateId: 'rub-tms' });
    });

    it('sin venir de un proyecto, no se sugiere ninguno: nace suelto', async () => {
        render(<MemoryRouter initialEntries={['/dashboard/exegesis/new']}><ExegesisCreatePage /></MemoryRouter>);
        expect((screen.getByLabelText('create.project.label') as HTMLSelectElement).value).toBe('');
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0]).not.toHaveProperty('projectId');
    });

    it('si el perfil por defecto carga antes que los proyectos, no pisa el encargo del curso', async () => {
        perfiles = [{ id: 'perfil', displayName: 'Otro curso', rubricTemplateId: 'rub-otro', briefTemplateId: null, styleGuideId: 'guia-otra', exegeticalStrategy: 'dialectical', isDefault: true }];
        proyectos = [];
        const ui = (k: string) => <MemoryRouter key={k} initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>;
        const { rerender } = render(ui('a'));
        proyectos = [curso];
        rerender(ui('a'));
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0]).toMatchObject({ projectId: 'teo2', styleGuideId: 'guia-tms', rubricTemplateId: 'rub-tms' });
    });

    it('elegir un perfil a mano reemplaza también la guía del proyecto (revisión de la etapa 1)', async () => {
        perfiles = [{ id: 'perfil', displayName: 'Griego NT', rubricTemplateId: 'rub-griego', briefTemplateId: null, styleGuideId: 'guia-griego', exegeticalStrategy: 'dialectical', isDefault: false }];
        render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('paperSetup.workProfile.pickLabel'), { target: { value: 'perfil' } });
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0]).toMatchObject({ styleGuideId: 'guia-griego', rubricTemplateId: 'rub-griego' });
    });

    it('dejar el proyecto deshace su encargo: ni su rúbrica ni su portada', async () => {
        render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('create.project.label'), { target: { value: '' } });
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        const input = createPaper.mock.calls[0]![0];
        expect(input).not.toHaveProperty('projectId');
        expect(input).not.toHaveProperty('cover');
        expect(input.rubricTemplateId).toBeUndefined();
        expect(input.styleGuideId).toBeNull();
    });

    it('«la rúbrica del sistema» del encargo se respeta (no cae en la plantilla por defecto)', async () => {
        proyectos = [{ ...curso, charge: { ...curso.charge, rubricTemplateId: null } }];
        render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0].rubricTemplateId).toBeNull();
    });

    it('un proyecto de la URL que no está activo no se manda', async () => {
        render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=archivado']}><ExegesisCreatePage /></MemoryRouter>);
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0]).not.toHaveProperty('projectId');
    });
});
