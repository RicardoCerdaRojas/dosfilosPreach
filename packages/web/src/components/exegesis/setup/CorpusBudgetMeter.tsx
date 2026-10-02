import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { PRIOR_ANALYSES_BUDGET_CHARS, VERSE_CORPUS_SPACE_CHARS } from '@dosfilos/infrastructure';
import { CURATED_CORPUS_BUDGET_CHARS, checkRecipeConsistency, type ExegeticalPaper } from '@dosfilos/domain';
import { useCorpusFootprint } from '@/hooks/exegesis/useCorpusFootprint';

/**
 * Cuánto corpus llega a cada versículo, contra el espacio que tiene.
 *
 * Mide lo que VIAJA, no lo que está guardado (ver `corpusFootprint`): las
 * hojas elegidas se consultan por versículo hasta un tope y no viajan enteras.
 * El medidor de #730 las sumaba completas y marcaba 129% con ~130.000
 * caracteres por versículo; el autor sacó fuentes que no hacía falta sacar.
 *
 * También avisa cuando una fuente guardó fragmentos que su propia receta no
 * declara.
 */
export function CorpusBudgetMeter({ paper }: { paper: ExegeticalPaper }) {
    const { t, i18n } = useTranslation('exegesis');
    const n = (x: number) => x.toLocaleString(i18n.language);

    const { perStepChars, admittedChars, pending } = useCorpusFootprint(paper.sources);
    const percent = Math.round((perStepChars / VERSE_CORPUS_SPACE_CHARS) * 100);
    const over = perStepChars > VERSE_CORPUS_SPACE_CHARS;
    // Los análisis ya aceptados ocupan el mismo mensaje: al final del pasaje
    // queda menos espacio para el corpus.
    const late = !over && perStepChars > VERSE_CORPUS_SPACE_CHARS - PRIOR_ANALYSES_BUDGET_CHARS;

    const inconsistent = paper.sources.filter(s => !checkRecipeConsistency(s).consistent);

    if (perStepChars === 0 && admittedChars === 0 && !pending) return null;

    return (
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.budget.title')}
                </span>
                <span className={`text-xs font-semibold tabular-nums ${over ? 'text-destructive' : 'text-foreground'}`}>
                    {percent}%
                </span>
            </div>

            <div
                className="h-1.5 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuenow={Math.min(percent, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('paperSetup.subSteps.corpus.budget.title')}
            >
                <div
                    className={`h-full transition-all ${over ? 'bg-destructive' : late ? 'bg-warning' : 'bg-primary'}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
            </div>

            <p className="text-[11px] tabular-nums text-muted-foreground">
                {t('paperSetup.subSteps.corpus.budget.stats', {
                    chars: n(perStepChars),
                    space: n(VERSE_CORPUS_SPACE_CHARS),
                    sources: paper.sources.length,
                })}
                {pending && ` · ${t('paperSetup.subSteps.corpus.budget.measuring')}`}
            </p>

            {admittedChars > 0 && (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.budget.consulted', {
                        admitted: n(admittedChars),
                        cap: n(CURATED_CORPUS_BUDGET_CHARS),
                    })}
                </p>
            )}

            {over && (
                <p className="text-[11px] text-destructive">
                    {t('paperSetup.subSteps.corpus.budget.over')}
                </p>
            )}

            {late && (
                <p className="text-[11px] text-warning-subtle-foreground">
                    {t('paperSetup.subSteps.corpus.budget.late', { prior: n(PRIOR_ANALYSES_BUDGET_CHARS) })}
                </p>
            )}

            {inconsistent.length > 0 && (
                <p className="flex items-start gap-1.5 text-[11px] text-warning-subtle-foreground">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>
                        {t('paperSetup.subSteps.corpus.budget.inconsistent', {
                            count: inconsistent.length,
                            labels: inconsistent.map(s => s.displayLabel).join(', '),
                        })}
                    </span>
                </p>
            )}
        </div>
    );
}
