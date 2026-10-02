import { useTranslation } from 'react-i18next';
import { Pin, PinOff, X } from 'lucide-react';
import {
    CURATED_CORPUS_BUDGET_CHARS,
    printedPageFor,
    sectionsCoveredBy,
    withPageSelection,
    type CorpusFootprint,
    type SheetRange,
} from '@dosfilos/domain';
import { VERSE_CORPUS_SPACE_CHARS } from '@dosfilos/infrastructure';
import { Button } from '@/components/ui/button';

/**
 * Lo que va al trabajo, y cuánto corpus llega con eso a cada versículo.
 *
 * Mide lo que VIAJA (ver `corpusFootprint`): las hojas elegidas de todas las
 * fuentes se consultan por versículo hasta un tope; los fragmentos van
 * completos. Antes sumaba todas las hojas como si viajaran enteras.
 */

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
    /** Lo que aportan las otras fuentes del trabajo a cada versículo. */
    otherSources: CorpusFootprint;
    selectedChars: number;
    sheetCount: number;
    onRemoveRange: (range: SheetRange) => void;
    /** Tramos marcados como «siempre incluir». */
    pinnedRanges: ReadonlyArray<SheetRange>;
    onTogglePinned: (range: SheetRange) => void;
    /** Caracteres que ocupan los tramos fijados. */
    pinnedChars: number;
    onConfirm: () => void;
    /**
     * Si lo elegido difiere de lo guardado. Sin cambios el botón dice
     * «Guardado» y se apaga: antes quedaba siempre encendido y, al volver a
     * entrar, no había forma de saber si las hojas ya estaban en el trabajo.
     */
    isDirty: boolean;
    isSaving: boolean;
}

export function SelectionCart({
    ranges,
    sections,
    printedPageOffset,
    otherSources,
    selectedChars,
    sheetCount,
    onRemoveRange,
    pinnedRanges,
    onTogglePinned,
    pinnedChars,
    onConfirm,
    isSaving,
    isDirty,
}: Props) {
    const { t, i18n } = useTranslation('exegesis');

    const n = (x: number) => x.toLocaleString(i18n.language);
    const conEsta = withPageSelection(otherSources, selectedChars, pinnedChars);
    const percent = Math.round((conEsta.perStepChars / VERSE_CORPUS_SPACE_CHARS) * 100);
    const overBudget = conEsta.perStepChars > VERSE_CORPUS_SPACE_CHARS;

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
        <div className="flex flex-col shrink-0 border-l border-border">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.picker.cart.title')}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                    {t('paperSetup.subSteps.corpus.picker.cart.rangeCount', { count: ranges.length })}
                </span>
            </div>

            {/* Altura propia: dentro de la columna con scroll, `flex-1` la
                dejaba en una franja casi invisible bajo los paneles de
                propuestas, y no se podían ver ni quitar los tramos. */}
            <div className="min-h-[10rem] max-h-[45vh] overflow-y-auto p-2 space-y-1.5">
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

                <p className="text-[11px] tabular-nums text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.picker.cart.perVerse', {
                        chars: n(conEsta.perStepChars),
                        admitted: n(conEsta.admittedChars),
                        cap: n(CURATED_CORPUS_BUDGET_CHARS),
                    })}
                </p>
                {otherSources.excerptChars > 0 && (
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                        {t('paperSetup.subSteps.corpus.picker.cart.otherExcerpts', { chars: n(otherSources.excerptChars) })}
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
                    disabled={sheetCount === 0 || isSaving || !isDirty}
                    onClick={onConfirm}
                >
                    {isSaving
                        ? t('paperSetup.subSteps.corpus.picker.cart.saving')
                        : !isDirty && sheetCount > 0
                            ? t('paperSetup.subSteps.corpus.picker.cart.saved', { count: sheetCount })
                            : t('paperSetup.subSteps.corpus.picker.cart.confirm', { count: sheetCount })}
                </Button>
            </div>
        </div>
    );
}
