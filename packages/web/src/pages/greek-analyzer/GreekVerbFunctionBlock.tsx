import { useTranslation } from 'react-i18next';
import { TENSE_USE_SOURCES, VERB_RULE_SOURCES, verbFunctionSources, type GreekWordInsight } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';

/**
 * G2 — la función del verbo (Wallace) en la ficha de la palabra: qué hace el
 * participio, el infinitivo o el modo, y el uso del tiempo en el indicativo
 * (el «presente habitual» de βλασφημοῦσιν, Stg 2:7, que pidió el profesor).
 * «Regla» si la decidió el texto; «Asistente» si la eligió de la lista que el
 * texto acota.
 */
export function GreekVerbFunctionBlock({ insight, mood }: { insight?: GreekWordInsight; /** Modo de MorphGNT: elige la fuente (participio o infinitivo). */ mood?: string }) {
    const { t } = useTranslation('greekTutor');
    if (!insight?.verbFunction && !insight?.tenseUse) return null;
    const etiqueta = (porRegla: boolean) => (
        <span
            title={porRegla && insight.verbRule ? t('analyzer.verbFn.ruleTitle', { why: t(`analyzer.verbFn.rules.${insight.verbRule}`) }) : t('analyzer.verbFn.assistantTitle')}
            className={
                porRegla
                    ? 'rounded border border-success/40 bg-success/10 px-1 text-[9.5px] font-semibold uppercase tracking-wider text-success'
                    : 'rounded border border-info/40 bg-info/10 px-1 text-[9.5px] font-semibold uppercase tracking-wider text-info'
            }
        >
            {porRegla ? t('analyzer.verbFn.rule') : t('analyzer.verbFn.assistant')}
        </span>
    );
    return (
        <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1" data-testid="verb-function">
            {insight.verbFunction && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('analyzer.verbFn.title')}</span>
                    <span className="font-medium">{t(`analyzer.verbFn.functions.${insight.verbFunction}`)}</span>
                    {etiqueta(!!insight.verbRule)}
                    {insight.verbRule && (
                        <span className="text-[11px] text-muted-foreground">({t(`analyzer.verbFn.rules.${insight.verbRule}`)})</span>
                    )}
                </div>
            )}
            {insight.tenseUse && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('analyzer.verbFn.tenseTitle')}</span>
                    <span className="font-medium">{t(`analyzer.verbFn.tenseUses.${insight.tenseUse}`)}</span>
                    {etiqueta(false)}
                </div>
            )}
            {insight.verbNote && <p className="text-xs leading-snug text-foreground/80">{insight.verbNote}</p>}
            <SourceNote
                sources={[
                    ...(insight.verbRule
                        ? VERB_RULE_SOURCES[insight.verbRule]
                        : insight.verbFunction
                          ? verbFunctionSources(insight.verbFunction, mood === 'P' ? 'participle' : mood === 'N' ? 'infinitive' : 'other')
                          : []),
                    ...(insight.tenseUse ? TENSE_USE_SOURCES[insight.tenseUse] : []),
                ]}
            />
        </div>
    );
}
