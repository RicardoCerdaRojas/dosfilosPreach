import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { parseIgnoredGrammarCategories } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Las reglas del curso que rigen este trabajo. Dos fuentes:
 * - las de la guía, que llegan de la devolución con «Pasar a tu guía» (se
 *   deciden en el escritorio del curso; aquí se muestran);
 * - las categorías que la gramática del curso marca «IGNORA», que el análisis
 *   recibe como prohibición de decisión (TP #11).
 */
export function CourseRulesCard({ guideRules, ignored, projectId, saving, onSaveIgnored }: {
    guideRules: ReadonlyArray<string>;
    ignored: ReadonlyArray<string>;
    projectId: string | null;
    saving: boolean;
    onSaveIgnored: (categories: string[]) => Promise<unknown>;
}) {
    const { t } = useTranslation('exegesis');
    const original = ignored.join('\n');
    const [texto, setTexto] = useState(original);
    const guardar = async () => {
        try {
            await onSaveIgnored(parseIgnoredGrammarCategories(texto));
            toast.success(t('inputs.rules.ignoredSaved'));
        } catch (err) {
            console.error('[inputs] no se pudieron guardar las categorías', err);
            toast.error(t('inputs.saveFailed'));
        }
    };
    return (
        <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-labelledby="reglas-titulo">
            <div>
                <h3 id="reglas-titulo" className="font-serif text-base font-semibold text-foreground">{t('inputs.rules.title')}</h3>
                <p className="text-xs text-muted-foreground">{t('inputs.rules.subtitle')}</p>
            </div>
            <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('inputs.rules.guideHeading', { count: guideRules.length })}</p>
                {guideRules.length === 0
                    ? <p className="text-xs text-muted-foreground">{t('inputs.rules.guideEmpty')}</p>
                    : (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground" data-testid="reglas-de-la-guia">
                            {guideRules.map(r => <li key={r}>{r}</li>)}
                        </ul>
                    )}
                {projectId && (
                    <Link to={`/dashboard/projects/${projectId}`} className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {t('inputs.rules.toDesk')}
                    </Link>
                )}
            </div>
            <div className="space-y-1.5">
                <label htmlFor="categorias-vetadas" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('inputs.rules.ignoredHeading')}
                </label>
                <p id="categorias-vetadas-ayuda" className="text-xs text-muted-foreground">{t('inputs.rules.ignoredHint')}</p>
                <textarea
                    id="categorias-vetadas"
                    aria-describedby="categorias-vetadas-ayuda"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    rows={4}
                    placeholder={t('inputs.rules.ignoredPlaceholder')}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                    type="button"
                    onClick={() => void guardar()}
                    disabled={saving || texto.trim() === original.trim()}
                    className="min-h-9 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                    {t('inputs.rules.ignoredSave')}
                </button>
            </div>
        </section>
    );
}
