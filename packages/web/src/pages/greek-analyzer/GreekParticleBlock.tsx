import { GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DISCOURSE_RULE_SOURCES, discourseRuleDecides, type GreekWordInsight } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';
import { FichaOrigenRotulo } from '@/components/word-ficha/FichaPiezas';

interface Props {
    insight: GreekWordInsight;
}

/**
 * Qué hace una partícula en el ARGUMENTO, no sólo qué significa.
 *
 * δέ aparece 2.766 veces en el NT y recibía una línea genérica. Son las
 * palabras que ARTICULAN el razonamiento: quien las lee bien sigue el
 * argumento del autor; quien las ignora predica versículos sueltos.
 */
export function GreekParticleBlock({ insight }: Props) {
    const { t } = useTranslation('greekTutor');
    // El pronombre explícito es un HECHO del texto: se muestra aunque el
    // asistente no haya devuelto la función (revisión de G4).
    if (!insight.discourseFunction && insight.discourseRule !== 'overtPronoun') return null;

    return (
        <div className="rounded-md border border-success/30 bg-success/5 p-2.5 space-y-1">
            <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                <GitBranch className="h-3 w-3" />
                {t('analyzer.discourse.title')}
            </h4>
            {/* #G1 (profesor, Stg 2:7): el pronombre sobra porque el verbo ya dice la persona. */}
            {insight.discourseRule === 'overtPronoun' && insight.overtPronounVerbText && (
                <p className="text-xs" data-testid="overt-pronoun">
                    {t('analyzer.discourse.overtPronoun', { verb: insight.overtPronounVerbText })}
                </p>
            )}
            {insight.discourseFunction && (
                <p className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="font-semibold">{t(`analyzer.discourse.${insight.discourseFunction}`)}</span>
                    {insight.discourseRule && (
                        <FichaOrigenRotulo origen={discourseRuleDecides(insight.discourseRule) ? 'regla' : 'asistente'} />
                    )}
                    {' — '}
                    <span className="text-muted-foreground">
                        {t(`analyzer.discourseHint.${insight.discourseFunction}`)}
                    </span>
                </p>
            )}
            {insight.discourseRule && <SourceNote sources={DISCOURSE_RULE_SOURCES[insight.discourseRule]} />}
            {insight.connects && (
                <p className="text-xs">
                    <span className="text-muted-foreground">{t('analyzer.discourse.connects')}: </span>
                    {insight.connects}
                </p>
            )}
        </div>
    );
}
