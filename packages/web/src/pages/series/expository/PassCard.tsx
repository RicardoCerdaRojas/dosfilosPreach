import { Minus } from 'lucide-react';
import { ChipStateBadge, type PassState, PassStateBadge } from './passState';

export function PassCard({
    index,
    title,
    subtitle,
    state,
    children,
    onCollapse,
    anchorId,
    t,
}: {
    index: number;
    title: string;
    subtitle: string;
    state: PassState;
    children?: React.ReactNode;
    onCollapse?: () => void;
    /** Id para llevar ahí la vista y el foco desde otro lugar de la página (p. ej. «Revisar la división»). */
    anchorId?: string;
    /** `t` con sus parámetros de interpolación: la firma anterior declaraba
     *  un solo argumento y varias llamadas pasan dos, así que mentía. */
    t: (key: string, params?: Record<string, unknown>) => string;
}) {
    return (
        <section
            id={anchorId}
            tabIndex={anchorId ? -1 : undefined}
            // The shared `view-transition-name` is what the browser
            // uses to identify "this card and the chip with the same
            // name are the same logical entity, morph between them".
            // Each pass needs a unique name so multiple morphs can run
            // independently when the pastor toggles several at once.
            style={{ viewTransitionName: `expository-pass-${index}` } as React.CSSProperties}
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
            <header className="flex items-start gap-3">
                <PassStateBadge state={state} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400 font-mono">
                            {t('expository.pass')} {index}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {title}
                        </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {subtitle}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 italic">
                        {t(`expository.state.${state}`)}
                    </span>
                    {onCollapse && (
                        <button
                            type="button"
                            onClick={onCollapse}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            aria-label={t('expository.collapse') as string}
                            title={t('expository.collapse') as string}
                        >
                            <Minus className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </header>
            {children && <div className="mt-4">{children}</div>}
        </section>
    );
}

// ── Collapsed strip ────────────────────────────────────────────────────

export function CollapsedStrip({
    collapsedPasses,
    passes,
    onExpand,
    t,
}: {
    collapsedPasses: Set<number>;
    passes: ReadonlyArray<{ index: number; key: string; state: PassState }>;
    onExpand: (index: number) => void;
    /** `t` con sus parámetros de interpolación: la firma anterior declaraba
     *  un solo argumento y varias llamadas pasan dos, así que mentía. */
    t: (key: string, params?: Record<string, unknown>) => string;
}) {
    const visible = passes.filter((p) => collapsedPasses.has(p.index));
    return (
        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/40 px-3 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium px-1">
                    {t('expository.collapsedStrip.label')}
                </span>
                {visible.map((p) => (
                    <button
                        key={p.index}
                        type="button"
                        onClick={() => onExpand(p.index)}
                        // Same view-transition-name as the corresponding
                        // PassCard — that's what makes the browser morph
                        // between the two on toggle.
                        style={{ viewTransitionName: `expository-pass-${p.index}` } as React.CSSProperties}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                        aria-label={t('expository.collapsedStrip.expand') as string}
                    >
                        <ChipStateBadge state={p.state} />
                        <span className="font-mono text-[10px] text-slate-400">
                            {t('expository.pass')} {p.index}
                        </span>
                        <span className="font-medium">
                            {t(`expository.passes.${p.key}.title`)}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
