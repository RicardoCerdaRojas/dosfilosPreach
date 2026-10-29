import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildProjectDesk, type AIProject, type CourseScheduleEntry, type FeedbackPattern } from '@dosfilos/domain';
import type { PdfFeedbackNote } from '@/lib/pdf/readPdfAnnotations';

/**
 * La devolución desde el PDF corregido (fundador, TI #1 del Salmo 23: 15
 * comentarios anclados en Canvas, 12 elogios y 3 correcciones de forma):
 * leer los comentarios → una fila por comentario con su clase propuesta →
 * clasificar → agregar a la lista → guardar con su clase y su ancla. Y en
 * el escritorio, las fortalezas aparte, cada observación con dónde la hizo.
 */

const tr = (k: string, p?: Record<string, unknown>) => {
    const vals = p ? Object.entries(p).filter(([n]) => n !== 'defaultValue').map(([, v]) => String(v)) : [];
    return vals.length ? `${k}:${vals.join('|')}` : k;
};
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: tr, i18n: { language: 'es' } }) }));

const mutateAsync = vi.fn();
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: [], updateProject: { mutateAsync, isPending: false } }),
}));
const addRule = vi.fn();
vi.mock('@/hooks/faculty/useCourseRecordActions', () => ({
    useCourseRecordActions: () => ({ addRuleToGuide: { mutateAsync: addRule, isPending: false }, importPreviousWorks: { mutateAsync: vi.fn(), isPending: false } }),
}));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [], isLoading: false, error: null }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({
    useUserStyleGuides: () => ({ guides: [{ id: 'g1', displayName: 'Guía TI', manifest: { additionalRules: [] } }] }),
}));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [] }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// La lectura del PDF, simulada: el resto del módulo (las funciones puras) es el real.
const leerPdf = vi.fn<[ArrayBuffer, { sheetLabel?: (n: number) => string }?], Promise<PdfFeedbackNote[]>>();
vi.mock('@/lib/pdf/readPdfAnnotations', async orig => ({ ...(await orig<object>()), readPdfAnnotations: (...a: Parameters<typeof leerPdf>) => leerPdf(...a) }));

const { CourseDeskSections } = await import('../../CourseDeskSections');

const NOW = new Date(2026, 9, 26, 12, 0, 0);
const PROFESOR = 'José Luis Antonio García Villanueva';
const NOTAS: PdfFeedbackNote[] = [
    { sheet: 4, page: '2', author: PROFESOR, text: 'Distinción textual-crítica correcta y necesaria.', quote: 'texto hebreo4.' },
    { sheet: 8, page: '6', author: PROFESOR, text: 'Este apóstrofe no es de redacción, sino de programación.', quote: "un solo participante. Waltke y O'Connor explican que" },
    { sheet: 11, page: '9', author: PROFESOR, text: '', quote: 'matiz de estado ya alcanzado que la conjugación permite afimar.' },
];

const entrada = (id: string, over: Partial<CourseScheduleEntry> = {}): CourseScheduleEntry => ({ id, workTypeId: 'ti', label: id.replace('e', 'TI #'), ...over });
function curso(over: Partial<AIProject> = {}): AIProject {
    return {
        id: 'at701', title: 'AT701', userId: 'u1', type: 'course',
        courseInfo: { course: 'AT701', styleGuideId: 'g1' },
        workTypes: [{ id: 'ti', label: 'Trabajo de investigación', styleGuideId: 'g1' }],
        courseScheduleMode: 'calendar',
        courseSchedule: [entrada('e1', { dueDate: '2026-09-20', deliveredAt: '2026-09-20T20:00:00.000Z' })],
        feedbackPatterns: [],
        ...over,
    } as unknown as AIProject;
}
function pintar(project: AIProject = curso()) {
    const desk = buildProjectDesk({ project, studies: [], rubricCatalog: { ids: [], defaultId: null } }, NOW);
    return render(<MemoryRouter><CourseDeskSections project={project} desk={desk} /></MemoryRouter>);
}
const ops = (call = 0) => mutateAsync.mock.calls[call]![0].courseOps;

function abrirDevolucion() {
    fireEvent.click(screen.getByText('feedback.recordFor:TI #1'));
    return screen.getByRole('dialog');
}
/** Elige el PDF (un archivo que solo sabe dar sus bytes: no se sube a ningún lado). */
async function elegirPdf(dialogo: HTMLElement) {
    const archivo = { name: 'ti1-anotado.pdf', arrayBuffer: async () => new ArrayBuffer(4) };
    fireEvent.change(within(dialogo).getByTestId('pdf-feedback-file'), { target: { files: [archivo] } });
    await waitFor(() => expect(within(dialogo).getAllByTestId('pdf-feedback-row')).toHaveLength(NOTAS.length));
    return within(dialogo).getAllByTestId('pdf-feedback-row');
}
const elegida = (fila: HTMLElement) => within(fila).getAllByRole('radio').find(r => r.getAttribute('aria-checked') === 'true')!.textContent;

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({});
    leerPdf.mockResolvedValue(NOTAS);
});

describe('leer los comentarios del PDF', () => {
    it('una fila por comentario: dónde, la clase propuesta y la marca sin texto que pide escribir qué era', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        expect(within(dialogo).getByText('feedbackDialog.pdf.hint')).toBeInTheDocument();
        const filas = await elegirPdf(dialogo);
        expect(leerPdf).toHaveBeenCalledTimes(1);
        expect(leerPdf.mock.calls[0]![0]).toBeInstanceOf(ArrayBuffer);
        expect(within(dialogo).getByText('feedbackDialog.pdf.found:3|ti1-anotado.pdf')).toBeInTheDocument();
        expect(within(filas[0]!).getByTestId('pdf-feedback-anchor')).toHaveTextContent('feedback.anchorPage:2 · «texto hebreo4.»');
        expect(filas.map(elegida)).toEqual(['feedbackDialog.kind.strength', 'feedbackDialog.kind.correction', 'feedbackDialog.kind.correction']);
        expect(filas[2]).toHaveTextContent('feedbackDialog.pdf.proposalEmpty');
        // El nombre propuesto: la primera frase del comentario.
        expect(within(filas[0]!).getByDisplayValue('Distinción textual-crítica correcta y necesaria')).toBeInTheDocument();
        // La marca sin texto se queda con su aviso; las completas se pueden agregar.
        expect(within(dialogo).getByText('feedbackDialog.pdf.add:2').closest('button')).not.toBeDisabled();
        expect(within(dialogo).getByText('feedbackDialog.pdf.incomplete:1')).toBeInTheDocument();
        expect(within(dialogo).getByText('feedbackDialog.pdf.ignoreBlank:1')).toBeInTheDocument();
        // Nada se guardó.
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('clasificar → agregar al registro → guardar envía cada observación con su clase y su ancla', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        const filas = await elegirPdf(dialogo);
        fireEvent.change(within(filas[2]!).getByLabelText('feedbackDialog.pdf.commentEmpty'), { target: { value: 'Errata: «afimar» por «afirmar».' } });
        // El nombre sigue al comentario mientras no se toque.
        expect(within(filas[2]!).getByDisplayValue('Errata: «afimar» por «afirmar»')).toBeInTheDocument();
        fireEvent.click(within(dialogo).getByText('feedbackDialog.pdf.add:3'));
        // Pasaron a la lista del diálogo; el panel del PDF se cierra.
        expect(within(dialogo).queryAllByTestId('pdf-feedback-row')).toHaveLength(0);
        const lista = within(dialogo).getAllByTestId('feedback-correction-row');
        expect(lista).toHaveLength(3);
        expect(elegida(lista[0]!)).toBe('feedbackDialog.kind.strength');
        expect(within(lista[1]!).getByDisplayValue('6')).toBeInTheDocument();
        expect(mutateAsync).not.toHaveBeenCalled();
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(ops()).toEqual([{ op: 'recordFeedback', entryId: 'e1', feedback: { text: '', grade: null, corrections: [
            { patternName: 'Distinción textual-crítica correcta y necesaria', patternKind: 'strength', note: 'Distinción textual-crítica correcta y necesaria.', anchor: { page: '2', quote: 'texto hebreo4.' } },
            { patternName: 'Este apóstrofe no es de redacción, sino de programación', patternKind: 'correction', note: 'Este apóstrofe no es de redacción, sino de programación.', anchor: { page: '6', quote: "un solo participante. Waltke y O'Connor explican que" } },
            { patternName: 'Errata: «afimar» por «afirmar»', patternKind: 'correction', note: 'Errata: «afimar» por «afirmar».', anchor: { page: '9', quote: 'matiz de estado ya alcanzado que la conjugación permite afimar.' } },
        ] } }]);
    });

    it('la propuesta se cambia: «Ignorar» lo deja fuera; «Fortaleza» cambia la clase', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        const filas = await elegirPdf(dialogo);
        fireEvent.click(within(filas[2]!).getByText('feedbackDialog.kind.ignore'));
        fireEvent.click(within(filas[1]!).getByText('feedbackDialog.kind.strength'));
        expect(elegida(filas[1]!)).toBe('feedbackDialog.kind.strength');
        fireEvent.click(within(dialogo).getByText('feedbackDialog.pdf.add:2'));
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        const cs = ops()[0].feedback.corrections;
        expect(cs).toHaveLength(2);
        expect(cs[1]).toMatchObject({ patternKind: 'strength', anchor: { page: '6' } });
    });

    it('las flechas mueven la elección dentro del grupo (radio)', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        const filas = await elegirPdf(dialogo);
        const fortaleza = within(filas[0]!).getByText('feedbackDialog.kind.strength');
        expect(fortaleza).toHaveAttribute('tabindex', '0');
        fireEvent.keyDown(fortaleza, { key: 'ArrowRight' });
        expect(elegida(filas[0]!)).toBe('feedbackDialog.kind.ignore');
    });

    it('un patrón del curso de la misma clase se ofrece reutilizar; el mismo nombre se suma solo; el de la otra clase avisa', async () => {
        const patrones: FeedbackPattern[] = [
            { id: 'dtc', name: 'Distinción textual-crítica', kind: 'strength', decision: 'pending' },
            { id: 'apo', name: 'Este apóstrofe no es de redacción, sino de programación', decision: 'pending' },
        ];
        pintar(curso({ feedbackPatterns: patrones }));
        const dialogo = abrirDevolucion();
        const filas = await elegirPdf(dialogo);
        fireEvent.click(within(filas[0]!).getByText('feedbackDialog.pdf.reuse:Distinción textual-crítica'));
        expect(filas[0]).toHaveTextContent('feedbackDialog.pdf.joins:Distinción textual-crítica');
        expect(filas[1]).toHaveTextContent('feedbackDialog.pdf.sameName:Este apóstrofe no es de redacción, sino de programación');
        // Como fortaleza, ese nombre ya es una corrección: hay que cambiarlo.
        fireEvent.click(within(filas[1]!).getByText('feedbackDialog.kind.strength'));
        expect(filas[1]).toHaveTextContent('feedbackDialog.clashCorrection');
        fireEvent.click(within(filas[1]!).getByText('feedbackDialog.kind.correction'));
        fireEvent.click(within(filas[2]!).getByText('feedbackDialog.kind.ignore'));
        fireEvent.click(within(dialogo).getByText('feedbackDialog.pdf.add:2'));
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(ops()[0].feedback.corrections.map((c: { patternId?: string }) => c.patternId)).toEqual(['dtc', 'apo']);
    });

    it('cerrar con comentarios leídos sin agregar pregunta antes de perder la clasificación', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        await elegirPdf(dialogo);
        fireEvent.keyDown(dialogo, { key: 'Escape' });
        expect(screen.getByRole('alertdialog')).toHaveTextContent('discardChanges.title');
    });

    it('«Guardar» con comentarios leídos sin agregar pregunta: agregarlos y guardar, guardar sin ellos o volver', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        fireEvent.change(within(dialogo).getByPlaceholderText('feedbackDialog.textPlaceholder'), { target: { value: 'Muy buen trabajo.' } });
        await elegirPdf(dialogo);
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        const alerta = screen.getByRole('alertdialog');
        // La marca sin texto está incompleta: «Agregarlos y guardar» agrega las otras dos y lo dice.
        expect(alerta).toHaveTextContent('feedbackDialog.pdfPending.title:3');
        expect(alerta).toHaveTextContent('feedbackDialog.pdfPending.incomplete:1');
        expect(mutateAsync).not.toHaveBeenCalled();
        fireEvent.click(within(alerta).getByText('feedbackDialog.pdfPending.addAndSave'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        const cs = ops()[0].feedback.corrections;
        expect(cs.map((c: { patternKind?: string; anchor?: { page?: string } }) => [c.patternKind, c.anchor?.page])).toEqual([['strength', '2'], ['correction', '6']]);
    });

    it('«Agregar al registro» pasa las completas y deja las marcas sin texto con su aviso; «Ignorar las marcas sin texto»', async () => {
        leerPdf.mockResolvedValueOnce([...NOTAS, { sheet: 12, page: '10', author: PROFESOR, text: '', quote: 'oveja a casa' }]);
        pintar();
        const dialogo = abrirDevolucion();
        const archivo = { name: 'ti1.pdf', arrayBuffer: async () => new ArrayBuffer(4) };
        fireEvent.change(within(dialogo).getByTestId('pdf-feedback-file'), { target: { files: [archivo] } });
        await waitFor(() => expect(within(dialogo).getAllByTestId('pdf-feedback-row')).toHaveLength(4));
        fireEvent.click(within(dialogo).getByText('feedbackDialog.pdf.add:2'));
        expect(within(dialogo).getAllByTestId('feedback-correction-row')).toHaveLength(2);
        // Las dos marcas siguen en el panel, sin ignorarse solas.
        const quedan = within(dialogo).getAllByTestId('pdf-feedback-row');
        expect(quedan).toHaveLength(2);
        expect(quedan.map(elegida)).toEqual(['feedbackDialog.kind.correction', 'feedbackDialog.kind.correction']);
        fireEvent.click(within(dialogo).getByText('feedbackDialog.pdf.ignoreBlank:2'));
        expect(within(dialogo).getAllByTestId('pdf-feedback-row').map(elegida)).toEqual(['feedbackDialog.kind.ignore', 'feedbackDialog.kind.ignore']);
        expect(within(dialogo).queryByText(/feedbackDialog\.pdf\.ignoreBlank/)).toBeNull();
        // Todo ignorado: guardar no pregunta.
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(ops()[0].feedback.corrections).toHaveLength(2);
    });

    it('el comentario se nombra con su rótulo visible y se describe con dónde está (WCAG 2.5.3)', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        const filas = await elegirPdf(dialogo);
        const campo = within(filas[0]!).getByLabelText('feedbackDialog.pdf.comment');
        expect(campo).toHaveAccessibleDescription('feedback.anchorPage:2 · «texto hebreo4.»');
    });

    it('un PDF con contraseña lo dice aparte', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        leerPdf.mockRejectedValueOnce(Object.assign(new Error('No password given'), { name: 'PasswordException' }));
        fireEvent.change(within(dialogo).getByTestId('pdf-feedback-file'), { target: { files: [{ name: 'x.pdf', arrayBuffer: async () => new ArrayBuffer(1) }] } });
        expect(await within(dialogo).findByText('feedbackDialog.pdf.locked')).toBeInTheDocument();
        expect(within(dialogo).queryByText('feedbackDialog.pdf.error')).toBeNull();
    });

    it('«Guardar sin ellos» guarda la devolución sin los comentarios leídos; sin nada más, no se ofrece', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        await elegirPdf(dialogo);
        // Solo los comentarios: guardar sin ellos dejaría la devolución vacía.
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        expect(within(screen.getByRole('alertdialog')).queryByText('feedbackDialog.pdfPending.saveWithout')).toBeNull();
        fireEvent.click(within(screen.getByRole('alertdialog')).getByText('feedbackDialog.pdfPending.back'));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
        fireEvent.change(within(dialogo).getByPlaceholderText('feedbackDialog.textPlaceholder'), { target: { value: 'Muy buen trabajo.' } });
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        fireEvent.click(within(screen.getByRole('alertdialog')).getByText('feedbackDialog.pdfPending.saveWithout'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(ops()[0].feedback).toEqual({ text: 'Muy buen trabajo.', grade: null, corrections: [] });
    });

    it('sin comentarios leídos pendientes (o todos ignorados), «Guardar» no pregunta', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        fireEvent.change(within(dialogo).getByPlaceholderText('feedbackDialog.textPlaceholder'), { target: { value: 'Bien.' } });
        const filas = await elegirPdf(dialogo);
        filas.forEach(f => fireEvent.click(within(f).getByText('feedbackDialog.kind.ignore')));
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('un PDF sin comentarios lo dice; uno que no se lee también', async () => {
        pintar();
        const dialogo = abrirDevolucion();
        leerPdf.mockResolvedValueOnce([]);
        const archivo = { name: 'limpio.pdf', arrayBuffer: async () => new ArrayBuffer(4) };
        fireEvent.change(within(dialogo).getByTestId('pdf-feedback-file'), { target: { files: [archivo] } });
        expect(await within(dialogo).findByText('feedbackDialog.pdf.empty:limpio.pdf')).toBeInTheDocument();
        leerPdf.mockRejectedValueOnce(new Error('roto'));
        fireEvent.change(within(dialogo).getByTestId('pdf-feedback-file'), { target: { files: [archivo] } });
        expect(await within(dialogo).findByText('feedbackDialog.pdf.error')).toBeInTheDocument();
    });
});

describe('una observación a mano', () => {
    it('elige Fortaleza (los patrones que ofrece son de esa clase) y lleva página y frase', async () => {
        const patrones: FeedbackPattern[] = [
            { id: 'cd', name: 'Cierre doble', decision: 'pending' },
            { id: 'tc', name: 'Crítica textual bien hecha', kind: 'strength', decision: 'pending' },
        ];
        pintar(curso({ feedbackPatterns: patrones }));
        const dialogo = abrirDevolucion();
        fireEvent.click(within(dialogo).getByText('feedbackDialog.addCorrection'));
        const fila = within(dialogo).getByTestId('feedback-correction-row');
        expect([...within(fila).getByRole('combobox').querySelectorAll('option')].map(o => o.textContent)).toEqual(['Cierre doble', 'feedbackDialog.newPattern']);
        fireEvent.click(within(fila).getByText('feedbackDialog.kind.strength'));
        expect([...within(fila).getByRole('combobox').querySelectorAll('option')].map(o => o.textContent)).toEqual(['Crítica textual bien hecha', 'feedbackDialog.newPattern']);
        fireEvent.change(within(fila).getByLabelText('feedbackDialog.anchorPageLabel:1'), { target: { value: '5' } });
        fireEvent.change(within(fila).getByLabelText('feedbackDialog.anchorQuoteLabel:1'), { target: { value: 'texto masorético' } });
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(ops()[0].feedback.corrections).toEqual([{ patternId: 'tc', anchor: { page: '5', quote: 'texto masorético' } }]);
    });

    it('pasar una observación guardada a «Fortaleza» la deja en un patrón nuevo, no en el primero de esa clase', () => {
        const project = curso({
            feedbackPatterns: [{ id: 'apo', name: 'Apóstrofe de programación', decision: 'pending' }, { id: 'tc', name: 'Crítica textual bien hecha', kind: 'strength', decision: 'pending' }],
            courseSchedule: [entrada('e1', {
                deliveredAt: '2026-09-20T20:00:00.000Z',
                feedback: { receivedAt: '2026-09-25T10:00:00.000Z', text: 'x', corrections: [{ id: 'c1', patternId: 'apo' }] },
            })],
        });
        pintar(project);
        fireEvent.click(screen.getByText('works.editFeedback'));
        fireEvent.click(screen.getByText('feedbackSummary.edit'));
        const fila = within(screen.getByRole('dialog')).getByTestId('feedback-correction-row');
        fireEvent.click(within(fila).getByText('feedbackDialog.kind.strength'));
        expect((within(fila).getByRole('combobox') as HTMLSelectElement).value).toBe('__new');
        expect(within(fila).getByPlaceholderText('feedbackDialog.patternNamePlaceholder')).toHaveValue('');
    });

    it('REGRESIÓN: «Ver la devolución» abre el resumen para leerla; el editor queda dentro', () => {
        const project = curso({
            feedbackPatterns: [{ id: 'apo', name: 'Apóstrofe', decision: 'pending' }, { id: 'tc', name: 'Crítica textual', kind: 'strength', decision: 'pending' }],
            courseSchedule: [entrada('e1', {
                deliveredAt: '2026-09-20T20:00:00.000Z',
                feedback: { receivedAt: '2026-09-25T10:00:00.000Z', text: 'x', grade: '98/100', corrections: [{ id: 'c1', patternId: 'apo', anchor: { page: '6' } }, { id: 'c2', patternId: 'tc' }] },
            })],
        });
        pintar(project);
        fireEvent.click(screen.getByText('works.editFeedback'));
        const resumen = screen.getByTestId('feedback-summary-dialog');
        expect(within(resumen).getByTestId('feedback-summary-corrections').querySelectorAll('li')).toHaveLength(1);
        expect(within(resumen).getByTestId('feedback-summary-strengths').querySelectorAll('li')).toHaveLength(1);
        expect(screen.queryByText('feedbackDialog.save')).toBeNull();
        fireEvent.click(screen.getByText('feedbackSummary.edit'));
        expect(screen.getByText('feedbackDialog.save')).toBeInTheDocument();
    });

    it('«Quitar la devolución» cuenta correcciones y fortalezas por separado', () => {
        const project = curso({
            feedbackPatterns: [{ id: 'apo', name: 'Apóstrofe', decision: 'pending' }, { id: 'tc', name: 'Crítica textual', kind: 'strength', decision: 'pending' }],
            courseSchedule: [entrada('e1', {
                deliveredAt: '2026-09-20T20:00:00.000Z',
                feedback: { receivedAt: '2026-09-25T10:00:00.000Z', text: 'x', corrections: [{ id: 'c1', patternId: 'apo' }, { id: 'c2', patternId: 'tc' }, { id: 'c3', patternId: 'tc' }] },
            })],
        });
        pintar(project);
        fireEvent.click(screen.getByText('works.editFeedback'));
        fireEvent.click(screen.getByText('feedbackSummary.edit'));
        fireEvent.click(within(screen.getByRole('dialog')).getByText('feedbackDialog.clear'));
        expect(screen.getByRole('alertdialog')).toHaveTextContent('feedbackDialog.clearHint:feedbackDialog.clearCount.corrections:1feedbackDialog.clearAndfeedbackDialog.clearCount.strengths:2');
    });

    it('al editar, una observación guardada conserva su ancla', async () => {
        const project = curso({
            feedbackPatterns: [{ id: 'apo', name: 'Apóstrofe de programación', decision: 'pending' }],
            courseSchedule: [entrada('e1', {
                deliveredAt: '2026-09-20T20:00:00.000Z',
                feedback: { receivedAt: '2026-09-25T10:00:00.000Z', text: 'x', corrections: [{ id: 'c1', patternId: 'apo', anchor: { page: '6', quote: "Waltke y O'Connor" } }] },
            })],
        });
        pintar(project);
        fireEvent.click(screen.getByText('works.editFeedback'));
        fireEvent.click(screen.getByText('feedbackSummary.edit'));
        const dialogo = screen.getByRole('dialog');
        expect(within(dialogo).getByDisplayValue("Waltke y O'Connor")).toBeInTheDocument();
        fireEvent.click(within(dialogo).getByText('feedbackDialog.save'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(ops()[0].feedback.corrections).toEqual([{ id: 'c1', patternId: 'apo', anchor: { page: '6', quote: "Waltke y O'Connor" } }]);
    });
});

describe('el registro en el escritorio', () => {
    const conFortalezas = () => curso({
        feedbackPatterns: [
            { id: 'esp', name: 'Espaciado de títulos', decision: 'pending' },
            { id: 'tc', name: 'Crítica textual bien hecha', kind: 'strength', decision: 'pending' },
        ],
        courseSchedule: [
            entrada('e1', { deliveredAt: '2026-09-20T20:00:00.000Z', feedback: { receivedAt: '2026-09-25T10:00:00.000Z', text: '', corrections: [
                { id: 'c1', patternId: 'esp', note: 'Revisa el espaciado.', anchor: { page: '1' } },
                { id: 'c2', patternId: 'tc', note: 'Distinción correcta.', anchor: { page: '2', quote: 'texto hebreo4.' } },
            ] } }),
            entrada('e2', { deliveredAt: '2026-10-20T20:00:00.000Z', feedback: { receivedAt: '2026-10-25T10:00:00.000Z', text: '', corrections: [
                { id: 'c3', patternId: 'tc', note: 'Sobresaliente.', anchor: { page: '5', quote: "Waltke y O'Connor" } },
            ] } }),
        ],
    });

    it('las fortalezas van aparte, «Lo que hay que mantener», sin el aviso «se repite»', () => {
        pintar(conFortalezas());
        expect(screen.getAllByTestId('course-pattern-row').map(f => f.textContent)).toEqual([expect.stringContaining('Espaciado de títulos')]);
        const fortalezas = screen.getByTestId('course-strengths');
        expect(fortalezas).toHaveTextContent('feedback.strengthsTitle');
        const fila = within(fortalezas).getByTestId('course-strength-row');
        expect(fila).toHaveTextContent('Crítica textual bien hecha');
        expect(fila).toHaveTextContent('feedback.countStrength:2');
        // En dos entregas: se repite, pero una fortaleza no queda pendiente ni lleva el aviso.
        expect(fila).not.toHaveTextContent('feedback.repeats');
    });

    it('cada observación con su entrega y su ancla', () => {
        pintar(conFortalezas());
        const fila = screen.getByTestId('course-strength-row');
        expect(within(fila).getByText('feedback.observations:2')).toBeInTheDocument();
        const obs = within(fila).getAllByTestId('course-pattern-observation');
        expect(obs[0]).toHaveTextContent('TI #1 · feedback.anchorPage:2 · «texto hebreo4.»');
        expect(obs[1]).toHaveTextContent("TI #2 · feedback.anchorPage:5 · «Waltke y O'Connor»");
        expect(obs[1]).toHaveTextContent('Sobresaliente.');
    });

    it('«Pasar a tu guía» una fortaleza: el texto habla de repetirla; descartarla pide razón', async () => {
        addRule.mockResolvedValue({ added: true });
        pintar(conFortalezas());
        const fila = screen.getByTestId('course-strength-row');
        fireEvent.click(within(fila).getByText('feedback.toGuide'));
        expect(screen.getByRole('dialog')).toHaveTextContent('guideRule.hintStrength');
        fireEvent.click(within(screen.getByRole('dialog')).getByText('common.cancel'));
        fireEvent.click(within(fila).getByLabelText('feedback.discardLabel:Crítica textual bien hecha'));
        const dialogo = screen.getByRole('dialog');
        expect(dialogo).toHaveTextContent('discard.hintStrength');
        expect(within(dialogo).getByText('discard.confirm').closest('button')).toBeDisabled();
        fireEvent.change(within(dialogo).getByLabelText('discard.reason'), { target: { value: 'Ya es costumbre.' } });
        fireEvent.click(within(dialogo).getByText('discard.confirm'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(ops()).toEqual([{ op: 'decidePattern', patternId: 'tc', decision: 'discarded', reason: 'Ya es costumbre.' }]);
    });
});
