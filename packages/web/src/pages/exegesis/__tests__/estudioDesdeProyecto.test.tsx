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
const tp = { id: 'tp', label: 'TP Semanal', rubricTemplateId: 'rub-tms', briefTemplateId: null, styleGuideId: 'guia-tms', exegeticalStrategy: 'free', cover: { institution: 'TMS', date: 'SEPTIEMBRE 2026' } };
const curso = {
    id: 'teo2', title: 'Teología II – Cristología', userId: 'u1',
    courseInfo: { course: 'Teología II' }, workTypes: [tp],
};
let perfiles: unknown[] = [];

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
let proyectos: unknown[] = [];
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: proyectos }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: perfiles, defaultProfile: perfiles[0] ?? null }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ createPaper: { isPending: false, mutateAsync: createPaper } }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
let encuadres: unknown[] = [];
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: encuadres, defaultBrief: null }) }));
vi.mock('@/components/exegesis/PassagePicker', () => ({
    PassagePicker: ({ onChange }: { onChange: (r: unknown, e: unknown) => void }) => {
        useEffect(() => onChange({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 }, null), []);
        return <div>pasaje</div>;
    },
}));
vi.mock('@/components/exegesis/setup/RubricTemplatePicker', () => ({ RubricTemplatePicker: () => <div>rúbrica</div> }));
vi.mock('@/components/exegesis/setup/AssignmentBriefPicker', () => ({ AssignmentBriefPicker: () => <div>consigna</div> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [
    { id: 'ropes', title: 'ICC James', exegeticalType: 'commentary-critical', coversBibleBooks: ['JAS'] },
    { id: 'romanos', title: 'Romans', exegeticalType: 'commentary-critical', coversBibleBooks: ['ROM'] },
    { id: 'bdag', title: 'BDAG', exegeticalType: 'lexicon-technical', coversBibleBooks: [] },
] }) }));
const { ExegesisCreatePage } = await import('../ExegesisCreatePage');

beforeEach(() => { cleanup(); vi.clearAllMocks(); perfiles = []; encuadres = []; proyectos = [curso, { id: 'otro', title: 'Otro', userId: 'u1' }]; });
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
        proyectos = [{ ...curso, workTypes: [{ ...tp, rubricTemplateId: null }] }];
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

    describe('un curso con varios tipos de trabajo (etapa 1b)', () => {
        const paperFinal = { id: 'pf', label: 'Paper final', rubricTemplateId: 'rub-paper', styleGuideId: null };
        const conDos = { ...curso, courseInfo: { course: 'NT785', styleGuideId: 'guia-curso' }, workTypes: [tp, paperFinal] };

        it('con dos tipos se pregunta: sin elegir, solo los datos del curso', async () => {
            proyectos = [conDos];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            expect((screen.getByLabelText('create.project.workType') as HTMLSelectElement).value).toBe('');
            expect(screen.getByText('create.project.pickWorkType')).toBeInTheDocument();
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            const input = createPaper.mock.calls[0]![0];
            expect(input).toMatchObject({ projectId: 'teo2', projectWorkTypeId: null, styleGuideId: 'guia-curso' });
            expect(input.rubricTemplateId).toBeUndefined();
        });

        it('pasar del TP al paper final no deja nada del TP: ni su encuadre, ni su portada, ni su estrategia', async () => {
            proyectos = [conDos];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'tp' } });
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'pf' } });
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            const input = createPaper.mock.calls[0]![0];
            // El paper final no trae guía: usa la del curso, no la del TP.
            expect(input).toMatchObject({ projectWorkTypeId: 'pf', rubricTemplateId: 'rub-paper', styleGuideId: 'guia-curso', exegeticalStrategy: 'dialectical' });
            expect(input).not.toHaveProperty('cover');
        });

        it('con un solo tipo se elige solo', async () => {
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            expect((screen.getByLabelText('create.project.workType') as HTMLSelectElement).value).toBe('tp');
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0]).toMatchObject({ projectWorkTypeId: 'tp' });
        });

        it('pasar del TP al paper final vacía la consigna del TP (revisión de la etapa 1b)', async () => {
            encuadres = [{ id: 'b-tp', displayName: 'TP', body: 'CONSIGNA DEL TP' }];
            proyectos = [{ ...conDos, workTypes: [{ ...tp, briefTemplateId: 'b-tp' }, paperFinal] }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'tp' } });
            await waitFor(() => expect(screen.getByDisplayValue('CONSIGNA DEL TP')).toBeInTheDocument());
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'pf' } });
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0].assignmentBrief).toBeNull();
        });

        it('un curso con solo el nombre no desplaza al perfil por defecto (revisión de la etapa 1b)', async () => {
            perfiles = [{ id: 'perfil', displayName: 'TP', rubricTemplateId: 'rub-p', briefTemplateId: null, styleGuideId: 'g-p', exegeticalStrategy: 'free', isDefault: true }];
            proyectos = [{ id: 'teo2', title: 'NT785', userId: 'u1', courseInfo: { course: 'NT785' }, workTypes: [] }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            expect(screen.queryByText('create.project.chargeApplied')).toBeNull();
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0]).toMatchObject({ projectId: 'teo2', rubricTemplateId: 'rub-p', styleGuideId: 'g-p', exegeticalStrategy: 'free' });
        });

        it('un tipo vacío elegido después de uno lleno no trae el perfil por defecto (revisión de la etapa 1b)', async () => {
            perfiles = [{ id: 'perfil', displayName: 'Otro', rubricTemplateId: 'rub-p', briefTemplateId: null, styleGuideId: 'g-p', exegeticalStrategy: 'free', isDefault: true, cover: { institution: 'X' } }];
            proyectos = [{ ...curso, workTypes: [tp, { id: 'ens', label: 'Ensayo' }] }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'tp' } });
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'ens' } });
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            const input = createPaper.mock.calls[0]![0];
            expect(input).toMatchObject({ projectWorkTypeId: 'ens', styleGuideId: null, exegeticalStrategy: 'dialectical' });
            expect(input.rubricTemplateId).toBeUndefined();
            expect(input).not.toHaveProperty('cover');
        });

        it('el encargo guardado en la etapa 1 sigue funcionando', async () => {
            proyectos = [{ id: 'teo2', title: 'Teología II', userId: 'u1', charge: { course: 'Teología II', rubricTemplateId: 'rub-tms', styleGuideId: 'guia-tms' } }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0]).toMatchObject({ projectId: 'teo2', rubricTemplateId: 'rub-tms', styleGuideId: 'guia-tms' });
        });
    });

    describe('hereda el estado del arte del proyecto (etapa 2)', () => {
        const bibliografia = [
            { id: 'a', title: 'ICC James', resourceId: 'ropes', sourceType: 'commentary-critical', weight: 'recommended', decision: 'approved', origins: ['studies'] },
            { id: 'b', title: 'Romans', resourceId: 'romanos', sourceType: 'commentary-critical', weight: 'recommended', decision: 'approved', origins: ['library'] },
            { id: 'c', title: 'BDAG', resourceId: 'bdag', sourceType: null, weight: 'required', decision: 'approved', origins: ['syllabus'] },
            { id: 'd', title: 'Pillar', resourceId: null, weight: 'recommended', decision: 'approved', origins: ['manual'] },
            { id: 'e', title: 'Candidata', resourceId: 'x', weight: 'recommended', decision: 'candidate', origins: ['catalog'] },
        ];

        it('las aprobadas en la biblioteca nacen en el corpus; un comentario de otro libro no se ofrece', async () => {
            proyectos = [{ ...curso, bibliography: bibliografia }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            expect(screen.queryByText('Romans')).toBeNull();
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0].initialSources).toEqual([
                { corpusId: 'ropes', sourceLibraryResourceId: 'ropes', sourceType: 'commentary-critical', displayLabel: 'ICC James', mode: 'full-document' },
                { corpusId: 'bdag', sourceLibraryResourceId: 'bdag', sourceType: 'lexicon-technical', displayLabel: 'BDAG', mode: 'full-document' },
            ]);
        });

        it('un proyecto de antes (solo sourceIds) hereda con el nombre y el tipo del libro, sin comentarios de otro libro (revisión)', async () => {
            proyectos = [{ ...curso, sourceIds: ['ropes', 'romanos', 'bdag'] }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0].initialSources.map((x: { displayLabel: string; sourceType: string }) => [x.displayLabel, x.sourceType]))
                .toEqual([['ICC James', 'commentary-critical'], ['BDAG', 'lexicon-technical']]);
        });

        it('una desmarcada no se hereda, y sin proyecto no se hereda nada', async () => {
            proyectos = [{ ...curso, bibliography: bibliografia }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            fireEvent.click(screen.getByLabelText(/ICC James/));
            fireEvent.change(screen.getByLabelText('create.project.label'), { target: { value: 'teo2' } });
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0].initialSources.map((x: { corpusId: string }) => x.corpusId)).toEqual(['bdag']);
            cleanup(); createPaper.mockClear();
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new']}><ExegesisCreatePage /></MemoryRouter>);
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0]).not.toHaveProperty('initialSources');
        });
    });

    describe('el método del tipo de trabajo (etapa 2, capa 3)', () => {
        it('el tipo trae su método; pasar a uno sin método vuelve al análisis de siempre', async () => {
            proyectos = [{ ...curso, workTypes: [{ ...tp, exegeticalMethod: 'mixed' }, { id: 'pf', label: 'Paper final', rubricTemplateId: 'rub-paper' }] }];
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=teo2']}><ExegesisCreatePage /></MemoryRouter>);
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'tp' } });
            expect((screen.getByLabelText('method.label') as HTMLSelectElement).value).toBe('mixed');
            fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'pf' } });
            expect((screen.getByLabelText('method.label') as HTMLSelectElement).value).toBe('');
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0]).not.toHaveProperty('exegeticalMethod');
        });

        it('se puede elegir a mano y viaja en la creación', async () => {
            render(<MemoryRouter initialEntries={['/dashboard/exegesis/new']}><ExegesisCreatePage /></MemoryRouter>);
            fireEvent.change(screen.getByLabelText('method.label'), { target: { value: 'exegetical' } });
            expect(screen.getByText('method.exegetical.hint')).toBeInTheDocument();
            crear();
            await waitFor(() => expect(createPaper).toHaveBeenCalled());
            expect(createPaper.mock.calls[0]![0]).toMatchObject({ exegeticalMethod: 'exegetical' });
        });
    });
});
