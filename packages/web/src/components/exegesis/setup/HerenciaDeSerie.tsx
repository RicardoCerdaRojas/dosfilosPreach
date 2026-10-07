import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { excludedLast, exclusionFor, type ExcludedSource, type ExegeticalPaper } from '@dosfilos/domain';
import { useCorpusHeredado } from '@/hooks/exegesis/useCorpusHeredado';
import { usePaperExclusions } from '@/hooks/exegesis/usePaperExclusions';
import { useLibrary } from '@/hooks/library';
import { ExcludedBadge } from './ExcludedBadge';
import { useExcludedSourceConfirm } from './useExcludedSourceConfirm';

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
 * Los fragmentos y las páginas del hermano no viajan: son de otra perícopa.
 * Al traerlas se proponen páginas para ESTE pasaje en cada comentario
 * (`heredarConPaginas`); léxicos y gramáticas quedan para el selector.
 */
export function HerenciaDeSerie({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { propuesta, heredar, avance } = useCorpusHeredado(paper.id);
    // Las que el estudiante dio vuelta respecto de su estado inicial: marcada,
    // salvo las excluidas del trabajo, que arrancan desmarcadas (TP #6: la
    // serie ofrecía de un clic las fuentes de la semana anterior).
    const [alternadas, setAlternadas] = useState<Set<string>>(new Set());
    const exclusiones = usePaperExclusions(paper);
    const { resources } = useLibrary();
    const { guard, dialog: confirmExcluded } = useExcludedSourceConfirm();

    const datos = propuesta.data;
    if (!datos) return null;

    const exclusionDe = (f: { citationKey?: string | null; sourceLibraryResourceId: string }): ExcludedSource | null =>
        exclusionFor({
            citationKey: f.citationKey ?? null,
            author: resources.find(r => r.id === f.sourceLibraryResourceId)?.author ?? null,
        }, exclusiones);
    const fuentes = excludedLast(datos.fuentes, f => exclusionDe(f) !== null);
    const estaElegida = (f: (typeof fuentes)[number]) =>
        (exclusionDe(f) === null) !== alternadas.has(f.sourceLibraryResourceId);
    const elegidos = fuentes.filter(estaElegida);

    const alternar = (id: string) => {
        setAlternadas(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const traer = () => {
        const hits = elegidos.map(exclusionDe).filter((e): e is ExcludedSource => e !== null);
        guard(hits, () => void traerYa());
    };

    const traerYa = async () => {
        try {
            const r = await heredar.mutateAsync({ soloEstos: elegidos.map(f => f.sourceLibraryResourceId), paper });
            // Se informa cuántas ENTRARON, no cuántas se pidieron: si alguien
            // adjuntó una a mano mientras tanto, el caso de uso no la duplica.
            const partes = [t('paperSetup.subSteps.corpus.herencia.toast', { count: r.creadas })];
            if (r.conPaginas > 0) partes.push(t('paperSetup.subSteps.corpus.herencia.toastConPaginas', { count: r.conPaginas }));
            if (r.porLema > 0) partes.push(t('paperSetup.subSteps.corpus.herencia.toastPorLema', { count: r.porLema }));
            if (r.sinPropuesta > 0) partes.push(t('paperSetup.subSteps.corpus.herencia.toastSinPropuesta', { count: r.sinPropuesta }));
            toast.success(partes.join(' '));
            setAlternadas(new Set());
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
                {fuentes.map(f => {
                    const elegida = estaElegida(f);
                    const exclusion = exclusionDe(f);
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
                                {exclusion && <ExcludedBadge exclusion={exclusion} />}
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
                    {heredar.isPending && avance
                        ? t('paperSetup.subSteps.corpus.herencia.proponiendo', { hechas: avance.hechas, total: avance.total })
                        : t('paperSetup.subSteps.corpus.herencia.cta', { count: elegidos.length })}
                </button>
                <p className="mt-3 text-[11.5px] text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.herencia.nota')}
                </p>
            </div>
            {confirmExcluded}
        </div>
    );
}
