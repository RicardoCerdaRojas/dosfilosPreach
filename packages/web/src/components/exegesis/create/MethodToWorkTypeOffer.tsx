import type { ExegeticalMethod } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/** La casilla «Guardar el método en el tipo de trabajo» (ver `useMethodToWorkType`). */
interface MethodToWorkTypeOfferProps {
    method: ExegeticalMethod;
    typeLabel: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export function MethodToWorkTypeOffer({ method, typeLabel, checked, onChange }: MethodToWorkTypeOfferProps) {
    const { t } = useTranslation('exegesis');
    return (
        <label className="mt-2 flex min-h-11 items-start gap-2 text-xs text-foreground sm:min-h-0" data-testid="method-to-work-type">
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-focus"
            />
            {t('method.saveToType', { method: t(`method.${method}.label`), type: typeLabel })}
        </label>
    );
}
