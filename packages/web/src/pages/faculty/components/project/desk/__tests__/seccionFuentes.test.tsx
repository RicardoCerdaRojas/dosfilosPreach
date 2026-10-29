import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { deskSourcesSummary } from '@dosfilos/domain';

/** «Fuentes», compartida por el Exegético y el Curso: resume y lleva al estado del arte. */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
const { SourcesSection, stateOfArtUrl } = await import('../SourcesSection');
beforeEach(cleanup);

/** Un título propio, ya traducido por quien llama (dato de prueba). */
const TITULO_PROPIO = 'Fuentes del curso';
const ficha = (id: string, over: Record<string, unknown> = {}) => ({ id, title: `Obra ${id}`, resourceId: `r_${id}`, weight: 'recommended', decision: 'approved', origins: ['catalog'], ...over });

describe('SourcesSection', () => {
    it('el ancla, el número de fase, el título propio y lo de cada tipo', () => {
        const s = deskSourcesSummary({ bibliography: [ficha('a')] as never });
        render(
            <MemoryRouter>
                <SourcesSection projectId="nt 785" sources={s} phase={{ id: 'sources', status: 'ready', evidence: { key: 'desk.sources.ready', params: { approved: 1, toAcquire: 0 } } }} phaseNumber={2} title={TITULO_PROPIO}>
                    <p>cobertura por tipo</p>
                </SourcesSection>
            </MemoryRouter>,
        );
        const seccion = document.getElementById('fase-sources')!;
        expect(seccion).toBeTruthy();
        expect(seccion.textContent).toContain('desk.journey.phaseLabel:{"number":2}');
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(TITULO_PROPIO);
        expect(screen.getByText('cobertura por tipo')).toBeInTheDocument();
        expect(screen.getByText('desk.sources.ready:{"approved":1,"toAcquire":0}')).toBeInTheDocument();
        expect(stateOfArtUrl('nt 785')).toBe('/dashboard/projects/nt%20785/estado-del-arte');
    });

    it('las obligatorias por conseguir, los requisitos sin cifra y los aceptados a propósito', () => {
        const s = deskSourcesSummary({
            bibliography: [ficha('moo', { title: 'James (PNTC)', resourceId: null, weight: 'required' }), ficha('b')] as never,
            bibliographyCriteria: {
                requirementItems: [
                    { id: 'r1', kind: 'minimum-type', text: 'tres', origin: 'manual', sourceType: 'commentary-critical', minimum: 3, done: true },
                    { id: 'r2', kind: 'perspectives', text: 'opuestos', origin: 'manual' },
                ],
            } as never,
        });
        render(<MemoryRouter><SourcesSection projectId="p" sources={s} phase={undefined} phaseNumber={2} /></MemoryRouter>);
        expect(screen.getByTestId('desk-sources-summary').textContent).toBe('sources.approved:{"count":2} · sources.toAcquire:{"count":1} · sources.requirements:{"met":1,"total":2}');
        expect(screen.getByTestId('desk-sources-required').textContent).toContain('James (PNTC)');
        expect(screen.getByText('sources.incomplete:{"count":1}')).toBeInTheDocument();
        expect(screen.getByText('sources.accepted:{"count":1}')).toBeInTheDocument();
        expect(screen.queryByTestId('desk-sources-manual')).toBeNull();
    });

    it('mientras la biblioteca carga (B6): «cargando», las fichas a la vista y lo que se mide por tipo, no', () => {
        const s = deskSourcesSummary({
            bibliography: [ficha('a'), ficha('b')] as never,
            bibliographyCriteria: { requirementItems: [{ id: 'r2', kind: 'perspectives', text: 'opuestos', origin: 'manual' }] } as never,
        });
        render(
            <MemoryRouter>
                <SourcesSection projectId="p" sources={s} phase={{ id: 'sources', status: 'doing', loading: true, evidence: { key: 'desk.sources.requirementsPending', params: { approved: 2, met: 0, total: 1 } } }} phaseNumber={2} />
            </MemoryRouter>,
        );
        expect(screen.getByText('desk.journey.status.loading')).toBeInTheDocument();
        expect(screen.getByTestId('desk-sources-summary').textContent).toBe('sources.approved:{"count":2}');
        expect(screen.queryByText(/desk\.sources\.requirementsPending/)).toBeNull();
        expect(screen.queryByText(/sources\.incomplete/)).toBeNull();
    });

    it('posterior a la activa y sin fichas: una línea; el Curso da su propia razón (no «tu lectura del libro»)', () => {
        const vacio = deskSourcesSummary({ bibliography: [] as never });
        render(<MemoryRouter><SourcesSection projectId="ezr" sources={vacio} phase={undefined} phaseNumber={2} later /></MemoryRouter>);
        expect(document.getElementById('fase-sources')!.textContent).toContain('later.sources');
        cleanup();
        render(<MemoryRouter><SourcesSection projectId="nt" sources={vacio} phase={undefined} phaseNumber={2} later laterReason="se abre cuando definas lo que pide el curso" /></MemoryRouter>);
        const linea = document.getElementById('fase-sources')!;
        expect(linea.textContent).toContain('se abre cuando definas lo que pide el curso');
        expect(linea.textContent).not.toContain('later.sources');
        expect(screen.queryByRole('link')).toBeNull();
    });
});
