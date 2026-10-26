import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unitsVsSundays } from '../utils/serieDesdeProyecto';

/**
 * Después del Pase 4: «El Pase 4 propone N unidades; planeaste M domingos»
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, principio 5). La unidad la fija el
 * texto y el calendario se ajusta: los domingos nunca fueron meta del
 * planificador. Por eso las dos salidas son reales y en ese orden: revisar
 * la división (vuelve al Pase 4) y, si se confirma, ajustar el calendario en
 * el encuadre del proyecto, que se abre aquí mismo (sin perder el análisis). Iguales, o sin domingos en el encuadre, no aparece.
 *
 * No promete «una unidad en varios domingos»: esa opción no existe todavía.
 */
export function UnitsVsSundaysNotice({ units, sundays, onReviewDivision, onAdjustCalendar, t }: {
    units: number;
    sundays: number | null | undefined;
    /** Despliega el Pase 4 y lleva el foco ahí. */
    onReviewDivision: () => void;
    /** Abre el diálogo del encuadre del proyecto en el planificador. */
    onAdjustCalendar: () => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    const diff = unitsVsSundays(units, sundays);
    if (!diff) return null;
    return (
        <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-info/30 bg-info-subtle p-3 text-sm text-info-subtle-foreground"
        >
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
                <p className="font-medium">
                    {t('expository.framing.units.summary', {
                        units: t('expository.framing.units.unitCount', { count: diff.units }),
                        sundays: t('expository.framing.units.sundayCount', { count: diff.sundays }),
                    })}
                </p>
                <p className="text-xs">{t('expository.framing.units.principle')}</p>
                <p className="text-xs">
                    {t(diff.direction === 'more-units' ? 'expository.framing.units.moreUnits' : 'expository.framing.units.fewerUnits')}
                </p>
                <div className="flex flex-wrap gap-2 pt-1.5">
                    <Button type="button" size="sm" variant="outline" className="min-h-11 text-foreground sm:min-h-0" onClick={onReviewDivision}>
                        {t('expository.framing.units.reviewDivision')}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-0" onClick={onAdjustCalendar}>
                        {t('expository.framing.units.adjustCalendar')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
