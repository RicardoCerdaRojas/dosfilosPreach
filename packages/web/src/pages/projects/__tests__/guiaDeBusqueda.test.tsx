import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Etapa 2c, versión 1: la guía de búsqueda en el paso Requisitos. Qué
 * buscar y dónde según lo que falta, con la consulta para copiar o abrir, y
 * la búsqueda anotada en el registro.
 */
const updateProject = vi.fn();
let proyecto: Record<string, unknown> = {};
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: [proyecto], updateProject: { mutateAsync: updateProject, isPending: false } }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [
    { id: 'tp8', projectId: 'nt785', linkedProjectIds: [], passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 }, sources: [] },
] }) }));
const toastOk = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastOk(m), error: vi.fn() } }));
vi.mock('@dosfilos/application', () => ({ exegesisService: { extractProjectBibliography: { execute: vi.fn() } }, MAX_BIBLIOGRAPHY_TEXT_CHARS: 60_000 }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u' } }) }));
const { ProjectStateOfArtPage } = await import('../ProjectStateOfArtPage');

const montar = () => {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={['/dashboard/projects/nt785/estado-del-arte']}>
                <Routes><Route path="/dashboard/projects/:projectId/estado-del-arte" element={<ProjectStateOfArtPage />} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.requirements/ }));
    return screen.getByRole('region', { name: /stateOfArt.guide.title/ });
};
const paso = (guia: HTMLElement, clave: string) => within(guia).getByText(new RegExp(`stateOfArt.guide.step.${clave}.title`)).closest('li')! as HTMLElement;

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    updateProject.mockImplementation(async (args: Record<string, unknown>) => { const { projectId: _p, ...c } = args; proyecto = { ...proyecto, ...c }; return {}; });
    proyecto = { id: 'nt785', userId: 'u', title: 'NT785', color: 'amber', type: 'course', workTypes: [] };
});

describe('guía de búsqueda', () => {
    it('trae el pasaje del estudio en IxTheo con la consulta y el enlace, y Dialnet en español', () => {
        const guia = montar();
        const pasaje = paso(guia, 'passage');
        expect(within(pasaje).getByText('James 4:1-10')).toBeInTheDocument();
        expect(within(pasaje).getByText('"Jas 4:1-10" OR "James 4:1-10" OR "Santiago 4:1-10" OR "Santiago 4,1-10"')).toBeInTheDocument();
        const abrir = within(pasaje).getByRole('link', { name: /stateOfArt.guide.openIn.*stateOfArt.guide.db.ixtheo/ });
        expect(abrir).toHaveAttribute('href', 'https://ixtheo.de/Search/Results?lookfor=James%204%3A1-10&type=BibleRangeSearch');
        expect(abrir).toHaveAttribute('target', '_blank');
        expect(abrir).toHaveAttribute('rel', 'noopener noreferrer');
        expect(within(paso(guia, 'spanish')).getByRole('link', { name: /stateOfArt.guide.openIn.*stateOfArt.guide.db.dialnet/ }))
            .toHaveAttribute('href', `https://dialnet.unirioja.es/buscar/documentos?querysDismax.DOCUMENTAL_TODO=${encodeURIComponent('epístola de Santiago')}`);
        // Sin requisitos que falten, no hay pasos de artículos ni de obras antiguas.
        expect(within(guia).queryByText(/stateOfArt.guide.step.articles.title/)).toBeNull();
        expect(within(guia).queryByText(/stateOfArt.guide.step.older.title/)).toBeNull();
    });

    it('un requisito sin cumplir agrega su paso y dice por qué; ATLA va por la biblioteca, sin enlace', () => {
        proyecto = { ...proyecto, bibliographyCriteria: { requirementItems: [
            { id: 'pag', kind: 'quantity', sourceType: 'journal-article', unit: 'pages', minimum: 100, text: '100 páginas de artículos', origin: 'syllabus' },
            { id: 'ep', kind: 'date-range', before: 1950, after: 2011, recentMinimum: 1, text: 'Antiguas y actuales', origin: 'syllabus' },
        ] } };
        const guia = montar();
        const articulos = paso(guia, 'articles');
        expect(within(articulos).getByText(/stateOfArt.guide.reason.requirement.*100 páginas de artículos/)).toBeInTheDocument();
        expect(within(articulos).getAllByText(/stateOfArt.guide.viaLibrary/).length).toBeGreaterThan(0);
        expect(within(articulos).queryByRole('link')).toBeNull();
        expect(within(paso(guia, 'older')).getByText(/stateOfArt.guide.step.older.hint.*"before":1950.*"publicDomain":\d{4}/)).toBeInTheDocument();
    });

    it('copiar pone la consulta en el portapapeles', async () => {
        const escribir = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
        const guia = montar();
        fireEvent.click(within(paso(guia, 'passage')).getByRole('button', { name: /stateOfArt.guide.copyIn.*stateOfArt.guide.db.ixtheo/ }));
        await waitFor(() => expect(escribir).toHaveBeenCalledWith('James 4:1-10'));
        expect(toastOk).toHaveBeenCalledWith('stateOfArt.guide.copied');
    });

    it('anotar una búsqueda la guarda en el registro con la base, la consulta y el resultado, y se ve en la lista', async () => {
        const guia = montar();
        const pasaje = paso(guia, 'passage');
        fireEvent.click(within(pasaje).getByRole('button', { name: /stateOfArt.guide.noteIn.*stateOfArt.guide.db.ixtheo/ }));
        fireEvent.change(within(pasaje).getByLabelText('stateOfArt.guide.found'), { target: { value: '23' } });
        fireEvent.change(within(pasaje).getByLabelText('stateOfArt.guide.added'), { target: { value: '4' } });
        fireEvent.click(within(pasaje).getByText('stateOfArt.guide.saveNote'));
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
        const args = updateProject.mock.calls[0]![0] as Record<string, unknown>;
        // Solo el registro: anotar no escribe las fichas ni los criterios.
        expect(Object.keys(args).sort()).toEqual(['bibliographySearchLog', 'projectId']);
        expect(args.bibliographySearchLog).toEqual([expect.objectContaining({
            kind: 'database', database: 'ixtheo', label: 'stateOfArt.guide.db.ixtheo · Santiago 4:1-10',
            query: 'James 4:1-10', found: 23, added: 4,
        })]);
        expect(await within(pasaje).findByText('stateOfArt.guide.noted')).toBeInTheDocument();
        const registro = screen.getByRole('region', { name: /stateOfArt.log.title/ });
        expect(within(registro).getByText(/stateOfArt.log.kind.database/)).toBeInTheDocument();
    });

    it('sin las dos cifras no se anota: un vacío no es un cero', () => {
        const guia = montar();
        const pasaje = paso(guia, 'passage');
        fireEvent.click(within(pasaje).getByRole('button', { name: /stateOfArt.guide.noteIn.*stateOfArt.guide.db.ixtheo/ }));
        expect(within(pasaje).getByText('stateOfArt.guide.saveNote').closest('button')).toBeDisabled();
        fireEvent.change(within(pasaje).getByLabelText('stateOfArt.guide.found'), { target: { value: '12' } });
        expect(within(pasaje).getByText('stateOfArt.guide.saveNote').closest('button')).toBeDisabled();
        fireEvent.change(within(pasaje).getByLabelText('stateOfArt.guide.added'), { target: { value: '0' } });
        expect(within(pasaje).getByText('stateOfArt.guide.saveNote').closest('button')).toBeEnabled();
    });

    it('dos anotaciones seguidas quedan las dos (las escrituras del registro van en fila)', async () => {
        let soltar: () => void = () => undefined;
        updateProject.mockImplementationOnce(async (args: Record<string, unknown>) => {
            await new Promise<void>(r => { soltar = r; });
            const { projectId: _p, ...c } = args; proyecto = { ...proyecto, ...c }; return {};
        });
        const guia = montar();
        const pasaje = paso(guia, 'passage');
        const anotar = (base: RegExp, n: string) => {
            fireEvent.click(within(pasaje).getByRole('button', { name: base }));
            const fila = within(pasaje).getAllByLabelText('stateOfArt.guide.found').at(-1)!.closest('li')! as HTMLElement;
            fireEvent.change(within(fila).getByLabelText('stateOfArt.guide.found'), { target: { value: n } });
            fireEvent.change(within(fila).getByLabelText('stateOfArt.guide.added'), { target: { value: '1' } });
            fireEvent.click(within(fila).getByText('stateOfArt.guide.saveNote'));
        };
        anotar(/stateOfArt.guide.noteIn.*stateOfArt.guide.db.ixtheo/, '5');
        anotar(/stateOfArt.guide.noteIn.*stateOfArt.guide.db.google-scholar/, '9');
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
        soltar();
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(2));
        const ultimo = updateProject.mock.calls[1]![0] as { bibliographySearchLog: Array<{ found: number }> };
        expect(ultimo.bibliographySearchLog.map(l => l.found)).toEqual([5, 9]);
    });

    it('el enfoque del catálogo se ve como sugerencia en la ficha, pero no cuenta hasta que se confirma', () => {
        proyecto = { ...proyecto, bibliography: [{ id: 'dib', title: 'James: A Commentary on the Epistle of James', author: 'Dibelius, Martin', sourceType: 'commentary-critical', weight: 'recommended', decision: 'approved', origins: ['catalog'] }],
            bibliographyCriteria: { requirementItems: [{ id: 'op', kind: 'perspectives', minimum: 1, text: 'Un enfoque al menos', origin: 'manual' }] } };
        montar();
        // Sin confirmar, el requisito no se da por cumplido: la ficha cuenta como «sin enfoque».
        const editor = screen.getByRole('region', { name: 'stateOfArt.requirement.title' });
        expect(within(editor).getByText(/stateOfArt.requirement.unmeasurable.perspectives/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /stateOfArt.step.approved/ }));
        const ficha = screen.getByText(/James: A Commentary on the Epistle of James/).closest('li')! as HTMLElement;
        fireEvent.click(within(ficha).getByText('stateOfArt.evaluate'));
        expect((within(ficha).getByLabelText('stateOfArt.q.approach') as HTMLSelectElement).value).toBe('historical-critical');
    });
});
