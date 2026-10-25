import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as renderRtl, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import es from '@/i18n/locales/es/exegesis.json';
import en from '@/i18n/locales/en/exegesis.json';

/**
 * U7 (`docs/FASE_ENCUADRE_SERIE_2026-10.md`): la lectura del pastor al final
 * del estudio, plegada, y el registro de lo que este estudio dice de ella.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let proyectos: unknown[] = [];
const mutateAsync = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: proyectos, updateProject: { mutateAsync, isPending: false } }),
}));

const { ReadingOfTheBookPanel, matchMovements, projectWithReading, entriesOfStudy } = await import('../ReadingOfTheBookPanel');

// El formulario enlaza al proyecto: necesita un router.
const render = (ui: ReactElement) => renderRtl(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const p = (cs: number, ce: number, vs: number | null = null, ve: number | null = null) =>
    ({ bookId: 'EZR', chapterStart: cs, chapterEnd: ce, verseStart: vs, verseEnd: ve });

const encuadre = {
    centralIdea: 'Dios restaura a su pueblo por su Palabra.',
    structure: [
        { passage: p(1, 6), title: 'El regreso y el templo' },
        { passage: p(7, 10), title: 'Esdras y la Ley' },
    ],
    hypothesisLog: [
        { id: 'a', at: '2026-10-20T10:00:00.000Z', source: 'study', studyId: 'est1', verdict: 'confirms', note: 'Nota de este estudio' },
        { id: 'b', at: '2026-10-21T10:00:00.000Z', source: 'study', studyId: 'otro', verdict: 'contradicts', note: 'Nota de otro estudio' },
        { id: 'c', at: '2026-10-19T10:00:00.000Z', source: 'panorama', verdict: 'nuances', note: 'Nota del panorama' },
    ],
};
const proyecto = { id: 'esd', title: 'Esdras — serie', userId: 'u1', framing: encuadre };
const estudio = (over: Record<string, unknown> = {}) =>
    ({ id: 'est1', projectId: 'esd', linkedProjectIds: [], passage: p(7, 7, 1, 10), ...over }) as never;

const abrir = () => fireEvent.click(screen.getByRole('button', { name: /readingPanel.title/ }));

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    proyectos = [proyecto];
});

describe('cuándo aparece', () => {
    it('no aparece sin proyecto', () => {
        const { container } = render(<ReadingOfTheBookPanel paper={estudio({ projectId: null })} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('no aparece si el proyecto no tiene encuadre', () => {
        proyectos = [{ ...proyecto, framing: undefined }];
        const { container } = render(<ReadingOfTheBookPanel paper={estudio()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('no aparece con un encuadre sin idea central ni estructura', () => {
        proyectos = [{ ...proyecto, framing: { genre: 'historical-narrative', occasion: 'Persia', centralIdea: '   ', structure: [] } }];
        const { container } = render(<ReadingOfTheBookPanel paper={estudio()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('con solo estructura, sí aparece', () => {
        proyectos = [{ ...proyecto, framing: { structure: encuadre.structure } }];
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        expect(screen.getByText('readingPanel.title')).toBeInTheDocument();
    });

    it('el de origen manda; un vinculado con encuadre sirve si el de origen no lo tiene; la papelera no cuenta', () => {
        const curso = { id: 'curso', title: 'Curso', userId: 'u1' };
        const otro = { id: 'otro', title: 'Otro', userId: 'u1', framing: { centralIdea: 'Otra idea' } };
        const all = [curso, proyecto, otro] as never[];
        expect(projectWithReading({ projectId: 'esd', linkedProjectIds: ['otro'] }, all)?.id).toBe('esd');
        expect(projectWithReading({ projectId: 'curso', linkedProjectIds: ['esd', 'otro'] }, all)?.id).toBe('esd');
        expect(projectWithReading({ projectId: 'esd', linkedProjectIds: [] }, [{ ...proyecto, deletedAt: new Date() }] as never[])).toBeNull();
    });
});

describe('libro o pasaje', () => {
    it('sin alcance, «del libro»; con alcance acotado, «del pasaje»', () => {
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        expect(screen.getByText('readingPanel.title')).toBeInTheDocument();
        expect(screen.getByText('readingPanel.centralIdea')).toBeInTheDocument();
        expect(screen.getByText('readingPanel.structure')).toBeInTheDocument();
        cleanup();
        proyectos = [{ ...proyecto, framing: { ...encuadre, scope: { bookId: 'EZR', passage: p(7, 10) } } }];
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        expect(screen.getByText('readingPanel.titlePassage')).toBeInTheDocument();
        expect(screen.getByText('readingPanel.centralIdeaPassage')).toBeInTheDocument();
        expect(screen.getByText('readingPanel.structurePassage')).toBeInTheDocument();
        expect(screen.queryByText('readingPanel.title')).not.toBeInTheDocument();
    });
});

describe('plegado al final', () => {
    it('aparece plegado: ni la idea ni el formulario están a la vista', () => {
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        const boton = screen.getByRole('button', { name: /readingPanel.title/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(encuadre.centralIdea)).not.toBeInTheDocument();
        expect(screen.queryByText('readingPanel.form.title')).not.toBeInTheDocument();
        expect(screen.getByText('readingPanel.whyFolded')).toBeInTheDocument();
    });

    it('se abre al pulsar y recuerda el plegado por estudio', () => {
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        expect(screen.getByRole('button', { name: /readingPanel.title/ })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText(encuadre.centralIdea)).toBeInTheDocument();
        cleanup();
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        expect(screen.getByText(encuadre.centralIdea)).toBeInTheDocument();
        cleanup();
        render(<ReadingOfTheBookPanel paper={estudio({ id: 'est2' })} />);
        expect(screen.queryByText(encuadre.centralIdea)).not.toBeInTheDocument();
    });

    it('la página del estudio lo monta DESPUÉS de los pasos', () => {
        const aqui = dirname(fileURLToPath(import.meta.url));
        const pagina = readFileSync(resolve(aqui, '../../ExegesisPaperPage.tsx'), 'utf8');
        const pasos = pagina.indexOf('<StepsPanel');
        const panel = pagina.indexOf('<ReadingOfTheBookPanel paper={paper} />');
        expect(pasos).toBeGreaterThan(0);
        expect(panel).toBeGreaterThan(pasos);
    });
});

describe('la estructura', () => {
    it('resalta el movimiento que contiene el pasaje del estudio, y solo ese', () => {
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        const items = screen.getAllByRole('listitem').filter(li => li.textContent?.includes('·') && li.closest('ol'));
        expect(items).toHaveLength(2);
        expect(items[0]).not.toHaveAttribute('data-match');
        expect(items[1]).toHaveAttribute('data-match', 'contains');
        expect(items[1]).toHaveAttribute('aria-current', 'location');
        expect(within(items[1]!).getByText('readingPanel.here')).toBeInTheDocument();
    });

    it('un pasaje a caballo entre dos movimientos toca los dos; uno fuera de todos, ninguno', () => {
        expect(matchMovements(encuadre.structure as never, p(6, 7, 19, 5) as never)).toEqual(['overlaps', 'overlaps']);
        expect(matchMovements(encuadre.structure as never, p(3, 3, 1, 13) as never)).toEqual(['contains', null]);
        expect(matchMovements(encuadre.structure as never, { ...p(3, 3, 1, 5), bookId: 'NEH' } as never)).toEqual([null, null]);
    });

    it('sin movimiento que lo incluya, lo dice', () => {
        proyectos = [{ ...proyecto, framing: { ...encuadre, structure: [{ passage: p(1, 6), title: 'El regreso' }] } }];
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        expect(screen.getByText('readingPanel.noMovement')).toBeInTheDocument();
    });

    it('la idea revisada vigente aparece rotulada; desactualizada, no', () => {
        const revision = { centralIdea: 'Idea revisada', verdict: 'nuanced', why: 'x', ofIdea: encuadre.centralIdea, revisedAt: '2026-10-22T00:00:00.000Z' };
        proyectos = [{ ...proyecto, framing: { ...encuadre, revision } }];
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        expect(screen.getByText('readingPanel.revisedIdea')).toBeInTheDocument();
        expect(screen.getByText('Idea revisada')).toBeInTheDocument();
        cleanup();
        proyectos = [{ ...proyecto, framing: { ...encuadre, revision: { ...revision, ofIdea: 'Otra idea anterior' } } }];
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        expect(screen.queryByText('Idea revisada')).not.toBeInTheDocument();
    });
});

describe('el registro de este estudio', () => {
    it('solo lista las anotaciones de este estudio', () => {
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        expect(screen.getByText('Nota de este estudio')).toBeInTheDocument();
        expect(screen.queryByText('Nota de otro estudio')).not.toBeInTheDocument();
        expect(screen.queryByText('Nota del panorama')).not.toBeInTheDocument();
        expect(entriesOfStudy(encuadre as never, 'est1').map(e => e.id)).toEqual(['a']);
    });

    it('anotar manda la entrada con studyId y veredicto al caso de uso, y nada más', async () => {
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        const anotar = screen.getByRole('button', { name: 'readingPanel.form.save' });
        expect(anotar).toBeDisabled();
        fireEvent.click(screen.getByRole('radio', { name: 'readingPanel.verdict.nuances' }));
        fireEvent.change(screen.getByLabelText('readingPanel.form.noteLabel'), { target: { value: '  7:10 pone la Ley antes del templo  ' } });
        expect(anotar).toBeEnabled();
        fireEvent.click(anotar);
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        // Sin `framingPatch`: el caso de uso lee el registro guardado y agrega.
        expect(mutateAsync.mock.calls[0]![0]).toEqual({
            projectId: 'esd',
            hypothesisEntry: { source: 'study', studyId: 'est1', verdict: 'nuances', note: '7:10 pone la Ley antes del templo' },
        });
        await waitFor(() => expect((screen.getByLabelText('readingPanel.form.noteLabel') as HTMLTextAreaElement).value).toBe(''));
    });

    it('el panel no llama a ningún prompt: ni él ni su formulario importan servicios ni hooks de generación', () => {
        const aqui = dirname(fileURLToPath(import.meta.url));
        const importsDe = (f: string) => [...readFileSync(resolve(aqui, f), 'utf8').matchAll(/from '([^']+)'/g)].map(m => m[1]);
        expect(importsDe('../ReadingOfTheBookPanel.tsx').sort()).toEqual([
            './ReadingAnnotateForm', '@/hooks/faculty/useFacultyProjects', '@/i18n', '@dosfilos/domain', 'lucide-react', 'react',
        ]);
        expect(importsDe('../ReadingAnnotateForm.tsx').sort()).toEqual([
            '@/components/ui/button', '@/components/ui/label', '@/components/ui/radio-group', '@/components/ui/textarea',
            '@/hooks/faculty/useFacultyProjects', '@/i18n', '@dosfilos/domain', 'lucide-react', 'react', 'react-router-dom', 'sonner',
        ]);
    });

    it('la nota dice dónde se revisa la idea y enlaza al proyecto', () => {
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        expect(screen.getByText(/readingPanel\.form\.private/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'readingPanel.form.goToProject' })).toHaveAttribute('href', '/dashboard/projects/esd');
    });

    it('si falla al anotar, lo avisa y conserva lo escrito', async () => {
        const { toast } = await import('sonner');
        mutateAsync.mockRejectedValueOnce(new Error('red'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ReadingOfTheBookPanel paper={estudio()} />);
        abrir();
        fireEvent.click(screen.getByRole('radio', { name: 'readingPanel.verdict.confirms' }));
        fireEvent.change(screen.getByLabelText('readingPanel.form.noteLabel'), { target: { value: 'Mi nota' } });
        fireEvent.click(screen.getByRole('button', { name: 'readingPanel.form.save' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('readingPanel.toast.failed'));
        expect(screen.getByLabelText('readingPanel.form.noteLabel')).toHaveValue('Mi nota');
    });
});

describe('textos', () => {
    const aplanar = (o: unknown, pre = ''): string[] =>
        Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
            v && typeof v === 'object' ? aplanar(v, `${pre}${k}.`) : [`${pre}${k}`]);
    const marcadores = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();

    it('es y en tienen las mismas claves y los mismos marcadores', () => {
        const a = (es as Record<string, unknown>).readingPanel;
        const b = (en as Record<string, unknown>).readingPanel;
        expect(aplanar(a).sort()).toEqual(aplanar(b).sort());
        const val = (o: unknown, k: string) => k.split('.').reduce((x, y) => (x as Record<string, unknown>)[y], o) as string;
        for (const k of aplanar(a)) expect(marcadores(val(b, k))).toEqual(marcadores(val(a, k)));
        for (const v of ['confirms', 'nuances', 'contradicts']) expect(aplanar(a)).toContain(`verdict.${v}`);
    });

    it('glosario: «tu lectura», nunca «tu hipótesis»; errores con «Inténtalo de nuevo»', () => {
        const panel = JSON.stringify((es as Record<string, unknown>).readingPanel);
        expect(panel).not.toMatch(/hipótesis/i);
        expect((es as { readingPanel: { toast: { failed: string } } }).readingPanel.toast.failed).toMatch(/Inténtalo de nuevo\.$/);
        expect((es as { readingPanel: { form: { noteLabel: string } } }).readingPanel.form.noteLabel).toBe('Nota (opcional)');
    });

    it('no nombra la máquina ni usa voseo', () => {
        const textos = JSON.stringify([(es as Record<string, unknown>).readingPanel, (en as Record<string, unknown>).readingPanel]);
        expect(textos).not.toMatch(/\b(IA|AI|GPT|Gemini|modelo|model|LLM)\b/);
        expect(textos).not.toMatch(/\b(acá|tenés|podés|anotá|escribí)\b/);
    });
});
