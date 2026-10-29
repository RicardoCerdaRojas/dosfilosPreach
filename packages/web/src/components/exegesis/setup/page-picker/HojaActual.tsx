import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    sheet: number;
    /** Lo que lleva impreso la hoja («692», «xii»), o `null` si nada. */
    printed: string | null;
    /** El libro tiene numeración impresa conocida (aunque esta hoja no lleve folio). */
    numberingKnown: boolean;
    onStep: (delta: number) => void;
}

/**
 * Hojear y decir dónde se está: «Hoja 803 · p. 692».
 *
 * TP #9 (B27): en el NA28 la hoja 803 es la p. 692, y la cabecera decía
 * «hoja 803 · impresa 692» en minúscula y gris, tan parecido que el número de
 * la hoja se leía como página. Ahora se nombra cada uno: la hoja del archivo,
 * y la página con la «p.» con que se cita. Una hoja sin folio en un libro
 * numerado (láminas, hojas de cortesía) lo dice, distinto de un libro
 * cuya numeración todavía no se detectó.
 */
export function HojaActual({ sheet, printed, numberingKnown, onStep }: Props) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="flex items-center gap-1.5" data-testid="hoja-actual">
            <Button
                type="button" variant="outline" size="icon" className="h-11 w-11 sm:h-7 sm:w-7"
                onClick={() => onStep(-1)}
                aria-label={t('paperSetup.subSteps.corpus.picker.viewer.previous')}
            >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
                type="button" variant="outline" size="icon" className="h-11 w-11 sm:h-7 sm:w-7"
                onClick={() => onStep(1)}
                aria-label={t('paperSetup.subSteps.corpus.picker.viewer.next')}
            >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="ml-1 text-xs font-semibold tabular-nums text-foreground">
                {t('paperSetup.subSteps.corpus.picker.viewer.sheet', { sheet })}
            </span>
            <span className={printed === null ? 'text-[11px] tabular-nums text-muted-foreground' : 'text-xs font-semibold tabular-nums text-foreground'}>
                {printed !== null
                    ? t('paperSetup.subSteps.corpus.picker.viewer.printed', { printed })
                    : numberingKnown ? t('paperSetup.subSteps.corpus.picker.viewer.unnumbered') : t('paperSetup.subSteps.corpus.picker.viewer.noPrinted')}
            </span>
        </div>
    );
}
