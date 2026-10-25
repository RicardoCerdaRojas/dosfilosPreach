import { CalendarDays } from 'lucide-react';
import { unitsVsSundays } from '../utils/serieDesdeProyecto';

/**
 * Después del Pase 4: «El texto dio N unidades; planeaste M domingos»
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, principio 5). El texto fija la
 * unidad y el calendario la ajusta: los domingos nunca fueron meta del
 * planificador, así que aquí solo se avisa y se nombran las salidas.
 * Iguales, o sin domingos en el encuadre, no aparece.
 */
export function UnitsVsSundaysNotice({ units, sundays, t }: {
    units: number;
    sundays: number | null | undefined;
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
            <div className="space-y-1">
                <p className="font-medium">
                    {t('expository.framing.units.summary', {
                        units: t('expository.framing.units.unitCount', { count: diff.units }),
                        sundays: t('expository.framing.units.sundayCount', { count: diff.sundays }),
                    })}
                </p>
                <p className="text-xs">
                    {t(diff.direction === 'more-units' ? 'expository.framing.units.moreUnits' : 'expository.framing.units.fewerUnits')}
                </p>
                <p className="text-xs">{t('expository.framing.units.principle')}</p>
            </div>
        </div>
    );
}
