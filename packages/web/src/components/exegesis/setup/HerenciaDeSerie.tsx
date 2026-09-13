import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCorpusHeredado } from '@/hooks/exegesis/useCorpusHeredado';

/**
 * «Las fuentes que ya usaste en esta serie».
 *
 * Un plan de predicación recorre un libro en pericopas, y el corpus que se armó
 * para una sirve casi siempre para la siguiente. Esta tarjeta lo ofrece de una
 * vez en lugar de hacerlo rearmar libro por libro.
 *
 * Se muestra SÓLO cuando hay algo que traer: el caso de uso devuelve `null`
 * cuando no hay serie, no hay hermanos o ya está todo presente. Una tarjeta
 * vacía enseñaría a ignorar el aviso cuando sí tenga algo.
 *
 * Llegan sin fragmentos a propósito: los excerpts se extraen contra un pasaje
 * concreto, y traer los de Jonás 2 a Jonás 3 metería citas fuera de lugar.
 */
export function HerenciaDeSerie({ paperId }: { paperId: string }) {
    const { t } = useTranslation('exegesis');
    const { propuesta, heredar } = useCorpusHeredado(paperId);
    const [excluidos, setExcluidos] = useState<Set<string>>(new Set());

    const datos = propuesta.data;
    if (!datos) return null;

    const elegidos = datos.fuentes.filter(f => !excluidos.has(f.sourceLibraryResourceId));

    const alternar = (id: string) => {
        setExcluidos(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const traer = async () => {
        try {
            const creadas = await heredar.mutateAsync(elegidos.map(f => f.sourceLibraryResourceId));
            // Se informa cuántas ENTRARON, no cuántas se pidieron: si alguien
            // adjuntó una a mano mientras tanto, el caso de uso no la duplica y
            // el número tiene que reflejar eso.
            toast.success(t('paperSetup.subSteps.corpus.herencia.toast', { count: creadas.length }));
            setExcluidos(new Set());
        } catch {
            toast.error(t('paperSetup.subSteps.corpus.herencia.error'));
        }
    };

    return (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/15 p-2 shrink-0">
                    <Layers className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-semibold">
                        {t('paperSetup.subSteps.corpus.herencia.eyebrow')}
                    </p>
                    <h4 className="text-base font-semibold text-foreground mt-0.5">
                        {t('paperSetup.subSteps.corpus.herencia.title', { count: datos.fuentes.length })}
                    </h4>
                    <p className="text-[12.5px] text-foreground/80 leading-relaxed mt-1.5">
                        {t('paperSetup.subSteps.corpus.herencia.body')}
                    </p>
                    {datos.yaPresentes > 0 && (
                        <p className="text-[11.5px] text-muted-foreground mt-1">
                            {t('paperSetup.subSteps.corpus.herencia.yaPresentes', { count: datos.yaPresentes })}
                        </p>
                    )}
                </div>
            </div>

            <ul className="space-y-1">
                {datos.fuentes.map(f => {
                    const elegida = !excluidos.has(f.sourceLibraryResourceId);
                    return (
                        <li key={f.sourceLibraryResourceId}>
                            <label className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-primary/10 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={elegida}
                                    onChange={() => alternar(f.sourceLibraryResourceId)}
                                    className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0"
                                />
                                <span className="text-[12.5px] text-foreground truncate flex-1 min-w-0">
                                    {f.displayLabel}
                                </span>
                                {f.citationKey && (
                                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                                        {f.citationKey}
                                    </span>
                                )}
                            </label>
                        </li>
                    );
                })}
            </ul>

            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-primary/20">
                <button
                    type="button"
                    onClick={traer}
                    disabled={elegidos.length === 0 || heredar.isPending}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {heredar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                    {t('paperSetup.subSteps.corpus.herencia.cta', { count: elegidos.length })}
                </button>
                <p className="mt-3 text-[11.5px] text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.herencia.nota')}
                </p>
            </div>
        </div>
    );
}
