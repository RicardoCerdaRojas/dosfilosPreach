import { useMemo, useState } from 'react';
import { Link2Off } from 'lucide-react';
import { toast } from 'sonner';
import { guessSourceForOrphanKey, orphanCitationKeys, type ExegeticalPaper } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

/**
 * Lo generado cita una clave que ya no es de ninguna fuente del corpus.
 *
 * Pasa cuando una fuente se renombró antes de que el renombre se propagara:
 * en el TP #6 el análisis citaba «Aland» con la fuente llamada «NA28», el
 * verificador respondía «ninguna fuente coincide» y el trabajo ensamblado
 * citaba «(Aland, p. 722)». Aquí se dice a qué fuente corresponde y se
 * corrige en todo el trabajo.
 */
export function OrphanCitationKeysNotice({ paper, analysis }: { paper: ExegeticalPaper; analysis: unknown }) {
    const { t } = useTranslation('exegesis');
    const { renameCitationKey } = useExegesisPapers();
    const huerfanas = useMemo(() => orphanCitationKeys(analysis, paper.sources), [analysis, paper.sources]);
    const claves = useMemo(
        () => [...new Set(paper.sources.map(s => s.citationKey).filter((k): k is string => !!k))].sort(),
        [paper.sources],
    );
    const [elegida, setElegida] = useState<Record<string, string>>({});
    // Propuesta: la fuente cuyo rótulo nombra la clave vieja.
    const propuesta = (from: string) => elegida[from] ?? guessSourceForOrphanKey(from, paper.sources)?.citationKey ?? claves[0]!;

    if (huerfanas.length === 0 || claves.length === 0) return null;

    const corregir = async (from: string) => {
        const to = propuesta(from);
        try {
            await renameCitationKey.mutateAsync({ paperId: paper.id, from, to });
            toast.success(t('canonical.review.orphanKeys.done', { from, to }));
        } catch (err) {
            console.error('[exegesis] rename citation key failed:', err);
            toast.error(t('canonical.review.orphanKeys.failed'));
        }
    };

    return (
        <section className="rounded-xl border border-warning/40 bg-warning-subtle/40 px-4 py-3 space-y-2">
            <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-subtle-foreground">
                <Link2Off className="h-3.5 w-3.5" />
                {t('canonical.review.orphanKeys.title', { count: huerfanas.length })}
            </h2>
            <p className="text-[11px] text-warning-subtle-foreground">{t('canonical.review.orphanKeys.body')}</p>
            <ul className="space-y-1.5">
                {huerfanas.map(from => (
                    <li key={from} className="flex flex-wrap items-center gap-2 text-[11px] text-foreground">
                        <span>{t('canonical.review.orphanKeys.item', { from })}</span>
                        <select
                            aria-label={t('canonical.review.orphanKeys.pick', { from })}
                            value={propuesta(from)}
                            onChange={(e) => setElegida(prev => ({ ...prev, [from]: e.target.value }))}
                            className="rounded-md border border-border bg-card px-2 py-1 text-[11px]"
                        >
                            {claves.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
                            disabled={renameCitationKey.isPending} onClick={() => void corregir(from)}>
                            {t('canonical.review.orphanKeys.fix')}
                        </Button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
