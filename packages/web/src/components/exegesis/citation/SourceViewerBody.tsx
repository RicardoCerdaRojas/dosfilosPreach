import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BookOpen, ClipboardCopy, Loader2, MessageCircleQuestion, Quote, SearchX, TextCursorInput, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { PdfPageViewer } from '@/components/exegesis/setup/page-picker/PdfPageViewer';
import { BookSearchResults } from './BookSearchResults';
import { CitationViewerToolbar, type SearchScope } from './CitationViewerToolbar';
import { IndiceDelLibro } from './IndiceDelLibro';
import { SubtituloDelLibro } from './SubtituloDelLibro';
import { useCitationSheet } from './useCitationSheet';
import { useDocumentTextSearch } from '@/hooks/exegesis/useDocumentTextSearch';
import type { CitationTarget, ViewedSheet } from './CitationSourceModal';
import { useCitationSink, type CitationSink } from './SourceViewerProvider';
import { citaParaInsertar } from './citarDesdeVisor';
import { PreguntarAlLibro } from '@/components/library/consulta/PreguntarAlLibro';
import { etiquetaDeFuente } from '@/components/library/consulta/etiquetaDeFuente';
import { useFirebase } from '@/context/firebase-context';

/**
 * El libro abierto: encabezado, barra (hojear, ir a página, buscar, zoom),
 * resultados de la búsqueda en el libro y la hoja.
 *
 * Es el cuerpo de las dos maneras de mostrar una fuente: el panel lateral,
 * que deja el texto del trabajo a la vista para citar mientras se escribe, y
 * la ventana ampliada, para leer. Antes vivía sólo dentro del modal de las
 * citas del análisis, y el resto de la aplicación abría el PDF suelto en otra
 * pestaña: en el TP #7 el fundador terminó buscando «tautologous» a mano en un
 * lector externo para comprobar dos citas (fase F).
 */
export interface SourceViewerBodyProps {
    /** `null` en la Biblioteca: el libro se abre sin trabajo. */
    paperId: string | null;
    target: CitationTarget | null;
    open: boolean;
    layout: 'panel' | 'full';
    /** Botones del encabezado que pone quien lo muestra (ampliar, cerrar). */
    actions?: ReactNode;
    /** El título accesible: el modal lo envuelve en su `DialogTitle`. */
    renderTitle?: (title: ReactNode) => ReactNode;
    /** Panel a la derecha de la hoja (la revisión de una cita). */
    aside?: (viewed: ViewedSheet) => ReactNode;
}

export function SourceViewerBody({ paperId, target, open, layout, actions, renderTitle, aside }: SourceViewerBodyProps) {
    const { t } = useTranslation('exegesis');
    const [quoteFound, setQuoteFound] = useState<boolean | null>(null);
    const [zoom, setZoom] = useState<number>(1);
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<SearchScope>('sheet');
    const [matches, setMatches] = useState(0);
    const [seleccion, setSeleccion] = useState<string | null>(null);
    // «Preguntar a este libro» (fase «biblioteca consultable», U4): una columna
    // a la derecha de la hoja; el índice queda a la izquierda.
    const [preguntando, setPreguntando] = useState(false);
    const { t: tl } = useTranslation('library');
    const { user } = useFirebase();
    const sink = useCitationSink();
    const view = useCitationSheet(paperId, target, open);
    const bookSearch = useDocumentTextSearch(view.resourceId, search, open && scope === 'book');

    // Cada destino nuevo vuelve a empezar: sin esto el visor heredaría el
    // veredicto del anterior y diría «no la encontré» sobre una frase que
    // todavía no buscó.
    useEffect(() => {
        setQuoteFound(null);
        setZoom(1);
        setSearch('');
        setScope('sheet');
        setMatches(0);
        setSeleccion(null);
        setPreguntando(false);
    }, [target?.sourceKey, target?.resourceId, target?.page, target?.verbatimQuote, target?.openAt?.page]);

    // Las flechas hojean, salvo cuando el lector está escribiendo.
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); view.goTo(view.viewSheet - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); view.goTo(view.viewSheet + 1); }
    };

    const hasDocument = !!view.resourceId;
    const hasQuote = !!target?.verbatimQuote?.trim();
    // Abierto por recurso es el libro, no una cita: no hay página citada que
    // comparar ni frase que buscar.
    const isCitation = !target?.resourceId;
    const viewed: ViewedSheet = { sheet: view.viewSheet, printed: view.printedOfView, isAnchor: view.viewSheet === view.anchorSheet };
    const showResults = hasDocument && scope === 'book' && search.trim().length >= 2;
    // Sólo en libros PROPIOS: la consulta busca en la biblioteca del usuario, y
    // en un libro del corpus o de otro respondería siempre «no encontré nada»
    // (revisión adversarial, U4).
    const puedePreguntar = layout === 'full' && hasDocument && !!view.resourceId && !!user?.uid && view.ownerId === user.uid;
    const results = showResults && (
        <BookSearchResults
            hits={bookSearch.data?.hits ?? []}
            truncated={bookSearch.data?.truncated ?? false}
            isLoading={bookSearch.isLoading}
            isError={bookSearch.isError}
            printedOf={view.printedOf}
            currentSheet={view.viewSheet}
            onGo={view.goTo}
            layout={layout === 'full' ? 'column' : 'strip'}
        />
    );
    const title = (
        <span className="inline-flex items-center gap-2 text-base font-semibold">
            <BookOpen className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate">{view.label}</span>
        </span>
    );

    return (
        <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown} data-testid="source-viewer">
            {/* Ampliado, el modal pone su propia X arriba a la derecha: se le
                deja lugar para que no tape «Volver al panel». */}
            <div className={cn('flex items-start gap-3 border-b border-border px-5 py-3', layout === 'full' && 'pr-14')}>
                <div className="min-w-0 flex-1 space-y-1">
                    {renderTitle ? renderTitle(title) : <h2 className="m-0">{title}</h2>}
                    <SubtituloDelLibro label={view.label} title={view.bookTitle} author={view.author} />
                    <p className="text-xs text-muted-foreground">
                        {viewed.printed !== null
                            ? t('citationViewer.pageWithSheet', { printed: viewed.printed, sheet: viewed.sheet })
                            : t('citationViewer.sheetOnly', { sheet: viewed.sheet })}
                        {!viewed.isAnchor && isCitation && ` · ${t('citationViewer.awayFromCited', { page: target?.page ?? '' })}`}
                    </p>
                    <StatusLine hasDocument={hasDocument} hasQuote={hasQuote} quoteFound={quoteFound} quote={target?.verbatimQuote ?? ''} isCitation={isCitation} />
                </div>
                {(actions || puedePreguntar) && (
                    <div className="flex shrink-0 items-center gap-1.5">
                        {puedePreguntar && (
                            <button
                                type="button"
                                onClick={() => setPreguntando(p => !p)}
                                aria-pressed={preguntando}
                                className={cn(
                                    'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    preguntando ? 'border-primary bg-primary-solid text-primary-foreground' : 'border-border text-foreground hover:bg-muted',
                                )}
                                data-testid="preguntar-a-este-libro"
                            >
                                <MessageCircleQuestion className="h-4 w-4" />
                                {tl('consult.askThisBook')}
                            </button>
                        )}
                        {actions}
                    </div>
                )}
            </div>

            {hasDocument && (
                <CitationViewerToolbar
                    viewSheet={view.viewSheet}
                    totalSheets={view.totalSheets}
                    onGo={view.goTo}
                    numbering={view.numbering}
                    printedPageOffset={view.printedPageOffset}
                    search={search}
                    onSearch={setSearch}
                    scope={scope}
                    onScope={setScope}
                    matches={matches}
                    zoom={zoom}
                    onZoom={setZoom}
                />
            )}

            {layout === 'panel' && results}

            <div className={cn('flex-1 min-h-0 flex', layout === 'full' ? 'flex-col md:flex-row' : 'flex-col')}>
                {/* Ampliado, a la izquierda: los resultados si se está buscando en
                    el libro; si no, el índice para ir a cualquier hoja. */}
                {layout === 'full' && (results || (hasDocument && !view.loading && (
                    <IndiceDelLibro pages={view.pages} printedOf={view.printedOf} currentSheet={view.viewSheet} onGo={view.goTo} />
                )))}
                <div className="flex-1 min-h-0 min-w-0 bg-muted/30">
                    {!hasDocument ? (
                        <Centered icon={<SearchX className="h-5 w-5 text-warning" />}>
                            {t('citationViewer.sourceNotConfigured', { key: target?.sourceKey ?? '' })}
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
                            highlightQuote={target?.verbatimQuote ?? null}
                            onHighlightResolved={setQuoteFound}
                            zoom={zoom === 1 ? 'fit' : zoom}
                            searchTerm={search.trim() || null}
                            onSearchMatches={setMatches}
                            selectable
                            onTextSelected={setSeleccion}
                        />
                    )}
                </div>
                {/* A la DERECHA de la hoja: el índice (o los resultados) sigue a
                    la izquierda, para hojear mientras se lee la respuesta
                    (pedido del fundador al probarlo, 2026-10-15). Montado
                    mientras se pueda preguntar: apagarlo no borra la conversación. */}
                {puedePreguntar && view.resourceId && (
                    <div className={cn('min-h-0 max-h-[45vh] md:max-h-none md:w-96 md:shrink-0 flex-col border-t md:border-t-0 md:border-l border-border bg-card/40', preguntando ? 'flex' : 'hidden')}>
                        <PreguntarAlLibro
                            resourceId={view.resourceId}
                            etiquetar={f => etiquetaDeFuente(f, { clave: view.citationKey, title: view.label, pageNumbering: view.numbering })}
                            onIrAHoja={view.goTo}
                            hojaActual={view.viewSheet}
                            paginaImpresa={view.printedOf}
                        />
                    </div>
                )}
                {aside && (
                    <aside className="md:w-[380px] md:max-w-[40vw] shrink-0 max-h-[40vh] md:max-h-none overflow-y-auto border-t md:border-t-0 md:border-l border-border bg-background p-4">
                        {aside(viewed)}
                    </aside>
                )}
            </div>
            {hasDocument && !view.loading && view.citationKey && (
                <CitarBarra
                    cita={citaParaInsertar(view.citationKey, view.anchorFor(view.viewSheet))}
                    frase={seleccion}
                    sink={sink}
                    onLimpiar={() => { setSeleccion(null); window.getSelection()?.removeAllRanges(); }}
                />
            )}
        </div>
    );
}

/**
 * Qué esperar de la página que se está abriendo.
 *
 * Los casos son distintos y confundirlos deja al lector buscando una marca
 * que no existe: la cita se resaltó, la cita existe pero no se pudo localizar
 * —OCR ilegible, corriente en documentos escaneados—, el análisis nunca
 * guardó una frase y sólo hay página, o no es una cita sino el libro abierto.
 */
function StatusLine({ hasDocument, hasQuote, quoteFound, quote, isCitation }: {
    hasDocument: boolean;
    hasQuote: boolean;
    quoteFound: boolean | null;
    quote: string;
    isCitation: boolean;
}) {
    const { t } = useTranslation('exegesis');
    if (!hasDocument || !isCitation) return null;

    if (!hasQuote) {
        return <p className="text-[11px] text-muted-foreground pt-0.5">{t('citationViewer.noQuoteRecorded')}</p>;
    }
    if (quoteFound === false) {
        return <p className="text-[11px] text-warning pt-0.5">{t('citationViewer.quoteNotFound')}</p>;
    }
    return <p className="text-[11px] text-muted-foreground pt-0.5 line-clamp-2 italic">«{quote}»</p>;
}

function Centered({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            {icon}
            <p className="text-sm text-muted-foreground max-w-md">{children}</p>
        </div>
    );
}

/**
 * Citar la hoja que se mira (fase F, F2). Con un editor abierto, la cita se
 * inserta donde está su cursor; sin ninguno, se copia. Con una frase
 * seleccionada, además se puede citar textual: «frase» (Clave, p. N).
 */
function CitarBarra({ cita, frase, sink, onLimpiar }: { cita: string; frase: string | null; sink: CitationSink | null; onLimpiar: () => void }) {
    const { t } = useTranslation('exegesis');
    const conFrase = frase ? `«${frase}» ${cita}` : null;

    const insertar = (texto: string) => {
        if (!sink) return;
        sink.insert(texto);
        toast.success(t('sourceViewer.inserted', { label: sink.label }));
    };
    const copiar = async (texto: string) => {
        try {
            await navigator.clipboard.writeText(texto);
            toast.success(t('sourceViewer.copied'));
        } catch {
            toast.error(t('sourceViewer.copyFailed'));
        }
    };

    return (
        <div className="border-t border-border bg-card px-5 py-3 space-y-2 print:hidden" data-testid="citar-barra">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                    {frase ? t('sourceViewer.selectionHint') : t('sourceViewer.pageHint')}
                </span>
                <span className="font-serif text-sm font-semibold text-foreground" data-testid="cita-armada">{cita}</span>
            </div>
            {frase && (
                <div className="flex items-start gap-2">
                    <p className="m-0 flex-1 text-xs italic text-muted-foreground line-clamp-2">«{frase}»</p>
                    {/* Si se seleccionó mal, se descarta la frase y vuelve la cita de la página. */}
                    <button type="button" onClick={onLimpiar} aria-label={t('sourceViewer.clearSelection')} title={t('sourceViewer.clearSelection')}
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <X className="h-3.5 w-3.5" aria-hidden="true" />{t('sourceViewer.clear')}
                    </button>
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                {sink ? (
                    <button type="button" onClick={() => insertar(cita)} className={PRIMARIO}>
                        <TextCursorInput className="h-4 w-4" aria-hidden="true" />{t('sourceViewer.citeHere')}
                    </button>
                ) : (
                    <button type="button" onClick={() => void copiar(cita)} className={PRIMARIO}>
                        <ClipboardCopy className="h-4 w-4" aria-hidden="true" />{t('sourceViewer.copyCitation')}
                    </button>
                )}
                {conFrase && (
                    <button type="button" onClick={() => (sink ? insertar(conFrase) : void copiar(conFrase))} className={SECUNDARIO}>
                        <Quote className="h-4 w-4" aria-hidden="true" />{t('sourceViewer.withQuote')}
                    </button>
                )}
                {sink && (
                    <button type="button" onClick={() => void copiar(cita)} className={SECUNDARIO}>
                        <ClipboardCopy className="h-4 w-4" aria-hidden="true" />{t('sourceViewer.copy')}
                    </button>
                )}
            </div>
            <p className="m-0 text-[11px] text-muted-foreground">
                {sink ? t('sourceViewer.insertsInto', { label: sink.label }) : t('sourceViewer.noEditor')}
            </p>
        </div>
    );
}

const PRIMARIO = 'inline-flex h-10 items-center gap-2 rounded-lg bg-primary-solid px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const SECUNDARIO = 'inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
