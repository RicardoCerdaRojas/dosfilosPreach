import { toast } from 'sonner';
import type { AcquisitionMark, ExegeticalPaper, SourceType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useCorpusNeeds } from '@/hooks/exegesis/useCorpusNeeds';
import { useUpdatePaperInputs } from '@/hooks/exegesis/usePaperInputs';
import { CorpusNeedRow } from './CorpusNeedRow';

/**
 * «Qué conseguir» (fase «Asistente del corpus», A6): lo que la rúbrica y el
 * sílabo piden para el corpus, cuánto hay, y con qué cubrir lo que falta, con
 * la edición a la vista. Reemplaza a la tarjeta de la rúbrica y a la del
 * sílabo, que decían lo mismo por separado.
 *
 * En TP #10 la rúbrica pedía 2 comentarios crítico-técnicos y el corpus tenía
 * 1; se supo después de entregar. Aquí se ve antes de redactar.
 */
export function CorpusNeedsCard({ paper, onPickType, onAddResource }: {
    paper: ExegeticalPaper;
    onPickType: (type: SourceType) => void;
    onAddResource: (resourceId: string) => void;
}) {
    const { t } = useTranslation('exegesis');
    const { needs, coverage } = useCorpusNeeds(paper);
    const guardar = useUpdatePaperInputs(paper.id);
    if (needs.length === 0) {
        return paper.rubric ? null : (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{t('paperSetup.subSteps.corpus.gap.noRubric')}</p>
        );
    }
    const marcar = async (key: string, mark: { status: 'por-conseguir' | 'descartada'; reason?: string } | null) => {
        const next: Record<string, AcquisitionMark> = { ...(paper.acquisitionMarks ?? {}) };
        if (mark) next[key] = { ...mark, at: new Date().toISOString() };
        else delete next[key];
        try {
            await guardar.mutateAsync({ acquisitionMarks: next });
        } catch (err) {
            console.error('[corpus] no se pudo guardar la marca', err);
            toast.error(t('corpusNeeds.saveFailed'));
        }
    };
    const todo = coverage.covered === coverage.total;
    return (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-labelledby="que-conseguir">
            <header>
                <h3 id="que-conseguir" className="font-serif text-base font-semibold text-foreground">{t('corpusNeeds.title')}</h3>
                <p role="status" className={todo ? 'text-xs text-success' : 'text-xs text-foreground'} data-testid="cobertura-necesidades">
                    {t('corpusNeeds.coverage', { covered: coverage.covered, total: coverage.total })}
                    {!todo && coverage.reachable > coverage.covered && <> {t('corpusNeeds.coverageReach', { count: coverage.reachable - coverage.covered })}</>}
                </p>
            </header>
            <ul className="divide-y divide-border">
                {needs.map(n => (
                    <CorpusNeedRow
                        key={n.id}
                        need={n}
                        actions={{ onAddResource, onPickType, onMark: (k, m) => void marcar(k, m), busy: guardar.isPending }}
                    />
                ))}
            </ul>
        </section>
    );
}
