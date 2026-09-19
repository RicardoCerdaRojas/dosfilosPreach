import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus, SpellCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    countGlossaryHits,
    exportPaperToMarkdown,
    findGlossaryHits,
    type ExegeticalPaper,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useSaveTermGlossary, useTermGlossary } from '@/hooks/exegesis/useTermGlossary';

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
    const save = useSaveTermGlossary();
    const [nuevoEvitar, setNuevoEvitar] = useState('');
    const [nuevoPreferir, setNuevoPreferir] = useState('');

    const markdown = paper.assembledMarkdown?.trim() || exportPaperToMarkdown(paper);
    const hits = terms.length > 0 ? findGlossaryHits(markdown, terms) : [];
    const cuenta = countGlossaryHits(hits);

    const agregar = async () => {
        const avoid = nuevoEvitar.trim();
        if (avoid.length < 3) return;
        const prefer = nuevoPreferir.trim();
        try {
            await save.mutateAsync([...terms, { avoid, ...(prefer ? { prefer } : {}) }]);
            setNuevoEvitar('');
            setNuevoPreferir('');
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el glosario:', err);
            toast.error(t('detail.glossary.saveFailed'));
        }
    };

    const quitar = async (avoid: string) => {
        try {
            await save.mutateAsync(terms.filter(term => term.avoid !== avoid));
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el glosario:', err);
            toast.error(t('detail.glossary.saveFailed'));
        }
    };

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-center gap-2">
                <SpellCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{t('detail.glossary.title')}</h3>
                {save.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </header>

            {terms.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('detail.glossary.empty')}</p>
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

            <div className="border-t border-border pt-2 space-y-2">
                <div className="flex flex-wrap gap-1">
                    {terms.map(term => (
                        <span key={term.avoid} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground">
                            {term.avoid}
                            {term.prefer && <span className="text-muted-foreground">→ {term.prefer}</span>}
                            <button
                                type="button"
                                onClick={() => quitar(term.avoid)}
                                disabled={save.isPending}
                                aria-label={t('detail.glossary.remove', { term: term.avoid })}
                                className="text-muted-foreground hover:text-destructive"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        type="text"
                        value={nuevoEvitar}
                        onChange={e => setNuevoEvitar(e.target.value)}
                        placeholder={t('detail.glossary.avoidPlaceholder')}
                        aria-label={t('detail.glossary.avoidPlaceholder')}
                        className="flex-1 min-w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                        type="text"
                        value={nuevoPreferir}
                        onChange={e => setNuevoPreferir(e.target.value)}
                        placeholder={t('detail.glossary.preferPlaceholder')}
                        aria-label={t('detail.glossary.preferPlaceholder')}
                        className="flex-1 min-w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={agregar} disabled={save.isPending || nuevoEvitar.trim().length < 3}>
                        <Plus className="h-3 w-3 mr-1" />
                        {t('detail.glossary.add')}
                    </Button>
                </div>
            </div>
        </section>
    );
}
