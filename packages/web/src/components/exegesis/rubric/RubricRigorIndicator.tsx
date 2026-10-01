import { Gauge } from 'lucide-react';
import {
    assessRubricRigor,
    type PaperRubric,
    type RubricRigorLevel,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Compact card surfacing two derived facts about a rubric:
 *   - How many minimum sources it requires (count, not what the
 *     student has).
 *   - The academic level it makes feasible (pastoral / seminary /
 *     research / publishable), bucketed from a weighted score
 *     `sum(minimum × rigorTier)`.
 *
 * Pure presentation — all the math lives in the domain
 * `assessRubricRigor` helper. Renders nothing when the rubric has
 * zero required sources (a fresh / empty rubric — surfacing
 * "Pastoral" with 0 minimums would be misleading).
 *
 * Used by `UserRubricEditDialog` (template editor) and
 * `RubricSummaryView` (paper-setup readonly card) so both surfaces
 * agree on the level and avoid duplicating the bucketing logic.
 */
export function RubricRigorIndicator({ rubric }: { rubric: PaperRubric }) {
    const { t } = useTranslation('exegesis');
    const assessment = assessRubricRigor(rubric);

    if (assessment.totalMinimum === 0) return null;

    const tone = LEVEL_TONE[assessment.level];

    return (
        <div className={`rounded-lg border ${tone.border} ${tone.bg} px-3 py-2.5 space-y-1.5`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Gauge className={`h-4 w-4 shrink-0 ${tone.icon}`} />
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                            {t('rubricRigor.title')}
                        </p>
                        <p className={`text-sm font-bold ${tone.text}`}>
                            {t(`rubricRigor.level.${assessment.level}`)}
                        </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-base font-bold text-foreground tabular-nums leading-none">
                        {assessment.totalMinimum}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {t('rubricRigor.minimumSourcesLabel', { count: assessment.totalMinimum })}
                    </p>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug">
                {t(`rubricRigor.levelDescription.${assessment.level}`)}
            </p>

            {/* El «score» interno ya no se muestra: el nivel no sale sólo de
                él (una fuente técnica basta para «seminario») y un número
                sin escala enseñaba a leer la rúbrica como una suma. */}
            <p className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                {t('rubricRigor.breadth', {
                    covered: assessment.groupBreadth,
                    total: assessment.groupTotal,
                })}
            </p>
        </div>
    );
}

const LEVEL_TONE: Record<RubricRigorLevel, {
    border: string;
    bg: string;
    icon: string;
    text: string;
}> = {
    pastoral: {
        border: 'border-border',
        bg: 'bg-muted/40',
        icon: 'text-muted-foreground',
        text: 'text-foreground',
    },
    seminary: {
        border: 'border-info/30',
        bg: 'bg-info-subtle',
        icon: 'text-info',
        text: 'text-info-subtle-foreground',
    },
    research: {
        border: 'border-success/30',
        bg: 'bg-success-subtle',
        icon: 'text-success',
        text: 'text-success-subtle-foreground',
    },
    publishable: {
        border: 'border-success/40',
        bg: 'bg-success-subtle',
        icon: 'text-success',
        text: 'text-success-subtle-foreground',
    },
};
