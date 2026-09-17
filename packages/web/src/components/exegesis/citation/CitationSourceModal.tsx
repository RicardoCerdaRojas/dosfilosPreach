import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Search, SearchX, ZoomIn, ZoomOut } from 'lucide-react';
import {
    isCitableSourceType,
    printedLabelIn,
    printedPageFor,
    sheetForPrintedIn,
    sheetForPrintedPage,
    type CitationPageKind,
} from '@dosfilos/domain';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useDocumentPageIndex, useDocumentPdfUrl } from '@/hooks/exegesis/useDocumentPageIndex';
import { usePageNumbering } from '@/hooks/library/usePageNumbering';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import { PdfPageViewer } from '@/components/exegesis/setup/page-picker/PdfPageViewer';

/**
 * La página del libro detrás de una cita, con la frase señalada.
 *
 * Existe porque comprobar una cita costaba cinco pasos —ir a la
 * biblioteca, buscar el libro, abrirlo, buscar la página, buscar la
 * frase— y nadie los da por costumbre. Por eso una atribución invertida a
 * un diccionario teológico sobrevivió meses en un paper: era verificable
 * en teoría y nadie la verificaba.
 *
 * El número de una cita es la HOJA FÍSICA, no la página impresa. Viene de
 * `anchorFor`, que rotula `p. ${chunk.sheet}` sobre el número de hoja del
 * fragmento recuperado. Así que el visor abre esa hoja directamente y
 * NO convierte — convertir movería la cita de sitio.
 *
 * Lo que sí muestra, cuando el documento lo permite, es la página que ese
 * pliego lleva impresa. Es lo único que deja al lector cruzar entre lo que
 * ve en pantalla y lo que dice el libro: en el comentario de Adamson la
 * hoja 57 lleva impreso el 53, y sin decirlo el lector cree estar en una
 * página que no es.
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

export interface CitationSourceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId: string;
    citation: CitationTarget | null;
}

export function CitationSourceModal({
    open,
    onOpenChange,
    paperId,
    citation,
}: CitationSourceModalProps) {
    const { t } = useTranslation('exegesis');
    const [quoteFound, setQuoteFound] = useState<boolean | null>(null);
    const [zoom, setZoom] = useState<number>(1);
    const [search, setSearch] = useState('');
    const [matches, setMatches] = useState(0);
    // Ya está en caché: la página del trabajo la pidió al montarse, así
    // que resolverla acá no agrega lecturas y evita arrastrar el paper
    // por props hasta cada tarjeta.
    const { paper } = useExegesisPaper(paperId);

    const source = useMemo(() => {
        if (!citation || !paper) return null;
        return paper.sources.find(s =>
            isCitableSourceType(s.sourceType)
            && (s.citationKey ?? s.displayLabel) === citation.sourceKey) ?? null;
    }, [paper, citation]);

    const resourceId = source?.sourceLibraryResourceId ?? source?.corpusId ?? null;
    const index = useDocumentPageIndex(open ? resourceId : null);
    const pdf = useDocumentPdfUrl(open ? resourceId : null);

    const numberingState = usePageNumbering(open ? resourceId : null);
    const numbering = numberingState.data?.numbering ?? null;
    const offset = index.data?.printedPageOffset ?? null;
    // Una cita en página impresa se lleva a la hoja con la calibración
    // confirmada; si no la hay, con el desfase detectado; y si tampoco, se
    // abre el número como hoja, que es lo que había.
    const sheet = citation
        ? (citation.pageKind === 'printed'
            ? sheetForPrintedIn(numbering, citation.page) ?? sheetForPrintedPage(citation.page, offset) ?? citation.page
            : citation.page)
        : 1;
    // Sólo informativo: qué número lleva impreso esa hoja, para que el
    // lector pueda buscarla en el libro de papel.
    const printed = numbering ? printedLabelIn(numbering, sheet) : printedPageFor(sheet, offset);

    // Cada cita nueva vuelve a empezar: sin esto el modal heredaría el
    // veredicto de la anterior y diría «no la encontré» sobre una frase
    // que todavía no buscó.
    useEffect(() => {
        setQuoteFound(null);
        setZoom(1);
        setSearch('');
        setMatches(0);
    }, [citation?.sourceKey, citation?.page, citation?.verbatimQuote]);

    const hasQuote = !!citation?.verbatimQuote?.trim();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-none w-[95vw] h-[92vh] p-0 flex flex-col gap-0">
                <DialogHeader className="px-6 py-4 border-b border-border space-y-1">
                    <DialogTitle className="inline-flex items-center gap-2 text-base">
                        <BookOpen className="h-4 w-4 text-primary shrink-0" />
                        {source?.displayLabel ?? citation?.sourceKey ?? ''}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {printed !== null
                            ? t('citationViewer.pageWithSheet', { printed, sheet })
                            : t('citationViewer.sheetOnly', { sheet })}
                    </DialogDescription>
                    <StatusLine
                        hasSource={!!source}
                        hasQuote={hasQuote}
                        quoteFound={quoteFound}
                        quote={citation?.verbatimQuote ?? ''}
                    />
                </DialogHeader>

                {!!source && (
                    <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-card/60">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            <input
                                type="search"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('citationViewer.searchPlaceholder')}
                                aria-label={t('citationViewer.searchPlaceholder')}
                                className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                        {search.trim() && (
                            <span className="text-[11px] text-muted-foreground shrink-0">
                                {matches > 0
                                    ? t('citationViewer.searchMatches', { count: matches })
                                    : t('citationViewer.searchNoMatches')}
                            </span>
                        )}
                        <div className="ml-auto flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                                disabled={zoom <= 1}
                                title={t('citationViewer.zoomOut')}
                                aria-label={t('citationViewer.zoomOut')}
                                className="rounded-md border border-border p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                            >
                                <ZoomOut className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={() => setZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                                disabled={zoom >= 4}
                                title={t('citationViewer.zoomIn')}
                                aria-label={t('citationViewer.zoomIn')}
                                className="rounded-md border border-border p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                            >
                                <ZoomIn className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 min-h-0 bg-muted/30">
                    {!source ? (
                        <Centered icon={<SearchX className="h-5 w-5 text-warning" />}>
                            {t('citationViewer.sourceNotConfigured', { key: citation?.sourceKey ?? '' })}
                        </Centered>
                    ) : index.isLoading || pdf.isLoading || numberingState.isLoading ? (
                        <Centered icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                            {t('citationViewer.loading')}
                        </Centered>
                    ) : (
                        <PdfPageViewer
                            url={pdf.data?.url ?? null}
                            sheet={sheet}
                            selected={false}
                            highlightQuote={citation?.verbatimQuote ?? null}
                            onHighlightResolved={setQuoteFound}
                            zoom={zoom === 1 ? 'fit' : zoom}
                            searchTerm={search.trim() || null}
                            onSearchMatches={setMatches}
                        />
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
function StatusLine({
    hasSource,
    hasQuote,
    quoteFound,
    quote,
}: {
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

function Centered({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            {icon}
            <p className="text-sm text-muted-foreground max-w-md">{children}</p>
        </div>
    );
}
