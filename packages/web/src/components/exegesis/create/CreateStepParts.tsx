import { useTranslation } from '@/i18n';
import type { ExegeticalStrategy } from '@dosfilos/domain';

/**
 * Las piezas de la página de creación (`ExegesisCreatePage`): cada paso
 * numerado y los botones de idioma y estrategia. Salieron de la página para
 * que su lógica quepa en un archivo legible.
 */

export interface StepProps {
    number: number;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

export function Step({ number, icon, title, subtitle, children }: StepProps) {
    return (
        <section className="rounded-2xl border border-border bg-card p-5">
            <header className="flex items-start gap-3 mb-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-success-subtle text-success-subtle-foreground flex items-center justify-center text-xs font-semibold">
                    {number}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{icon}</span>
                        <h2 className="text-base font-semibold text-foreground">
                            {title}
                        </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
            </header>
            <div>
                {children}
            </div>
        </section>
    );
}

export function LanguageOption({
    value,
    label,
    selected,
    onSelect,
}: {
    value: 'es' | 'en';
    label: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={[
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selected
                    ? 'border-success bg-success-subtle text-success-subtle-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent',
            ].join(' ')}
            aria-pressed={selected}
        >
            <span className="text-[10px] uppercase tracking-wide opacity-70 mr-2">{value}</span>
            {label}
        </button>
    );
}

export function StrategyOption({
    value,
    selected,
    onSelect,
    title,
    body,
    recommended = false,
}: {
    value: ExegeticalStrategy;
    selected: boolean;
    onSelect: () => void;
    title: string;
    body: string;
    recommended?: boolean;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            data-strategy={value}
            className={[
                'text-left rounded-lg border-2 p-3 transition-colors space-y-1',
                selected
                    ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                    : 'border-border bg-card text-foreground hover:border-foreground/30',
            ].join(' ')}
        >
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{title}</span>
                {recommended && (
                    <span className="text-[10px] uppercase tracking-wide font-medium rounded-full border border-success/40 bg-success-subtle text-success-subtle-foreground px-1.5 py-0">
                        {t('create.strategy.recommended')}
                    </span>
                )}
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
                {body}
            </p>
        </button>
    );
}

