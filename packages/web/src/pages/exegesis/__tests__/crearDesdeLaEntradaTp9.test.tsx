import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * TP #9 (Santiago 4:11-17): el fundador lo creó desde la entrada del
 * calendario de NT785 (tipo «TP Semanal») y tuvo que reescribir el pasaje
 * (B7), corregir el pasaje fijo del encargo (B5), llenar a mano el hueco de
 * las fuentes de la semana anterior (B4), volver a elegir «Mixto» (B8) y
 * ver un selector de perfil que sobraba (B9).
 */
const createPaper = vi.fn();
const mutateAsync = vi.fn();
const updateBrief = vi.fn();
let proyectos: unknown[] = [];
let resumenes: unknown[] = [];
let encuadres: unknown[] = [];
let perfiles: unknown[] = [];

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => vi.fn() }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k), i18n: { language: 'es' } }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: proyectos, updateProject: { mutateAsync } }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: perfiles, defaultProfile: null }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: resumenes, createPaper: { isPending: false, mutateAsync: createPaper } }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: encuadres, defaultBrief: null, updateBrief: { mutateAsync: updateBrief, isPending: false } }) }));
vi.mock('@/components/exegesis/setup/RubricTemplatePicker', () => ({ RubricTemplatePicker: () => <div>rúbrica</div> }));
vi.mock('@/components/exegesis/setup/AssignmentBriefPicker', () => ({ AssignmentBriefPicker: () => <div>consigna</div> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [] }) }));
const { ExegesisCreatePage } = await import('../ExegesisCreatePage');

const fuente = (citationKey: string, sourceType: string) => ({ citationKey, sourceType, corpusId: citationKey, sourceLibraryResourceId: null, displayLabel: citationKey });
const tp8 = {
    id: 'tp8', title: 'TP #8', passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 }, createdAt: new Date(2026, 9, 21), projectId: 'nt785', projectWorkTypeId: 'tp',
    citedSourceKeys: ['Adamson', 'Mayor', 'Metzger', 'Wallace'],
    sources: [fuente('Adamson', 'commentary-critical'), fuente('Mayor', 'commentary-expository'), fuente('Metzger', 'textual-commentary'), fuente('Wallace', 'grammar-syntax')],
};
const comentarios = ['commentary-critical', 'commentary-expository', 'textual-commentary'];
const nt785 = (entrada: Record<string, unknown>, tipo: Record<string, unknown> = {}) => ({
    id: 'nt785', title: 'NT785', userId: 'u1', type: 'course',
    workTypes: [{ id: 'tp', label: 'TP Semanal', briefTemplateId: 'enc', noRepeatSourceTypes: comentarios, ...tipo }],
    courseSchedule: [{ id: 'e9', workTypeId: 'tp', label: 'TP9 - Santiago 4:11-17', ...entrada }],
});
const encargo = (body: string) => [{ id: 'enc', displayName: 'TP semanal', body, isDefault: false }];
const abrir = () => render(<MemoryRouter initialEntries={['/dashboard/exegesis/new?projectId=nt785&workTypeId=tp&scheduleEntryId=e9']}><ExegesisCreatePage /></MemoryRouter>);
const encuadre = () => screen.getByPlaceholderText('create.brief.placeholder') as HTMLTextAreaElement;

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    createPaper.mockResolvedValue({ id: 'nuevo' });
    mutateAsync.mockResolvedValue({});
    updateBrief.mockResolvedValue({});
    resumenes = [tp8];
    encuadres = encargo('Trabajo práctico sobre [PASAJE]. Prohibido citar [FUENTES DE LA SEMANA ANTERIOR]: no se repiten.');
    perfiles = [{ id: 'perfil', displayName: 'TP Semanal', rubricTemplateId: 'r', briefTemplateId: null, styleGuideId: null, exegeticalStrategy: 'dialectical' }];
    proyectos = [nt785({})];
});

describe('crear el TP desde la entrada del calendario', () => {
    it('B7: el pasaje sale del rótulo de la entrada y llega a la creación (con el selector real)', async () => {
        abrir();
        await waitFor(() => expect(screen.getByDisplayValue('Santiago 4:11-17')).toBeInTheDocument());
        fireEvent.click(screen.getByText('create.submit'));
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0].passage).toEqual({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 });
    });

    it('B7: con el pasaje guardado en la entrada, ese manda', async () => {
        proyectos = [nt785({ label: 'TP #9', passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 } })];
        abrir();
        await waitFor(() => expect(screen.getByDisplayValue('Santiago 4:11-17')).toBeInTheDocument());
    });

    it('B5 + B4: el encargo llena el pasaje y las fuentes que no se repiten (sin Wallace)', async () => {
        abrir();
        await waitFor(() => expect(encuadre().value).toBe('Trabajo práctico sobre Santiago 4:11-17. Prohibido citar Adamson, Mayor y Metzger: no se repiten.'));
        expect(screen.getByTestId('brief-slot-notices')).toHaveTextContent('slotSourcesFilled');
    });

    it('B4: sin la regla en el tipo, la gramática (que solo conviene alternar) no entra al hueco', async () => {
        proyectos = [nt785({}, { noRepeatSourceTypes: undefined })];
        abrir();
        await waitFor(() => expect(encuadre().value).toContain('Prohibido citar Adamson, Mayor y Metzger:'));
    });

    it('B5: un pasaje fijo en el encargo se avisa y se puede reemplazar aquí o dejar como hueco en la plantilla', async () => {
        encuadres = encargo('Trabajo práctico sobre Santiago 4:1-10. Pregunta sobre Stg. 4:12.');
        abrir();
        await waitFor(() => expect(screen.getByTestId('brief-stale-passage')).toHaveTextContent('Santiago 4:1-10'));
        // Viene marcado: es el pasaje del TP anterior del mismo tipo.
        expect(screen.getByLabelText('Santiago 4:1-10')).toBeChecked();
        fireEvent.click(screen.getByText(/create\.brief\.staleFixTemplate/));
        await waitFor(() => expect(updateBrief).toHaveBeenCalledWith({ briefId: 'enc', body: 'Trabajo práctico sobre [PASAJE]. Pregunta sobre Stg. 4:12.' }));
        fireEvent.click(screen.getByText(/create\.brief\.staleUseHere/));
        expect(encuadre().value).toBe('Trabajo práctico sobre Santiago 4:11-17. Pregunta sobre Stg. 4:12.');
    });

    it('revisión de B5: un rango legítimo no se reemplaza sin marcarlo, ni aquí ni en la plantilla', async () => {
        encuadres = encargo('Escriba sobre Santiago 4:1-10 en el contexto de Santiago 4 y a la luz de Santiago 1:19-21.');
        abrir();
        await waitFor(() => expect(screen.getByTestId('brief-stale-passage')).toBeInTheDocument());
        expect(screen.getByLabelText('Santiago 1:19-21')).not.toBeChecked();
        expect(screen.queryByLabelText('Santiago 4')).toBeNull();
        fireEvent.click(screen.getByText(/create\.brief\.staleFixTemplate/));
        await waitFor(() => expect(updateBrief).toHaveBeenCalledWith({ briefId: 'enc', body: 'Escriba sobre [PASAJE] en el contexto de Santiago 4 y a la luz de Santiago 1:19-21.' }));
        fireEvent.click(screen.getByText(/create\.brief\.staleUseHere/));
        expect(encuadre().value).toBe('Escriba sobre Santiago 4:11-17 en el contexto de Santiago 4 y a la luz de Santiago 1:19-21.');
    });

    it('revisión de B5: sin TP anterior que coincida, nada viene marcado y los botones esperan', async () => {
        resumenes = [];
        encuadres = encargo('Escriba sobre Santiago 4:1-10.');
        abrir();
        await waitFor(() => expect(screen.getByLabelText('Santiago 4:1-10')).not.toBeChecked());
        expect(screen.getByText(/create\.brief\.staleUseHere/).closest('button')).toBeDisabled();
        expect(screen.getByText(/create\.brief\.staleFixTemplate/).closest('button')).toBeDisabled();
        fireEvent.click(screen.getByLabelText('Santiago 4:1-10'));
        expect(screen.getByText(/create\.brief\.staleUseHere/).closest('button')).not.toBeDisabled();
    });

    it('revisión de B4: la primera entrega de un tipo no toma lo citado por otro tipo, un suelto ni un archivado', async () => {
        resumenes = [
            { ...tp8, id: 'ens', projectWorkTypeId: 'ens' },
            { ...tp8, id: 'suelto', projectId: null, projectWorkTypeId: null },
        ];
        proyectos = [{ ...nt785({}), workTypes: [...nt785({}).workTypes, { id: 'ens', label: 'Ensayo' }] }];
        abrir();
        await waitFor(() => expect(screen.getByTestId('brief-slot-notices')).toHaveTextContent('slotSourcesNoPrevious'));
        expect(encuadre().value).toContain('[FUENTES DE LA SEMANA ANTERIOR]');
        cleanup();
        resumenes = [{ ...tp8, archivedAt: new Date(2026, 9, 22) }];
        abrir();
        await waitFor(() => expect(screen.getByTestId('brief-slot-notices')).toHaveTextContent('slotSourcesNoPrevious'));
    });

    it('revisión de B4: con «no repetir» apagado no dice que falta la entrega anterior', async () => {
        proyectos = [{ ...nt785({}), bibliographyCriteria: { noRepeatSources: false } }];
        abrir();
        await waitFor(() => expect(screen.getByTestId('brief-slot-notices')).toHaveTextContent('slotSourcesRuleOff'));
    });

    it('B9: llegando desde la entrada, no se muestra el selector de perfil', () => {
        abrir();
        expect(screen.queryByLabelText('paperSetup.workProfile.pickLabel')).toBeNull();
    });

    it('B8: el método elegido se guarda en el tipo de trabajo (marcado si el tipo no tenía)', async () => {
        abrir();
        fireEvent.change(screen.getByLabelText('method.label'), { target: { value: 'mixed' } });
        expect(screen.getByTestId('method-to-work-type').querySelector('input')).toBeChecked();
        fireEvent.click(screen.getByText('create.submit'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ workTypes: expect.any(Array) })));
        const tipos = mutateAsync.mock.calls.find(c => c[0].workTypes)![0].workTypes;
        expect(tipos[0]).toMatchObject({ id: 'tp', exegeticalMethod: 'mixed', noRepeatSourceTypes: comentarios });
    });

    it('B8: con el método del tipo puesto, no se ofrece; desmarcado, no se guarda', async () => {
        proyectos = [nt785({}, { exegeticalMethod: 'mixed' })];
        abrir();
        expect(screen.queryByTestId('method-to-work-type')).toBeNull();
        fireEvent.change(screen.getByLabelText('method.label'), { target: { value: 'exegetical' } });
        const casilla = screen.getByTestId('method-to-work-type').querySelector('input')!;
        expect(casilla).not.toBeChecked();
        fireEvent.click(screen.getByText('create.submit'));
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(mutateAsync.mock.calls.some(c => c[0].workTypes)).toBe(false);
    });
});
