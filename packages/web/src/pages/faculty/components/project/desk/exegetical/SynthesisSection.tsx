import { CheckCheck, History, NotebookPen } from 'lucide-react';
import type { DeskFraming, DeskPhase, DeskSynthesis } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { Aviso } from '../../ProjectFramingFields';
import { HypothesisLogList, type FramingStudy } from '../../ProjectFramingLogDialog';
import { DeskSection, EmptyState, TOUCH, deskSectionId, useDeskText } from '../primitives';

interface SynthesisSectionProps {
    synthesis: DeskSynthesis;
    framing: DeskFraming;
    phase: DeskPhase | undefined;
    studies: ReadonlyArray<FramingStudy>;
    onAnnotate: () => void;
    onRevise: () => void;
    onShowHistory: () => void;
}

/**
 * Fase 5 · «Síntesis»: se abre con la primera anotación (un libro largo no
 * queda meses sin ella). El registro resumido —cuántas confirman, matizan o
 * contradicen— y las tres últimas; «Revisar tu idea central» y «Ver cómo
 * cambió tu lectura». La fase queda lista solo con la idea revisada y vigente.
 */
export function SynthesisSection({ synthesis: s, framing, phase, studies, onAnnotate, onRevise, onShowHistory }: SynthesisSectionProps) {
    const { t } = useTranslation('projectDeskExegetical');
    const deskText = useDeskText();
    const registro = [
        t('synthesis.confirms', { count: s.counts.confirms }),
        t('synthesis.nuances', { count: s.counts.nuances }),
        t('synthesis.contradicts', { count: s.counts.contradicts }),
    ].join(' · ');

    return (
        <DeskSection
            id={deskSectionId('synthesis')}
            phase={5}
            title={t('synthesis.title')}
            status={phase?.status}
            evidence={phase ? deskText(phase.evidence) : undefined}
            description={t('synthesis.description')}
            data-testid="desk-section-synthesis"
            actions={s.open && (
                <>
                    {studies.length > 0 && (
                        <Button size="sm" variant="outline" className={TOUCH} onClick={onAnnotate}>
                            <NotebookPen className="h-3.5 w-3.5" aria-hidden />{t('synthesis.annotate')}
                        </Button>
                    )}
                    <Button size="sm" variant="outline" className={TOUCH} onClick={onShowHistory}>
                        <History className="h-3.5 w-3.5" aria-hidden />{t('synthesis.history')}
                    </Button>
                </>
            )}
            isEmpty={!s.open}
            empty={(
                <EmptyState
                    title={t('synthesis.emptyTitle')}
                    action={studies.length > 0 && (
                        <Button size="sm" variant="outline" className={TOUCH} onClick={onAnnotate}>
                            <NotebookPen className="h-3.5 w-3.5" aria-hidden />{t('synthesis.annotate')}
                        </Button>
                    )}
                >
                    {t('synthesis.empty')}
                </EmptyState>
            )}
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground" data-testid="desk-synthesis-counts">{registro}</p>
                    <HypothesisLogList entries={[...s.latest].reverse()} studies={studies} />
                    {s.annotations > s.latest.length && (
                        <button type="button" onClick={onShowHistory} className="min-h-11 rounded-sm text-[13px] text-primary-text underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-0">
                            {t('synthesis.seeAll', { count: s.annotations })}
                        </button>
                    )}
                </div>

                {s.revision === 'current' && framing.revisedIdea && (
                    <div className="space-y-1 rounded-lg border border-border p-3" data-testid="desk-revised-idea">
                        <p className="text-xs font-medium text-muted-foreground">{t('synthesis.revisedIdea')}</p>
                        <p className="whitespace-pre-line font-reading text-[16px] leading-relaxed text-foreground">{framing.revisedIdea}</p>
                    </div>
                )}
                {s.revision === 'stale' && <Aviso role="status">{t('synthesis.stale')}</Aviso>}

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {s.canRevise ? (
                        <Button size="sm" variant="outline" className={TOUCH} onClick={onRevise}>
                            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                            {t(s.revision === 'none' ? 'synthesis.revise' : 'synthesis.reviseAgain')}
                        </Button>
                    ) : (
                        // Sin idea original no hay qué contrastar: se dice, no se esconde.
                        <p className="text-[13px] text-muted-foreground" data-testid="desk-needs-idea">{t('synthesis.needsIdea')}</p>
                    )}
                </div>
            </div>
        </DeskSection>
    );
}
