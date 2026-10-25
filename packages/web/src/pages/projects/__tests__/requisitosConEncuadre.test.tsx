import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Fase «Encuadre de la serie»: con encuadre, los libros del proyecto son del
 * encuadre. En Requisitos se ven en solo lectura, con «Cambiar en el
 * encuadre», y guardar el estado del arte no los pisa. Sin encuadre, como hoy.
 */
const updateProject = vi.fn();
let proyecto: Record<string, unknown> = {};
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: [proyecto], updateProject: { mutateAsync: updateProject, isPending: false } }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@dosfilos/application', () => ({ exegesisService: { extractProjectBibliography: { execute: vi.fn() } }, MAX_BIBLIOGRAPHY_TEXT_CHARS: 60_000 }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u' } }) }));
const { ProjectStateOfArtPage } = await import('../ProjectStateOfArtPage');

const montar = () => render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/dashboard/projects/ezr/estado-del-arte']}>
            <Routes>
                <Route path="/dashboard/projects/:projectId/estado-del-arte" element={<ProjectStateOfArtPage />} />
                <Route path="/dashboard/projects/:projectId" element={<p>panel del proyecto</p>} />
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>,
);
const requisitos = () => fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    updateProject.mockResolvedValue({});
    proyecto = {
        id: 'ezr', userId: 'u', title: 'Esdras', color: 'amber', type: 'exegetical', workTypes: [],
        bibliographyCriteria: { bibleBooks: ['EZR'], inclusion: 'Comentarios críticos' },
        framing: { purpose: 'preach', centralIdea: 'Dios restaura.' },
    };
});

describe('Requisitos con encuadre', () => {
    it('los libros se ven en solo lectura y el enlace lleva al encuadre del panel', () => {
        montar();
        requisitos();
        const lista = screen.getByRole('list', { name: 'stateOfArt.criteria.books' });
        expect(within(lista).getByText('Esdras')).toBeInTheDocument();
        expect(within(lista).queryByRole('button')).toBeNull();
        expect(screen.queryByLabelText('stateOfArt.criteria.addBook')).toBeNull();
        const enlace = screen.getByRole('link', { name: /stateOfArt.criteria.changeInFraming/ });
        // Con «volver»: al guardar el encuadre, el panel ofrece volver a Requisitos.
        expect(enlace.getAttribute('href')).toBe('/dashboard/projects/ezr?encuadre=1&volver=requisitos');
        fireEvent.click(enlace);
        expect(screen.getByText('panel del proyecto')).toBeInTheDocument();
    });

    it('guardar el estado del arte manda los libros GUARDADOS, no los de su borrador', async () => {
        montar();
        requisitos();
        fireEvent.change(screen.getByLabelText(/stateOfArt\.criteria\.exclusionHint/), { target: { value: 'Devocio' } });
        // Lo guardado cambió mientras tanto (el encuadre agregó Nehemías); la
        // página vuelve a pintar con lo nuevo y el borrador conserva su cambio.
        proyecto = { ...proyecto, bibliographyCriteria: { bibleBooks: ['EZR', 'NEH'], inclusion: 'Comentarios críticos' } };
        fireEvent.change(screen.getByLabelText(/stateOfArt\.criteria\.exclusionHint/), { target: { value: 'Devocionales' } });
        fireEvent.click(screen.getByText('stateOfArt.save'));
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        const crit = (updateProject.mock.calls[0]![0] as { bibliographyCriteria: { bibleBooks: string[]; exclusion: string } }).bibliographyCriteria;
        expect(crit.exclusion).toBe('Devocionales');
        expect(crit.bibleBooks).toEqual(['EZR', 'NEH']);
    });

    it('sin encuadre (Curso, Investigación), los libros se eligen aquí como siempre', () => {
        proyecto = { ...proyecto, type: 'course', framing: undefined };
        montar();
        requisitos();
        expect(screen.getByLabelText('stateOfArt.criteria.addBook')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /stateOfArt.criteria.changeInFraming/ })).toBeNull();
        expect(within(screen.getByRole('list', { name: 'stateOfArt.criteria.books' })).getByRole('button', { name: /removeBook/ })).toBeInTheDocument();
    });
});
