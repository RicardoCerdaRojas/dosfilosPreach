import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    { id: 'otro', title: 'A Theology of Paul the Apostle', author: 'James D. G. Dunn', exegeticalType: 'theological-monograph', coversBibleBooks: ['ROM'] },
] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [
    { id: 'r-tp', rubric: { sourceRequirements: [{ sourceType: 'lexicon-technical', minimum: 1 }, { sourceType: 'grammar-syntax', minimum: 1 }], courseBibliography: [{ title: 'Greek Grammar Beyond the Basics', author: 'Wallace', requirement: 'required' }] } },
] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [
    { id: 'tp8', projectId: 'nt785', linkedProjectIds: [], passage: { bookId: 'JAS' }, sources: [{ sourceLibraryResourceId: 'ropes', corpusId: 'ropes', sourceType: 'commentary-critical', displayLabel: 'ICC James', citationKey: null }] },
    { id: 'tp6', projectId: null, linkedProjectIds: [], passage: { bookId: 'JAS' }, sources: [{ sourceLibraryResourceId: 'nicnt', corpusId: 'nicnt', sourceType: 'commentary-expository', displayLabel: 'NICNT', citationKey: null }] },
    { id: 'tp7', projectId: null, linkedProjectIds: [], passage: { bookId: 'JAS' }, sources: [{ sourceLibraryResourceId: 'nicnt', corpusId: 'nicnt', sourceType: 'commentary-expository', displayLabel: 'NICNT', citationKey: null }] },
] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const leerBibliografia = vi.fn();
vi.mock('@dosfilos/application', () => ({ exegesisService: { extractProjectBibliography: { execute: leerBibliografia } }, MAX_BIBLIOGRAPHY_TEXT_CHARS: 60_000 }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u' } }) }));
const { ProjectStateOfArtPage } = await import('../ProjectStateOfArtPage');
const { cleanBibliographyCriteria, cleanProjectBibliography, cleanSearchLog } = await import('@dosfilos/domain');
/** Firestore devuelve los mapas con otro orden de claves: la página tiene que reconciliarse igual. */
const alfabetico = (v: unknown): unknown => Array.isArray(v) ? v.map(alfabetico)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, alfabetico((v as Record<string, unknown>)[k])])) : v;

const montar = () => render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/dashboard/projects/nt785/estado-del-arte']}>
            <Routes><Route path="/dashboard/projects/:projectId/estado-del-arte" element={<ProjectStateOfArtPage />} /></Routes>
        </MemoryRouter>
    </QueryClientProvider>,
);
const guardado = () => updateProject.mock.calls.at(-1)![0] as { bibliography: Array<Record<string, unknown>>; bibliographyCriteria: Record<string, unknown> };
const ficha = (titulo: RegExp) => screen.getByText(titulo).closest('li')! as HTMLElement;

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    // Guardar escribe en el proyecto, como Firestore + el refetch: la página se reconcilia con lo guardado.
    // Limpia como UpdateProjectUseCase y reordena como Firestore (segunda revisión de la 2b).
    updateProject.mockImplementation(async (args: { bibliography: never; bibliographyCriteria: never; bibliographySearchLog?: never }) => {
        proyecto = {
            ...proyecto,
            bibliography: alfabetico(cleanProjectBibliography(args.bibliography)),
            bibliographyCriteria: alfabetico(cleanBibliographyCriteria(args.bibliographyCriteria)),
            ...(args.bibliographySearchLog ? { bibliographySearchLog: alfabetico(cleanSearchLog(args.bibliographySearchLog)) } : {}),
        };
        return {};
    });
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
        expect(within(ficha(/ICC James|Critical and Exegetical Commentary on the Epistle of St\. James/)).getByText('stateOfArt.origin.studies')).toBeInTheDocument();
    });

    it('aprobar y guardar deja la evaluación de la biblioteca y sourceIds viaja por la bibliografía', async () => {
        montar();
        fireEvent.click(screen.getByText('stateOfArt.gather'));
        fireEvent.click(within(ficha(/ICC James|Critical and Exegetical Commentary on the Epistle of St\. James/)).getByText('stateOfArt.approve'));
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
        // Moo (Pillar) ya tiene su ficha por el catálogo curado (etapa 2c): tampoco se ofrece.
        expect(within(within(moo).getByLabelText('stateOfArt.linkResource')).queryByText('The Letter of James')).toBeNull();
        fireEvent.change(within(moo).getByLabelText('stateOfArt.linkResource'), { target: { value: 'otro' } });
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
        // Lo que piden las rúbricas está en la cobertura, no en los avisos.
        expect(screen.getByText('stateOfArt.coverage.title')).toBeInTheDocument();
        expect(screen.queryByText(/stateOfArt.warning.missingType/)).toBeNull();
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

    describe('la cobertura conecta lo que falta con las candidatas (prueba del fundador)', () => {
        it('pulsar un tipo de la cobertura muestra solo sus candidatas', () => {
            montar();
            fireEvent.click(screen.getByText('stateOfArt.gather'));
            const cobertura = screen.getByRole('region', { name: 'stateOfArt.coverage.title' });
            fireEvent.click(within(cobertura).getByText('sourceTypes.grammar-syntax.label').closest('button')!);
            expect(screen.getByText(/Greek Grammar Beyond the Basics/)).toBeInTheDocument();
            expect(screen.queryByText(/Critical and Exegetical Commentary on the Epistle of St\. James|ICC James/)).toBeNull();
            fireEvent.click(within(cobertura).getByText('stateOfArt.coverage.clear'));
            expect(screen.getByText(/ICC James|Critical and Exegetical Commentary on the Epistle of St\. James/)).toBeInTheDocument();
        });

        it('una aprobada sin clasificar propone la clasificación de tus trabajos y se aplica con un clic', () => {
            proyecto = { ...proyecto, bibliography: [{ id: 'n', title: 'NICNT', resourceId: 'nicnt', sourceType: null, weight: 'recommended', decision: 'approved', origins: ['library'] }] };
            montar();
            fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.approved/ }));
            const nicnt = ficha(/^NICNT$/);
            fireEvent.click(within(nicnt).getByText(/sourceTypes.commentary-expository.label/));
            expect(within(ficha(/^NICNT$/)).getAllByText(/sourceTypes.commentary-expository.label/).length).toBeGreaterThan(0);
            expect(screen.getByText('unsaved')).toBeInTheDocument();
        });

        it('salir con cambios sin guardar pide confirmación', () => {
            montar();
            fireEvent.change(screen.getAllByLabelText('stateOfArt.field.title')[0]!, { target: { value: 'Obra nueva' } });
            fireEvent.click(screen.getByText('stateOfArt.addManual'));
            const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
            fireEvent.click(screen.getByText('NT785'));
            expect(confirmar).toHaveBeenCalledWith('stateOfArt.leaveUnsaved');
            confirmar.mockRestore();
        });
    });

    it('importar el sílabo: revisar, confirmar, guardar de una vez y ver lo que entró; repetirlo no duplica', async () => {
        leerBibliografia.mockResolvedValue({
            documentKind: 'assignment',
            entries: [
                { title: 'Greek Grammar Beyond the Basics', author: 'Wallace, Daniel B.', requirement: 'recommended', sourceType: 'grammar-syntax' },
                { title: 'Comentario de la epístola de Santiago', author: 'Moo, Douglas J.', requirement: 'required', sourceType: 'commentary-expository' },
            ],
            requirementItems: [
                { kind: 'quantity', text: 'Mínimo 100 páginas de artículos académicos', sourceType: 'journal-article', minimum: 100, unit: 'pages' },
                { kind: 'rule', text: 'No usar la misma fuente dos semanas consecutivas' },
                { kind: 'date-range', text: 'Fuentes antiguas y actuales' },
            ],
            requirements: 'Mínimo 100 páginas de artículos académicos.',
            prohibitions: 'No usar la misma fuente dos semanas consecutivas.',
        });
        // Una candidata de otro origen: el filtro de «lo recién importado» no la muestra.
        proyecto = { ...proyecto, bibliography: [{ id: 'otra', title: 'Obra de otro origen', weight: 'recommended', decision: 'candidate', origins: ['manual'] }] };
        montar();
        const importar = async () => {
            fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
            fireEvent.click(screen.getByText('stateOfArt.import.writeList'));
            fireEvent.change(screen.getByLabelText('stateOfArt.import.textLabel'), { target: { value: 'bibliografía del sílabo' } });
            fireEvent.click(screen.getByText('stateOfArt.import.read'));
            fireEvent.click(await screen.findByText(/^stateOfArt.review.confirm/));
        };
        await importar();
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
        const g = updateProject.mock.calls[0]![0] as { bibliography: Array<Record<string, unknown>>; bibliographyCriteria: Record<string, unknown>; bibliographySearchLog: Array<Record<string, unknown>> };
        expect(g.bibliography.find(e => /Santiago/.test(String(e.title)))).toMatchObject({ weight: 'required', origins: ['syllabus'] });
        // Solo obras (decisión del fundador, 2026-10-24): los requisitos y prohibiciones que trajera la lectura no tocan los criterios.
        expect(g.bibliographyCriteria).toEqual({});
        expect(g.bibliographySearchLog).toEqual([expect.objectContaining({ kind: 'syllabus', found: 2, added: 2 })]);
        // Lleva a Candidatas, mostrando solo lo que entró del sílabo.
        await waitFor(() => expect(screen.getByRole('tab', { name: /stateOfArt.step.candidates/ })).toHaveAttribute('aria-selected', 'true'));
        expect(within(ficha(/Comentario de la epístola de Santiago/)).getByText('stateOfArt.weight.required')).toBeInTheDocument();
        expect(screen.getByText(/stateOfArt.coverage.showing/)).toBeInTheDocument();
        expect(screen.queryByText('Obra de otro origen')).toBeNull();
        // Lo importado quedó guardado con los mismos ids: no queda nada «sin guardar».
        expect(screen.queryByText('unsaved')).toBeNull();

        // Otra vez la misma lista: las dos ya están, entran desmarcadas y no hay nada nuevo que agregar.
        await importar();
        expect(screen.getByText(/^stateOfArt.review.confirm/).closest('button')).toBeDisabled();
        // Marcar una solo completa su ficha: no la duplica, y el registro suma la importación.
        fireEvent.click(screen.getByLabelText(/^Comentario de la epístola de Santiago/));
        fireEvent.click(screen.getByText(/^stateOfArt.review.confirm/));
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(2));
        const h = updateProject.mock.calls[1]![0] as typeof g;
        expect(h.bibliography.filter(e => /Santiago/.test(String(e.title)))).toHaveLength(1);
        expect(h.bibliographySearchLog).toHaveLength(2);
        expect(h.bibliographySearchLog[1]).toMatchObject({ found: 2, added: 0 });
    });

    it('si guardar la importación falla, nada cambia en pantalla y la revisión queda para reintentar', async () => {
        leerBibliografia.mockResolvedValue({ documentKind: 'bibliography', entries: [{ title: 'Obra importada única', author: 'X', requirement: 'recommended' }], requirementItems: [], requirements: null, prohibitions: null });
        updateProject.mockRejectedValueOnce(new Error('sin red'));
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        fireEvent.click(screen.getByText('stateOfArt.import.writeList'));
        fireEvent.change(screen.getByLabelText('stateOfArt.import.textLabel'), { target: { value: 'una bibliografía' } });
        fireEvent.click(screen.getByText('stateOfArt.import.read'));
        fireEvent.click(await screen.findByText(/^stateOfArt.review.confirm/));
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
        expect(await screen.findByText(/^stateOfArt.review.confirm/)).toBeInTheDocument();
        expect(screen.queryByText('unsaved')).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.candidates/ }));
        expect(screen.queryByText('Obra importada única')).toBeNull();
    });

    it('los requisitos del nivel se proponen sin repetirse y lo que no se pudo medir lleva a esas fichas', async () => {
        proyecto = { ...proyecto, bibliography: [
            { id: 'a1', title: 'Artículo sin año', sourceType: 'journal-article', weight: 'recommended', decision: 'approved', origins: ['manual'] },
            { id: 'a2', title: 'Artículo con año', year: 2019, sourceType: 'journal-article', weight: 'recommended', decision: 'approved', origins: ['manual'] },
        ] };
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        expect(screen.getByText('stateOfArt.requirement.empty')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('stateOfArt.requirement.level'), { target: { value: 'seminary' } });
        fireEvent.click(screen.getByText('stateOfArt.requirement.propose'));
        const editor = screen.getByRole('region', { name: 'stateOfArt.requirement.title' });
        const cuantos = within(editor).getAllByRole('listitem').length;
        expect(cuantos).toBeGreaterThan(2);
        fireEvent.click(screen.getByText('stateOfArt.requirement.propose'));
        expect(within(editor).getAllByRole('listitem')).toHaveLength(cuantos);
        // El de épocas no puede medir una ficha sin año: lo dice y lleva a ella.
        fireEvent.click(within(editor).getByText(/stateOfArt.requirement.unmeasurable.date-range/));
        await waitFor(() => expect(screen.getByRole('tab', { name: /stateOfArt.step.approved/ })).toHaveAttribute('aria-selected', 'true'));
        expect(screen.getByText(/Artículo sin año/)).toBeInTheDocument();
        expect(screen.queryByText(/Artículo con año/)).toBeNull();
        expect(screen.getByText(/stateOfArt.coverage.showing/)).toBeInTheDocument();
    });

    it('los mínimos por tipo de los requisitos del proyecto entran en la cobertura', () => {
        proyecto = { ...proyecto, workTypes: [], bibliographyCriteria: { requirementItems: [{ id: 'q', kind: 'minimum-type', sourceType: 'commentary-critical', minimum: 3, text: 'Tres comentarios críticos', origin: 'manual' }] } };
        montar();
        const cobertura = screen.getByRole('region', { name: 'stateOfArt.coverage.title' });
        const fila = within(cobertura).getByText('sourceTypes.commentary-critical.label').closest('button')!;
        expect(within(fila).getByText(/stateOfArt.requirement.coverageLabel ≥ 3/)).toBeInTheDocument();
    });

    it('un requisito sin su cifra no se agrega, y uno guardado sin cifra se ve incompleto, no cumplido', () => {
        proyecto = { ...proyecto, bibliographyCriteria: { requirementItems: [{ id: 'v', kind: 'variety', text: 'Variedad de recursos', origin: 'syllabus' }] } };
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        const editor = screen.getByRole('region', { name: 'stateOfArt.requirement.title' });
        expect(within(editor).getAllByLabelText('stateOfArt.requirement.incomplete').length).toBeGreaterThan(0);
        expect(within(editor).queryByLabelText('stateOfArt.coverage.covered')).toBeNull();
        fireEvent.change(within(editor).getByLabelText('stateOfArt.requirement.kindLabel'), { target: { value: 'minimum-type' } });
        fireEvent.change(within(editor).getByLabelText('stateOfArt.requirement.textLabel'), { target: { value: 'Comentarios' } });
        expect(within(editor).getByText('stateOfArt.requirement.add').closest('button')).toBeDisabled();
        expect(within(editor).getByText('stateOfArt.requirement.needs.minimum-type')).toBeInTheDocument();
    });

    it('corregir una cifra supuesta la deja de declarar como supuesto', async () => {
        proyecto = { ...proyecto, bibliographyCriteria: { requirementItems: [{ id: 'd', kind: 'date-range', text: 'Antiguas y actuales', before: 1950, after: 2011, recentMinimum: 1, assumed: ['before'], origin: 'syllabus' }] } };
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        expect(screen.getByText(/stateOfArt.requirement.assumedNote/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('stateOfArt.requirement.field.before · Antiguas y actuales'), { target: { value: '1900' } });
        expect(screen.queryByText(/stateOfArt.requirement.assumedNote/)).toBeNull();
        // Sin supuestos queda `assumed: null` en pantalla y sin la clave en lo guardado: igual se reconcilia.
        fireEvent.click(screen.getByText('stateOfArt.save'));
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByText('unsaved')).toBeNull());
    });

    it('importar guarda lo guardado más lo importado: lo pendiente espera su «Guardar» y no se pierde', async () => {
        proyecto = { ...proyecto, type: 'research', bibliography: [{ id: 'e1', title: 'Obra guardada', weight: 'recommended', decision: 'candidate', origins: ['manual'] }], bibliographyCriteria: { inclusion: 'Lo guardado', noRepeatSources: false } };
        leerBibliografia.mockResolvedValue({
            documentKind: 'assignment',
            entries: [{ title: 'Obra importada', author: 'Autor', requirement: 'recommended' }],
            requirementItems: [{ kind: 'rule', text: 'No usar la misma fuente dos semanas consecutivas' }, { kind: 'rule', text: 'No usar fuentes de internet' }],
            requirements: null, prohibitions: null,
        });
        montar();
        // Cambios sin guardar: una ficha sin título (error) y un criterio a medio escribir.
        fireEvent.click(within(ficha(/Obra guardada/)).getByText('stateOfArt.evaluate'));
        fireEvent.change(within(ficha(/Obra guardada/)).getByLabelText('stateOfArt.field.title'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        fireEvent.change(screen.getByLabelText(/stateOfArt.criteria.inclusion/), { target: { value: 'A medio escribir' } });
        fireEvent.click(screen.getByText('stateOfArt.import.writeList'));
        fireEvent.change(screen.getByLabelText('stateOfArt.import.textLabel'), { target: { value: 'bibliografía del sílabo' } });
        fireEvent.click(screen.getByText('stateOfArt.import.read'));
        fireEvent.click(await screen.findByText(/^stateOfArt.review.confirm/));
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
        const g = guardado();
        expect(g.bibliography.map(e => e.title)).toEqual(['Obra guardada', 'Obra importada']);
        expect(g.bibliographyCriteria).toMatchObject({ inclusion: 'Lo guardado', noRepeatSources: false });
        // En pantalla sigue lo pendiente, más lo importado, y se puede guardar después.
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        expect((screen.getByLabelText(/stateOfArt.criteria.inclusion/) as HTMLTextAreaElement).value).toBe('A medio escribir');
        expect(screen.getByText('stateOfArt.save').closest('button')).toBeDisabled();
        expect(screen.getByText(/stateOfArt.fixErrors/)).toBeInTheDocument();
    });

    it('importar una obra que en pantalla se renombró no le da a la nueva el id de la renombrada', async () => {
        proyecto = { ...proyecto, bibliography: [{ id: 's', title: 'Obra guardada X', weight: 'recommended', decision: 'candidate', origins: ['manual'] }] };
        leerBibliografia.mockResolvedValue({ documentKind: 'bibliography', entries: [{ title: 'Obra guardada X', requirement: 'recommended' }], requirementItems: [], requirements: null, prohibitions: null });
        montar();
        fireEvent.click(within(ficha(/Obra guardada X/)).getByText('stateOfArt.evaluate'));
        fireEvent.change(within(ficha(/Obra guardada X/)).getByLabelText('stateOfArt.field.title'), { target: { value: 'Otra obra distinta' } });
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        fireEvent.click(screen.getByText('stateOfArt.import.writeList'));
        fireEvent.change(screen.getByLabelText('stateOfArt.import.textLabel'), { target: { value: 'una bibliografía' } });
        fireEvent.click(screen.getByText('stateOfArt.import.read'));
        fireEvent.click(await screen.findByText(/^stateOfArt.review.confirm/));
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
        // Guardar lo de pantalla conserva las dos: la renombrada y la importada.
        fireEvent.click(screen.getByText('stateOfArt.save'));
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(2));
        expect(guardado().bibliography.map(e => e.title).sort()).toEqual(['Obra guardada X', 'Otra obra distinta']);
        expect(new Set(guardado().bibliography.map(e => e.id)).size).toBe(2);
    });

    it('un requisito escrito a mano se agrega, se marca cumplido y se guarda', async () => {
        montar();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
        const editor = screen.getByRole('region', { name: 'stateOfArt.requirement.title' });
        fireEvent.change(within(editor).getByLabelText('stateOfArt.requirement.textLabel'), { target: { value: 'Consultar al menos una obra en alemán' } });
        fireEvent.click(within(editor).getByText('stateOfArt.requirement.add'));
        fireEvent.click(within(editor).getByLabelText('stateOfArt.requirement.done'));
        fireEvent.click(screen.getByText('stateOfArt.save'));
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        expect(guardado().bibliographyCriteria).toMatchObject({ requirementItems: [expect.objectContaining({ kind: 'other', text: 'Consultar al menos una obra en alemán', origin: 'manual', done: true })] });
        // Guardado y releído (limpio, en otro orden): la página vuelve a «limpio».
        await waitFor(() => expect(screen.queryByText('unsaved')).toBeNull());
    });
});
