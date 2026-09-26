import type { ExegeticalStep } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Predefined regeneration hints, scoped by step kind. Each entry is
 * one click — no typing required for the most common feedback the
 * user gives the orchestrator. The hints are designed to nudge the
 * model in a single dimension so the diff is interpretable.
 *
 * The keys mirror the i18n bundle so adding/removing a chip means
 * touching `detail.steps.quickHints.<kind>.<id>` in both ES + EN.
 */
const QUICK_HINTS: Record<ExegeticalStep['kind'], readonly string[]> = {
    verse: ['syntax', 'theology', 'historical', 'lexis', 'lessGeneral'],
    conclusion: ['concise', 'verseFocus', 'highlightThesis'],
    introduction: ['concise', 'previewStructure', 'pastoralHook'],
    // Assembly is mechanical; no LLM regen.
    assembly: [],
};

export function QuickHintChips({
    stepKind,
    onPick,
    disabled,
}: {
    stepKind: ExegeticalStep['kind'];
    onPick: (hint: string) => void;
    disabled: boolean;
}) {
    const { t } = useTranslation('exegesis');
    const ids = QUICK_HINTS[stepKind];
    if (ids.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mr-0.5">
                {t('detail.steps.quickHints.label')}
            </span>
            {ids.map(id => {
                const labelKey = `detail.steps.quickHints.${stepKind}.${id}`;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onPick(t(labelKey))}
                        disabled={disabled}
                        className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                            'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300',
                            'hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800',
                            'dark:hover:bg-emerald-950/40 dark:hover:border-emerald-700 dark:hover:text-emerald-200',
                            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
                        )}
                    >
                        {t(labelKey)}
                    </button>
                );
            })}
        </div>
    );
}
