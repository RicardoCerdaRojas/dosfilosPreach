import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('@/components/exegesis/setup/page-picker/PdfPageViewer', () => ({ PdfPageViewer: () => <div data-testid="visor" /> }));
vi.mock('@/hooks/exegesis/useDocumentPageIndex', () => ({ useDocumentPdfUrl: () => ({ data: null }) }));
let datos: unknown = null;
vi.mock('@/hooks/library/usePageNumbering', () => ({
    usePageNumbering: () => ({ data: datos, isLoading: false, isError: false }),
    useSavePageNumbering: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const { PageNumberingPage } = await import('../PageNumberingPage');

const pantalla = () => render(
    <MemoryRouter initialEntries={['/dashboard/library/k1/numeracion']}>
        <Routes><Route path="/dashboard/library/:resourceId/numeracion" element={<PageNumberingPage />} /></Routes>
    </MemoryRouter>,
);
const base = { lastSheet: 1120, storedOrigin: 'confirmed', ownerId: 'yo', title: 'Kittel', author: null };

beforeEach(() => cleanup());

describe('Numeración de un libro con páginas marcadas en el texto (Kittel, A8b)', () => {
    it('no ofrece calibrar a mano: muestra las páginas de la hoja que se mira', () => {
        datos = {
            ...base, markedSheets: 1028,
            numbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 1120, offset: null }], sheetPages: { '224': { from: 281, to: 282 } } },
            points: [{ sheet: 224, proposed: null }, { sheet: 561, proposed: null }],
        };
        pantalla();
        expect(screen.getByText('numbering.markedPages {"count":1028}')).toBeTruthy();
        expect(screen.getByText('numbering.markedSheetMany {"sheet":224,"pages":"281–282"}')).toBeTruthy();
        expect(screen.queryByText('numbering.confirm')).toBeNull();
        expect(screen.queryByPlaceholderText('numbering.printedPlaceholder')).toBeNull();
        expect(screen.queryByText('numbering.alreadyConfirmed')).toBeNull();
        // Nada que invite a leer el folio del archivo.
        expect(screen.queryByText('numbering.pageIntro')).toBeNull();
        expect(screen.queryByText('numbering.lookForFolio')).toBeNull();
    });

    it('un libro sin marcas sigue con su formulario', () => {
        datos = { ...base, markedSheets: 0, numbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 620, offset: -111 }] }, points: [{ sheet: 215, proposed: '104' }] };
        pantalla();
        expect(screen.getByText('numbering.confirm')).toBeTruthy();
        expect(screen.getByText('numbering.alreadyConfirmed')).toBeTruthy();
        expect(screen.getByText('numbering.pageIntro')).toBeTruthy();
        expect(screen.queryByText(/numbering\.markedPages/)).toBeNull();
    });
});
