import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ReviewTone = 'ok' | 'warn' | 'info';

const ICONO: Record<ReviewTone, { Icon: typeof Info; className: string }> = {
    ok: { Icon: CheckCircle2, className: 'text-success' },
    warn: { Icon: AlertTriangle, className: 'text-warning-subtle-foreground' },
    info: { Icon: Info, className: 'text-muted-foreground' },
};

/** Una parte de la bandeja: la obra, la edición, las páginas, la copia. El ícono no es la única señal: el texto lo dice. */
export function ReviewSection({ id, title, tone, children }: { id: string; title: string; tone: ReviewTone; children: ReactNode }) {
    const { Icon, className } = ICONO[tone];
    return (
        <section aria-labelledby={id} className="rounded-lg border border-border bg-card p-4" data-testid={id} data-tone={tone}>
            <h2 id={id} className="flex items-center gap-2 font-serif text-base font-semibold text-foreground">
                <Icon className={cn('h-4 w-4 shrink-0', className)} aria-hidden />
                {title}
            </h2>
            <div className="mt-2 space-y-2 pl-6 text-sm text-foreground">{children}</div>
        </section>
    );
}

/** Lo que está escrito en la hoja, citado tal cual para compararlo con el ejemplar. */
export function Evidence({ children }: { children: ReactNode }) {
    return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function ReviewAction({ children, onClick, disabled, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'min-h-9 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                primary ? 'bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover' : 'border border-border text-foreground hover:bg-accent',
            )}
        >
            {children}
        </button>
    );
}
