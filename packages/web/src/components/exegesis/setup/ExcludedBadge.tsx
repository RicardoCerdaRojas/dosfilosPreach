import { Ban } from 'lucide-react';
import type { ExcludedSource } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/** «Excluida · Citada en el TP #5»: va al lado del libro en cada lista. */
export function ExcludedBadge({ exclusion }: { exclusion: ExcludedSource }) {
    const { t } = useTranslation('exegesis');
    return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning-subtle-foreground">
            <Ban className="h-2.5 w-2.5" aria-hidden />
            {exclusion.previousPaperTitle
                ? t('paperSetup.subSteps.corpus.excluded.badgeCitedIn', { paper: exclusion.previousPaperTitle })
                : t('paperSetup.subSteps.corpus.excluded.badge')}
        </span>
    );
}
