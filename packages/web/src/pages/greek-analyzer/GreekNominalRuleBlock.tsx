import { useTranslation } from 'react-i18next';
import { NOMINAL_RULE_SOURCES, type GreekWordInsight } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';

const Regla = () => {
    const { t } = useTranslation('greekTutor');
    return (
        <span className="rounded border border-success/40 bg-success/10 px-1 text-[9.5px] font-semibold uppercase tracking-wider text-success">
            {t('analyzer.verbFn.rule')}
        </span>
    );
};

/**
 * G3 — la AGENCIA de una preposición con verbo pasivo (profesor #G5, Stg 2:9
 * «ἐλεγχόμενοι ὑπὸ τοῦ νόμου»: agente último). La decide el texto.
 */
export function GreekAgencyBlock({ insight }: { insight?: GreekWordInsight }) {
    const { t } = useTranslation('greekTutor');
    if (!insight?.agency || !insight.nominalRule) return null;
    return (
        <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1" data-testid="agency">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('analyzer.agency.title')}</span>
                <span className="font-medium">{t(`analyzer.agency.${insight.agency}`)}</span>
                <Regla />
                <span className="text-[11px] text-muted-foreground">
                    ({t(insight.nominalRule === 'agentDia' ? 'analyzer.agency.ruleAgentDia' : 'analyzer.agency.ruleAgentHypo')})
                </span>
            </div>
            <SourceNote sources={NOMINAL_RULE_SOURCES[insight.nominalRule]} />
        </div>
    );
}

/** G3 — el artículo anafórico decidido por el texto (profesor #G6): «Regla» y su fuente. */
export function GreekAnaphoraRuleNote({ insight }: { insight?: GreekWordInsight }) {
    const { t } = useTranslation('greekTutor');
    if (insight?.nominalRule !== 'anaphoraLemma') return null;
    return (
        <div className="space-y-0.5" data-testid="anaphora-rule">
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Regla /> {t('analyzer.agency.ruleAnaphora')}
            </p>
            <SourceNote sources={NOMINAL_RULE_SOURCES.anaphoraLemma} />
        </div>
    );
}
