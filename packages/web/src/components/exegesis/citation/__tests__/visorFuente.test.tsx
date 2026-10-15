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
    PdfPageViewer: ({ sheet, onTextSelected }: { sheet: number; onTextSelected?: (t: string | null) => void }) => (
        <div><span data-testid="hoja">hoja {sheet}</span><button type="button" onClick={() => onTextSelected?.('But this is tautologous')}>seleccionar</button></div>
    ),
}));
vi.mock('@/hooks/exegesis/useDocumentTextSearch', () => ({
    useDocumentTextSearch: () => ({ data: undefined, isLoading: false, isError: false }),
}));
const llamadas: Array<{ paperId: string | null; resourceId?: string }> = [];
const irA = vi.fn();
vi.mock('../useCitationSheet', () => ({
    useCitationSheet: (paperId: string | null, target: { resourceId?: string; sourceKey: string; label?: string } | null) => {
        llamadas.push({ paperId, resourceId: target?.resourceId });
        return {
            source: null, resourceId: target?.resourceId ?? (target ? 'res-del-trabajo' : null),
            label: target?.label ?? target?.sourceKey ?? '', citationKey: target?.sourceKey ?? null,
            pdfUrl: 'https://pdf', loading: false, totalSheets: 340, anchorSheet: 224, viewSheet: 224,
            printedOfView: 204, printedOf: () => 204, goTo: irA, goToPageInput: () => true,
            anchorFor: (sheet: number) => (sheet === 224 ? 'p. 204, § 3:18' : `hoja ${sheet}`),
            pages: [{ sheet: 223, section: 'James 3:13–18', firstLine: 'x' }, { sheet: 224, section: null, firstLine: 'Hartin goes on to argue' }],
        };
    },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { SourceViewerProvider, SourceViewerSlot, useSourceViewer, useRegisterCitationSink } = await import('../SourceViewerProvider');
const { useMemo, useRef, useState } = await import('react');
const { MemoryRouter, useNavigate } = await import('react-router-dom');
const { insertarEnCursor } = await import('../citarDesdeVisor');

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
        <textarea data-testid="texto-del-trabajo" defaultValue="El dativo…" />
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
        const texto = screen.getByTestId('texto-del-trabajo') as HTMLTextAreaElement;
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

/** Un editor mínimo que se ofrece como destino, como el lápiz de un paso. */
function Editor({ activo = true }: { activo?: boolean }) {
    const [texto, setTexto] = useState('rara vez indica agente.');
    const ref = useRef<HTMLTextAreaElement>(null);
    const sink = useMemo(() => (activo ? {
        label: 'Santiago 3:18',
        insert: (cita: string) => {
            const el = ref.current!;
            setTexto(insertarEnCursor(el.value, el.selectionStart, el.selectionEnd, cita).valor);
        },
    } : null), [activo]);
    useRegisterCitationSink(sink);
    return <textarea ref={ref} aria-label="editor" value={texto} onChange={e => setTexto(e.target.value)} />;
}
const conEditor = (activo = true) => render(
    <SourceViewerProvider>
        <Editor activo={activo} />
        <Abridor />
        <SourceViewerSlot />
    </SourceViewerProvider>,
);

describe('Visor de fuente — citar', () => {
    it('arma la cita de la hoja que se mira, con la página impresa', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.getByTestId('cita-armada').textContent).toBe('(McCartney, p. 204)');
    });

    it('con un editor abierto, «Citar en el texto» la inserta donde está el cursor', () => {
        conEditor();
        fireEvent.click(screen.getByText('abrir'));
        const editor = screen.getByLabelText('editor') as HTMLTextAreaElement;
        editor.setSelectionRange(22, 22);
        expect(screen.getByTestId('citar-barra').textContent).toContain('sourceViewer.insertsInto {"label":"Santiago 3:18"}');
        fireEvent.click(screen.getByText('sourceViewer.citeHere'));
        expect(editor.value).toBe('rara vez indica agente (McCartney, p. 204).');
    });

    it('con una frase seleccionada, «Con la frase» inserta la cita textual', () => {
        conEditor();
        fireEvent.click(screen.getByText('abrir'));
        const editor = screen.getByLabelText('editor') as HTMLTextAreaElement;
        editor.setSelectionRange(23, 23);
        fireEvent.click(screen.getByText('seleccionar'));
        fireEvent.click(screen.getByText('sourceViewer.withQuote'));
        expect(editor.value).toBe('rara vez indica agente. «But this is tautologous» (McCartney, p. 204)');
    });

    it('sin editor abierto, copia la cita (no hay dónde insertarla)', async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        conEditor(false);
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.queryByText('sourceViewer.citeHere')).toBeNull();
        await act(async () => { fireEvent.click(screen.getByText('sourceViewer.copyCitation')); });
        expect(writeText).toHaveBeenCalledWith('(McCartney, p. 204)');
    });

    it('al cerrarse el editor deja de ser destino', () => {
        const { rerender } = conEditor(true);
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.getByText('sourceViewer.citeHere')).toBeInTheDocument();
        rerender(
            <SourceViewerProvider>
                <Editor activo={false} />
                <Abridor />
                <SourceViewerSlot />
            </SourceViewerProvider>,
        );
        expect(screen.queryByText('sourceViewer.citeHere')).toBeNull();
    });

    it('con dos editores abiertos, cerrar el segundo devuelve el destino al primero', () => {
        function Dos({ segundo }: { segundo: boolean }) {
            return (
                <SourceViewerProvider>
                    <Editor activo />
                    {segundo && <EditorB />}
                    <Abridor />
                    <SourceViewerSlot />
                </SourceViewerProvider>
            );
        }
        const { rerender } = render(<Dos segundo />);
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.getByTestId('citar-barra').textContent).toContain('Santiago 3:15');
        rerender(<Dos segundo={false} />);
        expect(screen.getByTestId('citar-barra').textContent).toContain('Santiago 3:18');
    });
});

function EditorB() {
    const sink = useMemo(() => ({ label: 'Santiago 3:15', insert: () => {} }), []);
    useRegisterCitationSink(sink);
    return null;
}

function Ir({ a }: { a: string }) {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate(a)}>ir {a}</button>;
}

describe('Visor de fuente — navegación y foco', () => {
    it('al abrirse, el foco entra al panel (Escape lo cierra sin buscarlo)', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        expect(document.activeElement).toBe(screen.getByTestId('source-viewer-panel'));
    });

    it('sigue abierto dentro del mismo trabajo y se cierra al ir a otro', () => {
        render(
            <MemoryRouter initialEntries={['/dashboard/exegesis/p1']}>
                <SourceViewerProvider>
                    <Abridor />
                    <Ir a="/dashboard/exegesis/p1/pasos/s1/revision" />
                    <Ir a="/dashboard/exegesis/p2" />
                    <SourceViewerSlot />
                </SourceViewerProvider>
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByText('abrir'));
        fireEvent.click(screen.getByText('ir /dashboard/exegesis/p1/pasos/s1/revision'));
        expect(screen.getByTestId('source-viewer-panel')).toBeInTheDocument();
        fireEvent.click(screen.getByText('ir /dashboard/exegesis/p2'));
        expect(screen.queryByTestId('source-viewer-panel')).toBeNull();
    });

    it('abierto desde la Biblioteca (sin trabajo), se cierra al cambiar de pantalla', () => {
        render(
            <MemoryRouter initialEntries={['/dashboard/library']}>
                <SourceViewerProvider>
                    <Abridor resourceId="res-motyer" />
                    <Ir a="/dashboard/sermons" />
                    <SourceViewerSlot />
                </SourceViewerProvider>
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.getByTestId('source-viewer-panel')).toBeInTheDocument();
        fireEvent.click(screen.getByText('ir /dashboard/sermons'));
        expect(screen.queryByTestId('source-viewer-panel')).toBeNull();
    });
});

describe('Visor de fuente — lo que pidió el fundador al probarlo', () => {
    it('ampliado: un índice de hojas para ir a cualquier parte', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.queryByTestId('indice-del-libro')).toBeNull();
        fireEvent.click(screen.getByLabelText('sourceViewer.expand'));
        const indice = screen.getByTestId('indice-del-libro');
        expect(indice.textContent).toContain('James 3:13–18');
        fireEvent.click(screen.getByText('Hartin goes on to argue').closest('button')!);
        expect(irA).toHaveBeenCalledWith(224);
    });

    it('la frase seleccionada se puede quitar, y vuelve la cita de la página', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        fireEvent.click(screen.getByText('seleccionar'));
        expect(screen.getByTestId('citar-barra').textContent).toContain('But this is tautologous');
        fireEvent.click(screen.getByLabelText('sourceViewer.clearSelection'));
        expect(screen.getByTestId('citar-barra').textContent).not.toContain('But this is tautologous');
        expect(screen.queryByText('sourceViewer.withQuote')).toBeNull();
    });

    it('la cita del texto lleva autor y página, sin la sección', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.getByTestId('cita-armada').textContent).toBe('(McCartney, p. 204)');
    });
});

describe('Visor de fuente — preguntar a este libro (biblioteca consultable, U4)', () => {
    it('sólo ampliado: el botón cambia el índice por la conversación con el libro, y vuelve', () => {
        montar();
        fireEvent.click(screen.getByText('abrir'));
        expect(screen.queryByTestId('preguntar-a-este-libro')).toBeNull();
        fireEvent.click(screen.getByLabelText('sourceViewer.expand'));
        fireEvent.click(screen.getByTestId('preguntar-a-este-libro'));
        expect(screen.getByTestId('preguntar-al-libro')).toBeTruthy();
        expect(screen.queryByTestId('indice-del-libro')).toBeNull();
        fireEvent.click(screen.getByTestId('preguntar-a-este-libro'));
        expect(screen.getByTestId('indice-del-libro')).toBeTruthy();
    });
});
