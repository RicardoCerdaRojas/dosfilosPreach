import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * Etapa 2 (ADR-046): la página del estado del arte. Candidatas de varios
 * orígenes, evaluación, aprobar, descartar con razón, por conseguir, y el
 * guardado que deja `sourceIds` acotado a lo aprobado.
 */
const updateProject = vi.fn().mockResolvedValue({});
let proyecto: Record<string, unknown> = {};
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: [proyecto], updateProject: { mutateAsync: updateProject, isPending: false } }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [
    { id: 'ropes', title: 'A Critical and Exegetical Commentary on the Epistle of St. James', author: 'James Hardy Ropes', exegeticalType: 'commentary-critical', coversBibleBooks: ['JAS'] },
    { id: 'wallace', title: 'Greek Grammar Beyond the Basics', author: 'Daniel B. Wallace', exegeticalType: 'grammar-syntax', coversBibleBooks: [] },
    { id: 'pillar', title: 'The Letter of James', author: 'Douglas J. Moo', exegeticalType: 'commentary-expository', coversBibleBooks: ['ROM'] },
] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [
    { id: 'r-tp', rubric: { sourceRequirements: [{ sourceType: 'lexicon-technical', minimum: 1 }], courseBibliography: [{ title: 'Greek Grammar Beyond the Basics', author: 'Wallace', requirement: 'required' }] } },
] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [
    { id: 'tp8', projectId: 'nt785', linkedProjectIds: [], passage: { bookId: 'JAS' }, sources: [{ sourceLibraryResourceId: 'ropes', corpusId: 'ropes', sourceType: 'commentary-critical', displayLabel: 'ICC James', citationKey: null }] },
] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { ProjectStateOfArtPage } = await import('../ProjectStateOfArtPage');

const montar = () => render(
    <MemoryRouter initialEntries={['/dashboard/projects/nt785/estado-del-arte']}>
        <Routes><Route path="/dashboard/projects/:projectId/estado-del-arte" element={<ProjectStateOfArtPage />} /></Routes>
    </MemoryRouter>,
);
const guardado = () => updateProject.mock.calls.at(-1)![0] as { bibliography: Array<Record<string, unknown>>; bibliographyCriteria: Record<string, unknown> };
const ficha = (titulo: RegExp) => screen.getByText(titulo).closest('li')! as HTMLElement;

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    proyecto = { id: 'nt785', userId: 'u', title: 'NT785', color: 'amber', type: 'course', workTypes: [{ id: 'tp', label: 'TP Semanal', rubricTemplateId: 'r-tp' }] };
});

describe('ProjectStateOfArtPage', () => {
    it('buscar candidatas cruza sílabo, estudios y biblioteca en una ficha por obra', () => {
        montar();
        fireEvent.click(screen.getByText('stateOfArt.gather'));
        const wallace = ficha(/Greek Grammar Beyond the Basics/);
        expect(within(wallace).getByText('stateOfArt.weight.required')).toBeInTheDocument();
        expect(within(wallace).getByText('stateOfArt.origin.syllabus')).toBeInTheDocument();
        expect(within(wallace).getByText('stateOfArt.origin.library')).toBeInTheDocument();
        expect(screen.getAllByText(/Greek Grammar Beyond the Basics/)).toHaveLength(1);
        expect(within(ficha(/ICC James|Epistle of St. James/)).getByText('stateOfArt.origin.studies')).toBeInTheDocument();
    });

    it('aprobar y guardar deja la evaluación de la biblioteca y sourceIds viaja por la bibliografía', async () => {
        montar();
        fireEvent.click(screen.getByText('stateOfArt.gather'));
        fireEvent.click(within(ficha(/ICC James|Epistle of St. James/)).getByText('stateOfArt.approve'));
        fireEvent.click(screen.getByText('stateOfArt.save'));
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        const icc = guardado().bibliography.find(e => e.resourceId === 'ropes')!;
        expect(icc).toMatchObject({ decision: 'approved', evaluation: { coversBook: true } });
        expect(typeof icc.decidedAt).toBe('string');
    });

    it('descartar pide una razón antes de confirmar', () => {
        montar();
        fireEvent.click(screen.getByText('stateOfArt.gather'));
        const w = ficha(/Greek Grammar Beyond the Basics/);
        fireEvent.click(within(w).getByText('stateOfArt.discard'));
        const confirmar = within(w).getByText('stateOfArt.confirmDiscard').closest('button')!;
        expect(confirmar).toBeDisabled();
        fireEvent.change(within(w).getByLabelText('stateOfArt.discardReason'), { target: { value: 'Ya está Robertson' } });
        fireEvent.click(confirmar);
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.discarded/ }));
        expect(screen.getByText(/Ya está Robertson/)).toBeInTheDocument();
    });

    it('una obra agregada a mano queda por conseguir hasta ligarla a un libro', () => {
        montar();
        fireEvent.click(screen.getByText('stateOfArt.gather'));
        fireEvent.change(screen.getAllByLabelText('stateOfArt.field.title')[0]!, { target: { value: 'James (Pillar)' } });
        fireEvent.change(screen.getAllByLabelText('stateOfArt.field.author')[0]!, { target: { value: 'Moo' } });
        fireEvent.click(screen.getByText('stateOfArt.addManual'));
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.toAcquire/ }));
        const moo = ficha(/James \(Pillar\)/);
        fireEvent.click(within(moo).getByText('stateOfArt.gotIt'));
        // Un libro que ya tiene su ficha no se ofrece: serían dos fichas del mismo libro.
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.toAcquire/ }));
        expect(within(within(moo).getByLabelText('stateOfArt.linkResource')).queryByText(/Critical and Exegetical/)).toBeNull();
        fireEvent.change(within(moo).getByLabelText('stateOfArt.linkResource'), { target: { value: 'pillar' } });
        expect(screen.queryByText(/James \(Pillar\)/)).toBeNull();
    });

    it('una ficha a mano sin título no deja guardar y dice por qué (revisión)', () => {
        montar();
        fireEvent.change(screen.getAllByLabelText('stateOfArt.field.title')[0]!, { target: { value: 'Obra' } });
        fireEvent.click(screen.getByText('stateOfArt.addManual'));
        const obra = ficha(/^Obra$/);
        fireEvent.click(within(obra).getByText('stateOfArt.evaluate'));
        fireEvent.change(within(obra).getByLabelText('stateOfArt.field.title'), { target: { value: '  ' } });
        expect(screen.getByText('stateOfArt.save').closest('button')).toBeDisabled();
        expect(screen.getByText('stateOfArt.error.title')).toBeInTheDocument();
    });

    it('los criterios se guardan, y avisa lo que piden las rúbricas sin obra aprobada', async () => {
        montar();
        expect(screen.getByText(/stateOfArt.warning.missingType/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        fireEvent.change(screen.getByLabelText(/stateOfArt.criteria.inclusion/), { target: { value: 'Comentarios críticos posteriores a 1980' } });
        // En un curso, «no repetir» rige sin decidir: la casilla lo muestra (revisión de la etapa 2).
        const noRepetir = screen.getByLabelText(/stateOfArt.criteria.noRepeat/) as HTMLInputElement;
        expect(noRepetir.checked).toBe(true);
        fireEvent.click(noRepetir);
        expect(screen.getByText('unsaved')).toBeInTheDocument();
        fireEvent.click(screen.getByText('stateOfArt.save'));
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        expect(guardado().bibliographyCriteria).toMatchObject({ inclusion: 'Comentarios críticos posteriores a 1980', noRepeatSources: false });
    });
});
