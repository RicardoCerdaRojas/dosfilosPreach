import { PAPER_PROFILE_KINDS, type PaperProfileKind, type ProfileKindReading } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

interface ProfileKindPickerProps {
    value: PaperProfileKind;
    onChange: (kind: PaperProfileKind) => void;
    /** Si el valor se dedujo y por qué. Ausente: lo eligió el autor. */
    inferredReason?: ProfileKindReading['reason'] | null;
    id?: string;
    disabled?: boolean;
    /** Sin la explicación debajo, para la cabecera. */
    compact?: boolean;
}

/**
 * El tipo de trabajo (procedimiento §4d): TP por pregunta, investigación
 * temática o síntesis + sermón. Decide las secciones del documento y qué
 * aprueba el autor. No es el método: el método dice cuándo entran los
 * comentarios; el tipo, qué forma tiene lo que se entrega.
 */
export function ProfileKindPicker({ value, onChange, inferredReason, id = 'paper-profile-kind', disabled, compact }: ProfileKindPickerProps) {
    const { t } = useTranslation('exegesis');
    const deducido = !!inferredReason && inferredReason !== 'stored';
    return (
        <div className={compact ? 'inline-flex items-center gap-1.5' : 'space-y-1'}>
            <label htmlFor={id} className={compact ? 'text-xs text-muted-foreground whitespace-nowrap' : 'block text-[11px] uppercase tracking-wide font-semibold text-muted-foreground'}>
                {t(compact ? 'profileKind.labelShort' : 'profileKind.label')}
            </label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={e => onChange(e.target.value as PaperProfileKind)}
                aria-describedby={compact ? undefined : `${id}-hint`}
                className={`rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 ${compact ? 'h-8' : 'w-full'}`}
            >
                {PAPER_PROFILE_KINDS.map(k => <option key={k} value={k}>{t(`profileKind.${k}.label`)}</option>)}
            </select>
            {!compact && (
                <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
                    {t(`profileKind.${value}.hint`)}
                    {deducido && <> {t(`profileKind.inferred.${inferredReason}`)}</>}
                </p>
            )}
        </div>
    );
}
