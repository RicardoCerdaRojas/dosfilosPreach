import { type ExegeticalMethod } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

const METODOS: ExegeticalMethod[] = ['mixed', 'exegetical', 'research'];

interface MethodPickerProps {
    value: ExegeticalMethod | null | undefined;
    onChange: (method: ExegeticalMethod | null) => void;
    id?: string;
    disabled?: boolean;
    /** Sin la explicación debajo, para la cabecera. */
    compact?: boolean;
}

/**
 * El método del trabajo (etapa 2, capa 3): cuándo entran los comentarios en
 * el análisis. «Como siempre» deja el análisis de hoy, sin cambios.
 */
export function MethodPicker({ value, onChange, id = 'exegetical-method', disabled, compact }: MethodPickerProps) {
    const { t } = useTranslation('exegesis');
    const actual = value ?? '';
    return (
        <div className={compact ? 'inline-flex items-center gap-1.5' : 'space-y-1'}>
            <label htmlFor={id} className={compact ? 'text-xs text-muted-foreground' : 'block text-[11px] uppercase tracking-wide font-semibold text-muted-foreground'}>
                {t('method.label')}
            </label>
            <select
                id={id}
                value={actual}
                disabled={disabled}
                onChange={e => onChange((e.target.value || null) as ExegeticalMethod | null)}
                className={`rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 ${compact ? 'h-8' : 'w-full'}`}
            >
                <option value="">{t('method.none')}</option>
                {METODOS.map(m => <option key={m} value={m}>{t(`method.${m}.label`)}</option>)}
            </select>
            {!compact && <p className="text-[11px] text-muted-foreground">{t(actual ? `method.${actual}.hint` : 'method.noneHint')}</p>}
        </div>
    );
}
