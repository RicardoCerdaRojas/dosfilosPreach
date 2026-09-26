import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import {
    clipRangesTo,
    countChars,
    countSheets,
    normalizeSheetRanges,
    printedPageFor,
    type PageIndexEntry,
    type SheetRange,
    type LemmaPageProposal,
    type PassagePageHit,
    type PageNumbering,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { PanelGroup } from '@/components/ui/PanelGroup';
import { PanelDivider } from '@/components/ui/PanelDivider';
import { useDocumentPdfUrl } from '@/hooks/exegesis/useDocumentPageIndex';
import { PageRail, sheetsInRanges } from './PageRail';
import { PdfPageViewer } from './PdfPageViewer';
import { SelectionCart } from './SelectionCart';
import { LemmaPagesPanel } from './LemmaPagesPanel';
import { PassagePagesPanel } from './PassagePagesPanel';

/**
 * Los tres paneles del selector: índice, hoja y carrito.
 *
 * La propuesta del sistema llega DESPUÉS del primer render —hay que leer el
 * índice del libro y resolver la sección del pasaje—, así que el carrito y la
 * hoja visible no se pueden fijar en el estado inicial. La primera versión lo
 * hacía y el resultado era el peor posible: el aviso decía «encontramos la
 * sección» mientras el carrito mostraba «nada elegido» y el visor abría en la
 * portada.
 *
 * Se adopta una sola vez, cuando llega, y solo si el usuario no tocó nada.
 */

interface Props {
    pages: ReadonlyArray<PageIndexEntry>;
    printedPageOffset: number | null;
    resourceId: string;
    proposedRanges: ReadonlyArray<SheetRange>;
    proposalKind: 'structural' | 'semantic' | 'none';
    /** La propuesta todavía se está calculando. */
    proposalPending: boolean;
    /** Selección guardada, cuando la fuente ya pasó por el selector. */
    initialRanges: ReadonlyArray<SheetRange>;
    /** Tramos ya marcados como «siempre incluir». */
    initialPinned: ReadonlyArray<SheetRange>;
    otherSourcesChars: number;
    onConfirm: (ranges: ReadonlyArray<SheetRange>, pinned: ReadonlyArray<SheetRange>) => Promise<void>;
    isSaving: boolean;
    /**
     * Dónde vive cada lema del pasaje dentro de ESTE libro. Sólo llega
     * para los léxicos: en un comentario, un lema no tiene entrada propia.
     */
    lemmaProposals?: ReadonlyArray<LemmaPageProposal>;
    lemmaLoading?: boolean;
    /**
     * Las páginas donde ESTE libro nombra el pasaje del trabajo.
     *
     * Va para toda fuente y no sólo para las que quedaron sin fragmentos:
     * Wallace tenía trece y le faltaban justo las dos que contestaban la
     * pregunta difícil del trabajo.
     */
    passageProposals?: ReadonlyArray<PassagePageHit>;
    passageLoading?: boolean;
    /** Numeración confirmada del libro, para nombrar las hojas por su folio. */
    numbering?: PageNumbering | null;
}

export function SourcePagesWorkspace({
    pages,
    printedPageOffset,
    resourceId,
    proposedRanges,
    proposalKind,
    proposalPending,
    initialRanges,
    initialPinned,
    otherSourcesChars,
    onConfirm,
    isSaving,
    lemmaProposals,
    lemmaLoading = false,
    passageProposals,
    passageLoading = false,
    numbering = null,
}: Props) {
    const { t } = useTranslation('exegesis');
    const pdf = useDocumentPdfUrl(resourceId);

    const [ranges, setRanges] = useState<SheetRange[]>(() => normalizeSheetRanges(initialRanges));
    const [currentSheet, setCurrentSheet] = useState<number>(
        () => initialRanges[0]?.start ?? pages[0]?.sheet ?? 1,
    );
    // El usuario mandó: una vez que tocó algo, la propuesta que llegue tarde no
    // le pisa la selección ni le mueve la hoja de abajo del cursor.
    const touched = useRef(false);
    const adopted = useRef(false);

    /**
     * Hoja desde la que se está tendiendo un rango. Mientras hay ancla, tocar
     * otra hoja cierra el tramo entre las dos en vez de alternar una sola.
     */
    const [anchor, setAnchor] = useState<number | null>(null);

    /**
     * Última hoja que el usuario tocó. Es el otro extremo del rango cuando
     * elige con Shift, la convención de cualquier lista: tocar una, y con Shift
     * tocar otra para llevarse todo lo que hay en medio.
     */
    const lastPicked = useRef<number | null>(null);

    // Anchos de panel. El índice del libro es lo que más varía de documento a
    // documento —un comentario con títulos largos pide más que uno sin
    // encabezados— así que el usuario lo ajusta.
    const [pinned, setPinned] = useState<SheetRange[]>(() => normalizeSheetRanges(initialPinned));
    const [railWidth, setRailWidth] = useState(280);
    const [railOpen, setRailOpen] = useState(true);
    const [cartWidth, setCartWidth] = useState(320);

    useEffect(() => {
        if (adopted.current || touched.current) return;
        if (proposalPending || proposedRanges.length === 0) return;
        adopted.current = true;
        // Solo se adopta si la fuente no traía una selección guardada: esa es
        // del usuario y pesa más que cualquier sugerencia.
        if (initialRanges.length === 0) {
            setRanges(normalizeSheetRanges(proposedRanges));
        }
        setCurrentSheet(proposedRanges[0]!.start);
    }, [proposalPending, proposedRanges, initialRanges]);

    // Con índice cargado y sin propuesta ni selección previa, se arranca en la
    // primera hoja que exista, no en la 1 — un documento puede empezar en otra.
    useEffect(() => {
        if (touched.current || adopted.current) return;
        if (pages.length === 0) return;
        setCurrentSheet(prev => (pages.some(p => p.sheet === prev) ? prev : pages[0]!.sheet));
    }, [pages]);

    const selectedSheets = useMemo(() => sheetsInRanges(ranges), [ranges]);
    const proposedSheets = useMemo(() => sheetsInRanges(proposedRanges), [proposedRanges]);
    const selectedChars = useMemo(() => countChars(pages, ranges), [pages, ranges]);
    // Lo fijado se recorta a lo elegido: quitar una hoja marcada no puede dejar
    // el medidor contando material que la fuente ya no declara.
    const effectivePinned = useMemo(() => clipRangesTo(pinned, ranges), [pinned, ranges]);
    const pinnedChars = useMemo(() => countChars(pages, effectivePinned), [pages, effectivePinned]);
    const sheetCount = useMemo(() => countSheets(ranges), [ranges]);

    const rebuild = (mutate: (sheets: Set<number>) => void) => {
        touched.current = true;
        setRanges(prev => {
            const sheets = sheetsInRanges(prev);
            mutate(sheets);
            return normalizeSheetRanges(
                [...sheets].sort((a, b) => a - b).map(s => ({ start: s, end: s })),
            );
        });
    };

    const toggleSheet = useCallback((sheet: number) => {
        rebuild(sheets => { if (sheets.has(sheet)) sheets.delete(sheet); else sheets.add(sheet); });
    }, []);

    /**
     * Agrega una hoja propuesta para un lema y va a verla.
     *
     * Se muestra la hoja porque la propuesta es literal: dice dónde
     * aparece la palabra, no que ahí esté su entrada. Quien decide es
     * quien firma el trabajo, y para decidir hay que mirar.
     */
    const addLemmaSheet = useCallback((sheet: number) => {
        rebuild(sheets => sheets.add(sheet));
        setCurrentSheet(sheet);
    }, []);

    const addLemmaSheets = useCallback((hojas: ReadonlyArray<number>) => {
        rebuild(sheets => { for (const h of hojas) sheets.add(h); });
        if (hojas[0]) setCurrentSheet(hojas[0]);
    }, []);

    /**
     * Agrega el tramo entre el ancla y esta hoja, ambos inclusive.
     *
     * Recorre el ÍNDICE y no los números: un documento puede saltear hojas, y
     * tender el rango sobre los números incluiría hojas que no existen.
     */
    /** Agrega el tramo entre dos hojas, ambas inclusive. */
    const addSpan = useCallback((from: number, to: number) => {
        const a = pages.findIndex(p => p.sheet === from);
        const b = pages.findIndex(p => p.sheet === to);
        if (a < 0 || b < 0) return;
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        rebuild(sheets => { for (let i = lo; i <= hi; i++) sheets.add(pages[i]!.sheet); });
        lastPicked.current = to;
    }, [pages]);

    const closeRangeAt = useCallback((sheet: number) => {
        const from = anchor;
        setAnchor(null);
        if (from === null) return;
        addSpan(from, sheet);
    }, [anchor, addSpan]);

    /**
     * Un toque en el riel. Tres caminos hacia lo mismo, porque el usuario llega
     * por donde le resulta natural:
     *   - con un rango abierto por el botón, lo cierra acá;
     *   - con Shift, tiende el rango desde la última hoja que tocó;
     *   - solo, alterna esta hoja.
     */
    const pickSheet = useCallback((sheet: number, extend = false) => {
        if (anchor !== null) { closeRangeAt(sheet); return; }
        if (extend && lastPicked.current !== null && lastPicked.current !== sheet) {
            addSpan(lastPicked.current, sheet);
            return;
        }
        toggleSheet(sheet);
        lastPicked.current = sheet;
    }, [anchor, closeRangeAt, addSpan, toggleSheet]);

    const removeRange = useCallback((range: SheetRange) => {
        rebuild(sheets => { for (let s = range.start; s <= range.end; s++) sheets.delete(s); });
    }, []);

    const togglePinned = useCallback((range: SheetRange) => {
        setPinned(prev => {
            const already = prev.some(p => p.start === range.start && p.end === range.end);
            return already
                ? prev.filter(p => !(p.start === range.start && p.end === range.end))
                : normalizeSheetRanges([...prev, range]);
        });
    }, []);

    const acceptProposal = useCallback(() => {
        touched.current = true;
        setAnchor(null);
        setRanges(prev => normalizeSheetRanges([...prev, ...proposedRanges]));
        if (proposedRanges[0]) setCurrentSheet(proposedRanges[0].start);
    }, [proposedRanges]);

    // Navegar por hojas que EXISTEN en el índice: un documento puede saltear
    // números cuando una página no produjo texto.
    const step = useCallback((delta: number) => {
        touched.current = true;
        setCurrentSheet(prev => {
            const i = pages.findIndex(p => p.sheet === prev);
            if (i < 0) return pages[0]?.sheet ?? prev;
            const next = pages[Math.min(Math.max(i + delta, 0), pages.length - 1)]?.sheet ?? prev;
            // Navegar también ancla: el usuario puede llegar al inicio del tramo
            // con las flechas y cerrar con Shift desde el índice.
            lastPicked.current = next;
            return next;
        });
    }, [pages]);

    /**
     * Un toque en la fila del índice.
     *
     * Sin Shift: lleva el visor a esa hoja y DEJA EL ANCLAJE ahí. Que un clic
     * simple ancle es lo que hace funcionar la convención de cualquier lista —
     * tocar una fila, ir al final, Shift + clic para llevarse todo lo del
     * medio. Sin anclar, el Shift posterior no tiene desde dónde tender y
     * termina alternando una sola hoja, que fue justo lo que pasaba.
     *
     * Con Shift: cierra el tramo desde la hoja anclada. Da igual el orden —
     * `addSpan` ordena por posición en el índice, así que se puede empezar por
     * la mayor y terminar en la menor.
     */
    const goToSheet = useCallback((sheet: number, extend = false) => {
        touched.current = true;
        setCurrentSheet(sheet);
        if (extend) { pickSheet(sheet, true); return; }
        lastPicked.current = sheet;
    }, [pickSheet]);

    const printedCurrent = printedPageFor(currentSheet, printedPageOffset);
    const isCurrentSelected = selectedSheets.has(currentSheet);

    return (
        <>
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-info-subtle px-5 py-2.5">
                {proposalPending ? (
                    <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-info-subtle-foreground shrink-0" aria-hidden="true" />
                        <p className="text-xs text-info-subtle-foreground">
                            {t('paperSetup.subSteps.corpus.picker.proposal.pending')}
                        </p>
                    </>
                ) : proposedRanges.length === 0 ? (
                    <p className="text-xs text-info-subtle-foreground">
                        {t('paperSetup.subSteps.corpus.picker.proposal.none')}
                    </p>
                ) : (
                    <>
                        <Sparkles className="h-3.5 w-3.5 text-info-subtle-foreground shrink-0" aria-hidden="true" />
                        <p className="flex-1 min-w-[220px] text-xs text-info-subtle-foreground">
                            {proposalKind === 'structural'
                                ? t('paperSetup.subSteps.corpus.picker.proposal.structural')
                                : t('paperSetup.subSteps.corpus.picker.proposal.semantic')}
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={acceptProposal}>
                            {t('paperSetup.subSteps.corpus.picker.proposal.accept')}
                        </Button>
                    </>
                )}
            </div>

            <PanelGroup className="m-3 min-h-0 flex-1">
                {railOpen && (
                    <div
                        className="hidden min-w-0 shrink-0 lg:flex"
                        style={{ width: `${railWidth}px` }}
                    >
                        <PageRail
                            pages={pages}
                            printedPageOffset={printedPageOffset}
                            selected={selectedSheets}
                            proposed={proposedSheets}
                            anchor={anchor}
                            currentSheet={currentSheet}
                            onGoToSheet={goToSheet}
                            onToggleSheet={pickSheet}
                        />
                    </div>
                )}
                {/* `flex` y no `block`: el divisor centra su chevron con `top-1/2`
                    relativo a sí mismo, y un envoltorio que no estire lo deja con
                    altura cero — el chevron termina pegado al borde de arriba. */}
                <div className="hidden lg:flex">
                    <PanelDivider
                        panelSide="left"
                        isOpen={railOpen}
                        onToggle={() => setRailOpen(v => !v)}
                        onResize={railOpen
                            ? (delta) => setRailWidth(w => Math.min(460, Math.max(200, w + delta)))
                            : undefined}
                        title={t('paperSetup.subSteps.corpus.picker.rail.resize')}
                    />
                </div>

                <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
                        <div className="flex items-center gap-1.5">
                            <Button
                                type="button" variant="outline" size="icon" className="h-7 w-7"
                                onClick={() => step(-1)}
                                aria-label={t('paperSetup.subSteps.corpus.picker.viewer.previous')}
                            >
                                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                                type="button" variant="outline" size="icon" className="h-7 w-7"
                                onClick={() => step(1)}
                                aria-label={t('paperSetup.subSteps.corpus.picker.viewer.next')}
                            >
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <span className="ml-1 text-xs font-semibold tabular-nums text-foreground">
                                {t('paperSetup.subSteps.corpus.picker.viewer.sheet', { sheet: currentSheet })}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                                {printedCurrent === null
                                    ? t('paperSetup.subSteps.corpus.picker.viewer.noPrinted')
                                    : t('paperSetup.subSteps.corpus.picker.viewer.printed', { printed: printedCurrent })}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button
                                type="button"
                                variant={anchor !== null ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => (anchor === null ? setAnchor(currentSheet) : closeRangeAt(currentSheet))}
                            >
                                {anchor === null
                                    ? t('paperSetup.subSteps.corpus.picker.viewer.startRange')
                                    : t('paperSetup.subSteps.corpus.picker.viewer.endRange', { sheet: anchor })}
                            </Button>
                            <Button
                                type="button"
                                variant={isCurrentSelected ? 'default' : 'outline'}
                                size="sm"
                                onClick={(e) => pickSheet(currentSheet, e.shiftKey)}
                            >
                                {isCurrentSelected
                                    ? t('paperSetup.subSteps.corpus.picker.viewer.removeSheet')
                                    : t('paperSetup.subSteps.corpus.picker.viewer.addSheet')}
                            </Button>
                        </div>
                    </div>

                    {anchor !== null && (
                        <p className="shrink-0 border-b border-border bg-primary/10 px-3 py-1.5 text-[11px] text-foreground">
                            {t('paperSetup.subSteps.corpus.picker.viewer.rangeHint', { sheet: anchor })}
                        </p>
                    )}

                    <div className="min-h-0 flex-1 overflow-hidden">
                        <PdfPageViewer
                            url={pdf.data?.url ?? null}
                            sheet={currentSheet}
                            selected={isCurrentSelected}
                        />
                    </div>
                </div>

                <PanelDivider
                    panelSide="right"
                    isOpen
                    onResize={(delta) => setCartWidth(w => Math.min(460, Math.max(260, w + delta)))}
                    title={t('paperSetup.subSteps.corpus.picker.cart.resize')}
                />
                <div className="flex flex-col gap-2 min-w-0 shrink-0 overflow-y-auto" style={{ width: `${cartWidth}px` }}>
                    {passageProposals && (
                        <PassagePagesPanel
                            proposals={passageProposals}
                            isLoading={passageLoading}
                            numbering={numbering}
                            selected={selectedSheets}
                            onAdd={addLemmaSheet}
                            onAddAll={addLemmaSheets}
                        />
                    )}
                    {lemmaProposals && (
                        <LemmaPagesPanel
                            proposals={lemmaProposals}
                            isLoading={lemmaLoading}
                            numbering={numbering}
                            selected={selectedSheets}
                            onAdd={addLemmaSheet}
                            onAddAll={addLemmaSheets}
                        />
                    )}
                    <SelectionCart
                        ranges={ranges}
                        pages={pages}
                        printedPageOffset={printedPageOffset}
                        otherSourcesChars={otherSourcesChars}
                        selectedChars={selectedChars}
                        sheetCount={sheetCount}
                        onRemoveRange={removeRange}
                        pinnedRanges={effectivePinned}
                        onTogglePinned={togglePinned}
                        pinnedChars={pinnedChars}
                        onConfirm={() => onConfirm(ranges, effectivePinned)}
                        isSaving={isSaving}
                    />
                </div>
            </PanelGroup>
        </>
    );
}
