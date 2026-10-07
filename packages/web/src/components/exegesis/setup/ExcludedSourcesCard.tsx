import { useMemo, useState } from 'react';
import { Ban, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    previousDelivery,
    proposeExclusions,
    type ExcludedSource,
    type ExegeticalPaper,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

/**
 * Las fuentes que este trabajo no puede usar, como dato y no como frase del
 * encuadre (TP #6, 2026-10-07: «Extraer de mi biblioteca» recomendó las
 * cuatro que el encuadre prohibía).
 *
 * La primera vez propone lo citado en la entrega anterior; el estudiante lo
 * confirma o lo descarta, porque la regla de no repetir es del sílabo de SU
 * curso y no del sistema. Con eso el resto del corpus las pone al final,
 * marcadas, y los pasos que redactan las reciben.
 */
export function ExcludedSourcesCard({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { papers, updatePaperExcludedSources } = useExegesisPapers();
    const [nueva, setNueva] = useState('');
    // Claves de la propuesta que el estudiante desmarcó: lo citado la vez
    // pasada incluye léxicos y gramáticas que el sílabo suele permitir.
    const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set());

    const confirmadas = paper.excludedSources ?? null;
    const propuesta = useMemo(
        () => (confirmadas === null ? proposeExclusions(previousDelivery(papers, paper.id)) : []),
        [confirmadas, papers, paper.id],
    );
    const lista = confirmadas ?? [];

    const guardar = async (excludedSources: ReadonlyArray<ExcludedSource>): Promise<boolean> => {
        try {
            await updatePaperExcludedSources.mutateAsync({ paperId: paper.id, excludedSources });
            return true;
        } catch (err) {
            console.error('[exegesis] update excluded sources failed:', err);
            toast.error(t('paperSetup.subSteps.corpus.excluded.saveFailed'));
            return false;
        }
    };

    const agregar = async () => {
        const key = nueva.trim();
        if (!key) return;
        // Si falla, lo escrito se queda para reintentar.
        if (await guardar([...lista, { key, previousPaperTitle: null }])) setNueva('');
    };

    const alternar = (key: string) => setDesmarcadas(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });
    const elegidas = propuesta.filter(e => !desmarcadas.has(e.key));

    const ocupado = updatePaperExcludedSources.isPending;

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby="excluded-sources-title">
            <header className="flex items-start gap-2">
                <Ban className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                    <h3 id="excluded-sources-title" className="text-sm font-semibold text-foreground">
                        {t('paperSetup.subSteps.corpus.excluded.title')}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('paperSetup.subSteps.corpus.excluded.hint')}</p>
                </div>
            </header>

            {propuesta.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning-subtle/40 p-3 space-y-2">
                    <p className="text-xs text-warning-subtle-foreground">
                        {t('paperSetup.subSteps.corpus.excluded.proposal', {
                            paper: propuesta[0]!.previousPaperTitle ?? t('paperSetup.subSteps.corpus.excluded.previousFallback'),
                        })}
                    </p>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {propuesta.map(e => (
                            <li key={e.key}>
                                <label className="inline-flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!desmarcadas.has(e.key)}
                                        onChange={() => alternar(e.key)}
                                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                                    />
                                    {e.key}
                                </label>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" disabled={ocupado || elegidas.length === 0} onClick={() => void guardar(elegidas)}>
                            {t('paperSetup.subSteps.corpus.excluded.accept')}
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => void guardar([])}>
                            {t('paperSetup.subSteps.corpus.excluded.decline')}
                        </Button>
                    </div>
                </div>
            )}

            {lista.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {lista.map(e => (
                        <li key={e.key} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 py-0.5 text-xs">
                            <span className="font-medium text-foreground">{e.key}</span>
                            <span className="text-muted-foreground">
                                · {e.previousPaperTitle
                                    ? t('paperSetup.subSteps.corpus.excluded.citedIn', { paper: e.previousPaperTitle })
                                    : t('paperSetup.subSteps.corpus.excluded.byYou')}
                            </span>
                            <button
                                type="button"
                                disabled={ocupado}
                                onClick={() => void guardar(lista.filter(x => x.key !== e.key))}
                                aria-label={t('paperSetup.subSteps.corpus.excluded.remove', { source: e.key })}
                                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Con la propuesta pendiente, agregar a mano la descartaría: primero se decide. */}
            {propuesta.length === 0 && <form
                className="flex gap-2"
                onSubmit={(ev) => { ev.preventDefault(); void agregar(); }}
            >
                <Input
                    value={nueva}
                    onChange={(ev) => setNueva(ev.target.value)}
                    placeholder={t('paperSetup.subSteps.corpus.excluded.placeholder')}
                    aria-label={t('paperSetup.subSteps.corpus.excluded.placeholder')}
                    className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="outline" disabled={ocupado || !nueva.trim()}>
                    <Plus className="h-3 w-3 mr-1" />
                    {t('paperSetup.subSteps.corpus.excluded.add')}
                </Button>
            </form>}
        </section>
    );
}
