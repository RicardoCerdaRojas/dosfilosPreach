import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '../primitives';

export type FeedbackChoice = 'correction' | 'strength' | 'ignore';

interface FeedbackKindChoiceProps<T extends FeedbackChoice> {
    value: T;
    options: ReadonlyArray<T>;
    onChange: (v: T) => void;
    /** El nombre del grupo para el lector de pantalla («Clase de la observación 3»). */
    label: string;
}

/**
 * Corrección / Fortaleza (/ Ignorar): un grupo de radio compacto. Tab entra
 * a la opción elegida; las flechas mueven y eligen. En el teléfono cada
 * opción mide 44 px de alto.
 */
export function FeedbackKindChoice<T extends FeedbackChoice>({ value, options, onChange, label }: FeedbackKindChoiceProps<T>) {
    const { t } = useTranslation('projectDeskCourse');
    const botones = useRef<Array<HTMLButtonElement | null>>([]);
    const mover = (e: KeyboardEvent, i: number) => {
        const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!paso) return;
        e.preventDefault();
        const j = (i + paso + options.length) % options.length;
        onChange(options[j]!);
        botones.current[j]?.focus();
    };
    return (
        <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-md border border-border bg-background p-0.5 sm:w-auto">
            {options.map((o, i) => (
                <button
                    key={o}
                    ref={el => { botones.current[i] = el; }}
                    type="button"
                    role="radio"
                    aria-checked={value === o}
                    tabIndex={value === o ? 0 : -1}
                    onClick={() => onChange(o)}
                    onKeyDown={e => mover(e, i)}
                    className={cn(
                        'min-h-11 flex-1 rounded px-2.5 text-xs font-medium transition-colors sm:min-h-8 sm:flex-none',
                        FOCUS_RING,
                        value === o ? 'bg-primary-solid text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                >
                    {t(`feedbackDialog.kind.${o}`)}
                </button>
            ))}
        </div>
    );
}
