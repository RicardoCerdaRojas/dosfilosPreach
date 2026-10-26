import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * «Crear el TP #10» desde el escritorio del Curso
 * (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §9.1): la página de creación
 * lee el tipo de trabajo, la entrega y el rótulo de la URL, preselecciona el
 * tipo y, al crear, vincula la entrega con el estudio. Semana a semana (sin
 * entrega), crea la entrada sin fecha.
 */
const createPaper = vi.fn();
const mutateAsync = vi.fn();
const navigate = vi.fn();
const toastError = vi.fn();
let proyectos: unknown[] = [];
let pasajeElegido: unknown = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 };
let pasajeRecibido: unknown = null;

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, p?: { label?: string; from?: string }) => (p?.from ? `${k}:${p.from}>${p.label ?? ''}` : p?.label ? `${k}:${p.label}` : k), i18n: { language: 'es' } }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: proyectos, updateProject: { mutateAsync } }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [], defaultProfile: null }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ createPaper: { isPending: false, mutateAsync: createPaper } }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [], defaultBrief: null }) }));
vi.mock('@/components/exegesis/PassagePicker', () => ({
    PassagePicker: ({ value, onChange }: { value: unknown; onChange: (r: unknown, e: unknown) => void }) => {
        pasajeRecibido = value;
        // Solo elige si el estudiante «escribe» uno (la prueba lo decide).
        useEffect(() => { if (pasajeElegido) onChange(pasajeElegido, null); }, []);
        return <div>pasaje</div>;
    },
}));
vi.mock('@/components/exegesis/setup/RubricTemplatePicker', () => ({ RubricTemplatePicker: () => <div>rúbrica</div> }));
vi.mock('@/components/exegesis/setup/AssignmentBriefPicker', () => ({ AssignmentBriefPicker: () => <div>consigna</div> }));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [] }) }));
const { ExegesisCreatePage } = await import('../ExegesisCreatePage');

const tp10 = { bookId: 'JAS', chapterStart: 4, chapterEnd: 5, verseStart: 13, verseEnd: 6 };
const nt785 = {
    id: 'nt785', title: 'NT785', userId: 'u1', type: 'course',
    courseInfo: { course: 'NT785' },
    workTypes: [{ id: 'tp', label: 'TP Semanal', rubricTemplateId: 'rub-tp' }, { id: 'ens', label: 'Ensayo', rubricTemplateId: 'rub-ens' }],
    courseSchedule: [{ id: 'e10', workTypeId: 'tp', label: 'TP #10', dueDate: '2026-11-06', passage: tp10 }],
};
const abrir = (q: string) => render(<MemoryRouter initialEntries={[`/dashboard/exegesis/new?${q}`]}><ExegesisCreatePage /></MemoryRouter>);
const crear = () => fireEvent.click(screen.getByText('create.submit'));
const SETUP = '/dashboard/exegesis/nuevo/setup?from=%2Fdashboard%2Fprojects%2Fnt785';

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    createPaper.mockResolvedValue({ id: 'nuevo' });
    mutateAsync.mockResolvedValue({});
    proyectos = [nt785, { id: 'otro', title: 'Otro', userId: 'u1', type: 'course', workTypes: [{ id: 'tp', label: 'TP' }] }];
    pasajeElegido = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 };
    pasajeRecibido = null;
});

describe('crear un trabajo desde el escritorio del curso', () => {
    it('preselecciona el tipo de trabajo de la URL, aunque el curso tenga varios', async () => {
        abrir('projectId=nt785&workTypeId=ens');
        expect((screen.getByLabelText('create.project.workType') as HTMLSelectElement).value).toBe('ens');
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0]).toMatchObject({ projectId: 'nt785', projectWorkTypeId: 'ens', rubricTemplateId: 'rub-ens' });
    });

    it('un tipo de la URL que no es del curso se ignora', () => {
        abrir('projectId=nt785&workTypeId=fantasma');
        expect((screen.getByLabelText('create.project.workType') as HTMLSelectElement).value).toBe('');
    });

    it('con la entrega del calendario: lo dice, y al crear vincula esa entrega con el trabajo', async () => {
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        expect(screen.getByTestId('create-schedule-entry')).toHaveTextContent('create.fulfills:TP #10');
        crear();
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(mutateAsync.mock.calls[0]![0]).toEqual({ projectId: 'nt785', courseOps: [{ op: 'linkPaper', entryId: 'e10', paperId: 'nuevo' }] });
        // La configuración y el estudio vuelven al proyecto.
        expect(navigate).toHaveBeenCalledWith(SETUP);
    });

    it('si el estudiante cambia de tipo, no cumple la entrega de otro tipo: crea una entrada nueva del tipo elegido', async () => {
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'ens' } });
        // El ensayo no tiene rótulos con número: se dice que no cumple «TP #10».
        expect(screen.getByTestId('create-schedule-entry')).toHaveTextContent('create.otherTypeUnlabeled:TP #10');
        crear();
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(mutateAsync.mock.calls[0]![0].courseOps).toEqual([{ op: 'upsertEntry', entry: { workTypeId: 'ens', label: 'Santiago 4:1-10', paperId: 'nuevo' } }]);
    });

    it('volver al tipo de la entrega la vuelve a cumplir', async () => {
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'ens' } });
        fireEvent.change(screen.getByLabelText('create.project.workType'), { target: { value: 'tp' } });
        expect(screen.getByTestId('create-schedule-entry')).toHaveTextContent('create.fulfills:TP #10');
    });

    it('el pasaje de la entrega viene puesto si el estudiante no eligió otro', async () => {
        pasajeElegido = null;
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        await waitFor(() => expect(pasajeRecibido).toEqual(tp10));
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0].passage).toEqual(tp10);
    });

    it('semana a semana (sin entrega): crea la entrada con su tipo y su rótulo, sin fecha', async () => {
        abrir('projectId=nt785&workTypeId=tp&label=TP%20%2311');
        expect(screen.getByTestId('create-schedule-entry')).toHaveTextContent('create.newEntry:TP #11');
        crear();
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(mutateAsync.mock.calls[0]![0]).toEqual({ projectId: 'nt785', courseOps: [{ op: 'upsertEntry', entry: { workTypeId: 'tp', label: 'TP #11', paperId: 'nuevo' } }] });
    });

    it('semana a semana, con solo el tipo: la entrada toma el rótulo que sigue', async () => {
        proyectos = [{ ...nt785, courseScheduleMode: 'free' }];
        abrir('projectId=nt785&workTypeId=tp');
        expect(screen.getByTestId('create-schedule-entry')).toHaveTextContent('create.newEntry:TP #11');
        crear();
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(mutateAsync.mock.calls[0]![0].courseOps[0].entry).toEqual({ workTypeId: 'tp', label: 'TP #11', paperId: 'nuevo' });
    });

    it('semana a semana, sin rótulos con número: la entrada se llama como el pasaje', async () => {
        proyectos = [{ ...nt785, courseScheduleMode: 'free', courseSchedule: [] }];
        abrir('projectId=nt785&workTypeId=ens');
        expect(screen.getByTestId('create-schedule-entry')).toHaveTextContent('create.newEntryUnlabeled');
        crear();
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(mutateAsync.mock.calls[0]![0].courseOps[0].entry).toEqual({ workTypeId: 'ens', label: 'Santiago 4:1-10', paperId: 'nuevo' });
    });

    it('con calendario y solo el tipo (sin entrega ni rótulo), no se inventa una entrega', async () => {
        abrir('projectId=nt785&workTypeId=tp');
        expect(screen.queryByTestId('create-schedule-entry')).toBeNull();
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('si el estudiante elige otro proyecto, no se vincula nada', async () => {
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        fireEvent.change(screen.getByLabelText('create.project.label'), { target: { value: 'otro' } });
        expect(screen.queryByTestId('create-schedule-entry')).toBeNull();
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('fuera de un curso los parámetros no hacen nada', async () => {
        proyectos = [{ ...nt785, type: 'exegetical' }];
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        expect(screen.queryByTestId('create-schedule-entry')).toBeNull();
        crear();
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('si vincular falla un momento, se reintenta solo', async () => {
        mutateAsync.mockRejectedValueOnce(new Error('red'));
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        crear();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(SETUP));
        expect(mutateAsync).toHaveBeenCalledTimes(2);
        expect(toastError).not.toHaveBeenCalled();
    });

    it('si vincular falla, el trabajo ya existe: no se crea otro; el aviso queda con «Vincular» y se sigue a su configuración', async () => {
        mutateAsync.mockRejectedValue(new Error('red'));
        abrir('projectId=nt785&workTypeId=tp&scheduleEntryId=e10&label=TP%20%2310');
        crear();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(SETUP));
        expect(createPaper).toHaveBeenCalledTimes(1);
        const [texto, opciones] = toastError.mock.calls[0]!;
        expect(texto).toBe('create.linkFailed:TP #10');
        expect(opciones).toMatchObject({ duration: Infinity, action: { label: 'create.linkRetry' } });
        // «Vincular» reintenta la misma operación, y avisa si quedó.
        mutateAsync.mockResolvedValue({});
        opciones.action.onClick();
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('create.linked:TP #10'));
        expect(mutateAsync.mock.calls.at(-1)![0]).toEqual({ projectId: 'nt785', courseOps: [{ op: 'linkPaper', entryId: 'e10', paperId: 'nuevo' }] });
    });
});
