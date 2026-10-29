import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/**
 * TP #9: la cabecera del visor unificado muestra el autor del libro (B19) y
 * su «Ir a» pide la página impresa con la numeración del libro (B27: NA28,
 * hoja 803 = p. 692).
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
vi.mock('@/components/exegesis/setup/page-picker/PdfPageViewer', () => ({
    PdfPageViewer: ({ sheet }: { sheet: number }) => <span data-testid="hoja">hoja {sheet}</span>,
}));
vi.mock('@/hooks/exegesis/useDocumentTextSearch', () => ({
    useDocumentTextSearch: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'yo' } }) }));
const irA = vi.fn();
let autor: string | null = 'Barbara Aland';
vi.mock('../useCitationSheet', () => ({
    useCitationSheet: () => ({
        source: null, resourceId: 'res-na28', label: 'NA28', bookTitle: 'Novum Testamentum Graece', author: autor,
        citationKey: 'NA28', pdfUrl: 'https://pdf', loading: false, totalSheets: 1000, anchorSheet: 803, viewSheet: 803,
        printedOfView: '692', printedOf: () => '692', goTo: irA, printedPageOffset: null,
        anchorFor: () => 'p. 692', pages: [],
        numbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 1000, offset: -111 }] },
        ownerId: 'yo',
    }),
}));
const { SourceViewerBody } = await import('../SourceViewerBody');

beforeEach(() => { cleanup(); irA.mockClear(); autor = 'Barbara Aland'; });
const montar = () => render(
    <SourceViewerBody paperId={null} target={{ sourceKey: 'NA28', page: 692, pageKind: 'printed', resourceId: 'res-na28' }} open layout="panel" />,
);

describe('Cabecera del visor de fuente', () => {
    it('muestra el título del recurso y el autor bajo el rótulo', () => {
        montar();
        expect(screen.getByTestId('libro-autor').textContent).toBe('Novum Testamentum Graece · Barbara Aland');
    });

    it('sin autor ni título nuevo no agrega renglón', () => {
        autor = null;
        montar();
        expect(screen.getByTestId('libro-autor').textContent).toBe('Novum Testamentum Graece');
    });

    it('«Ir a» convierte la página impresa con la numeración del libro', () => {
        montar();
        const campo = screen.getByLabelText('citationViewer.jump.printedAria');
        fireEvent.change(campo, { target: { value: '692' } });
        fireEvent.submit(campo.closest('form')!);
        expect(irA).toHaveBeenCalledWith(803);
    });
});
