import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

/**
 * Fase F: un solo visor de fuente, en panel (no bloquea el texto del
 * trabajo) o ampliado. Se abre desde cualquier pantalla con
 * `useSourceViewer().open(...)`.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
vi.mock('@/components/exegesis/setup/page-picker/PdfPageViewer', () => ({
    PdfPageViewer: ({ sheet }: { sheet: number }) => <div data-testid="hoja">hoja {sheet}</div>,
}));
vi.mock('@/hooks/exegesis/useDocumentTextSearch', () => ({
    useDocumentTextSearch: () => ({ data: undefined, isLoading: false, isError: false }),
}));
const llamadas: Array<{ paperId: string | null; resourceId?: string }> = [];
vi.mock('../useCitationSheet', () => ({
    useCitationSheet: (paperId: string | null, target: { resourceId?: string; sourceKey: string; label?: string } | null) => {
        llamadas.push({ paperId, resourceId: target?.resourceId });
        return {
            source: null, resourceId: target?.resourceId ?? (target ? 'res-del-trabajo' : null),
            label: target?.label ?? target?.sourceKey ?? '', citationKey: target?.sourceKey ?? null,
            pdfUrl: 'https://pdf', loading: false, totalSheets: 340, anchorSheet: 224, viewSheet: 224,
            printedOfView: 204, printedOf: () => 204, goTo: () => {}, goToPageInput: () => true,
        };
    },
}));
const { SourceViewerProvider, SourceViewerSlot, useSourceViewer } = await import('../SourceViewerProvider');

beforeEach(() => { cleanup(); llamadas.length = 0; });

/** Un botón que abre el visor, como lo haría cualquier pantalla. */
function Abridor({ resourceId }: { resourceId?: string }) {
    const viewer = useSourceViewer();
    return (
        <button type="button" onClick={() => viewer.open({ paperId: resourceId ? null : 'p1', citation: { sourceKey: 'McCartney', page: 204, pageKind: 'printed', ...(resourceId ? { resourceId, label: 'The Message of James' } : {}) } })}>
            abrir
        </button>
    );
}
const montar = (resourceId?: string) => render(
    <SourceViewerProvider>
        <textarea aria-label="texto del trabajo" defaultValue="El dativo…" />
        <Abridor resourceId={resourceId} />
        <SourceViewerSlot />
    </SourceViewerProvider>,
);

describe('Visor de fuente — panel y ampliado', () => {
    it('cerrado no dibuja nada; al abrir, el panel con el libro en la página citada', () => {
        montar();
        expect(screen.queryByTestId('source-viewer-panel')).toBeNull();
        fireEvent.click(screen.getByText('abrir'));
        const panel = screen.getByTestId('source-viewer-panel');
        expect(panel.textContent).toContain('McCartney');
        expect(panel.textContent).toContain('citationViewer.pageWithSheet {"printed":204,"sheet":224}');
        expect(screen.getByTestId('hoja').textContent).toBe('hoja 224');
    });

    it('el panel NO bloquea: el texto del trabajo sigue editable al lado (no es un diálogo modal)', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.queryByRole('dialog')).toBeNull();
        const texto = screen.getByLabelText('texto del trabajo') as HTMLTextAreaElement;
        fireEvent.change(texto, { target: { value: 'escribo mientras miro el libro' } });
        expect(texto.value).toBe('escribo mientras miro el libro');
    });

    it('«Ampliar» lo pasa a la ventana grande, y «Volver al panel» lo regresa', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        fireEvent.click(screen.getByLabelText('sourceViewer.expand'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByTestId('source-viewer-panel')).toBeNull();
        fireEvent.click(screen.getByText('sourceViewer.backToPanel'));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByTestId('source-viewer-panel')).toBeInTheDocument();
    });

    it('se cierra con la X y con Escape', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        fireEvent.click(screen.getByLabelText('sourceViewer.close'));
        expect(screen.queryByTestId('source-viewer-panel')).toBeNull();
        fireEvent.click(screen.getByText('abrir'));
        fireEvent.keyDown(screen.getByTestId('source-viewer-panel'), { key: 'Escape' });
        expect(screen.queryByTestId('source-viewer-panel')).toBeNull();
    });

    it('abierto por recurso (la Biblioteca): sin trabajo, con el nombre del libro y sin «la cita decía»', () => {
        montar('res-motyer');
        fireEvent.click(screen.getByText('abrir'));
        expect(llamadas.at(-1)).toEqual({ paperId: null, resourceId: 'res-motyer' });
        const panel = screen.getByTestId('source-viewer-panel');
        expect(panel.textContent).toContain('The Message of James');
        expect(panel.textContent).not.toContain('citationViewer.noQuoteRecorded');
    });

    it('abierto desde una cita sin frase registrada, lo dice', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.getByTestId('source-viewer-panel').textContent).toContain('citationViewer.noQuoteRecorded');
    });

    it('fuera del proveedor, abrir no rompe la pantalla', () => {
        render(<Abridor />);
        act(() => { fireEvent.click(screen.getByText('abrir')); });
        expect(screen.queryByTestId('source-viewer-panel')).toBeNull();
    });
});
