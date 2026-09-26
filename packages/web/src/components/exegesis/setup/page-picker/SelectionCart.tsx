import { useTranslation } from 'react-i18next';
import { Pin, PinOff, X } from 'lucide-react';
import { printedPageFor, sectionsCoveredBy, type SheetRange } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';

/**
 * Lo que va al trabajo, y cuánto del presupuesto ocupa.
 *
 * El medidor no es decoración. El proxy corta el prompt en 200.000 caracteres
 * para TODAS las fuentes juntas, y pasarse fue exactamente el bug que originó
 * este trabajo: una fuente entera se recortaba en silencio desde el principio
 * del libro. Verlo mientras se elige convierte una falla invisible en una
 * decisión informada.
 */

/** Tope de `prompt` del callable `runLlmPrompt`, para todas las fuentes juntas. */
const BUDGET_CHARS = 200_000;

interface Props {
    ranges: ReadonlyArray<SheetRange>;
    /**
     * El índice de secciones del libro, entero.
     *
     * Reemplaza a `pages`, que el carrito usaba sólo para rotular y que guarda
     * una sola sección por hoja —la que la ABRE—: por eso el rótulo del tramo
     * nombraba la sección que venía corriendo desde antes.
     */
    sections: ReadonlyArray<{ sheet: number; section: string | null }>;
    printedPageOffset: number | null;
    /** Caracteres que ya ocupan las otras fuentes del trabajo. */
    otherSourcesChars: number;
    selectedChars: number;
    sheetCount: number;
    onRemoveRange: (range: SheetRange) => void;
    /** Tramos marcados como «siempre incluir». */
    pinnedRanges: ReadonlyArray<SheetRange>;
    onTogglePinned: (range: SheetRange) => void;
    /** Caracteres que ocupan los tramos fijados. */
    pinnedChars: number;
    onConfirm: () => void;
    isSaving: boolean;
}

export function SelectionCart({
    ranges,
    sections,
    printedPageOffset,
    otherSourcesChars,
    selectedChars,
    sheetCount,
    onRemoveRange,
    pinnedRanges,
    onTogglePinned,
    pinnedChars,
    onConfirm,
    isSaving,
}: Props) {
    const { t } = useTranslation('exegesis');

    const totalChars = selectedChars + otherSourcesChars;
    const percent = Math.round((totalChars / BUDGET_CHARS) * 100);
    const overBudget = totalChars > BUDGET_CHARS;

    /** Un tramo está fijado cuando coincide exactamente con uno marcado. */
    const isPinned = (range: SheetRange): boolean =>
        pinnedRanges.some(p => p.start === range.start && p.end === range.end);

    /**
     * Qué secciones cubre el tramo.
     *
     * Antes se rotulaba con la sección de la PRIMERA hoja, y como el índice
     * por hoja guarda la que la ABRE, el rótulo nombraba la sección que venía
     * corriendo desde antes: el tramo 184–193 de Porter —participios— salía
     * como «2.1. Genitive Absolute», que empieza antes y termina ahí.
     *
     * Y el número dice tanto como el nombre: un tramo que cubre quince
     * secciones no es una elección quirúrgica, y nada lo decía.
     */
    const labelFor = (range: SheetRange): { text: string; covered: ReadonlyArray<string> } => {
        const covered = sectionsCoveredBy(sections, range);
        if (covered.length === 0) return { text: '', covered: [] };
        const first = covered[0]!.section;
        return {
            text: covered.length > 1
                ? t('paperSetup.subSteps.corpus.picker.cart.sectionsCovered', { section: first, count: covered.length })
                : first,
            covered: covered.map(c => c.section),
        };
    };

    const rangeLabel = (range: SheetRange): string => {
        const printedStart = printedPageFor(range.start, printedPageOffset);
        const printedEnd = printedPageFor(range.end, printedPageOffset);
        const base = range.start === range.end
            ? t('paperSetup.subSteps.corpus.picker.cart.sheetOne', { sheet: range.start })
            : t('paperSetup.subSteps.corpus.picker.cart.sheetRange', { start: range.start, end: range.end });
        if (printedStart === null) return base;
        const printed = range.start === range.end
            ? String(printedStart)
            : `${printedStart}–${printedEnd}`;
        return t('paperSetup.subSteps.corpus.picker.cart.withPrinted', { base, printed });
    };

    return (
        <div className="flex flex-col min-h-0 border-l border-border">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.picker.cart.title')}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                    {t('paperSetup.subSteps.corpus.picker.cart.rangeCount', { count: ranges.length })}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {ranges.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-muted-foreground">
                        {t('paperSetup.subSteps.corpus.picker.cart.empty')}
                    </p>
                ) : (
                    ranges.map(range => (
                        <div
                            key={`${range.start}-${range.end}`}
                            className="relative flex items-center justify-between gap-2 overflow-hidden rounded-md border border-border bg-card py-1.5 pl-3 pr-1"
                        >
                            <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                            <span className="min-w-0">
                                <span className="block text-xs font-semibold tabular-nums text-foreground">
                                    {rangeLabel(range)}
                                </span>
                                {(() => {
                                    const label = labelFor(range);
                                    if (!label.text) return null;
                                    return (
                                        <span
                                            className="block truncate text-[11px] text-muted-foreground"
                                            title={label.covered.join('\n')}
                                        >
                                            {label.text}
                                        </span>
                                    );
                                })()}
                            </span>
                            <button
                                type="button"
                                onClick={() => onTogglePinned(range)}
                                aria-pressed={isPinned(range)}
                                title={t('paperSetup.subSteps.corpus.picker.cart.pinHint')}
                                aria-label={isPinned(range)
                                    ? t('paperSetup.subSteps.corpus.picker.cart.unpin', { range: rangeLabel(range) })
                                    : t('paperSetup.subSteps.corpus.picker.cart.pin', { range: rangeLabel(range) })}
                                className={`shrink-0 rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    isPinned(range)
                                        ? 'text-info-subtle-foreground bg-info-subtle'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                {isPinned(range)
                                    ? <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                                    : <PinOff className="h-3.5 w-3.5" aria-hidden="true" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => onRemoveRange(range)}
                                aria-label={t('paperSetup.subSteps.corpus.picker.cart.remove', { range: rangeLabel(range) })}
                                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-border bg-muted/40 px-3 py-3 space-y-2">
                <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                    <span>{t('paperSetup.subSteps.corpus.picker.cart.budget')}</span>
                    <span className={`tabular-nums font-semibold ${overBudget ? 'text-destructive' : 'text-foreground'}`}>
                        {percent}%
                    </span>
                </div>
                <div
                    className="h-1.5 overflow-hidden rounded-full bg-border"
                    role="progressbar"
                    aria-valuenow={Math.min(percent, 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('paperSetup.subSteps.corpus.picker.cart.budget')}
                >
                    <div
                        className={`h-full transition-all ${overBudget ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                </div>

                <div className="flex gap-3 text-[11px] tabular-nums text-muted-foreground">
                    <span>{t('paperSetup.subSteps.corpus.picker.cart.statSheets', { count: sheetCount })}</span>
                    <span>{t('paperSetup.subSteps.corpus.picker.cart.statChars', { count: selectedChars })}</span>
                </div>

                {pinnedChars > 0 && (
                    <p className="text-[11px] text-info-subtle-foreground">
                        {t('paperSetup.subSteps.corpus.picker.cart.pinnedChars', { count: pinnedChars })}
                    </p>
                )}

                {otherSourcesChars > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                        {t('paperSetup.subSteps.corpus.picker.cart.otherSources', { count: otherSourcesChars })}
                    </p>
                )}

                {overBudget && (
                    <p className="text-[11px] text-destructive">
                        {t('paperSetup.subSteps.corpus.picker.cart.overBudgetHint')}
                    </p>
                )}

                {/* Guardar NO se bloquea por presupuesto. La única forma de
                    bajarlo es guardar una selección más chica, así que
                    bloquearlo dejaba al usuario encerrado: no podía arreglar lo
                    que el aviso le pedía arreglar. Y si las otras fuentes ya se
                    pasan solas, esta fuente no se podría guardar nunca. */}
                <Button
                    type="button"
                    className="w-full"
                    variant={overBudget ? 'outline' : 'default'}
                    disabled={sheetCount === 0 || isSaving}
                    onClick={onConfirm}
                >
                    {isSaving
                        ? t('paperSetup.subSteps.corpus.picker.cart.saving')
                        : t('paperSetup.subSteps.corpus.picker.cart.confirm', { count: sheetCount })}
                </Button>
            </div>
        </div>
    );
}
