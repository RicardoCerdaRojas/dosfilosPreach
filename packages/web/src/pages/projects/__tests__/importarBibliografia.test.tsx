import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Estado del arte: importar la bibliografía del curso (pegar, PDF, imagen o recorte). */
const execute = vi.fn();
let textoDelPdf = '';
vi.mock('@dosfilos/application', () => ({ exegesisService: { extractProjectBibliography: { execute } }, MAX_BIBLIOGRAPHY_TEXT_CHARS: 60 }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
const toastError = vi.fn();
const toastWarning = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn(), warning: (m: string) => toastWarning(m) } }));
let pdfLargo = false;
vi.mock('@/lib/pdfText', () => ({ pdfToText: vi.fn(async () => ({ text: textoDelPdf, pages: pdfLargo ? 50 : 15, truncated: pdfLargo })), imageToBase64: vi.fn(async () => 'BASE64') }));
const { BibliographyImportPanel } = await import('../stateOfArt/BibliographyImportPanel');

const montar = (onImported = vi.fn()) => {
    render(<QueryClientProvider client={new QueryClient()}><BibliographyImportPanel onImported={onImported} /></QueryClientProvider>);
    return onImported;
};
beforeEach(() => { cleanup(); vi.clearAllMocks(); textoDelPdf = ''; pdfLargo = false; });

describe('BibliographyImportPanel', () => {
    it('pegar una lista (o una sola obra) y leer: cobra la lectura y entrega lo leído', async () => {
        const leido = { entries: [{ title: 'Comentario de la epístola de Santiago', requirement: 'required' }], requirements: null, prohibitions: null };
        execute.mockResolvedValue(leido);
        const onImported = montar();
        fireEvent.change(screen.getByLabelText('stateOfArt.import.textLabel'), { target: { value: 'Moo, Douglas J. Comentario de la epístola de Santiago. Vida, 2009.' } });
        fireEvent.click(screen.getByText('stateOfArt.import.read'));
        await waitFor(() => expect(onImported).toHaveBeenCalledWith(leido));
        expect(execute).toHaveBeenCalledWith({ ownerId: 'u1', text: 'Moo, Douglas J. Comentario de la epístola de Santiago. Vida, 2009.', image: null, language: 'es' });
    });

    it('pegar un recorte desde el portapapeles lo manda como imagen', async () => {
        execute.mockResolvedValue({ entries: [], requirements: null, prohibitions: null });
        montar();
        const archivo = new File(['x'], 'recorte.png', { type: 'image/png' });
        fireEvent.paste(screen.getByRole('region', { name: 'stateOfArt.import.title' }), {
            clipboardData: { items: [{ type: 'image/png', getAsFile: () => archivo }] },
        });
        await waitFor(() => expect(screen.getByText('stateOfArt.import.pastedImage')).toBeInTheDocument());
        fireEvent.click(screen.getByText('stateOfArt.import.read'));
        await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ image: { mimeType: 'image/png', base64: 'BASE64' } })));
    });

    it('un PDF con texto llena la lista; uno escaneado pide una foto', async () => {
        montar();
        const subir = screen.getByLabelText('stateOfArt.import.upload') as HTMLInputElement;
        textoDelPdf = 'Bibliografía de la clase en español. Alonso, José. La Sagrada Escritura: Carta de Santiago. Madrid: BAC, 1967.';
        fireEvent.change(subir, { target: { files: [new File(['%PDF'], 'silabo.pdf', { type: 'application/pdf' })] } });
        await waitFor(() => expect((screen.getByLabelText('stateOfArt.import.textLabel') as HTMLTextAreaElement).value).toContain('Alonso, José'));
        textoDelPdf = '';
        fireEvent.change(subir, { target: { files: [new File(['%PDF'], 'escaneo.pdf', { type: 'application/pdf' })] } });
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('stateOfArt.import.scannedPdf'));
    });

    it('sin saldo lo dice', async () => {
        execute.mockRejectedValue(Object.assign(new Error('x'), { code: 'insufficient-exegesis-credits' }));
        montar();
        fireEvent.change(screen.getByLabelText('stateOfArt.import.textLabel'), { target: { value: 'Una obra cualquiera, 2020.' } });
        fireEvent.click(screen.getByText('stateOfArt.import.read'));
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('stateOfArt.import.noCredits'));
    });

    it('pegar texto no se toma como imagen aunque lo copiado traiga ambas cosas', async () => {
        montar();
        const archivo = new File(['x'], 'r.png', { type: 'image/png' });
        fireEvent.paste(screen.getByRole('region', { name: 'stateOfArt.import.title' }), {
            clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }, { type: 'image/png', getAsFile: () => archivo }] },
        });
        // La imagen se lee de forma asíncrona: se espera antes de mirar.
        await new Promise(r => setTimeout(r, 30));
        expect(screen.queryByText('stateOfArt.import.pastedImage')).toBeNull();
    });

    it('avisa lo que no se va a leer: un PDF largo y un texto que pasa el tope; una respuesta cortada pide importar por partes', async () => {
        montar();
        textoDelPdf = 'Bibliografía larga de un sílabo de muchas páginas, con muchas obras citadas.';
        pdfLargo = true;
        fireEvent.change(screen.getByLabelText('stateOfArt.import.upload'), { target: { files: [new File(['%PDF'], 'largo.pdf', { type: 'application/pdf' })] } });
        await waitFor(() => expect(toastWarning).toHaveBeenCalledWith('stateOfArt.import.pdfTruncated'));
        expect(screen.getByText('stateOfArt.import.textTruncated')).toBeInTheDocument();
        execute.mockRejectedValue(Object.assign(new Error('x'), { code: 'truncated' }));
        fireEvent.click(screen.getByText('stateOfArt.import.read'));
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('stateOfArt.import.truncated'));
    });
});
