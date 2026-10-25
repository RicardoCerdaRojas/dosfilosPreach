import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Un proyecto sin estudios (la serie de Nehemías que empieza) elige sus
 * libros: sin ellos no hay guía de búsqueda ni títulos del catálogo.
 */
const updateProject = vi.fn();
let proyecto: Record<string, unknown> = {};
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: [proyecto], updateProject: { mutateAsync: updateProject, isPending: false } }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [] }) }));
let estudios: unknown[] = [];
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: estudios }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@dosfilos/application', () => ({ exegesisService: { extractProjectBibliography: { execute: vi.fn() } }, MAX_BIBLIOGRAPHY_TEXT_CHARS: 60_000 }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u' } }) }));
const { ProjectStateOfArtPage } = await import('../ProjectStateOfArtPage');

const montar = () => render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/dashboard/projects/neh/estado-del-arte']}>
            <Routes><Route path="/dashboard/projects/:projectId/estado-del-arte" element={<ProjectStateOfArtPage />} /></Routes>
        </MemoryRouter>
    </QueryClientProvider>,
);

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    updateProject.mockImplementation(async (args: Record<string, unknown>) => { const { projectId: _p, ...c } = args; proyecto = { ...proyecto, ...c }; return {}; });
    estudios = [];
    proyecto = { id: 'neh', userId: 'u', title: 'Nehemías', color: 'amber', type: 'exegetical', workTypes: [] };
});

describe('libros del proyecto', () => {
    it('sin estudios ni libros no hay guía; al elegir Nehemías aparecen la guía y los títulos del catálogo, y se guarda', async () => {
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        expect(screen.getByText('stateOfArt.guide.empty')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('stateOfArt.criteria.addBook'), { target: { value: 'NEH' } });
        expect(within(screen.getByRole('list', { name: 'stateOfArt.criteria.books' })).getByText('Nehemías')).toBeInTheDocument();
        // La guía ya busca el libro en IxTheo y en español.
        expect(screen.getByText('"Nehemiah" OR "Ezra-Nehemiah"')).toBeInTheDocument();
        expect(screen.getAllByText('Nehemías comentario').length).toBeGreaterThan(0);
        fireEvent.click(screen.getByText('stateOfArt.save'));
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        expect((updateProject.mock.calls[0]![0] as { bibliographyCriteria: { bibleBooks: string[] } }).bibliographyCriteria.bibleBooks).toEqual(['NEH']);
        // Los títulos reconocidos de Nehemías entran como candidatas.
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.candidates/ }));
        fireEvent.click(screen.getByText('stateOfArt.gather'));
        // Williamson (WBC) y Myers (Anchor): dos obras con el mismo título.
        expect(screen.getAllByText('Ezra, Nehemiah')).toHaveLength(2);
        expect(screen.getByText(/Nehemías: siervo de Dios en tiempos de cambio/)).toBeInTheDocument();
    });

    it('un libro elegido se quita; los de los estudios no se tocan hasta elegir otros', () => {
        proyecto = { ...proyecto, bibliographyCriteria: { bibleBooks: ['NEH', 'EZR'] } };
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        const lista = screen.getByRole('list', { name: 'stateOfArt.criteria.books' });
        fireEvent.click(within(lista).getByRole('button', { name: /stateOfArt.criteria.removeBook.*Esdras/ }));
        expect(within(screen.getByRole('list', { name: 'stateOfArt.criteria.books' })).queryByText('Esdras')).toBeNull();
        expect(screen.getByText('unsaved')).toBeInTheDocument();
    });

    it('con estudios, sus libros valen hasta elegir otro, y al elegirlo se conservan', () => {
        estudios = [{ id: 'tp', projectId: 'neh', linkedProjectIds: [], passage: { bookId: 'NEH', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 11 }, sources: [] }];
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        expect(screen.getByText('stateOfArt.criteria.fromStudies')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('stateOfArt.criteria.addBook'), { target: { value: 'EZR' } });
        const lista = within(screen.getByRole('list', { name: 'stateOfArt.criteria.books' }));
        expect(lista.getByText('Nehemías')).toBeInTheDocument();
        expect(lista.getByText('Esdras')).toBeInTheDocument();
        expect(screen.queryByText('stateOfArt.criteria.fromStudies')).toBeNull();
    });
});
