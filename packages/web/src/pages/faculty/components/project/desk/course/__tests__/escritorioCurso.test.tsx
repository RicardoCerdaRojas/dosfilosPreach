import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
    buildProjectDesk,
    type AIProject,
    type CourseScheduleEntry,
    type DeskStudyInput,
    type ExegesisPaperSummary,
    type FeedbackPattern,
    type PassageReference,
} from '@dosfilos/domain';

/**
 * El escritorio del Curso (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §9.1):
 * las secciones en el orden del recorrido y lo que escribe cada acción.
 * Ninguna acción de una fase completa otra: marcar entregado no registra
 * devolución, registrar la devolución no marca entregado.
 */

// Los textos: la clave y, si hay, sus valores (así se ve qué se interpoló).
const tr = (k: string, p?: Record<string, unknown>) => {
    const vals = p ? Object.entries(p).filter(([n]) => n !== 'defaultValue').map(([, v]) => String(v)) : [];
    return vals.length ? `${k}:${vals.join('|')}` : k;
};
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: tr, i18n: { language: 'es' } }) }));

const mutateAsync = vi.fn();
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: [{ id: 'otro', title: 'Teología II' }], updateProject: { mutateAsync, isPending: false } }),
}));
const addRule = vi.fn();
const importWorks = vi.fn();
vi.mock('@/hooks/faculty/useCourseRecordActions', () => ({
    useCourseRecordActions: () => ({
        addRuleToGuide: { mutateAsync: addRule, isPending: false },
        importPreviousWorks: { mutateAsync: importWorks, isPending: false },
    }),
}));
let papers: ExegesisPaperSummary[] = [];
let papersLoading = false;
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers, isLoading: papersLoading, error: null }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [{ id: 'rub1', displayName: 'Rúbrica TP' }], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({
    useUserStyleGuides: () => ({ guides: [
        { id: 'g1', displayName: 'TP Semanal', manifest: { additionalRules: Array.from({ length: 17 }, (_, i) => `r${i}`) } },
        { id: 'gcurso', displayName: 'Guía NT785', manifest: { additionalRules: [] } },
    ] }),
}));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [] }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [] }) }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

const { CourseDeskSections } = await import('../../CourseDeskSections');
const { importCandidates } = await import('../courseDeskFormat');

const NOW = new Date(2026, 9, 26, 23, 0, 0);
const pasaje = (cs: number, ce: number, vs: number, ve: number): PassageReference => ({ bookId: 'JAS', chapterStart: cs, chapterEnd: ce, verseStart: vs, verseEnd: ve });
const entrada = (id: string, over: Partial<CourseScheduleEntry> = {}): CourseScheduleEntry => ({ id, workTypeId: 'tp', label: id.replace('e', 'TP #'), ...over });
const estudio = (id: string, over: Partial<DeskStudyInput> = {}): DeskStudyInput => ({
    id, title: `Estudio ${id}`, passage: pasaje(1, 1, 1, 8), phase: 'assembled', stepCount: 8, acceptedStepCount: 8,
    archivedAt: null, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-10T10:00:00.000Z', citedSourceKeys: [], projectWorkTypeId: 'tp', ...over,
});
const patrones: FeedbackPattern[] = [
    { id: 'cat', name: 'Categoría ≠ traducción', decision: 'guide', guideId: 'g1', ruleText: 'La categoría no es la traducción.' },
    { id: 'cd', name: 'Cierre doble', decision: 'pending' },
];

function curso(over: Partial<AIProject> = {}): AIProject {
    return {
        id: 'nt785', title: 'NT785', userId: 'u1', type: 'course',
        courseInfo: { course: 'NT785', styleGuideId: 'gcurso' },
        workTypes: [
            { id: 'tp', label: 'TP Semanal', rubricTemplateId: 'rub1', exegeticalMethod: 'mixed', styleGuideId: 'g1' },
            { id: 'ens', label: 'Ensayo' },
        ],
        courseScheduleMode: 'calendar',
        courseSchedule: [
            entrada('e10', { dueDate: '2026-11-06', passage: pasaje(4, 5, 13, 6) }),
            entrada('e9', { dueDate: '2026-10-28', paperId: 's9' }),
            entrada('e8', { dueDate: '2026-10-21', paperId: 's8', deliveredAt: '2026-10-21T20:00:00.000Z' }),
            entrada('e7', {
                dueDate: '2026-10-14', paperId: 's7', deliveredAt: '2026-10-14T20:00:00.000Z',
                feedback: { receivedAt: '2026-10-19T10:00:00.000Z', text: 'Cuidado con los cierres.', grade: '6,5', corrections: [{ id: 'c1', patternId: 'cd' }, { id: 'c2', patternId: 'cd' }, { id: 'c3', patternId: 'cat' }] },
            }),
        ],
        feedbackPatterns: patrones,
        bibliographyCriteria: {
            bibleBooks: ['JAS'],
            requirementItems: [{ id: 'pag', kind: 'quantity', text: 'Cien páginas de artículos', origin: 'syllabus', sourceType: 'journal-article', unit: 'pages', minimum: 100 }],
        },
        bibliography: [
            { id: 'moo', title: 'James (PNTC)', author: 'Moo', resourceId: null, weight: 'required', decision: 'approved', origins: ['catalog'], sourceType: 'commentary-critical' },
            { id: 'art1', title: 'Artículo', author: null, resourceId: 'r1', weight: 'recommended', decision: 'approved', origins: ['catalog'], sourceType: 'journal-article', pageCount: 64, annotation: { review: { mainIdea: 'x' } } },
        ],
        ...over,
    } as unknown as AIProject;
}
// Cada estudio nace en su semana: «no repetir» compara por `createdAt`.
const estudios = [
    estudio('s7', { citedSourceKeys: ['moo', 'davids'], createdAt: '2026-10-08T10:00:00.000Z' }),
    estudio('s8', { citedSourceKeys: ['Moo', 'mcknight'], createdAt: '2026-10-15T10:00:00.000Z' }),
    estudio('s9', { phase: 'in-progress', acceptedStepCount: 5, createdAt: '2026-10-22T10:00:00.000Z', updatedAt: '2026-10-26T12:00:00.000Z' }),
    estudio('s2', { title: 'TP #2 de antes', createdAt: '2026-08-20T10:00:00.000Z' }),
];

function pintar(project: AIProject = curso(), studies: DeskStudyInput[] = estudios) {
    const desk = buildProjectDesk({ project, studies, rubricCatalog: { ids: ['rub1'], defaultId: null } }, NOW);
    return render(<MemoryRouter><CourseDeskSections project={project} desk={desk} /></MemoryRouter>);
}
const ops = (call = 0) => mutateAsync.mock.calls[call]![0];

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({});
    papers = [];
    papersLoading = false;
});

describe('el escritorio del Curso', () => {
    it('pinta las cinco secciones en el orden del recorrido, cada una con su ancla', () => {
        const { container } = pintar();
        const ids = [...container.querySelectorAll('section[id^="fase-"]')].map(s => s.id);
        expect(ids).toEqual(['fase-charge', 'fase-sources', 'fase-calendar', 'fase-works', 'fase-feedback']);
        expect(screen.getByText('desk.journey.phaseLabel:1')).toBeInTheDocument();
    });

    it('no pinta nada si el escritorio no es de un curso', () => {
        const project = curso({ type: 'exegetical' } as Partial<AIProject>);
        const desk = buildProjectDesk({ project, studies: [] }, NOW);
        const { container } = render(<MemoryRouter><CourseDeskSections project={project} desk={desk} /></MemoryRouter>);
        expect(container).toBeEmptyDOMElement();
    });

    describe('lo que pide el curso', () => {
        it('resume los tipos como chips de solo lectura: rúbrica · método · guía; avisa la rúbrica sin elegir', () => {
            pintar();
            const chips = screen.getAllByTestId('course-work-type-chip');
            expect(chips[0]).toHaveTextContent('TP Semanal');
            expect(chips[0]).toHaveTextContent('Rúbrica TP');
            expect(chips[0]).toHaveTextContent('charge.method.mixed');
            expect(chips[0]).toHaveTextContent('charge.guideRules:TP Semanal|17');
            // El ensayo no eligió rúbrica y el usuario no tiene una por defecto: no está resuelta.
            expect(chips[1]).toHaveTextContent('charge.rubric.unset');
            expect(chips[1]!.className).toContain('bg-warning-subtle');
            // Sin formularios abiertos en la página.
            expect(screen.queryByText('workTypes.save')).toBeNull();
        });

        it('«El curso no da rúbrica»: por tipo sin la del profesor, guarda `rubricConfirmed` en los tipos', async () => {
            pintar();
            const caja = screen.getByTestId('course-rubric-confirm');
            // Solo el ensayo: el TP tiene la rúbrica del profesor.
            expect(within(caja).getAllByRole('button')).toHaveLength(1);
            fireEvent.click(within(caja).getByText('charge.confirmSystem:Ensayo'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops()).toEqual({ projectId: 'nt785', workTypes: [
                { id: 'tp', label: 'TP Semanal', rubricTemplateId: 'rub1', exegeticalMethod: 'mixed', styleGuideId: 'g1' },
                { id: 'ens', label: 'Ensayo', rubricConfirmed: true },
            ] });
        });

        it('confirmado, el chip lo dice y ya no se ofrece; mientras carga el catálogo, ni aviso ni botón', () => {
            const project = curso({ workTypes: [{ id: 'tp', label: 'TP Semanal', rubricTemplateId: 'rub1' }, { id: 'ens', label: 'Ensayo', rubricConfirmed: true }] } as Partial<AIProject>);
            pintar(project);
            expect(screen.getAllByTestId('course-work-type-chip')[1]).toHaveTextContent('charge.rubric.unsetConfirmed');
            expect(screen.queryByTestId('course-rubric-confirm')).toBeNull();
            cleanup();
            const desk = buildProjectDesk({ project: curso(), studies: estudios, rubricCatalog: null }, NOW);
            render(<MemoryRouter><CourseDeskSections project={curso()} desk={desk} /></MemoryRouter>);
            const chips = screen.getAllByTestId('course-work-type-chip');
            expect(chips[0]).toHaveTextContent('charge.rubric.loading');
            expect(chips[0]!.className).not.toContain('bg-warning-subtle');
        });

        it('los avisos dentro del chip van en el tono del aviso, no en gris', () => {
            pintar(curso({ workTypes: [{ id: 'ens', label: 'Ensayo', exegeticalMethod: 'research', styleGuideId: 'g1' }, { id: 'tp', label: 'TP Semanal', rubricTemplateId: 'rub1' }] } as Partial<AIProject>));
            const chip = screen.getAllByTestId('course-work-type-chip')[0]!;
            expect(chip).toHaveTextContent('charge.method.research');
            expect(chip).toHaveTextContent('charge.guideRules:TP Semanal|17');
            expect(chip.querySelector('.text-muted-foreground')).toBeNull();
        });

        it('«Editar» abre un diálogo con los dos formularios de antes', () => {
            pintar();
            fireEvent.click(screen.getByText('charge.edit'));
            const dialogo = screen.getByRole('dialog');
            expect(within(dialogo).getByText('workTypes.save')).toBeInTheDocument();
            expect(within(dialogo).getByText('course.save')).toBeInTheDocument();
        });
    });

    describe('el calendario', () => {
        it('el modo es un grupo de radio: la opción elegida marcada y la única con Tab', () => {
            pintar();
            const grupo = screen.getByRole('radiogroup');
            const [cal, libre] = within(grupo).getAllByRole('radio');
            expect(cal).toHaveAttribute('aria-checked', 'true');
            expect(cal).toHaveAttribute('tabindex', '0');
            expect(libre).toHaveAttribute('tabindex', '-1');
            // Las flechas mueven el foco sin guardar.
            cal!.focus();
            fireEvent.keyDown(cal!, { key: 'ArrowRight' });
            expect(document.activeElement).toBe(libre);
            expect(mutateAsync).not.toHaveBeenCalled();
        });

        it('quitar una entrega pide confirmación en rojo y dice qué se pierde si tiene registro', async () => {
            pintar();
            fireEvent.click(screen.getByLabelText('calendar.removeEntry:TP #7'));
            const alerta = screen.getByRole('alertdialog');
            expect(alerta).toHaveTextContent('calendar.removeWithRecord');
            const quitar = within(alerta).getByText('calendar.removeConfirm');
            expect(quitar.className).toContain('bg-destructive-solid');
            fireEvent.click(quitar);
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps).toEqual([{ op: 'removeEntry', entryId: 'e7' }]);
        });

        it('cerrar una entrega con cambios pregunta antes; sin cambios, cierra', () => {
            pintar();
            fireEvent.click(screen.getByText('calendar.add'));
            fireEvent.click(within(screen.getByRole('dialog')).getByText('common.cancel'));
            expect(screen.queryByRole('dialog')).toBeNull();
            fireEvent.click(screen.getByText('calendar.add'));
            fireEvent.change(within(screen.getByRole('dialog')).getByPlaceholderText('calendar.passagePlaceholder'), { target: { value: '5:7-12' } });
            fireEvent.click(within(screen.getByRole('dialog')).getByText('common.cancel'));
            expect(screen.getByRole('alertdialog')).toHaveTextContent('discardChanges.title');
            fireEvent.click(screen.getByText('discardChanges.keep'));
            expect(screen.getByPlaceholderText('calendar.passagePlaceholder')).toHaveValue('5:7-12');
        });

        it('elegir «semana a semana» guarda el modo y nada más', async () => {
            pintar();
            fireEvent.click(screen.getByText('calendar.mode.free'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops()).toEqual({ projectId: 'nt785', courseScheduleMode: 'free' });
        });

        it('una entrega nueva sugiere el número que sigue y guarda tipo, rótulo, pasaje (original) y fecha', async () => {
            pintar();
            fireEvent.click(screen.getByText('calendar.add'));
            const dialogo = screen.getByRole('dialog');
            const rotulo = within(dialogo).getByDisplayValue('TP #11');
            expect(rotulo).toBeInTheDocument();
            fireEvent.change(within(dialogo).getByPlaceholderText('calendar.passagePlaceholder'), { target: { value: '5:7-12' } });
            fireEvent.change(dialogo.querySelector('input[type="date"]')!, { target: { value: '2026-11-13' } });
            fireEvent.click(within(dialogo).getByText('common.save'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps).toEqual([{ op: 'upsertEntry', entry: {
                workTypeId: 'tp', label: 'TP #11', passage: { bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 7, verseEnd: 12 }, dueDate: '2026-11-13',
                paperId: null,
            } }]);
        });

        it('cambiar de tipo cambia el rótulo sugerido mientras no se haya escrito', () => {
            pintar();
            fireEvent.click(screen.getByText('calendar.add'));
            const dialogo = screen.getByRole('dialog');
            fireEvent.change(within(dialogo).getByDisplayValue('TP Semanal'), { target: { value: 'ens' } });
            // El ensayo no tiene rótulos con número: lo escribe el estudiante.
            expect((within(dialogo).getAllByRole('textbox')[0] as HTMLInputElement).value).toBe('');
        });

        it('un pasaje que no se reconoce no se guarda y se dice por qué', () => {
            pintar();
            fireEvent.click(screen.getByText('calendar.add'));
            const dialogo = screen.getByRole('dialog');
            fireEvent.change(within(dialogo).getByPlaceholderText('calendar.passagePlaceholder'), { target: { value: 'cualquier cosa' } });
            fireEvent.click(within(dialogo).getByText('common.save'));
            expect(within(dialogo).getByText('calendar.passageInvalid')).toBeInTheDocument();
            expect(mutateAsync).not.toHaveBeenCalled();
        });

        it('editar una entrega permite vincularla con un trabajo del curso que no figura como entrega', async () => {
            pintar();
            fireEvent.click(screen.getByLabelText('calendar.editEntry:TP #10'));
            const dialogo = screen.getByRole('dialog');
            fireEvent.change(within(dialogo).getByDisplayValue('calendar.noPaper'), { target: { value: 's2' } });
            fireEvent.click(within(dialogo).getByText('common.save'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps[0].entry).toMatchObject({ id: 'e10', paperId: 's2', dueDate: '2026-11-06' });
        });
    });

    describe('la mesa', () => {
        it('una entrega sin trabajo ofrece crearlo con el curso, el tipo, la entrega y el rótulo', () => {
            pintar();
            const crear = screen.getByText('works.create:TP #10').closest('a')!;
            const url = new URL(crear.getAttribute('href')!, 'http://x');
            expect(url.pathname).toBe('/dashboard/exegesis/new');
            expect(Object.fromEntries(url.searchParams)).toEqual({ projectId: 'nt785', workTypeId: 'tp', scheduleEntryId: 'e10', label: 'TP #10' });
        });

        it('el trabajo abre con la vuelta al proyecto', () => {
            pintar();
            const link = screen.getAllByText('TP #9').map(e => e.closest('a')).find(Boolean)!;
            expect(link.getAttribute('href')).toBe('/dashboard/exegesis/s9?from=%2Fdashboard%2Fprojects%2Fnt785');
        });

        it('muestra avance, fuentes repetidas y entrega por fila', () => {
            pintar();
            const filas = screen.getAllByTestId('course-works-row');
            const tp8 = filas.find(f => f.textContent?.includes('TP #8'))!;
            expect(tp8).toHaveTextContent('works.study.assembled');
            expect(tp8).toHaveTextContent('works.sources.repeats:moo');
            expect(tp8).toHaveTextContent('works.delivery.delivered');
            const tp9 = filas.find(f => f.textContent?.includes('TP #9'))!;
            expect(tp9).toHaveTextContent('works.study.progress:5|8');
            expect(tp9).toHaveTextContent('works.dueSoon');
        });

        it('«Marcar como entregado» solo marca la entrega: no registra devolución', async () => {
            pintar();
            const tp9 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #9'))!;
            fireEvent.click(within(tp9).getByText('works.markDelivered'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps).toEqual([{ op: 'markDelivered', entryId: 'e9' }]);
        });

        it('semana a semana: cada tipo ofrece crear su trabajo siguiente, sin entrega del calendario', () => {
            pintar(curso({ courseScheduleMode: 'free' } as Partial<AIProject>));
            const crear = screen.getByText('works.createNamed:TP #11').closest('a')!;
            const url = new URL(crear.getAttribute('href')!, 'http://x');
            expect(Object.fromEntries(url.searchParams)).toEqual({ projectId: 'nt785', workTypeId: 'tp', label: 'TP #11' });
            // El ensayo, sin rótulos con número, igual se puede crear.
            expect(screen.getByText('works.createOfType:Ensayo')).toBeInTheDocument();
        });

        it('fuentes «sin datos» si a uno de los dos lados le faltan las citas', () => {
            pintar(curso(), estudios.map(e => (e.id === 's8' ? { ...e, citedSourceKeys: [] } : e)));
            const tp8 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #8'))!;
            expect(tp8).toHaveTextContent('works.sources.unknownFrom:TP #7');
            expect(tp8).not.toHaveTextContent('works.sources.noRepeat');
        });

        it('una entrega cuyo estudio está archivado no ofrece «Crear» otra vez: muestra «archivado» con enlace', () => {
            const project = curso();
            const sched = project.courseSchedule!.map(e => (e.id === 'e10' ? { ...e, paperId: 'viejo' } : e));
            pintar({ ...project, courseSchedule: sched } as AIProject);
            expect(screen.queryByText('works.create:TP #10')).toBeNull();
            expect(screen.getByTestId('course-works-archived').getAttribute('href')).toBe('/dashboard/exegesis/viejo?from=%2Fdashboard%2Fprojects%2Fnt785');
        });

        it('los trabajos fuera del calendario se ven aunque el curso no tenga tipos', () => {
            pintar(curso({ workTypes: [], courseSchedule: [] } as Partial<AIProject>));
            expect(screen.getByText('works.offCalendar:4')).toBeInTheDocument();
            expect(screen.getByText('Estudio s7')).toBeInTheDocument();
        });

        it('la cabecera de la mesa no es un elemento de la lista', () => {
            pintar();
            for (const ol of screen.getAllByTestId('course-works-group').map(g => g.querySelector('ol')!)) {
                expect([...ol.children].every(li => li.getAttribute('data-testid') === 'course-works-row')).toBe(true);
            }
        });

        it('la lectura dirigida va como fila: páginas reseñadas de la meta', () => {
            pintar();
            expect(screen.getByTestId('course-directed-reading')).toHaveTextContent('works.reading.pages:64|100');
        });
    });

    describe('la devolución', () => {
        it('se registra con texto, nota y correcciones (patrón existente o nuevo por nombre) y no marca entregado', async () => {
            pintar();
            const tp8 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #8'))!;
            fireEvent.click(within(tp8).getByText('works.recordFeedback'));
            const dialogo = screen.getByRole('dialog');
            fireEvent.change(within(dialogo).getByPlaceholderText('feedbackDialog.textPlaceholder'), { target: { value: 'Revisa los cierres.' } });
            fireEvent.change(within(dialogo).getByPlaceholderText('feedbackDialog.gradePlaceholder'), { target: { value: '6,0' } });
            fireEvent.click(within(dialogo).getByText('feedbackDialog.addCorrection'));
            fireEvent.click(within(dialogo).getByText('feedbackDialog.addCorrection'));
            const filas = within(dialogo).getAllByTestId('feedback-correction-row');
            // La primera: el patrón existente que viene puesto. La segunda: uno nuevo.
            fireEvent.change(within(filas[1]!).getByRole('combobox'), { target: { value: '__new' } });
            fireEvent.change(within(filas[1]!).getByPlaceholderText('feedbackDialog.patternNamePlaceholder'), { target: { value: 'Falta la glosa' } });
            fireEvent.change(within(filas[1]!).getByPlaceholderText('feedbackDialog.notePlaceholder'), { target: { value: 'v. 3' } });
            fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps).toEqual([{ op: 'recordFeedback', entryId: 'e8', feedback: {
                text: 'Revisa los cierres.', grade: '6,0',
                corrections: [{ patternId: 'cat' }, { patternName: 'Falta la glosa', note: 'v. 3' }],
            } }]);
        });

        it('«Sin devolución» se marca a propósito; con una devolución escrita no se ofrece', async () => {
            pintar();
            const tp8 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #8'))!;
            fireEvent.click(within(tp8).getByText('works.recordFeedback'));
            fireEvent.click(within(screen.getByRole('dialog')).getByText('feedbackDialog.none'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps).toEqual([{ op: 'markNoFeedback', entryId: 'e8' }]);
            cleanup();
            pintar();
            const tp7 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #7'))!;
            fireEvent.click(within(tp7).getByText('works.editFeedback'));
            const dialogo = screen.getByRole('dialog');
            expect(within(dialogo).queryByText('feedbackDialog.none')).toBeNull();
            // Editar conserva el texto, la nota y las correcciones con su id.
            expect(within(dialogo).getByDisplayValue('Cuidado con los cierres.')).toBeInTheDocument();
            expect(within(dialogo).getAllByTestId('feedback-correction-row')).toHaveLength(3);
        });

        it('«Quitar la devolución» confirma diciendo qué se borra', async () => {
            pintar();
            const tp7 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #7'))!;
            fireEvent.click(within(tp7).getByText('works.editFeedback'));
            fireEvent.click(within(screen.getByRole('dialog')).getByText('feedbackDialog.clear'));
            expect(mutateAsync).not.toHaveBeenCalled();
            const alerta = screen.getByRole('alertdialog');
            expect(alerta).toHaveTextContent('feedbackDialog.clearHint:3');
            fireEvent.click(within(alerta).getByText('feedbackDialog.clear'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps).toEqual([{ op: 'clearFeedback', entryId: 'e7' }]);
        });

        it('cerrar la devolución con texto escrito pregunta antes de perderlo', () => {
            pintar();
            const tp8 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #8'))!;
            fireEvent.click(within(tp8).getByText('works.recordFeedback'));
            fireEvent.change(within(screen.getByRole('dialog')).getByPlaceholderText('feedbackDialog.textPlaceholder'), { target: { value: 'Pegado del profesor.' } });
            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
            expect(screen.getByRole('alertdialog')).toHaveTextContent('discardChanges.title');
            fireEvent.click(screen.getByText('discardChanges.discard'));
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('al editar, las correcciones guardadas conservan su id y su fecha de llegada', async () => {
            pintar();
            const tp7 = screen.getAllByTestId('course-works-row').find(f => f.textContent?.includes('TP #7'))!;
            fireEvent.click(within(tp7).getByText('works.editFeedback'));
            fireEvent.click(within(screen.getByRole('dialog')).getByText('feedbackDialog.save'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            const fb = ops().courseOps[0].feedback;
            expect(fb.receivedAt).toBe('2026-10-19T10:00:00.000Z');
            expect(fb.corrections.map((c: { id?: string }) => c.id)).toEqual(['c1', 'c2', 'c3']);
        });
    });

    it('el diálogo de la devolución se puede abrir desde afuera («Ahora»: registrar la devolución)', () => {
        const project = curso();
        const desk = buildProjectDesk({ project, studies: estudios, rubricCatalog: { ids: ['rub1'], defaultId: null } }, NOW);
        const cerrar = vi.fn();
        render(<MemoryRouter><CourseDeskSections project={project} desk={desk} feedbackEntryId="e8" onFeedbackEntryChange={cerrar} /></MemoryRouter>);
        expect(screen.getByRole('dialog')).toHaveTextContent('feedbackDialog.title:TP #8');
        fireEvent.click(within(screen.getByRole('dialog')).getByText('common.cancel'));
        expect(cerrar).toHaveBeenCalledWith(null);
    });

    describe('el registro de devoluciones', () => {
        it('los patrones pendientes van primero, con su conteo y sus entregas', () => {
            pintar();
            const filas = screen.getAllByTestId('course-pattern-row');
            expect(filas[0]).toHaveTextContent('Cierre doble');
            expect(filas[0]).toHaveTextContent('feedback.count:2');
            expect(filas[0]).toHaveTextContent('feedback.inEntries:1');
            expect(filas[1]).toHaveTextContent('feedback.decided.guide');
        });

        it('«Pasar a tu guía» propone el nombre del patrón; el estudiante lo edita y confirma en la guía del tipo', async () => {
            addRule.mockResolvedValue({ added: true });
            pintar();
            fireEvent.click(within(screen.getAllByTestId('course-pattern-row')[0]!).getByText('feedback.toGuide'));
            const dialogo = screen.getByRole('dialog');
            // El nombre va de ejemplo, no como valor: la regla la escribe el estudiante.
            const regla = within(dialogo).getByPlaceholderText('Cierre doble') as HTMLTextAreaElement;
            expect(regla.value).toBe('');
            expect(within(dialogo).getByText('guideRule.confirm').closest('button')).toBeDisabled();
            // Igual al nombre (sin contar mayúsculas ni espacios) no dice qué hacer: no se acepta.
            fireEvent.change(regla, { target: { value: '  cierre DOBLE ' } });
            expect(within(dialogo).getByText('guideRule.confirm').closest('button')).toBeDisabled();
            expect(within(dialogo).getByText('guideRule.sameAsName')).toBeInTheDocument();
            fireEvent.change(regla, { target: { value: 'No cierres dos veces la misma idea.' } });
            expect((within(dialogo).getByRole('combobox') as HTMLSelectElement).value).toBe('g1');
            fireEvent.click(within(dialogo).getByText('guideRule.confirm'));
            await waitFor(() => expect(addRule).toHaveBeenCalled());
            expect(addRule.mock.calls[0]![0]).toEqual({ projectId: 'nt785', patternId: 'cd', guideId: 'g1', ruleText: 'No cierres dos veces la misma idea.' });
            // La decisión la registra el caso de uso: la página no escribe aparte.
            expect(mutateAsync).not.toHaveBeenCalled();
        });

        it('un error de la guía se dice con su propio texto', async () => {
            addRule.mockRejectedValue(Object.assign(new Error('x'), { name: 'AddRuleToStyleGuideError', code: 'guide-without-manifest' }));
            pintar();
            fireEvent.click(within(screen.getAllByTestId('course-pattern-row')[0]!).getByText('feedback.toGuide'));
            fireEvent.change(within(screen.getByRole('dialog')).getByPlaceholderText('Cierre doble'), { target: { value: 'Cierra una sola vez.' } });
            fireEvent.click(within(screen.getByRole('dialog')).getByText('guideRule.confirm'));
            await waitFor(() => expect(toastError).toHaveBeenCalledWith('guideRule.errors.guide-without-manifest'));
        });

        it('«Descartar» pide la razón (con sugerencias) y decide el patrón sin tocar la guía', async () => {
            pintar();
            fireEvent.click(screen.getByLabelText('feedback.discardLabel:Cierre doble'));
            const dialogo = screen.getByRole('dialog');
            // Sin razón no se descarta.
            expect(within(dialogo).getByText('discard.confirm').closest('button')).toBeDisabled();
            fireEvent.click(within(dialogo).getByText('discard.suggestion.notForCourse'));
            expect(within(dialogo).getByDisplayValue('discard.suggestion.notForCourse')).toBeInTheDocument();
            fireEvent.change(within(dialogo).getByLabelText('discard.reason'), { target: { value: 'No aplica: el profesor lo pidió solo en el TP #7.' } });
            fireEvent.click(within(dialogo).getByText('discard.confirm'));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(ops().courseOps).toEqual([{ op: 'decidePattern', patternId: 'cd', decision: 'discarded', reason: 'No aplica: el profesor lo pidió solo en el TP #7.' }]);
            expect(addRule).not.toHaveBeenCalled();
        });

        it('un patrón descartado muestra su razón en la fila', () => {
            pintar(curso({ feedbackPatterns: [patrones[0]!, { id: 'cd', name: 'Cierre doble', decision: 'discarded', discardReason: 'No aplica a este curso' }] } as Partial<AIProject>));
            const fila = screen.getAllByTestId('course-pattern-row').find(f => f.textContent?.includes('Cierre doble'))!;
            expect(within(fila).getByTestId('course-pattern-reason')).toHaveTextContent('feedback.discardedBecause:No aplica a este curso');
            expect(fila).toHaveTextContent('feedback.decided.discarded');
        });

        it('«se repite» sigue la regla única: dos correcciones en UNA entrega no se repiten', () => {
            pintar();
            const cd = screen.getAllByTestId('course-pattern-row').find(f => f.textContent?.includes('Cierre doble'))!;
            expect(cd).not.toHaveTextContent('feedback.repeats');
            cleanup();
            const project = curso();
            const sched = project.courseSchedule!.map(e => (e.id === 'e8'
                ? { ...e, feedback: { receivedAt: '2026-10-25T10:00:00.000Z', text: 'x', corrections: [{ id: 'c9', patternId: 'cd' }] } }
                : e));
            pintar({ ...project, courseSchedule: sched } as AIProject);
            const cd2 = screen.getAllByTestId('course-pattern-row').find(f => f.textContent?.includes('Cierre doble'))!;
            expect(cd2).toHaveTextContent('feedback.repeats');
        });

        it('una sola escritura a la vez: mientras «Pasar a tu guía» guarda, descartar y reabrir esperan', async () => {
            let soltar: (v: unknown) => void = () => {};
            addRule.mockReturnValue(new Promise(r => { soltar = r; }));
            pintar();
            fireEvent.click(within(screen.getAllByTestId('course-pattern-row')[0]!).getByText('feedback.toGuide'));
            fireEvent.change(within(screen.getByRole('dialog')).getByPlaceholderText('Cierre doble'), { target: { value: 'Cierra una sola vez.' } });
            fireEvent.click(within(screen.getByRole('dialog')).getByText('guideRule.confirm'));
            await waitFor(() => expect(addRule).toHaveBeenCalled());
            expect(screen.getByLabelText('feedback.discardLabel:Cierre doble')).toBeDisabled();
            expect(screen.getByLabelText('feedback.reopenLabel:Categoría ≠ traducción')).toBeDisabled();
            soltar({ added: true });
            await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
            expect(screen.getByLabelText('feedback.discardLabel:Cierre doble')).not.toBeDisabled();
        });
    });

    it('las fases posteriores por empezar y vacías van en una línea, sin acción', () => {
        const project = curso({ workTypes: [], courseSchedule: [], courseScheduleMode: undefined, feedbackPatterns: [] } as Partial<AIProject>);
        pintar(project, []);
        for (const id of ['calendar', 'works', 'feedback']) {
            const sec = screen.getByTestId(`desk-section-${id}`);
            expect(sec).toHaveAttribute('data-later-phase');
            expect(within(sec).queryAllByRole('button')).toHaveLength(0);
            expect(sec).toHaveTextContent(`later.${id}`);
        }
    });

    describe('traer los trabajos anteriores', () => {
        const resumen = (id: string, over: Partial<ExegesisPaperSummary> = {}) => ({
            id, title: `TP ${id}`, passage: pasaje(1, 1, 1, 8), phase: 'assembled', archivedAt: null,
            createdAt: new Date(2026, 7, Number(id.replace(/\D/g, '')) || 1), updatedAt: new Date(2026, 8, 1), projectId: null, linkedProjectIds: [], ...over,
        }) as unknown as ExegesisPaperSummary;

        it('los candidatos: sueltos, de otro proyecto y del curso sin entrega; sin archivados ni los que ya cumplen una entrega', () => {
            const lista = importCandidates([
                resumen('t3'), resumen('t1'), resumen('s9', { projectId: 'nt785' }), resumen('t2', { projectId: 'otro' }),
                resumen('t4', { archivedAt: new Date() }), resumen('s2', { projectId: 'nt785' }),
            ], curso());
            expect(lista.map(p => p.id)).toEqual(['t1', 't2', 's2', 't3']);
        });

        it('mientras llegan los estudios no dice «no hay trabajos»', () => {
            papersLoading = true;
            pintar();
            fireEvent.click(screen.getByText('works.import'));
            const dialogo = screen.getByRole('dialog');
            expect(within(dialogo).getByTestId('import-loading')).toHaveAttribute('role', 'status');
            expect(within(dialogo).queryByText('import.empty')).toBeNull();
        });

        it('pide la fecha de entrega (opcional) y «entregado el» viene puesta con el último cambio, a la vista y editable', async () => {
            papers = [resumen('t1', { updatedAt: new Date(2026, 8, 3, 9) }), resumen('t2', { updatedAt: new Date(2026, 8, 10, 9) })];
            importWorks.mockResolvedValue({ results: [{ paperId: 't1', status: 'origin-set', entryId: 'n1' }, { paperId: 't2', status: 'origin-set', entryId: 'n2' }] });
            pintar();
            fireEvent.click(screen.getByText('works.import'));
            const dialogo = screen.getByRole('dialog');
            const [c1, c2] = within(dialogo).getAllByTestId('import-candidate');
            fireEvent.click(within(c1!).getAllByRole('checkbox')[0]!);
            fireEvent.click(within(c2!).getAllByRole('checkbox')[0]!);
            const entregado1 = within(c1!).getByLabelText('import.deliveredOn') as HTMLInputElement;
            expect(entregado1.value).toBe('2026-09-03');
            fireEvent.change(within(c1!).getByLabelText('import.dueDate'), { target: { value: '2026-09-04' } });
            fireEvent.change(entregado1, { target: { value: '2026-09-05' } });
            // Borrada: se usa la que el estudiante vio puesta, no hoy.
            fireEvent.change(within(c2!).getByLabelText('import.deliveredOn'), { target: { value: '' } });
            fireEvent.click(within(dialogo).getByText('import.confirm:2'));
            await waitFor(() => expect(importWorks).toHaveBeenCalled());
            const { works } = importWorks.mock.calls[0]![0];
            expect(works[0]).toMatchObject({ paperId: 't1', dueDate: '2026-09-04', deliveredAt: new Date(2026, 8, 5, 12).toISOString() });
            expect(works[1]).toMatchObject({ paperId: 't2', deliveredAt: new Date(2026, 8, 10, 12).toISOString() });
            expect(works[1]).not.toHaveProperty('dueDate');
        });

        it('trae los elegidos con su tipo, su rótulo y si se entregaron; avisa el que queda solo vinculado', async () => {
            papers = [resumen('t1'), resumen('t2', { projectId: 'otro' })];
            importWorks.mockResolvedValue({ results: [{ paperId: 't1', status: 'origin-set', entryId: 'n1' }, { paperId: 't2', status: 'linked', entryId: 'n2' }] });
            pintar();
            fireEvent.click(screen.getByText('works.import'));
            const dialogo = screen.getByRole('dialog');
            const [c1, c2] = within(dialogo).getAllByTestId('import-candidate');
            fireEvent.click(within(c1!).getAllByRole('checkbox')[0]!);
            fireEvent.change(within(c1!).getByDisplayValue('TP t1'), { target: { value: 'TP #1' } });
            fireEvent.click(within(c2!).getAllByRole('checkbox')[0]!);
            expect(within(c2!).getByText('import.willLink')).toBeInTheDocument();
            fireEvent.click(within(c2!).getByLabelText('import.delivered'));
            fireEvent.click(within(dialogo).getByText('import.confirm:2'));
            await waitFor(() => expect(importWorks).toHaveBeenCalled());
            const { projectId, works } = importWorks.mock.calls[0]![0];
            expect(projectId).toBe('nt785');
            expect(works).toHaveLength(2);
            expect(works[0]).toMatchObject({ paperId: 't1', workTypeId: 'tp', label: 'TP #1' });
            expect(works[0].deliveredAt).toEqual(expect.any(String));
            expect(works[1]).toMatchObject({ paperId: 't2', workTypeId: 'tp', label: 'TP t2' });
            expect(works[1]).not.toHaveProperty('deliveredAt');
            // El de otro proyecto queda vinculado: se avisa antes de cerrar.
            expect(await screen.findByTestId('import-warning')).toHaveTextContent('import.warnLinked:TP t2');
        });
    });
});
