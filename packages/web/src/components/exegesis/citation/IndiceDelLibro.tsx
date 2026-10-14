import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * El índice de hojas del libro, en la vista ampliada del visor (pedido del
 * fundador al probar la fase F): para ir a cualquier parte sin pasar hoja por
 * hoja. Cada fila dice su página impresa (la que se cita), la hoja del archivo
 * y la sección o el primer renglón.
 */
export function IndiceDelLibro({ pages, printedOf, currentSheet, onGo }: {
    pages: ReadonlyArray<{ sheet: number; section: string | null; firstLine: string }>;
    printedOf: (sheet: number) => string | number | null;
    currentSheet: number;
    onGo: (sheet: number) => void;
}) {
    const { t } = useTranslation('exegesis');
    const actual = useRef<HTMLButtonElement>(null);
    // La hoja que se mira queda a la vista en el índice al hojear.
    useEffect(() => { actual.current?.scrollIntoView({ block: 'nearest' }); }, [currentSheet]);
    if (pages.length === 0) return null;
    return (
        <nav aria-label={t('sourceViewer.index')} className="md:w-72 md:shrink-0 max-h-44 md:max-h-none overflow-y-auto border-b md:border-b-0 md:border-r border-border bg-card/40" data-testid="indice-del-libro">
            <p className="sticky top-0 z-10 bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('sourceViewer.index')}</p>
            <ul className="divide-y divide-border/60">
                {pages.map(p => {
                    const printed = printedOf(p.sheet);
                    const esActual = p.sheet === currentSheet;
                    return (
                        <li key={p.sheet}>
                            <button
                                ref={esActual ? actual : undefined}
                                type="button"
                                onClick={() => onGo(p.sheet)}
                                aria-current={esActual || undefined}
                                className={cn(
                                    'w-full px-4 py-1.5 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent/60',
                                    esActual && 'bg-accent/50',
                                )}
                            >
                                <span className="text-[11px] font-medium tabular-nums text-foreground">
                                    {printed !== null
                                        ? t('citationViewer.hitPage', { printed, sheet: p.sheet })
                                        : t('citationViewer.hitSheet', { sheet: p.sheet })}
                                </span>
                                <span className="block truncate text-[11px] text-muted-foreground">{p.section ?? p.firstLine}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
