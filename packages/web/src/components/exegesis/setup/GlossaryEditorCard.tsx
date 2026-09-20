import { useState } from 'react';
import { Loader2, Plus, SpellCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useSaveTermGlossary, useTermGlossary } from '@/hooks/exegesis/useTermGlossary';

/**
 * Las palabras que este autor no usa.
 *
 * La LISTA es de la persona y vive en sus ajustes; la COMPROBACIÓN de si
 * aparecen es de cada trabajo y vive en su página. Antes las dos estaban
 * en el trabajo, y desde ahí parecía que la lista había que rehacerla en
 * cada entrega.
 */
export function GlossaryEditorCard() {
    const { t } = useTranslation('exegesis');
    const { terms } = useTermGlossary();
    const save = useSaveTermGlossary();
    const [evitar, setEvitar] = useState('');
    const [preferir, setPreferir] = useState('');

    const guardar = async (siguientes: Parameters<typeof save.mutateAsync>[0]) => {
        try {
            await save.mutateAsync(siguientes);
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el glosario:', err);
            toast.error(t('detail.glossary.saveFailed'));
        }
    };

    const agregar = async () => {
        const avoid = evitar.trim();
        if (avoid.length < 3) return;
        const prefer = preferir.trim();
        await guardar([...terms, { avoid, ...(prefer ? { prefer } : {}) }]);
        setEvitar('');
        setPreferir('');
    };

    return (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-start gap-3">
                <SpellCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{t('detail.glossary.title')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('detail.glossary.settingsDescription')}</p>
                </div>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </header>

            <div className="pl-7 space-y-2">
                {terms.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('detail.glossary.empty')}</p>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {terms.map(term => (
                            <span key={term.avoid} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground">
                                {term.avoid}
                                {term.prefer && <span className="text-muted-foreground">→ {term.prefer}</span>}
                                <button
                                    type="button"
                                    onClick={() => guardar(terms.filter(x => x.avoid !== term.avoid))}
                                    disabled={save.isPending}
                                    aria-label={t('detail.glossary.remove', { term: term.avoid })}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    <input
                        type="text"
                        value={evitar}
                        onChange={e => setEvitar(e.target.value)}
                        placeholder={t('detail.glossary.avoidPlaceholder')}
                        aria-label={t('detail.glossary.avoidPlaceholder')}
                        className="flex-1 min-w-32 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                        type="text"
                        value={preferir}
                        onChange={e => setPreferir(e.target.value)}
                        placeholder={t('detail.glossary.preferPlaceholder')}
                        aria-label={t('detail.glossary.preferPlaceholder')}
                        className="flex-1 min-w-32 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={agregar} disabled={save.isPending || evitar.trim().length < 3}>
                        <Plus className="h-3 w-3 mr-1" />
                        {t('detail.glossary.add')}
                    </Button>
                </div>
            </div>
        </section>
    );
}
