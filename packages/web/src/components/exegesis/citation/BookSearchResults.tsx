import { Loader2 } from 'lucide-react';
import type { DocumentSheetHit } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface Props {
    hits: ReadonlyArray<DocumentSheetHit>;
    truncated: boolean;
    isLoading: boolean;
    isError: boolean;
    /** Qué folio lleva impreso una hoja, para nombrarla como el libro. */
    printedOf: (sheet: number) => string | number | null;
    currentSheet: number;
    onGo: (sheet: number) => void;
}

/**
 * Las hojas donde aparece lo buscado, en orden del libro.
 *
 * Cada entrada se nombra por su folio impreso —que es el que el lector va
 * a escribir en la cita— con la hoja del archivo al lado, y trae el
 * renglón donde cae la palabra: casi siempre basta para saber cuál de las
 * cinco hojas es la que importa sin abrirlas una por una.
 */
export function BookSearchResults({ hits, truncated, isLoading, isError, printedOf, currentSheet, onGo }: Props) {
    const { t } = useTranslation('exegesis');

    if (isLoading) {
        return (
            <p className="flex items-center gap-2 px-6 py-2 text-[11px] text-muted-foreground border-b border-border bg-card/40">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t('citationViewer.bookSearching')}
            </p>
        );
    }
    if (isError) {
        return (
            <p className="px-6 py-2 text-[11px] text-destructive border-b border-border bg-card/40">
                {t('citationViewer.bookSearchFailed')}
            </p>
        );
    }
    if (hits.length === 0) {
        return (
            <p className="px-6 py-2 text-[11px] text-muted-foreground border-b border-border bg-card/40">
                {t('citationViewer.bookSearchEmpty')}
            </p>
        );
    }

    return (
        <div className="border-b border-border bg-card/40 max-h-44 overflow-y-auto">
            <ul className="divide-y divide-border/60">
                {hits.map(hit => {
                    const printed = printedOf(hit.sheet);
                    const isCurrent = hit.sheet === currentSheet;
                    return (
                        <li key={hit.sheet}>
                            <button
                                type="button"
                                onClick={() => onGo(hit.sheet)}
                                aria-current={isCurrent || undefined}
                                className={cn(
                                    'w-full text-left px-6 py-1.5 hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent/60',
                                    isCurrent && 'bg-accent/40',
                                )}
                            >
                                <span className="text-[11px] font-medium tabular-nums text-foreground">
                                    {printed !== null
                                        ? t('citationViewer.hitPage', { printed, sheet: hit.sheet })
                                        : t('citationViewer.hitSheet', { sheet: hit.sheet })}
                                </span>
                                {hit.count > 1 && (
                                    <span className="text-[11px] text-muted-foreground"> · {t('citationViewer.hitCount', { count: hit.count })}</span>
                                )}
                                {hit.section && (
                                    <span className="text-[11px] text-muted-foreground"> · {hit.section}</span>
                                )}
                                <span className="block text-[11px] text-muted-foreground line-clamp-2">{hit.snippet}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {truncated && (
                <p className="px-6 py-1.5 text-[11px] text-muted-foreground">{t('citationViewer.bookSearchTruncated')}</p>
            )}
        </div>
    );
}
