import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { reviewPdf, type LibraryResource } from '@dosfilos/domain';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('@/hooks/library/useLibrary', () => ({ useLibrary: () => ({ resources: [], isLoading: false }) }));
vi.mock('@/hooks/exegesis/useDocumentPageIndex', () => ({ useDocumentPdfUrl: () => ({ data: null }) }));

const { IdentitySection, EditionSection, PaginationSection, CopySection } = await import('../ReviewSections');
const { buildReviewInput, citedEditionFor } = await import('@/hooks/library/usePdfReview');

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
        expect(input.declared).toMatchObject({ books: ['JAS'], bibliographyYear: '2004', storedNumbering: null });
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

    it('la numeración guardada se compara en cada hoja leída: un tramo que no coincide en una basta', () => {
        // En la hoja 215 el primer tramo da 115, no 104: no coincide. Antes se miraba solo la hoja del medio.
        const dos = { ...martin, pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 300, offset: -100 }, { fromSheet: 301, toSheet: 620, offset: -111 }] } } as unknown as LibraryResource;
        expect(reviewPdf(buildReviewInput(dos, leido)).pagination).toMatchObject({ storedDisagrees: true, storedAgrees: false });
        const bien = { ...martin, pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 111, offset: null }, { fromSheet: 112, toSheet: 620, offset: -111 }] } } as unknown as LibraryResource;
        expect(reviewPdf(buildReviewInput(bien, leido)).pagination).toMatchObject({ storedDisagrees: false, storedAgrees: true });
    });

    it('Mayor: reimpresión de 1978 de la edición de 1897; el año no se ofrece guardar, el ISBN sí', () => {
        const onSave = vi.fn();
        const mayor = { ...martin, id: 'mayor', title: 'The Epistle of James - the Greek text with introduction', author: 'Mayor', bibliography: {} } as unknown as LibraryResource;
        const r = reviewPdf(buildReviewInput(mayor, { ...leido, front: [{ sheet: 6, lines: ['Reprinted 1978 from the 1897 edition', 'ISBN: 0-8010-6073-7'] }] }));
        const cited = { title: 'The Epistle of St. James', year: 1910, publisher: 'Macmillan', isbn: null };
        render(<EditionSection review={{ ...r, edition: { ...r.edition, vsCited: 'distinta' } }} resource={mayor} cited={cited} onSave={onSave} saving={false} />);
        const sec = screen.getByTestId('revision-edicion');
        expect(sec.textContent).toContain('review.edition.reprint {"year":"1978","original":1897}');
        expect(sec.textContent).toContain('review.edition.vsCited.distintaReimpresion {"cited":"Macmillan, 1910","year":"1897"}');
        expect(sec.textContent).toContain('review.edition.reprintNote');
        fireEvent.click(screen.getByRole('button'));
        expect(onSave).toHaveBeenCalledWith({ isbn: '9780801060731' });
    });

    it('Mayor: dos tramos; con dos hojas del cuerpo se guardan las dos numeraciones y se avisa del hueco', () => {
        const a = { onSave: vi.fn(), onSaveNone: vi.fn(), onCalibrate: vi.fn(), onShowSheet: vi.fn() };
        const mayor = { ...martin, id: 'mayor', title: 'The Epistle of James', author: 'Mayor' } as unknown as LibraryResource;
        const muestras = [
            { sheet: 137, lines: ['TO WHOM THE EPISTLE IS ADDRESSED exix'], folio: null },
            { sheet: 272, lines: ['ecliv INTRODUCTION'], folio: null },
            { sheet: 405, lines: [], folio: '127' },
        ];
        const corto = reviewPdf(buildReviewInput(mayor, { ...leido, numPages: 540, samples: muestras }));
        render(<PaginationSection review={corto} ebook={false} storedConfirmed={false} canSave={!!corto.pagination.proposal} saving={false} {...a} />);
        let sec = screen.getByTestId('revision-paginas');
        expect(sec.dataset.tone).toBe('warn');
        expect(sec.textContent).toContain('review.pagination.tramos {');
        expect(sec.textContent).toContain('"romanFrom":19,"arabicFrom":279');
        expect(sec.textContent).toContain('review.pagination.tramosShort');
        expect(screen.queryByText('review.pagination.saveRuns')).toBeNull();
        cleanup();
        const r = reviewPdf(buildReviewInput(mayor, { ...leido, numPages: 540, samples: [...muestras, { sheet: 486, lines: [], folio: '208' }] }));
        render(<PaginationSection review={r} ebook={false} storedConfirmed={false} canSave={!!r.pagination.proposal} saving={false} {...a} />);
        sec = screen.getByTestId('revision-paginas');
        expect(sec.dataset.tone).toBe('ok');
        expect(sec.textContent).toContain('review.pagination.tramosGap {"from":273,"to":278}');
        expect(sec.textContent).not.toContain('tramosShort');
        fireEvent.click(screen.getByText('review.pagination.saveRuns'));
        expect(a.onSave).toHaveBeenCalled();
    });

    it('Kittel: páginas marcadas en el texto; se muestran las del libro y no se ofrece guardar ni reemplazar', () => {
        const a = { onSave: vi.fn(), onSaveNone: vi.fn(), onCalibrate: vi.fn(), onShowSheet: vi.fn() };
        const kittel = { ...martin, pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 620, offset: null }], sheetPages: { '215': { from: 281, to: 282 } } } } as unknown as LibraryResource;
        const r = reviewPdf(buildReviewInput(kittel, leido));
        render(<PaginationSection review={r} ebook={false} storedConfirmed canSave={!!r.pagination.proposal} saving={false} {...a} />);
        const sec = screen.getByTestId('revision-paginas');
        expect(sec.dataset.tone).toBe('ok');
        expect(sec.textContent).toContain('review.pagination.marcas');
        expect(screen.getByText('review.pagination.pointMarked {"sheet":215,"pages":"pp. 281–282"}')).toBeTruthy();
        expect(screen.queryByText('review.pagination.save')).toBeNull();
        expect(screen.queryByText('review.pagination.replace')).toBeNull();
        expect(screen.queryByText('review.pagination.storedDisagrees')).toBeNull();
    });
});
