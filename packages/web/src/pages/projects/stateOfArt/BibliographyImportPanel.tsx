import { useRef, useState } from 'react';
import { useIsMutating, useMutation } from '@tanstack/react-query';
import { ClipboardPaste, FileUp, Loader2, ScanText } from 'lucide-react';
import { toast } from 'sonner';
import { exegesisService, MAX_BIBLIOGRAPHY_TEXT_CHARS } from '@dosfilos/application';
import { bibliographyFileFormat, parseBibtex, parseRis } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { imageToBase64, pdfToText } from '@/lib/pdfText';
import { campo } from './BibliographyEntryEditor';
import { BibliographyImportReview, type ImportReviewContext } from './BibliographyImportReview';
import type { ImportOutcome, ImportPlan, PendingImport } from './useProjectBibliography';

interface BibliographyImportPanelProps {
    context: ImportReviewContext;
    /** Lo leído que espera su revisión: vive fuera del panel para no perderse al cambiar de paso. */
    pending: PendingImport | null;
    onPending: (pending: PendingImport | null) => void;
    onConfirm: (plan: ImportPlan) => Promise<ImportOutcome>;
    /** Al terminar: muestra las fichas que tocó la importación. */
    onDone: (outcome: ImportOutcome) => void;
}

/** Tope de la foto: el servidor acepta hasta unos 7 MB en base64. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** La misma clave en cada montaje: si se cambia de paso mientras lee, al volver se ve que sigue leyendo. */
const LEER = ['state-of-art', 'read-bibliography'] as const;

/**
 * Importar una bibliografía (estado del arte, etapa 2b): el sílabo de un
 * curso, la bibliografía de un artículo o un libro, una lista, o lo
 * exportado de ATLA, NTA o Zotero. Al soltar un archivo se lee; después, la
 * revisión muestra el PLAN (lo que pide, lo que manda leer, qué conseguir
 * primero) y recién al confirmar se guarda.
 */
export function BibliographyImportPanel({ context, pending, onPending, onConfirm, onDone }: BibliographyImportPanelProps) {
    const { t, i18n } = useTranslation('projects');
    const { user } = useFirebase();
    const [texto, setTexto] = useState('');
    const [escribiendo, setEscribiendo] = useState(false);
    const [preparando, setPreparando] = useState(false);
    const [arrastrando, setArrastrando] = useState(false);
    const archivoRef = useRef<HTMLInputElement>(null);
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

    // Los callbacks del hook (no los de `mutate`) corren aunque el panel se
    // haya desmontado: lo leído llega a `onPending` igual.
    const leer = useMutation({
        mutationKey: LEER,
        mutationFn: async (input: { text: string; image: { mimeType: string; base64: string } | null; label: string }) => {
            if (!user) throw new Error('No authenticated user');
            const result = await exegesisService.extractProjectBibliography.execute({ ownerId: user.uid, text: input.text, image: input.image, language: lang });
            return { result, label: input.label, local: false };
        },
        onSuccess: res => onPending(res),
        onError: err => {
            console.error('[projects] read bibliography failed:', err);
            const code = (err as { code?: string }).code;
            toast.error(t(code === 'insufficient-exegesis-credits' ? 'stateOfArt.import.noCredits' : code === 'truncated' ? 'stateOfArt.import.truncated' : 'stateOfArt.import.failed'));
        },
    });

    const leyendo = useIsMutating({ mutationKey: LEER }) > 0;
    const ocupado = leyendo || preparando;
    // Una lectura a la vez: soltar otro archivo mientras se lee cobraría dos.
    const libre = () => !leyendo && !pending;

    /** RIS y BibTeX se leen aquí, gratis; lo demás va al lector. */
    const leerTexto = (txt: string, label: string) => {
        if (!libre()) return;
        const formato = bibliographyFileFormat(label, txt);
        if (formato) {
            const entries = formato === 'ris' ? parseRis(txt) : parseBibtex(txt);
            if (entries.length === 0) { toast.error(t('stateOfArt.import.emptyFile')); return; }
            onPending({ result: { documentKind: 'bibliography', entries, requirementItems: [], requirements: null, prohibitions: null }, label, local: true });
            return;
        }
        if (txt.length > MAX_BIBLIOGRAPHY_TEXT_CHARS) toast.warning(t('stateOfArt.import.textTruncated', { max: MAX_BIBLIOGRAPHY_TEXT_CHARS.toLocaleString() }));
        leer.mutate({ text: txt, image: null, label });
    };

    const tomarImagen = async (file: Blob, label: string) => {
        if (!libre()) return;
        if (file.size > MAX_IMAGE_BYTES) { toast.error(t('stateOfArt.import.imageTooBig')); return; }
        leer.mutate({ text: '', image: { mimeType: file.type || 'image/png', base64: await imageToBase64(file) }, label });
    };

    const tomarArchivo = async (file: File | undefined) => {
        if (!file || !libre() || preparando) return;
        if (file.type.startsWith('image/')) return tomarImagen(file, file.name);
        setPreparando(true);
        try {
            if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
                const { text, truncated } = await pdfToText(file);
                // Un escaneo no trae texto: se pide la imagen.
                if (text.length < 40) { toast.error(t('stateOfArt.import.scannedPdf')); return; }
                if (truncated) toast.warning(t('stateOfArt.import.pdfTruncated'));
                return leerTexto(text, file.name);
            }
            if (/\.(ris|bib|bibtex|txt)$/i.test(file.name) || file.type.startsWith('text/')) return leerTexto(await file.text(), file.name);
            toast.error(t('stateOfArt.import.unsupported'));
        } catch (err) {
            console.error('[projects] import file failed:', err);
            toast.error(t('stateOfArt.import.pdfFailed'));
        } finally {
            setPreparando(false);
        }
    };

    // Pegar un recorte: solo si lo copiado es una imagen. Un texto se pega como texto.
    const alPegar = (e: React.ClipboardEvent) => {
        if ([...e.clipboardData.items].some(i => i.type === 'text/plain')) return;
        const archivo = [...e.clipboardData.items].find(i => i.type.startsWith('image/'))?.getAsFile();
        if (!archivo) return;
        e.preventDefault();
        void tomarImagen(archivo, t('stateOfArt.import.pastedImage'));
    };

    if (pending) {
        return (
            <BibliographyImportReview
                result={pending.result}
                label={pending.label}
                local={pending.local}
                context={context}
                onCancel={() => onPending(null)}
                onConfirm={async plan => {
                    const outcome = await onConfirm(plan);
                    toast.success(t('stateOfArt.import.done', { read: plan.found ?? plan.entries.length, added: outcome.added }));
                    onPending(null);
                    setTexto('');
                    setEscribiendo(false);
                    onDone(outcome);
                }}
            />
        );
    }

    return (
        <section className="rounded-lg border border-border bg-card p-3 space-y-2" aria-labelledby="bib-import-title">
            <h3 id="bib-import-title" className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                <ScanText className="h-4 w-4 text-muted-foreground" />{t('stateOfArt.import.title')}
            </h3>
            <p className="text-xs text-muted-foreground">{t('stateOfArt.import.hint')}</p>

            <div
                id="bib-import-zone"
                role="group"
                aria-label={t('stateOfArt.import.dropZone')}
                tabIndex={0}
                onPaste={alPegar}
                onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={e => { e.preventDefault(); setArrastrando(false); void tomarArchivo(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${arrastrando ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
                {ocupado ? (
                    <p className="inline-flex items-center gap-2 text-sm text-foreground" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" />{t(preparando ? 'stateOfArt.import.preparing' : 'stateOfArt.import.reading')}
                    </p>
                ) : (
                    <>
                        <p className="text-sm text-foreground">{t('stateOfArt.import.dropHere')}</p>
                        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ClipboardPaste className="h-3.5 w-3.5" />{t('stateOfArt.import.pasteHere')}</p>
                        <div className="flex flex-wrap justify-center gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => archivoRef.current?.click()}>
                                <FileUp className="mr-1.5 h-3.5 w-3.5" />{t('stateOfArt.import.upload')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEscribiendo(v => !v)} aria-expanded={escribiendo}>
                                {t('stateOfArt.import.writeList')}
                            </Button>
                        </div>
                        <input
                            ref={archivoRef}
                            type="file"
                            tabIndex={-1}
                            aria-label={t('stateOfArt.import.upload')}
                            accept="application/pdf,image/png,image/jpeg,image/webp,.ris,.bib,.bibtex,.txt"
                            className="sr-only"
                            onChange={e => { void tomarArchivo(e.target.files?.[0]); e.target.value = ''; }}
                        />
                    </>
                )}
            </div>

            {escribiendo && (
                <div className="space-y-2">
                    <label htmlFor="bib-import-text" className="block text-xs text-muted-foreground">{t('stateOfArt.import.textLabel')}</label>
                    <textarea id="bib-import-text" className={campo} rows={5} value={texto} placeholder={t('stateOfArt.import.placeholder')} onChange={e => setTexto(e.target.value)} />
                    <Button size="sm" onClick={() => leerTexto(texto.trim(), t('stateOfArt.import.pastedList'))} disabled={texto.trim().length < 10 || ocupado}>
                        {t('stateOfArt.import.read')}
                    </Button>
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">{t('stateOfArt.import.cost')}</p>
        </section>
    );
}
