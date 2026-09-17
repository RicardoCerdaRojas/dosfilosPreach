import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BookOpen, Loader2, SearchX } from 'lucide-react';
import type { CitationPageKind } from '@dosfilos/domain';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { PdfPageViewer } from '@/components/exegesis/setup/page-picker/PdfPageViewer';
import { CitationViewerToolbar } from './CitationViewerToolbar';
import { useCitationSheet } from './useCitationSheet';

/**
 * El libro detrás de una cita, abierto en la página citada y con la frase
 * señalada, con sitio para hojear y para el problema que se vino a
 * resolver.
 *
 * Existe porque comprobar una cita costaba cinco pasos —ir a la
 * biblioteca, buscar el libro, abrirlo, buscar la página, buscar la
 * frase— y nadie los da por costumbre. Por eso una atribución invertida a
 * un diccionario teológico sobrevivió meses en un paper: era verificable
 * en teoría y nadie la verificaba.
 *
 * La primera versión mostraba una sola hoja fija. Servía para confirmar
 * una cita buena y de nada para arreglar una mala: el verificador decía
 * «la p. 440 habla de Hifil, no de Polel» y el visor dejaba al lector en
 * la 440 sin poder ir a buscar el Polel ni ver, mientras leía, qué era lo
 * que buscaba. Por eso hojea, va a un folio, y admite un panel al lado
 * (`aside`) con el veredicto y la revisión.
 */
export interface CitationTarget {
    /** Clave de cita tal como aparece en el análisis, p. ej. "Adamson". */
    sourceKey: string;
    /**
     * Número que declara la cita. Desde las citas ancladas es la PÁGINA
     * IMPRESA cuando `pageKind` es `'printed'`; si no, la hoja del archivo.
     */
    page: number;
    /**
     * Qué es `page`. Ausente = hoja, que es lo que decían todas las citas
     * antes de la calibración. Con `'printed'` el visor convierte a hoja
     * con la calibración confirmada del libro: en Waltke-O'Connor la p. 440
     * es la hoja 458, y abrir la hoja 440 (que imprime 422) mandaba al
     * lector a otro capítulo.
     */
    pageKind?: CitationPageKind;
    /** Frase textual registrada, cuando el análisis guardó una. */
    verbatimQuote?: string | null;
}

/** Lo que el visor sabe de la hoja que se está mirando, para quien la acompaña. */
export interface ViewedSheet {
    sheet: number;
    printed: string | number | null;
    /** Si es la hoja donde la cita dijo estar. */
    isAnchor: boolean;
}

export interface CitationSourceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId: string;
    citation: CitationTarget | null;
    /**
     * Panel a la derecha del libro: el problema de la cita y su revisión.
     * Recibe la hoja que se mira para que pueda proponer «está aquí».
     */
    aside?: (viewed: ViewedSheet) => ReactNode;
}

export function CitationSourceModal({ open, onOpenChange, paperId, citation, aside }: CitationSourceModalProps) {
    const { t } = useTranslation('exegesis');
    const [quoteFound, setQuoteFound] = useState<boolean | null>(null);
    const [zoom, setZoom] = useState<number>(1);
    const [search, setSearch] = useState('');
    const [matches, setMatches] = useState(0);
    const view = useCitationSheet(paperId, citation, open);

    // Cada cita nueva vuelve a empezar: sin esto el modal heredaría el
    // veredicto de la anterior y diría «no la encontré» sobre una frase
    // que todavía no buscó.
    useEffect(() => {
        setQuoteFound(null);
        setZoom(1);
        setSearch('');
        setMatches(0);
    }, [citation?.sourceKey, citation?.page, citation?.verbatimQuote]);

    // Las flechas hojean, salvo cuando el lector está escribiendo.
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); view.goTo(view.viewSheet - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); view.goTo(view.viewSheet + 1); }
    };

    const hasQuote = !!citation?.verbatimQuote?.trim();
    const viewed: ViewedSheet = { sheet: view.viewSheet, printed: view.printedOfView, isAnchor: view.viewSheet === view.anchorSheet };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-none w-[95vw] h-[92vh] p-0 flex flex-col gap-0" onKeyDown={onKeyDown}>
                <DialogHeader className="px-6 py-4 border-b border-border space-y-1">
                    <DialogTitle className="inline-flex items-center gap-2 text-base">
                        <BookOpen className="h-4 w-4 text-primary shrink-0" />
                        {view.source?.displayLabel ?? citation?.sourceKey ?? ''}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {viewed.printed !== null
                            ? t('citationViewer.pageWithSheet', { printed: viewed.printed, sheet: viewed.sheet })
                            : t('citationViewer.sheetOnly', { sheet: viewed.sheet })}
                        {!viewed.isAnchor && ` · ${t('citationViewer.awayFromCited', { page: citation?.page ?? '' })}`}
                    </DialogDescription>
                    <StatusLine
                        hasSource={!!view.source}
                        hasQuote={hasQuote}
                        quoteFound={quoteFound}
                        quote={citation?.verbatimQuote ?? ''}
                    />
                </DialogHeader>

                {!!view.source && (
                    <CitationViewerToolbar
                        viewSheet={view.viewSheet}
                        totalSheets={view.totalSheets}
                        onGo={view.goTo}
                        onGoToPageInput={view.goToPageInput}
                        search={search}
                        onSearch={setSearch}
                        matches={matches}
                        zoom={zoom}
                        onZoom={setZoom}
                    />
                )}

                <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                    <div className="flex-1 min-h-0 min-w-0 bg-muted/30">
                        {!view.source ? (
                            <Centered icon={<SearchX className="h-5 w-5 text-warning" />}>
                                {t('citationViewer.sourceNotConfigured', { key: citation?.sourceKey ?? '' })}
                            </Centered>
                        ) : view.loading ? (
                            <Centered icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                                {t('citationViewer.loading')}
                            </Centered>
                        ) : (
                            <PdfPageViewer
                                url={view.pdfUrl}
                                sheet={view.viewSheet}
                                selected={false}
                                highlightQuote={citation?.verbatimQuote ?? null}
                                onHighlightResolved={setQuoteFound}
                                zoom={zoom === 1 ? 'fit' : zoom}
                                searchTerm={search.trim() || null}
                                onSearchMatches={setMatches}
                            />
                        )}
                    </div>
                    {aside && (
                        <aside className="md:w-[380px] md:max-w-[40vw] shrink-0 max-h-[40vh] md:max-h-none overflow-y-auto border-t md:border-t-0 md:border-l border-border bg-background p-4">
                            {aside(viewed)}
                        </aside>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Qué esperar de la página que se está abriendo.
 *
 * Los tres casos son distintos y confundirlos deja al lector buscando una
 * marca que no existe: la cita se resaltó, la cita existe pero no se pudo
 * localizar —OCR ilegible, corriente en documentos escaneados—, o el
 * análisis nunca guardó una frase y sólo hay página.
 */
function StatusLine({ hasSource, hasQuote, quoteFound, quote }: {
    hasSource: boolean;
    hasQuote: boolean;
    quoteFound: boolean | null;
    quote: string;
}) {
    const { t } = useTranslation('exegesis');
    if (!hasSource) return null;

    if (!hasQuote) {
        return (
            <p className="text-[11px] text-muted-foreground pt-0.5">
                {t('citationViewer.noQuoteRecorded')}
            </p>
        );
    }
    if (quoteFound === false) {
        return (
            <p className="text-[11px] text-warning pt-0.5">
                {t('citationViewer.quoteNotFound')}
            </p>
        );
    }
    return (
        <p className="text-[11px] text-muted-foreground pt-0.5 line-clamp-2 italic">
            «{quote}»
        </p>
    );
}

function Centered({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            {icon}
            <p className="text-sm text-muted-foreground max-w-md">{children}</p>
        </div>
    );
}
