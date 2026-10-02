import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { MAX_PROMPT_CHARS } from '@dosfilos/infrastructure';
import { checkRecipeConsistency, type ExegeticalPaper } from '@dosfilos/domain';
import { useCorpusFootprint } from '@/hooks/exegesis/useCorpusFootprint';

/**
 * Cuánto del presupuesto del prompt ocupa el corpus del trabajo, sumando todas
 * las fuentes.
 *
 * Hasta acá el medidor vivía solo dentro del selector de páginas, así que para
 * saber cómo venía el total había que entrar a una fuente y leer "otras fuentes
 * ocupan N" — un número sin contexto, de una pantalla que hablaba de otra cosa.
 * El presupuesto es del trabajo; el lugar de mirarlo es el corpus.
 *
 * También avisa cuando una fuente guardó fragmentos que su propia receta no
 * declara. Esa inconsistencia hace que este mismo medidor mienta, así que
 * callarla sería sostener un número en el que no se puede confiar.
 */
export function CorpusBudgetMeter({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');

    // Cuenta también las páginas elegidas (ver `useCorpusFootprint`): antes
    // sólo sumaba fragmentos y una fuente con páginas valía cero.
    const { chars: totalChars, pending } = useCorpusFootprint(paper.sources);
    const percent = Math.round((totalChars / MAX_PROMPT_CHARS) * 100);
    const over = totalChars > MAX_PROMPT_CHARS;

    const inconsistent = paper.sources.filter(s => !checkRecipeConsistency(s).consistent);

    if (totalChars === 0) return null;

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
                    className={`h-full transition-all ${over ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
            </div>

            <p className="text-[11px] tabular-nums text-muted-foreground">
                {t('paperSetup.subSteps.corpus.budget.stats', {
                    sources: paper.sources.length,
                    chars: totalChars,
                })}
                {pending && ` · ${t('paperSetup.subSteps.corpus.budget.measuring')}`}
            </p>

            {over && (
                <p className="text-[11px] text-destructive">
                    {t('paperSetup.subSteps.corpus.budget.over')}
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
