import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { reviewPdf, type LibraryResource } from '@dosfilos/domain';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('@/hooks/library/useLibrary', () => ({ useLibrary: () => ({ resources: [], isLoading: false }) }));
vi.mock('@/hooks/exegesis/useDocumentPageIndex', () => ({ useDocumentPdfUrl: () => ({ data: null }) }));

const { IdentitySection, EditionSection, PaginationSection, CopySection } = await import('../ReviewSections');
const { buildReviewInput, storedOffsetAt, citedEditionFor } = await import('@/hooks/library/usePdfReview');

const martin = {
    id: 'martin', title: 'James (Word Biblical Commentary 48)', author: 'Ralph P. Martin', mimeType: 'application/pdf',
    coversBibleBooks: ['JAS'], exegeticalType: 'commentary-critical', bibliography: { year: '2004' },
} as unknown as LibraryResource;
const leido = {
    numPages: 620, producer: 'Adobe PDF Library', creator: null, hasText: true,
    front: [{ sheet: 3, lines: ['James', 'RALPH P. MARTIN'] }, { sheet: 4, lines: ['Copyright © 1988 by Word, Incorporated', 'ISBN 0-8499-0247-9'] }],
    samples: [{ sheet: 215, lines: ['JAMES 3:13–18'], folio: '104' }, { sheet: 340, lines: [], folio: '229' }, { sheet: 460, lines: [], folio: '349' }],
};

beforeEach(() => cleanup());

describe('Bandeja de revisión del PDF (A7)', () => {
    it('Martin WBC 48 no está en el catálogo de Santiago (antes pasaba por el Dibelius de 1976); la ficha guardada dice 2004', () => {
        const input = buildReviewInput(martin, leido);
        expect(input.cited).toBeNull();
        // Dibelius sí está: su copia se compara con la de 1976.
        const dibelius = { ...martin, id: 'dib', title: 'James: A Commentary on the Epistle of James', author: 'Martin Dibelius' } as unknown as LibraryResource;
        expect(citedEditionFor(dibelius)).toMatchObject({ year: 1976, publisher: 'Fortress' });
        // En el catálogo con otro tipo (expositivo) que el del registro (exegético): igual se encuentra.
        const mccartney = { ...martin, id: 'mcc', title: 'James — Baker Exegetical Commentary on the New Testament', author: 'McCartney, Dan G.', exegeticalType: 'commentary-critical' } as unknown as LibraryResource;
        expect(citedEditionFor(mccartney)).toMatchObject({ year: 2009, isbn: '9780801026768' });
        expect(input.declared).toMatchObject({ books: ['JAS'], bibliographyYear: '2004', storedOffset: null });
        const r = reviewPdf(input);
        expect(r.edition).toMatchObject({ year: 1988, vsCited: null, vsBibliography: 'distinta' });
    });

    it('la edición: guardar en la ficha solo lo que cambia (año 1988 e ISBN), conservando lo demás', () => {
        const onSave = vi.fn();
        const r = reviewPdf(buildReviewInput(martin, leido));
        render(<EditionSection review={r} resource={martin} cited={citedEditionFor(martin)} onSave={onSave} saving={false} />);
        expect(screen.getByTestId('revision-edicion').textContent).toContain('review.edition.vsBibliography {"stored":"2004"}');
        fireEvent.click(screen.getByRole('button'));
        expect(onSave).toHaveBeenCalledWith({ year: '1988', isbn: '9780849902475' });
        cleanup();
        // Con la ficha al día no se ofrece nada.
        const alDia = { ...martin, bibliography: { year: '1988', isbn: '9780849902475' } } as unknown as LibraryResource;
        render(<EditionSection review={reviewPdf(buildReviewInput(alDia, leido))} resource={alDia} cited={null} onSave={onSave} saving={false} />);
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByTestId('revision-edicion').textContent).toContain('review.edition.noCited');
    });

    it('las páginas: una regla (resta 111), guardar, ver una hoja; con la misma numeración ya confirmada no se ofrece guardar', () => {
        const a = { onSave: vi.fn(), onSaveNone: vi.fn(), onCalibrate: vi.fn(), onShowSheet: vi.fn() };
        const r = reviewPdf(buildReviewInput(martin, leido));
        render(<PaginationSection review={r} ebook={false} storedConfirmed={false} canSave saving={false} {...a} />);
        const sec = screen.getByTestId('revision-paginas');
        expect(sec.dataset.tone).toBe('ok');
        expect(sec.textContent).toContain('review.pagination.minus');
        expect(sec.textContent).toContain('111');
        fireEvent.click(screen.getByText('review.pagination.save'));
        expect(a.onSave).toHaveBeenCalled();
        fireEvent.click(screen.getByText('review.pagination.point {"sheet":340,"folio":"229"}'));
        expect(a.onShowSheet).toHaveBeenCalledWith(340);
        cleanup();
        const guardada = { ...martin, pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 620, offset: -111 }] } } as unknown as LibraryResource;
        render(<PaginationSection review={reviewPdf(buildReviewInput(guardada, leido))} ebook={false} storedConfirmed canSave saving={false} {...a} />);
        expect(screen.getByText('review.pagination.storedAgrees')).toBeTruthy();
        expect(screen.queryByText('review.pagination.save')).toBeNull();
        cleanup();
        // Detectada, sin confirmar: dice lo mismo, pero hay que confirmarla.
        const detectada = { ...martin, pageNumbering: { origin: 'detected', segments: [{ fromSheet: 1, toSheet: 620, offset: -111 }] } } as unknown as LibraryResource;
        render(<PaginationSection review={reviewPdf(buildReviewInput(detectada, leido))} ebook={false} storedConfirmed={false} canSave saving={false} {...a} />);
        expect(screen.queryByText('review.pagination.storedAgrees')).toBeNull();
        expect(screen.getByText('review.pagination.save')).toBeTruthy();
    });

    it('un libro electrónico: sin hojas que leer, se ofrece guardar «sin páginas impresas» y no se calibra', () => {
        const a = { onSave: vi.fn(), onSaveNone: vi.fn(), onCalibrate: vi.fn(), onShowSheet: vi.fn() };
        const epub = { ...martin, mimeType: 'application/epub+zip' } as unknown as LibraryResource;
        const r = reviewPdf(buildReviewInput(epub, null));
        render(<PaginationSection review={r} ebook storedConfirmed={false} canSave={false} saving={false} {...a} />);
        expect(screen.queryByText('review.pagination.save')).toBeNull();
        expect(screen.getByTestId('revision-paginas').textContent).toContain('review.pagination.ebook');
        expect(screen.queryByText('review.pagination.calibrate')).toBeNull();
        fireEvent.click(screen.getByText('review.pagination.saveNone'));
        expect(a.onSaveNone).toHaveBeenCalled();
        render(<CopySection review={r} />);
        expect(screen.getByTestId('revision-copia').textContent).toContain('review.copy.conversion {"detail":"epub"}');
    });

    it('la obra: otro libro se avisa con la línea que lo muestra', () => {
        const gardner = { ...martin, title: 'James (ZECNT)', author: 'Paul Gardner' } as unknown as LibraryResource;
        const r = reviewPdf(buildReviewInput(gardner, { ...leido, front: [{ sheet: 3, lines: ['1 CORINTHIANS', 'Paul Gardner'] }], samples: [] }));
        render(<IdentitySection review={r} resource={gardner} />);
        const sec = screen.getByTestId('revision-obra');
        expect(sec.dataset.tone).toBe('warn');
        expect(sec.textContent).toContain('"declared":"Santiago"');
        expect(sec.textContent).toContain('"found":"1 Corintios"');
        expect(sec.textContent).toContain('review.evidence {"line":"1 CORINTHIANS"}');
    });

    it('la numeración guardada se lee en el tramo de la hoja del medio, solo si es arábiga y ascendente', () => {
        const n = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 20, offset: null }, { fromSheet: 21, toSheet: 600, offset: -24 }] } as never;
        expect(storedOffsetAt(n, 300)).toBe(-24);
        expect(storedOffsetAt(n, 10)).toBeNull();
        expect(storedOffsetAt({ origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 600, offset: 303, step: -1 }] } as never, 300)).toBeNull();
        expect(storedOffsetAt({ origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 600, offset: -2, style: 'roman' }] } as never, 300)).toBeNull();
        expect(storedOffsetAt(null, 300)).toBeNull();
        expect(storedOffsetAt(n, null)).toBeNull();
        // Se compara en la hoja del medio de las muestras (340), no en la primera (215).
        const dos = { ...martin, pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 300, offset: -100 }, { fromSheet: 301, toSheet: 620, offset: -111 }] } } as unknown as LibraryResource;
        expect(buildReviewInput(dos, leido).declared.storedOffset).toBe(-111);
    });
});
