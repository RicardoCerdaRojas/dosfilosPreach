import type { CoverOrigin } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * «Usar portada de…»: carga en el formulario la portada de un trabajo
 * anterior o de un perfil. Sólo llena el borrador; guardar sigue siendo del
 * autor, que ve lo que se cargó antes de confirmarlo.
 */
export function CoverOriginPicker({ origins, onPick, disabled }: {
    origins: ReadonlyArray<CoverOrigin>;
    onPick: (origin: CoverOrigin) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation('exegesis');
    if (origins.length === 0) return null;
    return (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t('paperSetup.cover.useFrom')}
            <select
                value=""
                disabled={disabled}
                onChange={(e) => {
                    const origen = origins.find(o => `${o.kind}:${o.id}` === e.target.value);
                    if (origen) onPick(origen);
                }}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
                <option value="" disabled>{t('paperSetup.cover.useFromPlaceholder')}</option>
                {origins.map(o => (
                    <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
                        {t(o.kind === 'paper' ? 'paperSetup.cover.originPaper' : 'paperSetup.cover.originProfile', { label: o.label })}
                    </option>
                ))}
            </select>
        </label>
    );
}
