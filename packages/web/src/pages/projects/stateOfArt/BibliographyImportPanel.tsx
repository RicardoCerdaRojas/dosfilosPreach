import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileUp, ImageIcon, Loader2, ScanText, X } from 'lucide-react';
import { toast } from 'sonner';
import { exegesisService, MAX_BIBLIOGRAPHY_TEXT_CHARS } from '@dosfilos/application';
import type { ExtractedCourseBibliography } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { imageToBase64, pdfToText } from '@/lib/pdfText';
import { campo } from './BibliographyEntryEditor';

interface BibliographyImportPanelProps {
    onImported: (result: ExtractedCourseBibliography) => void;
}

/** Tope de la foto: el servidor acepta hasta unos 7 MB en base64. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Importar la bibliografía del curso (estado del arte, paso 1): pegar la
 * lista (o una sola obra), subir el sílabo en PDF, o subir o pegar una foto
 * o un recorte. Se puede hacer las veces que haga falta: lo leído se junta
 * con lo que hay. Cada lectura se descuenta del plan.
 */
export function BibliographyImportPanel({ onImported }: BibliographyImportPanelProps) {
    const { t, i18n } = useTranslation('projects');
    const { user } = useFirebase();
    const [texto, setTexto] = useState('');
    const [imagen, setImagen] = useState<{ mimeType: string; base64: string; name: string } | null>(null);
    const [leyendoPdf, setLeyendoPdf] = useState(false);
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

    const leer = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.extractProjectBibliography.execute({
                ownerId: user.uid, text: texto, image: imagen ? { mimeType: imagen.mimeType, base64: imagen.base64 } : null, language: lang,
            });
        },
        onSuccess: res => {
            onImported(res);
            setTexto('');
            setImagen(null);
        },
        onError: err => {
            console.error('[projects] read bibliography failed:', err);
            const code = (err as { code?: string }).code;
            toast.error(t(code === 'insufficient-exegesis-credits' ? 'stateOfArt.import.noCredits' : code === 'truncated' ? 'stateOfArt.import.truncated' : 'stateOfArt.import.failed'));
        },
    });

    const tomarImagen = async (file: Blob, name: string) => {
        if (file.size > MAX_IMAGE_BYTES) { toast.error(t('stateOfArt.import.imageTooBig')); return; }
        setImagen({ mimeType: file.type || 'image/png', base64: await imageToBase64(file), name });
    };
    const tomarArchivo = async (file: File | undefined) => {
        if (!file) return;
        if (file.type.startsWith('image/')) return tomarImagen(file, file.name);
        if (file.type !== 'application/pdf') { toast.error(t('stateOfArt.import.unsupported')); return; }
        setLeyendoPdf(true);
        try {
            const { text: txt, truncated } = await pdfToText(file);
            // Un escaneo no trae texto: se pide la imagen.
            if (txt.length < 40) { toast.error(t('stateOfArt.import.scannedPdf')); return; }
            if (truncated) toast.warning(t('stateOfArt.import.pdfTruncated'));
            setTexto(txt);
        } catch (err) {
            console.error('[projects] pdf text failed:', err);
            toast.error(t('stateOfArt.import.pdfFailed'));
        } finally {
            setLeyendoPdf(false);
        }
    };
    // Pegar un recorte desde el portapapeles (captura de pantalla).
    const alPegar = (e: React.ClipboardEvent) => {
        // Si lo copiado trae texto, es un pegado de texto: no se toca.
        if ([...e.clipboardData.items].some(i => i.type === 'text/plain')) return;
        const archivo = [...e.clipboardData.items].find(i => i.type.startsWith('image/'))?.getAsFile();
        if (!archivo) return;
        e.preventDefault();
        void tomarImagen(archivo, t('stateOfArt.import.pastedImage'));
    };

    const hayAlgo = texto.trim().length >= 10 || !!imagen;
    const ocupado = leer.isPending || leyendoPdf;

    return (
        <section className="rounded-lg border border-border bg-card p-3 space-y-2" aria-labelledby="bib-import-title" onPaste={alPegar}>
            <h3 id="bib-import-title" className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                <ScanText className="h-4 w-4 text-muted-foreground" />{t('stateOfArt.import.title')}
            </h3>
            <p className="text-xs text-muted-foreground">{t('stateOfArt.import.hint')}</p>
            <label htmlFor="bib-import-text" className="sr-only">{t('stateOfArt.import.textLabel')}</label>
            <textarea
                id="bib-import-text"
                className={campo}
                rows={5}
                value={texto}
                placeholder={t('stateOfArt.import.placeholder')}
                onChange={e => setTexto(e.target.value)}
            />
            {imagen && (
                <p className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />{imagen.name}
                    <button type="button" onClick={() => setImagen(null)} aria-label={t('stateOfArt.import.removeImage')} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent focus-within:ring-2 focus-within:ring-primary/40">
                    <FileUp className="h-3.5 w-3.5" />{t('stateOfArt.import.upload')}
                    <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={e => { void tomarArchivo(e.target.files?.[0]); e.target.value = ''; }}
                    />
                </label>
                <Button size="sm" onClick={() => leer.mutate()} disabled={!hayAlgo || ocupado}>
                    {ocupado && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t(leyendoPdf ? 'stateOfArt.import.readingPdf' : 'stateOfArt.import.read')}
                </Button>
                <span className="text-[11px] text-muted-foreground">{t('stateOfArt.import.cost')}</span>
                {texto.length > MAX_BIBLIOGRAPHY_TEXT_CHARS && (
                    <span className="text-[11px] text-warning-subtle-foreground">{t('stateOfArt.import.textTruncated', { max: MAX_BIBLIOGRAPHY_TEXT_CHARS.toLocaleString() })}</span>
                )}
            </div>
        </section>
    );
}
