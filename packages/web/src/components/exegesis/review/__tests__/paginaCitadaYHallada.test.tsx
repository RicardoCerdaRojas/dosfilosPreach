import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { VerifiedCitation } from '@dosfilos/domain';
import { paginaHallada } from '../paginaHallada';

/**
 * Fase F, F4: cuando el verificador halló el apoyo en otra página, la
 * revisión ofrece mirar las dos. En el TP #7 (McCartney 203 → «202») la
 * alarma era falsa y comprobarlo exigió salir de la aplicación.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
const { CitationEvidencePanel } = await import('../CitationEvidencePanel');

beforeEach(() => cleanup());

describe('paginaHallada', () => {
    it('lee el rótulo: «p. N» es página impresa, «hoja N» es hoja', () => {
        expect(paginaHallada({ matchedPage: '202', matchedPageLabel: 'p. 202' })).toEqual({ page: 202, pageKind: 'printed', label: 'p. 202' });
        expect(paginaHallada({ matchedPage: '16', matchedPageLabel: 'hoja 16' })).toEqual({ page: 16, label: 'hoja 16' });
    });
    it('sin rótulo, el número como página impresa; una romana o nada, no se abre', () => {
        expect(paginaHallada({ matchedPage: '61', matchedPageLabel: null })).toEqual({ page: 61, pageKind: 'printed', label: 'p. 61' });
        expect(paginaHallada({ matchedPage: null, matchedPageLabel: 'p. ccxxii' })).toBeNull();
        expect(paginaHallada({ matchedPage: null, matchedPageLabel: null })).toBeNull();
    });
});

const veredicto = (pages: string, hallada: string | null) => ({
    raw: `McCartney, p. ${pages}`, author: 'McCartney', title: '', pages, offset: 0,
    evidence: 'The epexegetical view best fits James’s concerns', evidenceIsQuoted: true, status: 'page-mismatch',
    matchedCorpusId: 'r', matchedSourceLabel: 'McCartney', similarityScore: 0.99,
    matchedPage: hallada?.replace('p. ', '') ?? null, matchedPageLabel: hallada, note: '',
}) as unknown as VerifiedCitation;

const panel = (v: VerifiedCitation, onOpenFound = vi.fn(), onOpenSource = vi.fn()) => render(
    <MemoryRouter>
        <CitationEvidencePanel path="p1" verdict={v} claim={null} review={null} isReviewing={false}
            onReview={vi.fn()} onOpenSource={onOpenSource} onOpenFound={onOpenFound} noteFromView={null} viewed={null} />
    </MemoryRouter>,
);

describe('Revisión — la página citada y la del verificador', () => {
    it('apoyo en otra página: dos botones, cada uno abre la suya', () => {
        const onOpenFound = vi.fn(); const onOpenSource = vi.fn();
        panel(veredicto('203', 'p. 202'), onOpenFound, onOpenSource);
        fireEvent.click(screen.getByText('canonical.review.panel.openCited {"page":"p. 203"}'));
        expect(onOpenSource).toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('abrir-pagina-hallada'));
        expect(onOpenFound).toHaveBeenCalled();
        expect(screen.getByTestId('abrir-pagina-hallada').textContent).toContain('canonical.review.panel.openFound {"page":"p. 202"}');
    });
    it('apoyo en la misma página, o sin página hallada: un solo botón', () => {
        panel(veredicto('204', 'p. 204'));
        expect(screen.queryByTestId('abrir-pagina-hallada')).toBeNull();
        expect(screen.getByText('canonical.review.panel.openPdf')).toBeInTheDocument();
        cleanup();
        panel(veredicto('204', null));
        expect(screen.queryByTestId('abrir-pagina-hallada')).toBeNull();
    });
    it('un rango citado que empieza en la hallada cuenta como la misma', () => {
        panel(veredicto('538–539', 'p. 538'));
        expect(screen.queryByTestId('abrir-pagina-hallada')).toBeNull();
    });
});
