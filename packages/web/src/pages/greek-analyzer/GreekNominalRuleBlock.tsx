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

/**
 * G3 — αὐτός intensivo («αὐτὸς ὁ κύριος», «el Señor mismo», 1 Ts 4:16) o
 * identificador («ὁ αὐτὸς κύριος», «el mismo Señor»): lo decide su posición.
 */
export function GreekAutosBlock({ insight }: { insight?: GreekWordInsight }) {
    const { t } = useTranslation('greekTutor');
    if (!insight?.autosUse || !insight.nominalRule) return null;
    const head = insight.autosHeadText;
    const tr = insight.autosHeadTranslation;
    // La concordancia la pone la traducción del PROPIO αὐτός, que el asistente da en español
    // («misma», «los mismos»): el género griego no sirve («τὴν αὐτὴν ἀγάπην» = «el mismo amor»).
    const own = insight.translation?.trim() ?? '';
    const esMismo = /\bmism[oa]s?\b/i.test(own);
    const frase =
        insight.autosUse === 'intensive' ? esMismo : esMismo && /^(el|la|los|las|lo) /i.test(own);
    const trBase = insight.autosUse === 'identical' ? tr?.replace(/^(el|la|los|las|lo) /i, '') : tr;
    const hint = insight.autosTogether
        ? t('analyzer.autos.together')
        : head && tr
          ? t(`analyzer.autos.${insight.autosUse}${frase ? 'HintTr' : 'Hint'}`, { head, tr: frase ? trBase : tr, own })
          : t(`analyzer.autos.${insight.autosUse}HintNoHead`);
    // Un análisis guardado antes de la regla pudo traducirlo «él»: se avisa en vez de contradecirlo.
    const vieja = !insight.autosTogether && !!own && !/mism|propi|persona|junt|igual/i.test(own);
    return (
        <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1" data-testid="autos">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('analyzer.autos.title')}</span>
                <span className="font-medium">{t(`analyzer.autos.${insight.autosUse}`)}</span>
                <Regla />
                <span className="text-[11px] text-muted-foreground">
                    ({t(insight.autosUse === 'intensive' ? 'analyzer.autos.ruleIntensive' : 'analyzer.autos.ruleIdentical')})
                </span>
            </div>
            <p className="text-xs text-muted-foreground">{hint}</p>
            {vieja && (
                <p className="text-[11px] text-warning" data-testid="autos-stale">
                    {t('analyzer.autos.staleTranslation', { own })}
                </p>
            )}
            <SourceNote sources={NOMINAL_RULE_SOURCES[insight.nominalRule]} />
        </div>
    );
}
