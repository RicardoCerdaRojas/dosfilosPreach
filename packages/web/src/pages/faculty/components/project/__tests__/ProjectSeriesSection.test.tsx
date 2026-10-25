import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** Etapa 3 de ADR-046: «Series de predicación» en el panel del proyecto. */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) =>
            k === 'seriesSection.progress' ? `${o?.studies} de ${o?.total} · ${o?.sermons}` : k === 'seriesSection.nextDate' ? `next:${o?.date}` : k,
        i18n: { language: 'es' },
    }),
}));
const { ProjectSeriesSection, planSeriesUrl } = await import('../ProjectSeriesSection');
beforeEach(cleanup);

const pasaje = { bookId: 'NEH', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 11 };
const estudio = (id: string, title: string) => ({ id, title, passage: pasaje, phase: 'configuring', updatedAt: new Date(), projectId: 'neh', linkedProjectIds: [] });
const nehemias = {
    id: 'sNeh', title: 'Nehemías', projectId: 'neh', createdAt: new Date('2026-10-01'),
    metadata: { plannedSermons: [
        { id: 'p1', week: 1, passage: 'Neh 1:1-11', title: 'La oración' },
        { id: 'p2', week: 2, passage: 'Neh 2:1-10', paperId: 'e2', draftId: 'd2' },
        { id: 'p3', week: 3, passage: 'Neh 2:11-20', paperId: 'e3', draftId: 'd3' },
    ] },
};
const papers = [estudio('e2', 'Ante el rey'), estudio('e3', 'Reconstruyamos')];
const sermons = [
    { id: 'd2', status: 'draft', updatedAt: new Date() },
    { id: 'd3', status: 'draft', updatedAt: new Date() },
    { id: 'c3', status: 'published', sourceSermonId: 'd3', updatedAt: new Date() },
];
const montar = (series: unknown[], onPlanSeries = vi.fn()) =>
    render(<MemoryRouter><ProjectSeriesSection project={{ id: 'neh' }} series={series as never} papers={papers as never} sermons={sermons} onPlanSeries={onPlanSeries} /></MemoryRouter>);

describe('ProjectSeriesSection', () => {
    it('sin series: el vacío y «Planificar la serie»', () => {
        const onPlanSeries = vi.fn();
        montar([], onPlanSeries);
        expect(screen.getByText('seriesSection.empty')).toBeInTheDocument();
        fireEvent.click(screen.getByText('seriesSection.plan'));
        expect(onPlanSeries).toHaveBeenCalled();
        expect(screen.queryByText('seriesSection.planAnother')).toBeNull();
    });

    it('una serie: su avance, las filas en orden y los enlaces de estudio y sermón', () => {
        montar([nehemias]);
        expect(screen.getByText('2 de 3 · 2')).toBeInTheDocument();
        expect(screen.getByText('Nehemías').closest('a')!.getAttribute('href')).toBe('/dashboard/plans/sNeh');

        const filas = screen.getAllByTestId('project-series-row');
        expect(filas.map(f => within(f).getByText(/^Neh /).textContent)).toEqual(['Neh 1:1-11', 'Neh 2:1-10', 'Neh 2:11-20']);

        // Sin estudio ni sermón: rótulos sin enlace.
        expect(within(filas[0]!).getByText('seriesSection.row.noStudy').closest('a')).toBeNull();
        expect(within(filas[0]!).getByText('seriesSection.row.noSermon').closest('a')).toBeNull();

        // Borrador: abre el asistente con el borrador.
        expect(within(filas[1]!).getByText('Ante el rey').closest('a')!.getAttribute('href')).toBe('/dashboard/exegesis/e2');
        expect(within(filas[1]!).getByText('seriesSection.row.sermonDraft').closest('a')!.getAttribute('href')).toBe('/dashboard/sermons/generate?id=d2');

        // Publicado (como copia): abre la copia publicada.
        expect(within(filas[2]!).getByText('Reconstruyamos').closest('a')!.getAttribute('href')).toBe('/dashboard/exegesis/e3');
        expect(within(filas[2]!).getByText('seriesSection.row.sermonPublished').closest('a')!.getAttribute('href')).toBe('/dashboard/sermons/c3');
    });

    it('la próxima fecha solo aparece si hay una por delante', () => {
        const futura = new Date(Date.now() + 7 * 86400000);
        montar([{ ...nehemias, metadata: { plannedSermons: [{ id: 'p1', passage: 'Neh 1:1-11', scheduledDate: futura }] } }]);
        expect(screen.getByText(/^next:/)).toBeInTheDocument();
        cleanup();
        montar([nehemias]);
        expect(screen.queryByText(/^next:/)).toBeNull();
    });

    it('dos series: dos tarjetas y «Planificar otra serie»', () => {
        montar([nehemias, { ...nehemias, id: 'sNeh2', title: 'Nehemías II' }]);
        expect(screen.getAllByTestId('project-series-card')).toHaveLength(2);
        expect(screen.getByText('seriesSection.planAnother')).toBeInTheDocument();
        expect(screen.queryByText('seriesSection.plan')).toBeNull();
    });
});

describe('planSeriesUrl', () => {
    it('con libro lo agrega; sin libro va solo el proyecto', () => {
        expect(planSeriesUrl('p1', 'NEH')).toBe('/dashboard/plans/pericope?projectId=p1&book=NEH');
        expect(planSeriesUrl('p1', null)).toBe('/dashboard/plans/pericope?projectId=p1');
    });
});

/** La lista de estudios pasa a «Otros estudios» y no repite los de la serie. */
describe('ProjectStudiesSection con una serie', async () => {
    const { ProjectStudiesSection } = await import('../ProjectStudiesSection');
    const estudios = [estudio('e2', 'Ante el rey'), estudio('suelto', 'Neh 13 suelto')];

    it('sin excluidos, todo igual que antes', () => {
        render(<MemoryRouter><ProjectStudiesSection projectId="neh" studies={estudios as never} onNewStudy={vi.fn()} /></MemoryRouter>);
        expect(screen.getByText('studies.title')).toBeInTheDocument();
        expect(screen.getByText('Ante el rey')).toBeInTheDocument();
    });

    it('con los estudios de la serie: «Otros estudios» y solo los sueltos', () => {
        render(<MemoryRouter><ProjectStudiesSection projectId="neh" studies={estudios as never} excludeIds={new Set(['e2'])} onNewStudy={vi.fn()} /></MemoryRouter>);
        expect(screen.getByText('studies.otherTitle')).toBeInTheDocument();
        expect(screen.queryByText('Ante el rey')).toBeNull();
        expect(screen.getByText('Neh 13 suelto')).toBeInTheDocument();
    });
});

/** El recorrido Exegético muestra sus textos por i18n; los demás, su español. */
describe('ProjectRoadmap con claves de textos', async () => {
    const { ProjectRoadmap } = await import('../ProjectRoadmap');
    const fase = (id: string, i18nKey?: string) => ({
        complete: false,
        phase: { id, title: `T-${id}`, description: `D-${id}`, icon: () => null, cta: { label: `C-${id}`, kind: 'planSeries' as const }, ...(i18nKey ? { i18nKey } : {}) },
    });

    it('con clave usa i18n; sin clave, el texto de la fase', () => {
        const onPhaseCta = vi.fn();
        render(<ProjectRoadmap typeLabel="Exegético" onPhaseCta={onPhaseCta} roadmap={{ activeIndex: 0, allComplete: false, phases: [fase('division', 'exegetical.division'), fase('otra')] }} />);
        expect(screen.getAllByText('roadmap.phases.exegetical.division.title').length).toBeGreaterThan(0);
        expect(screen.getByText('roadmap.phases.exegetical.division.description')).toBeInTheDocument();
        expect(screen.getByText('T-otra')).toBeInTheDocument();
        fireEvent.click(screen.getByText('roadmap.phases.exegetical.division.cta'));
        expect(onPhaseCta).toHaveBeenCalledWith('planSeries');
    });
});
