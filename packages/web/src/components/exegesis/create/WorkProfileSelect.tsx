import type { WorkProfile } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

interface WorkProfileSelectProps {
    profiles: ReadonlyArray<WorkProfile>;
    value: string | null;
    onPick: (profile: WorkProfile | null) => void;
}

/**
 * «Perfil de trabajo»: cómo quedó configurado un trabajo anterior. Rellena
 * los campos y no decide. La página no lo muestra cuando el trabajo nace de
 * un tipo de trabajo del curso: el tipo ya trae lo mismo (TP #9, B9).
 */
export function WorkProfileSelect({ profiles, value, onPick }: WorkProfileSelectProps) {
    const { t } = useTranslation('exegesis');
    const elegido = profiles.find(p => p.id === value) ?? null;
    return (
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
            <label htmlFor="work-profile" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                {t('paperSetup.workProfile.pickLabel')}
            </label>
            <select
                id="work-profile"
                value={value ?? ''}
                onChange={e => onPick(profiles.find(p => p.id === e.target.value) ?? null)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
                <option value="">{t('paperSetup.workProfile.pickNone')}</option>
                {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.displayName}{p.course ? ` · ${p.course}` : ''}
                    </option>
                ))}
            </select>
            <p className="text-[11px] text-muted-foreground">{t('paperSetup.workProfile.pickHint')}</p>
            {elegido && elegido.rubricTemplateId === null && (
                <p className="text-[11px] text-warning-subtle-foreground">{t('paperSetup.workProfile.noRubric')}</p>
            )}
        </div>
    );
}
