import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { printedLabelForSheet, type PageIndexEntry, type PageNumbering, type SheetRange } from '@dosfilos/domain';

/**
 * Panel de navegación del documento.
 *
 * Cuando el documento trae encabezados muestra su índice real; cuando no —el
 * caso de la mayoría de la biblioteca— muestra el arranque del texto de cada
 * hoja. Se degrada, no desaparece: incluso sin un solo encabezado, la primera
 * línea alcanza para distinguir el prefacio del cuerpo del comentario.
 *
 * No es donde se decide. Sirve para llegar rápido a una hoja; la decisión se
 * toma mirando el PDF.
 */

interface Props {
    pages: ReadonlyArray<PageIndexEntry>;
    printedPageOffset: number | null;
    /** La numeración confirmada; manda sobre el desfase (`printedLabelForSheet`). */
    numbering: PageNumbering | null;
    selected: ReadonlySet<number>;
    proposed: ReadonlySet<number>;
    /** Hoja desde la que se está tendiendo un rango, si hay una. */
    anchor: number | null;
    currentSheet: number;
    onGoToSheet: (sheet: number, extend: boolean) => void;
    onToggleSheet: (sheet: number, extend: boolean) => void;
}

export function PageRail({
    pages,
    printedPageOffset,
    numbering,
    selected,
    proposed,
    anchor,
    currentSheet,
    onGoToSheet,
    onToggleSheet,
}: Props) {
    const { t } = useTranslation('exegesis');
    const listRef = useRef<HTMLDivElement>(null);
    const hasHeadings = pages.some(p => !!p.section);

    // Seguir la hoja que se está mirando: sin esto, navegar con el visor deja
    // el índice varias pantallas atrás y el usuario pierde el hilo.
    useEffect(() => {
        const el = listRef.current?.querySelector<HTMLElement>(`[data-sheet="${currentSheet}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [currentSheet]);

    return (
        <div className="flex w-full min-w-0 flex-col overflow-hidden border-r border-border">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {hasHeadings
                        ? t('paperSetup.subSteps.corpus.picker.rail.withHeadings')
                        : t('paperSetup.subSteps.corpus.picker.rail.withoutHeadings')}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                    {t('paperSetup.subSteps.corpus.picker.rail.sheetCount', { count: pages.length })}
                </span>
            </div>
            <div className="shrink-0 border-b border-border/60 px-3 py-1">
                <span className="text-[10px] text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.picker.rail.shiftHint')}
                </span>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                {pages.map(page => {
                    const isSelected = selected.has(page.sheet);
                    const isProposed = proposed.has(page.sheet);
                    const isCurrent = page.sheet === currentSheet;
                    const isAnchor = page.sheet === anchor;
                    const printed = printedLabelForSheet(page.sheet, numbering, printedPageOffset);

                    return (
                        <div
                            key={page.sheet}
                            data-sheet={page.sheet}
                            className={`relative flex min-w-0 items-start gap-2 border-b border-border/60 pl-3 pr-2 py-1.5 ${
                                isSelected ? 'bg-primary/10' : isCurrent ? 'bg-accent' : ''
                            } ${isAnchor ? 'ring-1 ring-inset ring-primary' : ''}`}
                        >
                            <span
                                aria-hidden="true"
                                className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                                    isSelected
                                        ? 'bg-primary'
                                        : isProposed
                                            ? 'bg-gradient-to-b from-info to-transparent opacity-70'
                                            : ''
                                }`}
                            />
                            <button
                                type="button"
                                onClick={(e) => onGoToSheet(page.sheet, e.shiftKey)}
                                className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                                aria-current={isCurrent ? 'true' : undefined}
                            >
                                <span className="flex items-baseline gap-1.5">
                                    <span className={`text-xs tabular-nums ${isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                                        {page.sheet}
                                    </span>
                                    {printed !== null && (
                                        <span className="text-[10px] tabular-nums text-muted-foreground/70">
                                            {t('paperSetup.subSteps.corpus.picker.rail.printedShort', { printed })}
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={`block truncate text-xs ${
                                        page.section ? 'text-foreground font-medium' : 'text-muted-foreground italic'
                                    }`}
                                >
                                    {page.section || page.firstLine}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => onToggleSheet(page.sheet, e.shiftKey)}
                                aria-pressed={isSelected}
                                aria-label={
                                    anchor !== null
                                        ? t('paperSetup.subSteps.corpus.picker.rail.endRange', { sheet: page.sheet })
                                        : isSelected
                                            ? t('paperSetup.subSteps.corpus.picker.rail.removeSheet', { sheet: page.sheet })
                                            : t('paperSetup.subSteps.corpus.picker.rail.addSheet', { sheet: page.sheet })
                                }
                                className={`shrink-0 mt-0.5 h-5 w-5 rounded border text-xs leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    isSelected
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border text-muted-foreground hover:bg-accent'
                                }`}
                            >
                                {anchor !== null ? '⇥' : isSelected ? '−' : '+'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Expande tramos a hojas sueltas, que es como los consultan los paneles. */
export function sheetsInRanges(ranges: ReadonlyArray<SheetRange>): Set<number> {
    const out = new Set<number>();
    for (const range of ranges) {
        for (let sheet = range.start; sheet <= range.end; sheet++) out.add(sheet);
    }
    return out;
}
