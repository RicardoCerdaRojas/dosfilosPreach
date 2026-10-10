import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { FichaCompleta, FichaPanel, FichaResumen } from '@/components/word-ficha/Ficha';
import { cn } from '@/lib/utils';
import { BLOQUES_GRIEGO, type DatosGriego } from './ficha/bloquesGriego';

/**
 * La ficha de palabra en el analizador griego: el panel lateral y la grilla
 * de tarjetas resumen — la misma estructura que el tutor de hebreo.
 */

export function FichaPanelGriego({
    titulo, total, datos, abierta, onAbrir,
}: {
    /** «Santiago 1:2». */
    titulo: string;
    total: number;
    datos: (i: number) => DatosGriego | null;
    abierta: number | null;
    onAbrir: (i: number | null) => void;
}) {
    const { t } = useTranslation('languageStructure');
    const i = abierta;
    return (
        <FichaPanel
            registro={BLOQUES_GRIEGO}
            d={i === null ? null : datos(i)}
            abierto={i !== null}
            onCerrar={() => onAbrir(null)}
            referencia={i === null ? '' : t('wordFicha.reference', { ref: titulo, n: i + 1, total })}
            onAnterior={i !== null && i > 0 ? () => onAbrir(i - 1) : undefined}
            onSiguiente={i !== null && i < total - 1 ? () => onAbrir(i + 1) : undefined}
        />
    );
}

/** La grilla de tarjetas resumen; al imprimir, la ficha completa de cada palabra. */
export function TarjetasResumenGriego({
    total, datos, activa, onAbrir,
}: {
    total: number;
    datos: (i: number) => DatosGriego | null;
    activa: number | null;
    onAbrir: (i: number) => void;
}) {
    const { t } = useTranslation('languageStructure');
    const indices = Array.from({ length: total }, (_, i) => i);
    return (
        <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 print:hidden">
                {indices.map((i) => {
                    const d = datos(i);
                    return d ? (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onAbrir(i)}
                            className={cn(
                                'flex h-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-colors',
                                activa === i ? 'border-primary/70 ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
                            )}
                            data-testid="tarjeta-resumen"
                        >
                            <div className="flex-1"><FichaResumen registro={BLOQUES_GRIEGO} d={d} /></div>
                            <span className="flex items-center justify-end gap-1 border-t border-border px-4 py-2 text-xs font-semibold text-primary">
                                {t('wordFicha.seeFicha')}<ChevronRight className="h-3.5 w-3.5" />
                            </span>
                        </button>
                    ) : null;
                })}
            </div>
            <div className="hidden print:block">
                {indices.map((i) => {
                    const d = datos(i);
                    return d ? (
                        <div key={i} className="mb-4 break-inside-avoid rounded-xl border border-border">
                            <FichaCompleta registro={BLOQUES_GRIEGO} d={d} />
                        </div>
                    ) : null;
                })}
            </div>
        </>
    );
}
