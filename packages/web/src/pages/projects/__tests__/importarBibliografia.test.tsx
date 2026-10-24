import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Etapa 2b: importar una bibliografía produce un PLAN, no una lista. Al
 * soltar un archivo se lee; la revisión ordena lo leído y recién al confirmar
 * se guarda (prueba del fundador: antes quedaba solo en pantalla).
 */
const execute = vi.fn();
let textoDelPdf = '';
vi.mock('@dosfilos/application', () => ({ exegesisService: { extractProjectBibliography: { execute } }, MAX_BIBLIOGRAPHY_TEXT_CHARS: 60_000 }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count !== undefined ? `${k}:${o.count}` : k), i18n: { language: 'es' } }) }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/pdfText', () => ({ pdfToText: vi.fn(async () => ({ text: textoDelPdf, pages: 15, truncated: false })), imageToBase64: vi.fn(async () => 'BASE64') }));
const { BibliographyImportPanel } = await import('../stateOfArt/BibliographyImportPanel');
type Pendiente = Parameters<typeof BibliographyImportPanel>[0]['pending'];

const silabo = {
    documentKind: 'assignment',
    entries: [
        { title: 'La epístola de Santiago: Un comentario sobre el texto griego', author: 'Davids, Peter H.', requirement: 'required', sourceType: 'commentary-critical' },
        { title: 'Does Scripture Speak in Vain? A Reconsideration of James IV. 5', author: 'Laws, Sophie', requirement: 'recommended', sourceType: 'journal-article' },
        { title: 'Greek Grammar Beyond the Basics', author: 'Wallace, Daniel B.', requirement: 'recommended', sourceType: 'grammar-syntax' },
        { title: 'Commentary on James', author: 'Dibelius, Martin', requirement: 'recommended', sourceType: 'commentary-critical' },
        { title: 'La sabiduría en Santiago 3', author: 'Hartin, Patrick', requirement: 'recommended', sourceType: 'theological-monograph' },
        { title: 'The Letter of James', author: 'Moo, Douglas J.', requirement: 'required', sourceType: 'commentary-expository' },
    ],
    requirementItems: [
        { kind: 'quantity', text: 'Un mínimo de 100 páginas de artículos académicos', sourceType: 'journal-article', minimum: 100, unit: 'pages' },
        { kind: 'rule', text: 'No usar la misma fuente dos semanas consecutivas' },
    ],
    requirements: 'Reseñar cada artículo.',
    prohibitions: 'No repetir fuentes en semanas consecutivas.',
};
const contexto = {
    library: [{ id: 'wallace', title: 'Greek Grammar Beyond the Basics', author: 'Daniel B. Wallace', exegeticalType: 'grammar-syntax' as const }],
    // Moo ya está en la lista del proyecto.
    existing: [{ id: 'moo', title: 'The Letter of James', author: 'Douglas J. Moo', weight: 'recommended', decision: 'approved', origins: ['library'] }],
    mentions: (t: string) => (/James IV/.test(t) ? [{ bookId: 'JAS' as const, chapter: 4 }] : /Santiago 3/.test(t) ? [{ bookId: 'JAS' as const, chapter: 3 }] : []),
    unmetTypes: new Set(['journal-article'] as const),
};

const resultado = { added: 3, ids: ['a', 'b'], step: 'candidates' as const };
/** Lo leído vive fuera del panel (en el hook): el arnés lo guarda y deja ocultar el panel, como cambiar de paso. */
function Arnes({ onConfirm, onDone, ctx = contexto }: { onConfirm: (plan: unknown) => Promise<typeof resultado>; onDone: (o: unknown) => void; ctx?: unknown }) {
    const [pendiente, setPendiente] = useState<Pendiente>(null);
    const [visible, setVisible] = useState(true);
    return (
        <>
            <button onClick={() => setVisible(v => !v)}>cambiar de paso</button>
            {visible && <BibliographyImportPanel context={ctx as never} pending={pendiente} onPending={setPendiente} onConfirm={onConfirm as never} onDone={onDone} />}
        </>
    );
}
const montar = (ctx?: unknown) => {
    const onConfirm = vi.fn(async (_plan: unknown) => resultado);
    const onDone = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><Arnes onConfirm={onConfirm} onDone={onDone} ctx={ctx} /></QueryClientProvider>);
    return { onConfirm, onDone };
};
const escribirYLeer = () => {
    fireEvent.click(screen.getByText('stateOfArt.import.writeList'));
    fireEvent.change(screen.getByLabelText('stateOfArt.import.textLabel'), { target: { value: 'la bibliografía del sílabo' } });
    fireEvent.click(screen.getByText('stateOfArt.import.read'));
};
const grupo = (g: string) => screen.getByRole('group', { name: new RegExp(`stateOfArt.review.group.${g}\\b`) });
const zona = () => screen.getByRole('group', { name: 'stateOfArt.import.dropZone' });
beforeEach(() => { cleanup(); vi.clearAllMocks(); textoDelPdf = ''; });

describe('importar una bibliografía', () => {
    it('soltar el sílabo en PDF lo lee de inmediato y muestra el plan agrupado', async () => {
        execute.mockResolvedValue(silabo);
        textoDelPdf = 'Plan de estudio NT785 … Bibliografía de la clase …';
        montar();
        fireEvent.drop(zona(), { dataTransfer: { files: [new File(['%PDF'], 'NT785.pdf', { type: 'application/pdf' })] } });
        await waitFor(() => expect(screen.getByText('stateOfArt.review.titleAssignment')).toBeInTheDocument());
        expect(execute).toHaveBeenCalledWith(expect.objectContaining({ text: textoDelPdf, image: null }));
        expect(within(grupo('required')).getByText(/La epístola de Santiago/)).toBeInTheDocument();
        // El artículo sobre 4:5 llena un requisito que falta (artículos): va primero en «conseguir».
        expect(within(grupo('gap')).getByText(/Does Scripture Speak in Vain/)).toBeInTheDocument();
        expect(within(grupo('library')).getByText(/Greek Grammar Beyond the Basics/)).toBeInTheDocument();
        expect(within(grupo('rest')).getByText(/Commentary on James/)).toBeInTheDocument();
        // Nombra un capítulo de los estudios: su propio grupo y su etiqueta.
        expect(within(grupo('passage')).getByText(/La sabiduría en Santiago 3/)).toBeInTheDocument();
        expect(within(grupo('passage')).getByText('stateOfArt.review.mentions')).toBeInTheDocument();
        // Lo que ya está en la lista va al final, desmarcado, aunque sea obligatorio.
        expect(within(grupo('already')).getByText('The Letter of James')).toBeInTheDocument();
        expect(within(grupo('already')).getByText('stateOfArt.weight.required')).toBeInTheDocument();
        expect(screen.getByLabelText(/^The Letter of James/)).not.toBeChecked();
        expect(screen.getByText('Un mínimo de 100 páginas de artículos académicos')).toBeInTheDocument();
    });

    it('confirmar manda solo lo marcado, con los requisitos, como sílabo; y muestra lo que entró', async () => {
        execute.mockResolvedValue(silabo);
        const { onConfirm, onDone } = montar();
        escribirYLeer();
        await waitFor(() => expect(screen.getByText('stateOfArt.review.titleAssignment')).toBeInTheDocument());
        fireEvent.click(screen.getByLabelText(/Commentary on James/));
        fireEvent.click(screen.getByLabelText(/No usar la misma fuente/));
        // El texto de lo que prohíbe se agrega solo si queda marcado.
        fireEvent.click(screen.getByLabelText(/No repetir fuentes en semanas consecutivas/));
        fireEvent.click(screen.getByText('stateOfArt.review.confirm'));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        const plan = onConfirm.mock.calls[0]![0] as { entries: Array<{ title: string }>; requirementItems: Array<{ text: string }>; origin: { kind: string }; logKind: string; requirementsText: string | null; prohibitionsText: string | null; found: number };
        expect(plan.entries.map(e => e.title)).toEqual([
            'La epístola de Santiago: Un comentario sobre el texto griego', 'Does Scripture Speak in Vain? A Reconsideration of James IV. 5',
            'Greek Grammar Beyond the Basics', 'La sabiduría en Santiago 3',
        ]);
        expect(plan.requirementItems.map(r => r.text)).toEqual(['Un mínimo de 100 páginas de artículos académicos']);
        expect(plan).toMatchObject({ origin: { kind: 'syllabus' }, logKind: 'syllabus', requirementsText: 'Reseñar cada artículo.', prohibitionsText: null, found: 6 });
        await waitFor(() => expect(onDone).toHaveBeenCalledWith(resultado));
    });

    it('marcar una obra que ya está la cuenta como «completa», no como nueva', async () => {
        execute.mockResolvedValue(silabo);
        montar();
        escribirYLeer();
        await waitFor(() => expect(screen.getByText('stateOfArt.review.willAddWorks:5 · stateOfArt.review.willAddRequirements:2')).toBeInTheDocument());
        fireEvent.click(screen.getByLabelText(/^The Letter of James/));
        expect(screen.getByText('stateOfArt.review.willAddWorks:5 · stateOfArt.review.willUpdate:1 · stateOfArt.review.willAddRequirements:2')).toBeInTheDocument();
    });

    it('otra edición del mismo título no es «ya en tu lista»: entra como obra nueva, igual que en la mezcla', async () => {
        execute.mockResolvedValue({ documentKind: 'bibliography', entries: [{ title: 'Commentary on James', author: 'Dibelius, Martin' }], requirementItems: [], requirements: null, prohibitions: null });
        montar({
            ...contexto,
            library: [{ id: 'ed2', title: 'Commentary on James', author: 'Martin Dibelius', exegeticalType: 'commentary-critical' }],
            existing: [{ id: 'x', title: 'Commentary on James', author: 'Martin Dibelius', resourceId: 'ed1', weight: 'recommended', decision: 'approved', origins: ['library'] }],
        });
        escribirYLeer();
        await waitFor(() => expect(screen.getByText('stateOfArt.review.titleBibliography')).toBeInTheDocument());
        expect(screen.queryByRole('group', { name: /stateOfArt.review.group.already/ })).toBeNull();
        expect(screen.getByLabelText(/^Commentary on James/)).toBeChecked();
    });

    it('soltar otro archivo mientras lee no lanza (ni cobra) otra lectura', async () => {
        let soltar: (v: unknown) => void = () => undefined;
        execute.mockReturnValue(new Promise(r => { soltar = r; }));
        textoDelPdf = 'Un sílabo con texto suficiente para leerlo entero.';
        montar();
        fireEvent.drop(zona(), { dataTransfer: { files: [new File(['%PDF'], 'uno.pdf', { type: 'application/pdf' })] } });
        await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
        fireEvent.drop(zona(), { dataTransfer: { files: [new File(['%PDF'], 'dos.pdf', { type: 'application/pdf' })] } });
        const recorte = new File(['x'], 'r.png', { type: 'image/png' });
        fireEvent.paste(zona(), { clipboardData: { items: [{ type: 'image/png', getAsFile: () => recorte }] } });
        await new Promise(r => setTimeout(r, 30));
        expect(execute).toHaveBeenCalledTimes(1);
        soltar(silabo);
        await waitFor(() => expect(screen.getByText('stateOfArt.review.titleAssignment')).toBeInTheDocument());
    });

    it('cambiar de paso con la revisión abierta no pierde lo leído (ni lo cobra otra vez)', async () => {
        execute.mockResolvedValue(silabo);
        montar();
        escribirYLeer();
        await waitFor(() => expect(screen.getByText('stateOfArt.review.titleAssignment')).toBeInTheDocument());
        fireEvent.click(screen.getByText('cambiar de paso'));
        expect(screen.queryByText('stateOfArt.review.titleAssignment')).toBeNull();
        fireEvent.click(screen.getByText('cambiar de paso'));
        expect(screen.getByText('stateOfArt.review.titleAssignment')).toBeInTheDocument();
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('si se cambia de paso mientras lee, lo leído llega igual y al volver se ve', async () => {
        let soltar: (v: unknown) => void = () => undefined;
        execute.mockReturnValue(new Promise(r => { soltar = r; }));
        montar();
        escribirYLeer();
        await waitFor(() => expect(screen.getByText('stateOfArt.import.reading')).toBeInTheDocument());
        fireEvent.click(screen.getByText('cambiar de paso'));
        fireEvent.click(screen.getByText('cambiar de paso'));
        expect(screen.getByText('stateOfArt.import.reading')).toBeInTheDocument();
        soltar(silabo);
        await waitFor(() => expect(screen.getByText('stateOfArt.review.titleAssignment')).toBeInTheDocument());
    });

    it('un RIS se lee aquí, sin el asistente; si se dice de qué obra es, entra como «citada por»', async () => {
        const { onConfirm, onDone } = montar();
        const ris = 'TY  - JOUR\nAU  - Laws, Sophie\nTI  - Does Scripture Speak in Vain?\nT2  - New Testament Studies\nVL  - 20\nPY  - 1973\nSP  - 210\nEP  - 215\nER  -';
        const archivo = new File([ris], 'atla.ris', { type: 'application/x-research-info-systems' });
        Object.defineProperty(archivo, 'text', { value: async () => ris });
        fireEvent.change(screen.getByLabelText('stateOfArt.import.upload'), { target: { files: [archivo] } });
        await waitFor(() => expect(screen.getByText('stateOfArt.review.titleBibliography')).toBeInTheDocument());
        expect(execute).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('stateOfArt.review.citedBy'), { target: { value: 'Moo, Comentario de Santiago' } });
        // Una bibliografía no trae requisitos: no se muestran ni se mandan.
        expect(screen.queryByText('stateOfArt.review.requirements')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('stateOfArt.review.confirm'));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        const plan = onConfirm.mock.calls[0]![0] as { entries: Array<{ title: string; pageCount?: number }>; requirementItems: unknown[]; origin: unknown; logKind: string; label: string };
        expect(plan).toMatchObject({ origin: { kind: 'citation', citedBy: 'Moo, Comentario de Santiago' }, logKind: 'file', label: 'atla.ris', requirementItems: [] });
        expect(plan.entries[0]).toMatchObject({ title: 'Does Scripture Speak in Vain?', pageCount: 6 });
        await waitFor(() => expect(onDone).toHaveBeenCalledWith(resultado));
    });

    it('una lectura cortada se revisa igual y dice hasta qué obra entró', async () => {
        execute.mockResolvedValue({ ...silabo, truncated: true, truncatedAfter: 'Commentary on James' });
        montar();
        escribirYLeer();
        expect(await screen.findByRole('status')).toHaveTextContent('stateOfArt.review.truncated');
        expect(screen.getByText('stateOfArt.review.titleAssignment')).toBeInTheDocument();
    });

    it('cancelar la revisión vuelve a la zona sin guardar nada', async () => {
        execute.mockResolvedValue(silabo);
        const { onConfirm } = montar();
        escribirYLeer();
        await waitFor(() => expect(screen.getByText('stateOfArt.review.cancel')).toBeInTheDocument());
        fireEvent.click(screen.getByText('stateOfArt.review.cancel'));
        expect(zona()).toBeInTheDocument();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('si guardar falla, la revisión sigue abierta y lo dice', async () => {
        execute.mockResolvedValue(silabo);
        const { onConfirm, onDone } = montar();
        onConfirm.mockRejectedValueOnce(new Error('sin red'));
        escribirYLeer();
        await waitFor(() => expect(screen.getByText('stateOfArt.review.confirm')).toBeInTheDocument());
        fireEvent.click(screen.getByText('stateOfArt.review.confirm'));
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('stateOfArt.saveFailed'));
        expect(screen.getByText('stateOfArt.review.confirm')).toBeInTheDocument();
        expect(onDone).not.toHaveBeenCalled();
    });

    it('pegar un recorte en la zona lo lee como imagen; un texto pegado no', async () => {
        execute.mockResolvedValue({ documentKind: 'bibliography', entries: [], requirementItems: [], requirements: null, prohibitions: null });
        montar();
        const recorte = new File(['x'], 'r.png', { type: 'image/png' });
        fireEvent.paste(zona(), { clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }, { type: 'image/png', getAsFile: () => recorte }] } });
        await new Promise(r => setTimeout(r, 30));
        expect(execute).not.toHaveBeenCalled();
        fireEvent.paste(zona(), { clipboardData: { items: [{ type: 'image/png', getAsFile: () => recorte }] } });
        await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ image: { mimeType: 'image/png', base64: 'BASE64' } })));
    });

    it('un PDF escaneado pide una foto; sin saldo lo dice', async () => {
        montar();
        fireEvent.drop(zona(), { dataTransfer: { files: [new File(['%PDF'], 'escaneo.pdf', { type: 'application/pdf' })] } });
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('stateOfArt.import.scannedPdf'));
        execute.mockRejectedValue(Object.assign(new Error('x'), { code: 'insufficient-exegesis-credits' }));
        textoDelPdf = 'Un sílabo con texto suficiente para leerlo entero.';
        fireEvent.drop(zona(), { dataTransfer: { files: [new File(['%PDF'], 'silabo.pdf', { type: 'application/pdf' })] } });
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('stateOfArt.import.noCredits'));
    });
});
