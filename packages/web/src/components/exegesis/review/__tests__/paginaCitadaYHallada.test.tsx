import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { VerifiedCitation } from '@dosfilos/domain';
import { esOtraPagina, paginaHallada } from '../paginaHallada';

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
    it('acepta «pp.» y mayúsculas, que vienen de la pista libre del verificador', () => {
        expect(paginaHallada({ matchedPage: null, matchedPageLabel: 'pp. 202' })).toMatchObject({ page: 202, pageKind: 'printed' });
        expect(paginaHallada({ matchedPage: null, matchedPageLabel: 'P. 202' })).toMatchObject({ page: 202, pageKind: 'printed' });
    });
    it('«p. 16» citada y «hoja 16» hallada son páginas distintas; un rango que empieza en la hallada es la misma', () => {
        expect(esOtraPagina({ pages: '16', raw: 'Mayor, p. 16' }, { page: 16 })).toBe(true);
        expect(esOtraPagina({ pages: '16', raw: 'Mayor, p. 16' }, { page: 16, pageKind: 'printed' })).toBe(false);
        expect(esOtraPagina({ pages: '538–539', raw: 'Robertson, pp. 538–539' }, { page: 538, pageKind: 'printed' })).toBe(false);
        expect(esOtraPagina({ pages: null, raw: 'Mayor' } as never, { page: 9, pageKind: 'printed' })).toBe(true);
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

/** TP #8 (8b, C5): la oración «copiada» que no estaba en la fuente ya no se borra en silencio. */
describe('Revisión — la cita textual no hallada', () => {
    it('muestra la oración retirada y qué hacer', () => {
        render(
            <MemoryRouter>
                <CitationEvidencePanel path="commentatorEngagement[0]" verdict={veredicto('203', null)}
                    claim={{ site: 'commentator', path: 'commentatorEngagement[0]', sourceKey: 'McCartney', page: 203, claim: 'x', verbatimQuote: null, unverifiedQuote: 'una oración inventada' }}
                    review={null} isReviewing={false} onReview={vi.fn()} noteFromView={null} viewed={null} />
            </MemoryRouter>,
        );
        expect(screen.getByTestId('cita-textual-no-hallada')).toHaveTextContent('«una oración inventada»');
    });

    it('sin oración retirada, nada', () => {
        panel(veredicto('203', null));
        expect(screen.queryByTestId('cita-textual-no-hallada')).toBeNull();
    });
});

/** TP #8 (8b, D3): lo que la oración le atribuye y lo que la fuente dice, lado a lado. */
describe('Revisión — lo atribuido y lo que dice la fuente', () => {
    it('muestra los dos cuando el juez los dio', () => {
        panel({ ...veredicto('203', 'p. 202'), takenFromSource: 'McCartney prefiere la lectura epexegética', supportingSpan: { text: 'The epexegetical view best fits', pageLabel: 'p. 202' } } as never);
        const caja = screen.getByTestId('atribuido-y-fuente');
        expect(caja).toHaveTextContent('McCartney prefiere la lectura epexegética');
        expect(caja).toHaveTextContent('«The epexegetical view best fits»');
        expect(caja).toHaveTextContent('canonical.review.panel.sourceSaysAt {"page":"p. 202"}');
    });

    it('sin ellos, nada', () => {
        panel(veredicto('203', null));
        expect(screen.queryByTestId('atribuido-y-fuente')).toBeNull();
    });
});

/** TP #8 (8b, D4): «Diagnosticar esta cita» dice la causa y aplica el remedio. */
describe('Revisión — Diagnosticar esta cita', () => {
    const conCorreccion = (v: VerifiedCitation, onCorrect = vi.fn()) => render(
        <MemoryRouter>
            <CitationEvidencePanel path="commentatorEngagement[0]" verdict={v}
                claim={{ site: 'commentator', path: 'commentatorEngagement[0]', sourceKey: 'McCartney', page: 203, claim: 'x', verbatimQuote: null }}
                review={null} isReviewing={false} onReview={vi.fn()} noteFromView={null} viewed={null}
                onCorrect={onCorrect} knownAuthors={['McCartney', 'Mayor']} />
        </MemoryRouter>,
    );

    it('otra página: corrige a la hallada con un clic', () => {
        const onCorrect = vi.fn();
        conCorreccion({ ...veredicto('203', 'p. 202'), bookSearch: 'book' } as never, onCorrect);
        fireEvent.click(screen.getByTestId('diagnosticar-cita'));
        expect(screen.getByTestId('diagnostico')).toHaveTextContent('canonical.review.diagnosis.cause.other-page');
        fireEvent.click(screen.getByText('canonical.review.diagnosis.remedy.correctPage {"page":"p. 202"}'));
        expect(onCorrect).toHaveBeenCalledWith('commentatorEngagement[0]', { kind: 'page', page: 202, pageKind: 'printed' });
    });

    it('una causa que se anota deja la nota escrita en la revisión', () => {
        conCorreccion({ ...veredicto('203', null), status: 'fuzzy-low', supportingSpan: { text: 'Mayor holds the epexegetical view', pageLabel: 'p. 203' } } as never);
        fireEvent.click(screen.getByTestId('diagnosticar-cita'));
        fireEvent.click(screen.getByText('canonical.review.diagnosis.remedy.useNote'));
        expect((screen.getByLabelText(/reviewLabel/) as HTMLTextAreaElement).value).toContain('Segunda mano: McCartney atribuye la idea a Mayor');
    });

    it('una cita verificada no ofrece diagnóstico', () => {
        conCorreccion({ ...veredicto('203', null), status: 'verified' } as never);
        expect(screen.queryByTestId('diagnosticar-cita')).toBeNull();
    });
});
