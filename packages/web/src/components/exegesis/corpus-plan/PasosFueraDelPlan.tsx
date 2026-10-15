import { toast } from 'sonner';
import { formatPassageReference, type ExegeticalStep } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

/**
 * Los pasos fuera del documento, cada uno con su interruptor.
 *
 * El plan sólo decía «2 pasos quedan fuera» y la inclusión se cambiaba
 * únicamente desde la página del trabajo: en el TP #7 el fundador agregó
 * «(Stg. 3:15)» al encuadre y no tenía cómo meter 3:15 desde el plan (#16).
 */
export function PasosFueraDelPlan({ paperId, steps }: { paperId: string; steps: ReadonlyArray<ExegeticalStep> }) {
    const { t, i18n } = useTranslation('exegesis');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
    const { setStepInclusion } = useExegesisPapers();
    if (steps.length === 0) return null;
    const nombre = (s: ExegeticalStep) => s.verseRef
        ? formatPassageReference(s.verseRef, lang)
        : t(`detail.steps.kind.${s.kind}`);
    return (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
                {t('paperSetup.subSteps.corpus-plan.outsideDocument', { count: steps.length })}
            </p>
            <ul className="flex flex-wrap gap-1.5">
                {steps.map(s => (
                    <li key={s.id}>
                        <button
                            type="button"
                            disabled={setStepInclusion.isPending}
                            onClick={() => setStepInclusion.mutate(
                                { paperId, stepId: s.id, include: true },
                                { onError: () => toast.error(t('detail.steps.assembly.toggleFailed')) },
                            )}
                            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                            aria-label={t('paperSetup.subSteps.corpus-plan.includeStepAria', { name: nombre(s) })}
                        >
                            + {nombre(s)}
                        </button>
                    </li>
                ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">{t('paperSetup.subSteps.corpus-plan.includeStepHint')}</p>
        </div>
    );
}
