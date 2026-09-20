import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, SpellCheck } from 'lucide-react';
import {
    countGlossaryHits,
    exportPaperToMarkdown,
    findGlossaryHits,
    type ExegeticalPaper,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useTermGlossary } from '@/hooks/exegesis/useTermGlossary';

/**
 * Las palabras que no son suyas, encontradas en lo que se va a entregar.
 *
 * El autor tachó a mano «tronco», «atestiguada» y varios calcos del
 * inglés en su primer trabajo. El prompt ya pide no usarlas, y el modelo
 * casi siempre obedece: «casi siempre» es lo que obliga a releer el
 * trabajo entero buscando. Esto lo busca por él.
 *
 * No reemplaza solo. Cambiar una palabra dentro de una frase compuesta
 * puede romper la concordancia, y el trabajo lo firma él.
 */
export function GlossaryCheckCard({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { terms } = useTermGlossary();

    const markdown = paper.assembledMarkdown?.trim() || exportPaperToMarkdown(paper);
    const hits = terms.length > 0 ? findGlossaryHits(markdown, terms) : [];
    const cuenta = countGlossaryHits(hits);



    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-center gap-2">
                <SpellCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{t('detail.glossary.title')}</h3>
            </header>

            {terms.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    {t('detail.glossary.emptyInPaper')}{' '}
                    <Link to="/dashboard/settings?tab=writing" className="underline underline-offset-2 text-foreground">
                        {t('detail.glossary.goToSettings')}
                    </Link>
                </p>
            ) : hits.length === 0 ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('detail.glossary.clean', { count: terms.length })}
                </p>
            ) : (
                <div className="space-y-2">
                    <p className="inline-flex items-center gap-1.5 text-xs text-warning-subtle-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        {t('detail.glossary.found', { count: hits.length })}
                    </p>
                    <ul className="space-y-1.5">
                        {[...cuenta.entries()].map(([avoid, n]) => {
                            const term = terms.find(x => x.avoid === avoid)!;
                            const primera = hits.find(h => h.term.avoid === avoid)!;
                            return (
                                <li key={avoid} className="text-xs">
                                    <span className="font-medium text-foreground">{avoid}</span>
                                    <span className="text-muted-foreground"> · {t('detail.glossary.times', { count: n })}</span>
                                    {term.prefer && (
                                        <span className="text-muted-foreground"> → {term.prefer}</span>
                                    )}
                                    <span className="block text-[11px] text-muted-foreground italic line-clamp-2">
                                        «{primera.context}»
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="text-[11px] text-muted-foreground">{t('detail.glossary.howToFix')}</p>
                </div>
            )}

        </section>
    );
}
