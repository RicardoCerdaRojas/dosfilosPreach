import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ModoDeConsulta = 'preguntar' | 'temas';

/**
 * El buscador en un solo bloque (rediseño, 2026-10-17): el modo y el alcance
 * arriba, la caja abajo. Antes eran tres piezas sueltas en la página.
 */
export function BarraDeConsulta({ modo, onModo, alcance, ayuda, children }: {
    modo: ModoDeConsulta;
    onModo: (m: ModoDeConsulta) => void;
    /** El selector de alcance (un chip). */
    alcance: ReactNode;
    /**
     * Cómo funciona este modo (cuenta o no como consulta, qué muestra). Va en
     * un ⓘ y no como nota fija bajo la caja (fase «barra única»).
     */
    ayuda?: string;
    /** La caja: la pregunta o el tema. */
    children: ReactNode;
}) {
    const { t } = useTranslation('library');
    return (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
                <div role="group" aria-label={t('consult.modeLabel')} className="inline-flex rounded-xl bg-muted p-[3px]">
                    {(['preguntar', 'temas'] as const).map(m => (
                        <button
                            key={m}
                            type="button"
                            aria-pressed={modo === m}
                            onClick={() => onModo(m)}
                            className={cn(
                                'min-h-9 rounded-lg px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                modo === m ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {m === 'preguntar' ? t('consult.modeAsk') : t('consult.modeTopics')}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5">
                    {alcance}
                    {ayuda && (
                        // Popover y no tooltip: se abre también tocándolo en el teléfono.
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={t('consult.howItWorks')}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <Info className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72 text-[13px] leading-relaxed text-foreground">{ayuda}</PopoverContent>
                        </Popover>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
}
