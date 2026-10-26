import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildProjectDesk, type ProjectDeskModel } from '@dosfilos/domain';
import {
    NOW, NOW_CURSO, esdrasAMedias, esdrasRecienCreado, nt785,
} from '@dosfilos/domain/exegesis/services/__tests__/projectDesk.fixtures';
import { getProjectTypeMeta } from '@/pages/projects/projectRoadmaps';

/**
 * El escritorio del proyecto (W2-A): la composición del panel. Los datos
 * llegan de `useProjectDesk` (aquí, armado con el modelo real del dominio)
 * y las secciones de cada tipo son de sus unidades: aquí solo se prueba que
 * se montan, en qué orden y adónde llevan «Ahora» y las notas.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/hooks/useAuthorization', () => ({ useAuthorization: () => ({ isAdmin: false }) }));
// Los formularios (encuadre, tipos de trabajo) leen sus catálogos: vacíos, sin la capa de servicios.
vi.mock('@dosfilos/application', () => ({}));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [] }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [] }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({ useUserStyleGuides: () => ({ guides: [] }) }));

// Un solo origen de datos: el hook del escritorio.
let vista: Record<string, unknown> = {};
vi.mock('../hooks/useProjectDesk', () => ({ useProjectDesk: () => vista }));
vi.mock('../hooks/useSaveProjectSources', () => ({ useSaveProjectSources: () => ({ save: vi.fn(), saving: false }) }));
vi.mock('../hooks/useLinkProjectSession', () => ({ useLinkProjectSession: () => ({ linkingId: null, link: vi.fn() }) }));

// Las secciones de cada tipo (W2-B y W2-C): un marcador con sus anclas.
const seccionesExegeticas = vi.fn();
const seccionesDelCurso = vi.fn();
const anclas = (desk: ProjectDeskModel) => desk.phases.map(p => <section key={p.id} id={`fase-${p.id}`}><h2 data-desk-heading tabIndex={-1}>{p.id}</h2></section>);
vi.mock('../components/project/desk/ExegeticalDeskSections', () => ({
    ExegeticalDeskSections: (p: { desk: ProjectDeskModel; onOpenFraming: () => void }) => {
        seccionesExegeticas(p);
        return <div data-testid="secciones-exegeticas">{anclas(p.desk)}<button type="button" onClick={p.onOpenFraming}>editar-encuadre</button></div>;
    },
}));
vi.mock('../components/project/desk/CourseDeskSections', () => ({
    CourseDeskSections: (p: { desk: ProjectDeskModel }) => {
        seccionesDelCurso(p);
        return <div data-testid="secciones-del-curso">{anclas(p.desk)}</div>;
    },
}));
vi.mock('../components/project/ProjectSourcePickerModal', () => ({ ProjectSourcePickerModal: () => null }));
vi.mock('../components/project/ProjectLinkSessionDialog', () => ({ ProjectLinkSessionDialog: () => null }));
vi.mock('../components/project/ProjectOutputEditorDialog', () => ({
    ProjectOutputEditorDialog: ({ mode, output }: { mode: string; output?: { id: string } }) => <div>{`editor-${mode}-${output?.id ?? ''}`}</div>,
}));

const { ProjectDashboard } = await import('../ProjectDashboard');

const mutacion = { mutateAsync: vi.fn(), isPending: false };
const slicesVacias = () => ({
    projectSessions: [], projectSermons: [], projectSermonsAll: [], projectGreekSessions: [], linkableGreekSessions: [],
    projectHebrewSessions: [], linkableHebrewSessions: [], projectStudies: [], projectSeries: [], seriesStudyIds: new Set<string>(),
});
const armar = (project: Record<string, unknown>, desk: ProjectDeskModel | null, over: Record<string, unknown> = {}) => ({
    project, projects: [project], isLoadingProject: false, updateProject: mutacion,
    typeMeta: getProjectTypeMeta(project.type as never), desk, legacyRoadmap: null,
    blocks: { work: 'ready', series: 'ready', sources: 'ready', sermons: 'ready', material: 'ready' }, journey: 'ready',
    retrySeries: vi.fn(), papers: [], series: [], sermons: [], slices: slicesVacias(),
    attached: { sources: [], isLoading: false, error: null, reprocessing: {}, reprocessSource: vi.fn() },
    workspace: { outputs: [], isLoadingOutputs: false, createOutput: mutacion, updateOutput: mutacion, deleteOutput: mutacion },
    ...over,
});
/** Un proyecto completo (`AIProject`) a partir del de los escenarios. */
const completo = (p: Record<string, unknown>) => ({ userId: 'u1', title: 'Proyecto', color: 'amber', ...p });

const montar = (id = 'p1') => render(
    <MemoryRouter initialEntries={[`/dashboard/projects/${id}`]}>
        <Routes><Route path="/dashboard/projects/:projectId" element={<ProjectDashboard />} /></Routes>
    </MemoryRouter>,
);
const botonAhora = () => within(screen.getByTestId('desk-now')).getByRole('button');

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
});

describe('el escritorio Exegético', () => {
    const esdras = () => {
        const input = esdrasAMedias();
        return { project: completo(input.project as never), desk: buildProjectDesk(input, NOW) };
    };

    it('recorrido arriba, luego sus secciones y al final herramientas y material; sin lista suelta, tarjetas de curso ni serie vieja', () => {
        const { project, desk } = esdras();
        vista = armar(project, desk);
        montar();
        const recorrido = screen.getByTestId('desk-journey');
        const secciones = screen.getByTestId('secciones-exegeticas');
        const herramientas = screen.getByTestId('desk-tools');
        expect(recorrido.compareDocumentPosition(secciones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(secciones.compareDocumentPosition(herramientas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(seccionesExegeticas).toHaveBeenCalledWith(expect.objectContaining({ project, desk }));
        expect(screen.queryByText('studies.title')).toBeNull();
        expect(screen.queryByText('course.options')).toBeNull();
        expect(screen.queryByText('seriesSection.title')).toBeNull();
        expect(screen.getByText('material.sectionLabel')).toBeInTheDocument();
    });

    it('Esdras: las herramientas son hebreo y arameo, no griego', () => {
        const { project, desk } = esdras();
        vista = armar(project, desk);
        montar();
        const herramientas = screen.getByTestId('desk-tools');
        expect(within(herramientas).getByText('desk.tools.hebrewAramaic')).toBeInTheDocument();
        expect(within(herramientas).queryByText('resources.greek.label')).toBeNull();
    });

    it('«Ahora» (la perícopa en curso) abre el estudio con la vuelta al proyecto', () => {
        const { project, desk } = esdras();
        vista = armar(project, desk);
        montar();
        fireEvent.click(botonAhora());
        expect(navigate).toHaveBeenCalledWith('/dashboard/exegesis/s5?from=%2Fdashboard%2Fprojects%2Fp1');
    });

    it('sin nota de antes, «Escribe tu lectura del libro» abre el encuadre', () => {
        const input = esdrasRecienCreado();
        delete (input.project as { contextNote?: string }).contextNote;
        vista = armar(completo(input.project as never), buildProjectDesk(input, NOW));
        montar();
        fireEvent.click(botonAhora());
        expect(screen.getByText('framing.dialog.title')).toBeInTheDocument();
    });

    it('con nota de antes, «Ahora» lleva a la sección de la fase 1 (donde se pasa la nota), no al formulario vacío', () => {
        const input = esdrasRecienCreado();
        vista = armar(completo(input.project as never), buildProjectDesk(input, NOW));
        montar();
        fireEvent.click(botonAhora());
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
        expect(document.activeElement?.textContent).toBe('passage');
        expect(screen.queryByText('framing.dialog.title')).toBeNull();
    });

    it('«Revisar tu idea central» abre la revisión en el lugar', () => {
        const { project, desk } = esdras();
        vista = armar(project, { ...desk, now: { kind: 'phase', text: { key: 'desk.now.reviseIdea' }, target: { type: 'reviseIdea', phaseId: 'synthesis' } } });
        montar();
        fireEvent.click(botonAhora());
        expect(screen.getByText('framing.consolidate.title')).toBeInTheDocument();
    });

    it('«Planificar la serie» abre el planificador en el libro del proyecto', () => {
        const { project, desk } = esdras();
        vista = armar(project, { ...desk, now: { kind: 'phase', text: { key: 'desk.now.division' }, target: { type: 'planSeries', phaseId: 'division' } } });
        montar();
        fireEvent.click(botonAhora());
        expect(navigate).toHaveBeenCalledWith('/dashboard/plans/pericope?projectId=p1&book=EZR');
    });

    it('«Editar» desde la sección abre el diálogo del encuadre del panel', () => {
        const { project, desk } = esdras();
        vista = armar(project, desk);
        montar();
        fireEvent.click(screen.getByText('editar-encuadre'));
        expect(screen.getByText('framing.dialog.title')).toBeInTheDocument();
    });
});

describe('el escritorio del Curso', () => {
    const curso = () => {
        const input = nt785();
        return { project: completo(input.project as never), desk: buildProjectDesk(input, NOW_CURSO) };
    };

    it('monta sus secciones; las notas llevan a su destino (una obligatoria por conseguir, al estado del arte)', () => {
        const { project, desk } = curso();
        vista = armar(project, desk);
        montar('nt785');
        expect(seccionesDelCurso).toHaveBeenCalledWith(expect.objectContaining({ project, desk }));
        expect(seccionesExegeticas).not.toHaveBeenCalled();
        fireEvent.click(screen.getAllByRole('button').find(b => b.textContent?.includes('desk.notes.requiredToAcquire'))!);
        expect(navigate).toHaveBeenCalledWith('/dashboard/projects/nt785/estado-del-arte');
    });

    it('«Crear el TP #10» lleva al estudio nuevo con su tipo, su entrada y su rótulo', () => {
        const { project, desk } = curso();
        vista = armar(project, { ...desk, now: { kind: 'scheduled', text: { key: 'desk.now.createScheduled', params: { label: 'TP #10' } }, target: { type: 'createScheduled', id: 'e10', workTypeId: 'tp', label: 'TP #10' } } });
        montar('nt785');
        fireEvent.click(botonAhora());
        expect(navigate).toHaveBeenCalledWith('/dashboard/exegesis/new?projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP+%2310');
    });

    it('«Registrar la devolución» salta a la fase de la devolución y le pide abrir el diálogo de esa entrega', () => {
        const { project, desk } = curso();
        vista = armar(project, { ...desk, now: { kind: 'phase', text: { key: 'desk.now.recordFeedback', params: { label: 'TP #8' } }, target: { type: 'recordFeedback', id: 'e8', label: 'TP #8' } } });
        montar('nt785');
        expect(seccionesDelCurso).toHaveBeenLastCalledWith(expect.objectContaining({ feedbackEntryId: null }));
        fireEvent.click(botonAhora());
        expect(document.activeElement?.textContent).toBe('feedback');
        expect(seccionesDelCurso).toHaveBeenLastCalledWith(expect.objectContaining({ feedbackEntryId: 'e8' }));
        // Al cerrar el diálogo, la sección lo avisa y el panel lo suelta.
        const { onFeedbackEntryChange } = seccionesDelCurso.mock.lastCall![0] as { onFeedbackEntryChange: (id: string | null) => void };
        act(() => onFeedbackEntryChange(null));
        expect(seccionesDelCurso).toHaveBeenLastCalledWith(expect.objectContaining({ feedbackEntryId: null }));
    });

    it('Santiago: la herramienta es griego', () => {
        const { project, desk } = curso();
        vista = armar(project, desk);
        montar('nt785');
        const herramientas = screen.getByTestId('desk-tools');
        expect(within(herramientas).getByText('resources.greek.label')).toBeInTheDocument();
        expect(within(herramientas).queryByText('resources.hebrew.label')).toBeNull();
    });
});

describe('mientras carga y si falla', () => {
    it('cargando: el recorrido espera y las secciones no se dibujan (sus vacíos serían falsos)', () => {
        const input = esdrasAMedias();
        vista = armar(completo(input.project as never), buildProjectDesk(input, NOW), { journey: 'loading' });
        montar();
        expect(screen.getByTestId('project-roadmap-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('desk-now')).toBeNull();
        expect(screen.queryByTestId('secciones-exegeticas')).toBeNull();
    });

    it('si las series fallan, lo avisa y ofrece reintentar, sin secciones', () => {
        const input = esdrasAMedias();
        const retrySeries = vi.fn();
        vista = armar(completo(input.project as never), buildProjectDesk(input, NOW), { journey: 'error', retrySeries });
        montar();
        expect(screen.getByTestId('project-roadmap-error')).toBeInTheDocument();
        expect(screen.queryByTestId('secciones-exegeticas')).toBeNull();
        fireEvent.click(screen.getByText('seriesSection.retry'));
        expect(retrySeries).toHaveBeenCalled();
    });

    it('en frío, el esqueleto; ya cargado y sin proyecto, «no encontrado»', () => {
        vista = { ...armar(completo({ id: 'p1', type: 'exegetical' }), null), project: undefined, isLoadingProject: true };
        montar();
        expect(screen.getByTestId('project-dashboard-loading')).toBeInTheDocument();
        cleanup();
        vista = { ...armar(completo({ id: 'p1', type: 'exegetical' }), null), project: undefined, isLoadingProject: false };
        montar();
        expect(screen.getByText('notFound.title')).toBeInTheDocument();
    });
});

describe('los otros tipos', () => {
    it('Consejería conserva su recorrido, sin estudios ni lenguas', async () => {
        const project = completo({ id: 'c1', type: 'counseling' });
        const { computeRoadmapState } = await import('@/pages/projects/projectRoadmaps');
        const legacyRoadmap = computeRoadmapState(getProjectTypeMeta('counseling'), {
            project: project as never, studyCount: 0, sourceCount: 0, greekCount: 0, hebrewCount: 0, sessionCount: 0, outputs: [], sermons: [],
        });
        vista = armar(project, buildProjectDesk({ project: project as never, studies: [] }, NOW), { legacyRoadmap });
        montar('c1');
        expect(screen.getByText(/roadmap\.activePhase\.label/)).toBeInTheDocument();
        expect(screen.queryByTestId('desk-journey')).toBeNull();
        expect(screen.queryByText('studies.title')).toBeNull();
        expect(within(screen.getByTestId('desk-tools')).getAllByTestId('desk-tool')).toHaveLength(1);
    });

    it('General: «Ahora» con lo último que se tocó (un material abre su editor), sus estudios, el selector de fuentes y las opciones de curso plegadas', () => {
        const project = completo({ id: 'g1', type: 'general', sourceIds: ['r1'] });
        const nota = { id: 'o1', kind: 'note', title: 'Bosquejo', content: 'x', updatedAt: new Date('2026-10-25T10:00:00Z'), createdAt: new Date('2026-10-25T10:00:00Z') };
        const desk = buildProjectDesk({ project: project as never, studies: [], outputs: [nota as never] }, NOW);
        vista = armar(project, desk, {
            workspace: { outputs: [nota], isLoadingOutputs: false, createOutput: mutacion, updateOutput: mutacion, deleteOutput: mutacion },
            attached: { sources: [{ id: 'r1', title: 'Moo', author: 'Moo', indexingStatus: 'ready' }], isLoading: false, error: null, reprocessing: {}, reprocessSource: vi.fn() },
        });
        montar('g1');
        expect(screen.getByText('desk.journey.nowOnlyLabel')).toBeInTheDocument();
        expect(screen.getByText('studies.title')).toBeInTheDocument();
        expect(screen.getByTestId('desk-picker-sources')).toBeInTheDocument();
        expect(screen.getByText('course.options')).toBeInTheDocument();
        fireEvent.click(botonAhora());
        expect(screen.getByText('editor-edit-o1')).toBeInTheDocument();
    });
});

describe('el material', () => {
    it('no repite los sermones de la serie (ya están en su fila de la mesa); los demás sí', () => {
        const input = esdrasAMedias();
        const project = completo(input.project as never);
        const slices = {
            ...slicesVacias(),
            projectSeries: [{ id: 'serie1', projectId: 'p1', createdAt: new Date() }],
            seriesStudyIds: new Set(['s3']),
            projectSermons: [
                { id: 'a', title: 'De la serie', status: 'draft', seriesId: 'serie1', updatedAt: new Date('2026-10-10') },
                { id: 'b', title: 'Del estudio de la serie', status: 'draft', sourcePaperId: 's3', updatedAt: new Date('2026-10-11') },
                { id: 'c', title: 'Suelto', status: 'published', updatedAt: new Date('2026-10-12') },
            ],
        };
        vista = armar(project, buildProjectDesk(input, NOW), { slices });
        montar();
        expect(screen.getByText('Suelto')).toBeInTheDocument();
        expect(screen.queryByText('De la serie')).toBeNull();
        expect(screen.queryByText('Del estudio de la serie')).toBeNull();
    });
});
