import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

export type SearchScope = 'sheet' | 'book';

interface Props {
    viewSheet: number;
    totalSheets: number | null;
    onGo: (sheet: number) => void;
    /** Devuelve `false` cuando lo escrito no es un número de página. */
    onGoToPageInput: (input: number) => boolean;
    search: string;
    onSearch: (v: string) => void;
    scope: SearchScope;
    onScope: (s: SearchScope) => void;
    matches: number;
    zoom: number;
    onZoom: (z: number) => void;
}

/**
 * Hojear, ir a una página y buscar en la hoja.
 *
 * El cuadro «ir a» acepta el folio impreso, que es lo que el lector ve en
 * la nota al pie de la cita y en el libro; la conversión a hoja la hace
 * quien conoce la calibración. Las flechas del teclado hojean cuando el
 * foco no está en un cuadro de texto.
 */
export function CitationViewerToolbar({ viewSheet, totalSheets, onGo, onGoToPageInput, search, onSearch, scope, onScope, matches, zoom, onZoom }: Props) {
    const { t } = useTranslation('exegesis');
    const [pageInput, setPageInput] = useState('');
    const [rejected, setRejected] = useState(false);
    useEffect(() => { setRejected(false); }, [pageInput]);

    const submitPage = () => {
        const n = Number(pageInput.trim());
        const ok = pageInput.trim() !== '' && onGoToPageInput(n);
        setRejected(!ok);
        if (ok) setPageInput('');
    };

    return (
        <div className="flex flex-wrap items-center gap-3 px-6 py-2 border-b border-border bg-card/60">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onGo(viewSheet - 1)}
                    disabled={viewSheet <= 1}
                    title={t('citationViewer.prevSheet')}
                    aria-label={t('citationViewer.prevSheet')}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] tabular-nums text-muted-foreground px-1 whitespace-nowrap">
                    {totalSheets
                        ? t('citationViewer.sheetOf', { sheet: viewSheet, total: totalSheets })
                        : t('citationViewer.sheetOnly', { sheet: viewSheet })}
                </span>
                <button
                    type="button"
                    onClick={() => onGo(viewSheet + 1)}
                    disabled={totalSheets !== null && viewSheet >= totalSheets}
                    title={t('citationViewer.nextSheet')}
                    aria-label={t('citationViewer.nextSheet')}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>

            <form
                onSubmit={e => { e.preventDefault(); submitPage(); }}
                className="flex items-center gap-1"
            >
                <input
                    type="text"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={e => setPageInput(e.target.value)}
                    placeholder={t('citationViewer.goToPage')}
                    aria-label={t('citationViewer.goToPage')}
                    aria-invalid={rejected || undefined}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid]:border-destructive"
                />
                {rejected && <span className="text-[11px] text-destructive">{t('citationViewer.goToPageInvalid')}</span>}
            </form>

            <div className="relative flex-1 min-w-40 max-w-sm">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <input
                    type="search"
                    value={search}
                    onChange={e => onSearch(e.target.value)}
                    placeholder={t(scope === 'book' ? 'citationViewer.searchBookPlaceholder' : 'citationViewer.searchPlaceholder')}
                    aria-label={t(scope === 'book' ? 'citationViewer.searchBookPlaceholder' : 'citationViewer.searchPlaceholder')}
                    className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
            <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0" role="group" aria-label={t('citationViewer.scopeLabel')}>
                {(['sheet', 'book'] as const).map(value => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onScope(value)}
                        aria-pressed={scope === value}
                        className={cn(
                            'px-2 py-1 text-[11px]',
                            scope === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                        )}
                    >
                        {t(`citationViewer.scope.${value}`)}
                    </button>
                ))}
            </div>

            {scope === 'sheet' && search.trim() && (
                <span className="text-[11px] text-muted-foreground shrink-0">
                    {matches > 0
                        ? t('citationViewer.searchMatches', { count: matches })
                        : t('citationViewer.searchNoMatches')}
                </span>
            )}

            <div className="ml-auto flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    onClick={() => onZoom(Math.max(1, Math.round((zoom - 0.25) * 100) / 100))}
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
                    onClick={() => onZoom(Math.min(4, Math.round((zoom + 0.25) * 100) / 100))}
                    disabled={zoom >= 4}
                    title={t('citationViewer.zoomIn')}
                    aria-label={t('citationViewer.zoomIn')}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                >
                    <ZoomIn className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
