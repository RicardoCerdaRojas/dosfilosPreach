import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import esProjects from '@/i18n/locales/es/projects.json';
import enProjects from '@/i18n/locales/en/projects.json';

/**
 * Fase «Encuadre de la serie» (U4): el diálogo «Pasaje y propósito», la
 * tarjeta «Encuadre», el registro de la hipótesis y su consolidación, las
 * tarjetas de curso plegadas y la comparación canónica.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [] }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [] }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({ useUserStyleGuides: () => ({ guides: [{ id: 'g1', displayName: 'Guía TMS' }] }) }));

const { ProjectFramingDialog } = await import('../ProjectFramingDialog');
const { ProjectFramingCard } = await import('../ProjectFramingCard');
const { ProjectSetupCards } = await import('../ProjectSetupCards');
const { ProjectCourseCard } = await import('../ProjectCourseCard');
const { ProjectWorkTypesCard } = await import('../ProjectWorkTypesCard');
const { formFromProject, saveFromForm, parseReaderRange } = await import('../ProjectFramingForm');
const { canonico } = await import('@/utils/canonico');

beforeEach(() => { cleanup(); vi.clearAllMocks(); });

const esdras = (over: Record<string, unknown> = {}) => ({ id: 'ezr', userId: 'u', title: 'Esdras', color: 'amber', type: 'exegetical', ...over });

function abrirDialogo(project: Record<string, unknown>) {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ProjectFramingDialog project={project as never} open onOpenChange={vi.fn()} onSave={onSave} saving={false} />);
    return onSave;
}
const guardar = () => fireEvent.click(screen.getByRole('button', { name: /framing\.dialog\.save/ }));
const agregarLibro = (b: string) => fireEvent.change(screen.getByLabelText('framing.dialog.addBook'), { target: { value: b } });

describe('diálogo «Pasaje y propósito»', () => {
    it('guarda en UNA llamada los campos del formulario y los libros, sin tocar el registro ni la revisión', async () => {
        const conRegistro = esdras({
            framing: {
                centralIdea: 'Dios restaura.',
                hypothesisLog: [{ id: 'h1', at: '2026-10-20T00:00:00.000Z', source: 'study', studyId: 's1', verdict: 'confirms', note: 'x' }],
                revision: { centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'y', ofIdea: 'Dios restaura.', revisedAt: '2026-10-21T00:00:00.000Z' },
            },
        });
        const onSave = abrirDialogo(conRegistro);
        agregarLibro('EZR');
        fireEvent.change(screen.getByLabelText('framing.dialog.centralIdea'), { target: { value: 'Dios restaura a su pueblo por su palabra.' } });
        guardar();
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        const { framingPatch, bibleBooks } = onSave.mock.calls[0]![0];
        expect(bibleBooks).toEqual(['EZR']);
        expect(framingPatch.centralIdea).toBe('Dios restaura a su pueblo por su palabra.');
        expect(framingPatch.purpose).toBe('preach');
        expect('hypothesisLog' in framingPatch).toBe(false);
        expect('revision' in framingPatch).toBe(false);
        // Lo vacío viaja como null: el pastor lo vació, se borra.
        expect(framingPatch.occasion).toBeNull();
    });

    it('sin libros no se puede guardar; no hay ningún otro campo obligatorio', () => {
        const onSave = abrirDialogo(esdras());
        expect(screen.getByRole('button', { name: /framing\.dialog\.save/ })).toBeDisabled();
        expect(screen.getByText('framing.dialog.noBooks')).toBeInTheDocument();
        agregarLibro('EZR');
        expect(screen.getByRole('button', { name: /framing\.dialog\.save/ })).not.toBeDisabled();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('el alcance desde–hasta solo se elige con un libro, y con dos se guarda el libro completo', async () => {
        const onSave = abrirDialogo(esdras({ bibliographyCriteria: { bibleBooks: ['EZR'] } }));
        fireEvent.click(screen.getByLabelText('framing.dialog.scopeRange'));
        fireEvent.change(screen.getByPlaceholderText('framing.dialog.scopePlaceholder'), { target: { value: '9-10' } });
        agregarLibro('NEH');
        expect(screen.queryByLabelText('framing.dialog.scopeRange')).toBeNull();
        expect(screen.getByText('framing.dialog.scopeOnlyOneBook')).toBeInTheDocument();
        guardar();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0]![0].framingPatch.scope).toBeNull();
        expect(onSave.mock.calls[0]![0].bibleBooks).toEqual(['EZR', 'NEH']);
    });

    it('un tramo mal escrito detiene el guardado y lo dice', () => {
        abrirDialogo(esdras({ bibliographyCriteria: { bibleBooks: ['EZR'] } }));
        fireEvent.click(screen.getByLabelText('framing.dialog.scopeRange'));
        fireEvent.change(screen.getByPlaceholderText('framing.dialog.scopePlaceholder'), { target: { value: '40-41' } });
        expect(screen.getByText('framing.dialog.scopeError')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /framing\.dialog\.save/ })).toBeDisabled();
    });

    it('el alcance y los movimientos se guardan en la numeración del ORIGINAL y se muestran en la del lector (Jonás 1:17 = TM 2:1)', async () => {
        const onSave = abrirDialogo({ id: 'jon', type: 'exegetical', bibliographyCriteria: { bibleBooks: ['JON'] } });
        fireEvent.click(screen.getByLabelText('framing.dialog.scopeRange'));
        fireEvent.change(screen.getByPlaceholderText('framing.dialog.scopePlaceholder'), { target: { value: '1:17-2:10' } });
        fireEvent.click(screen.getByText('framing.dialog.addMovement'));
        fireEvent.change(screen.getByLabelText('framing.dialog.movementRange 1'), { target: { value: '1:17-2:10' } });
        fireEvent.change(screen.getByLabelText('framing.dialog.movementTitle 1'), { target: { value: 'La oración desde el pez' } });
        guardar();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        const { framingPatch } = onSave.mock.calls[0]![0];
        const original = { bookId: 'JON', chapterStart: 2, verseStart: 1, chapterEnd: 2, verseEnd: 11 };
        expect(framingPatch.scope).toEqual({ bookId: 'JON', passage: original });
        expect(framingPatch.structure).toEqual([{ passage: original, title: 'La oración desde el pez' }]);
        // De vuelta: lo guardado se escribe en la numeración del lector.
        const form = formFromProject({ bibliographyCriteria: { bibleBooks: ['JON'] }, framing: framingPatch } as never);
        expect(form.scopeRange).toBe('1:17-2:10');
        expect(form.structure[0]!.range).toBe('1:17-2:10');
    });

    it('un movimiento de otro libro se escribe con su libro', () => {
        expect(parseReaderRange('Neh 1-7', 'EZR')).toEqual({ ok: true, passage: { bookId: 'NEH', chapterStart: 1, chapterEnd: 7, verseStart: null, verseEnd: null } });
        expect(parseReaderRange('1-6', 'EZR')).toEqual({ ok: true, passage: { bookId: 'EZR', chapterStart: 1, chapterEnd: 6, verseStart: null, verseEnd: null } });
        expect(parseReaderRange('', 'EZR')).toEqual({ ok: true, passage: null });
        expect(parseReaderRange('xx', 'EZR').ok).toBe(false);
    });

    it('en «estudio personal» los bloques pastorales se ocultan y se borran; la trayectoria hacia Cristo sigue', async () => {
        const onSave = abrirDialogo(esdras({ bibliographyCriteria: { bibleBooks: ['EZR'] }, framing: { audience: 'La iglesia', rhythm: { sundays: 12 } } }));
        expect(screen.getByTestId('framing-pastoral')).toBeInTheDocument();
        expect(screen.getByTestId('framing-rhythm')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('framing.purpose.personal'));
        expect(screen.queryByTestId('framing-pastoral')).toBeNull();
        expect(screen.queryByTestId('framing-rhythm')).toBeNull();
        expect(screen.getByLabelText('framing.dialog.christTrajectory')).toBeInTheDocument();
        guardar();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        const { framingPatch } = onSave.mock.calls[0]![0];
        expect(framingPatch).toMatchObject({ purpose: 'personal', audience: null, need: null, needEvidence: null, desiredChange: null, rhythm: null });
    });

    it('las preguntas guía cambian con el género (narrativa: conflicto, giro, resolución, narrador)', () => {
        abrirDialogo(esdras({ bibliographyCriteria: { bibleBooks: ['EZR'] } }));
        expect(screen.queryByTestId('framing-genre-questions')).toBeNull();
        fireEvent.change(screen.getByLabelText('framing.genre.label'), { target: { value: 'historical-narrative' } });
        const narrativa = within(screen.getByTestId('framing-genre-questions'));
        expect(narrativa.getByText('framing.genre.questions.historical-narrative.conflict')).toBeInTheDocument();
        expect(narrativa.getByText('framing.genre.questions.historical-narrative.narrator')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('framing.genre.label'), { target: { value: 'epistle' } });
        const epistola = within(screen.getByTestId('framing-genre-questions'));
        expect(epistola.queryByText('framing.genre.questions.historical-narrative.conflict')).toBeNull();
        expect(epistola.getByText('framing.genre.questions.epistle.argument')).toBeInTheDocument();
    });

    it('con Esdras: la nota de Esdras-Nehemías, las notas «Para predicar» y resaltada la que toca el alcance', () => {
        abrirDialogo(esdras());
        expect(screen.queryByTestId('framing-ezra-nehemiah')).toBeNull();
        expect(screen.queryByTestId('framing-notes')).toBeNull();
        agregarLibro('EZR');
        expect(screen.getByTestId('framing-ezra-nehemiah')).toBeInTheDocument();
        const notas = screen.getByTestId('framing-notes');
        expect(within(notas).getByText('Esdras y Nehemías son un solo libro')).toBeInTheDocument();
        expect(notas.querySelectorAll('[data-highlighted]')).toHaveLength(0);
        fireEvent.click(screen.getByLabelText('framing.dialog.scopeRange'));
        fireEvent.change(screen.getByPlaceholderText('framing.dialog.scopePlaceholder'), { target: { value: '9-10' } });
        const resaltadas = [...notas.querySelectorAll('[data-highlighted]')].map(n => n.textContent);
        expect(resaltadas).toHaveLength(1);
        expect(resaltadas[0]).toContain('Esdras 9–10');
    });

    it('un título por capítulo: diez para Esdras, los del alcance si lo hay, y solo se guardan los que se ven', () => {
        abrirDialogo(esdras({ bibliographyCriteria: { bibleBooks: ['EZR'] } }));
        expect(within(screen.getByTestId('framing-chapter-titles')).getAllByRole('textbox')).toHaveLength(10);
        fireEvent.click(screen.getByLabelText('framing.dialog.scopeRange'));
        fireEvent.change(screen.getByPlaceholderText('framing.dialog.scopePlaceholder'), { target: { value: '7-8' } });
        expect(within(screen.getByTestId('framing-chapter-titles')).getAllByRole('textbox')).toHaveLength(2);
        const form = { ...formFromProject({ bibliographyCriteria: { bibleBooks: ['EZR'] } } as never), scopeMode: 'range' as const, scopeRange: '7-8', chapterTitles: { 1: 'El decreto', 7: 'Esdras llega' } };
        expect(saveFromForm(form).framingPatch.reading).toEqual({ chapterTitles: { 7: 'Esdras llega' } });
    });
});

describe('tarjeta «Encuadre»', () => {
    const estudios = [{ id: 's1', title: 'Esdras 1', passage: { bookId: 'EZR' as const, chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 11 } }];
    const montar = (project: Record<string, unknown>, extra: Partial<{ onAnnotate: () => Promise<void>; onConsolidate: () => Promise<void> }> = {}) => {
        const props = { onEdit: vi.fn(), onAnnotate: vi.fn().mockResolvedValue(undefined), onConsolidate: vi.fn().mockResolvedValue(undefined), ...extra };
        render(<ProjectFramingCard project={project as never} studies={estudios} saving={false} {...props} />);
        return props;
    };
    const conIdea = (framing: Record<string, unknown>) => esdras({ bibliographyCriteria: { bibleBooks: ['EZR'] }, framing: { purpose: 'preach', centralIdea: 'Dios restaura.', ...framing } });

    it('sin encuadre invita a definirlo, y el botón abre el diálogo', () => {
        const { onEdit } = montar(esdras());
        expect(screen.getByText('framing.card.empty')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /framing\.card\.define/ }));
        expect(onEdit).toHaveBeenCalled();
    });

    it('dice lo que falta, sin bloquear', () => {
        montar(conIdea({}));
        const falta = screen.getByTestId('framing-missing').textContent!;
        expect(falta).toContain('framing.field.genre');
        expect(falta).toContain('framing.field.structure');
        expect(falta).toContain('framing.field.centralIdeaEvidence');
        expect(falta).not.toMatch(/framing\.field\.centralIdea(,|")/);
        expect(falta).not.toContain('framing.field.bibleBooks');
    });

    it('anotar lo que dice un estudio agrega una entrada con estudio, veredicto y nota', async () => {
        const { onAnnotate } = montar(conIdea({}));
        expect(screen.queryByRole('button', { name: /framing\.card\.consolidate/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /framing\.card\.annotate/ }));
        fireEvent.click(screen.getByLabelText('framing.hypothesisVerdict.nuances'));
        fireEvent.change(screen.getByPlaceholderText('framing.annotate.notePlaceholder'), { target: { value: 'El decreto pesa más.' } });
        fireEvent.click(screen.getByRole('button', { name: /framing\.annotate\.save/ }));
        await waitFor(() => expect(onAnnotate).toHaveBeenCalledWith({ source: 'study', studyId: 's1', verdict: 'nuances', note: 'El decreto pesa más.' }));
    });

    it('«Consolidar la idea» aparece con una anotación y guarda idea, veredicto y porqué', async () => {
        const { onConsolidate } = montar(conIdea({ hypothesisLog: [{ id: 'h1', at: '2026-10-20T12:00:00.000Z', source: 'study', studyId: 's1', verdict: 'nuances', note: 'El decreto pesa más.' }] }));
        expect(within(screen.getByTestId('framing-log')).getByText(/Esdras 1/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /framing\.card\.consolidate/ }));
        expect(screen.getByTestId('framing-original-idea')).toHaveTextContent('Dios restaura.');
        fireEvent.change(screen.getByLabelText('framing.consolidate.revised'), { target: { value: 'Dios restaura a su pueblo por su palabra.' } });
        fireEvent.click(screen.getByLabelText('framing.revisionVerdict.nuanced'));
        fireEvent.change(screen.getByLabelText('framing.consolidate.why'), { target: { value: 'Esd 7:10' } });
        fireEvent.click(screen.getByRole('button', { name: /^framing\.consolidate\.save$/ }));
        await waitFor(() => expect(onConsolidate).toHaveBeenCalledWith({ centralIdea: 'Dios restaura a su pueblo por su palabra.', verdict: 'nuanced', why: 'Esd 7:10' }));
    });

    it('si la idea cambió después de consolidarla, lo dice y ofrece consolidar de nuevo', () => {
        const revision = { centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'y', ofIdea: 'Otra idea.', revisedAt: '2026-10-21T00:00:00.000Z' };
        const log = [{ id: 'h1', at: '2026-10-20T12:00:00.000Z', source: 'panorama', verdict: 'confirms', note: '' }];
        montar(conIdea({ revision, hypothesisLog: log }));
        expect(screen.getByTestId('framing-stale')).toBeInTheDocument();
        expect(screen.queryByTestId('framing-revision')).toBeNull();
        expect(screen.getByRole('button', { name: 'framing.card.consolidateAgain' })).toBeInTheDocument();
        cleanup();
        montar(conIdea({ revision: { ...revision, ofIdea: 'Dios restaura.' }, hypothesisLog: log }));
        expect(screen.queryByTestId('framing-stale')).toBeNull();
        expect(screen.getByTestId('framing-revision')).toHaveTextContent('Dios restaura por su palabra.');
    });
});

describe('tarjetas de curso en un Exegético', () => {
    it('sin datos guardados no se muestran; «Opciones de curso» las despliega', () => {
        render(<ProjectSetupCards project={esdras() as never} onSave={vi.fn()} collapsible />);
        expect(screen.queryByText('course.save')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /course\.options/ }));
        expect(screen.getByText('course.save')).toBeInTheDocument();
    });

    it('con datos guardados se ven como siempre', () => {
        render(<ProjectSetupCards project={esdras({ workTypes: [{ id: 'a', label: 'TP' }] }) as never} onSave={vi.fn()} collapsible />);
        expect(screen.getByText('course.save')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /course\.options/ })).toBeNull();
    });

    it('los demás tipos, como siempre', () => {
        render(<ProjectSetupCards project={{ id: 'c', type: 'course' } as never} onSave={vi.fn()} />);
        expect(screen.getByText('course.save')).toBeInTheDocument();
    });
});

describe('«Cambios sin guardar» canónico', () => {
    it('null, vacío y ausente son iguales; las claves en cualquier orden; los arreglos en orden', () => {
        expect(canonico({ a: 1, b: null, c: '' })).toBe(canonico({ a: 1 }));
        expect(canonico({ b: 2, a: 1 })).toBe(canonico({ a: 1, b: 2 }));
        expect(canonico({ x: { y: null } })).toBe(canonico({}));
        expect(canonico([1, 2])).not.toBe(canonico([2, 1]));
        expect(canonico([{ id: 'a' }, { id: 'b', t: '' }])).toBe(canonico([{ id: 'a' }, { id: 'b' }]));
        expect(canonico({ a: 0 })).not.toBe(canonico({}));
        expect(canonico({ a: false })).not.toBe(canonico({}));
    });

    it('elegir una guía y volver a «Ninguna» no deja el aviso pegado (caso real)', () => {
        render(<ProjectCourseCard project={{ id: 'p', type: 'course', courseInfo: { course: 'NT785' } } as never} onSave={vi.fn()} saving={false} />);
        expect(screen.queryByText('unsaved')).toBeNull();
        fireEvent.change(screen.getByLabelText('course.styleGuide'), { target: { value: 'g1' } });
        expect(screen.getByText('unsaved')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('course.styleGuide'), { target: { value: '' } });
        expect(screen.queryByText('unsaved')).toBeNull();
    });
});

describe('«Cambios sin guardar» en los tipos de trabajo', () => {
    it('la rúbrica «del sistema» (null) sí es un cambio frente a «por defecto» (ausente)', () => {
        render(<ProjectWorkTypesCard project={{ id: 'p', type: 'course', workTypes: [{ id: 'a', label: 'TP' }] } as never} onSave={vi.fn()} saving={false} />);
        fireEvent.click(screen.getByText('workTypes.edit'));
        fireEvent.change(screen.getByLabelText('workTypes.rubric'), { target: { value: '__system' } });
        expect(screen.getByText('unsaved')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('workTypes.rubric'), { target: { value: '' } });
        expect(screen.queryByText('unsaved')).toBeNull();
    });
});

describe('textos del encuadre en es y en', () => {
    function* hojas(v: unknown, ruta: string): Generator<[string, string]> {
        if (typeof v === 'string') yield [ruta, v];
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* hojas(x, ruta ? `${ruta}.${k}` : k);
    }
    const ph = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort();
    const nuevos = (json: Record<string, any>) => ({
        framing: json.framing,
        passage: json.roadmap.phases.exegetical.passage,
        passageEdit: json.roadmap.phases.exegetical.passageEdit,
        options: json.course.options, hideOptions: json.course.hideOptions,
        booksFromFraming: json.stateOfArt.criteria.booksFromFraming,
        changeInFraming: json.stateOfArt.criteria.changeInFraming,
        noBooksFraming: json.stateOfArt.criteria.noBooksFraming,
    });

    it('las mismas claves, no vacías y con los mismos placeholders', () => {
        const es = new Map(hojas(nuevos(esProjects as never), ''));
        const en = new Map(hojas(nuevos(enProjects as never), ''));
        expect([...en.keys()].sort()).toEqual([...es.keys()].sort());
        expect(es.size).toBeGreaterThan(100);
        for (const [k, v] of es) {
            expect(v.trim(), k).not.toBe('');
            expect(en.get(k)!.trim(), k).not.toBe('');
            expect(ph(en.get(k)!), k).toEqual(ph(v));
        }
    });

    it('ningún texto nombra la tecnología', () => {
        const prohibidas = /\b(IA|AI|modelo|Gemini|LLM|asistente)\b/i;
        const hallazgos = [...hojas(nuevos(esProjects as never), 'es'), ...hojas(nuevos(enProjects as never), 'en')].filter(([, v]) => prohibidas.test(v));
        expect(hallazgos).toEqual([]);
    });
});
