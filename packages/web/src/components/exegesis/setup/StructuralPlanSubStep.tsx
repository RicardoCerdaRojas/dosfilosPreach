import type { ReactNode } from 'react';
import { ListTree, BookText, Layers, Crosshair } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { frameLeftOut, type ExegeticalPaper } from '@dosfilos/domain';
import { StepKindEmphasisCard } from './StepKindEmphasisCard';

/**
 * Structural plan sub-step.
 *
 * Surfaces the per-kind emphasis editor as three independent cards
 * (introduction / verses / conclusion). Each card pre-fills from the
 * rubric's `structuralExpectations` and lets the student override
 * with academic justification visible.
 *
 * v1 deliberately does NOT expose per-step (per-verse) overrides —
 * that's a v1.5 feature once the student has lived with kind-level
 * customization long enough to know where they need finer control.
 */
interface StructuralPlanSubStepProps {
    paper: ExegeticalPaper;
}

export function StructuralPlanSubStep({ paper }: StructuralPlanSubStepProps) {
    const { t } = useTranslation('exegesis');

    if (!paper.rubric) {
        return (
            <div className="space-y-4">
                <header className="flex items-start gap-3">
                    <ListTree className="h-5 w-5 text-success mt-0.5 shrink-0" />
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            {t('paperSetup.subSteps.plan.heading')}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t('paperSetup.subSteps.plan.description')}
                        </p>
                    </div>
                </header>
                <p className="text-xs text-warning-subtle-foreground italic">
                    {t('paperSetup.subSteps.plan.noRubric')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <header className="flex items-start gap-3">
                <ListTree className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        {t('paperSetup.subSteps.plan.heading')}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {t('paperSetup.subSteps.plan.description')}
                    </p>
                </div>
            </header>

            {frameLeftOut(paper, 'introduction')
                ? <FrameLeftOutNote kind="introduction" icon={<BookText className="h-4 w-4" />} />
                : <StepKindEmphasisCard paper={paper} kind="introduction" icon={<BookText className="h-4 w-4" />} />}
            <StepKindEmphasisCard paper={paper} kind="verse" icon={<Crosshair className="h-4 w-4" />} />
            {frameLeftOut(paper, 'conclusion')
                ? <FrameLeftOutNote kind="conclusion" icon={<Layers className="h-4 w-4" />} />
                : <StepKindEmphasisCard paper={paper} kind="conclusion" icon={<Layers className="h-4 w-4" />} />}
        </div>
    );
}

/** El marco que el encuadre deja fuera: se dice, en vez de planificarlo. */
function FrameLeftOutNote({ kind, icon }: { kind: 'introduction' | 'conclusion'; icon: ReactNode }) {
    const { t } = useTranslation('exegesis');
    return (
        <section className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 flex items-start gap-2 text-muted-foreground">
            <span className="mt-0.5">{icon}</span>
            <div>
                <p className="text-sm font-medium">{t(`paperSetup.subSteps.plan.leftOut.${kind}`)}</p>
                <p className="text-xs mt-0.5">{t('paperSetup.subSteps.plan.leftOut.body')}</p>
            </div>
        </section>
    );
}
