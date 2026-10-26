import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Library } from 'lucide-react';
import type { DeskPhase, DeskSourcesSummary } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { DeskSection, EmptyState, LaterPhase, TOUCH, deskSectionId, useDeskText } from './primitives';

/** El estado del arte del proyecto: la entrada a las fuentes por el método. */
export function stateOfArtUrl(projectId: string): string {
    return `/dashboard/projects/${encodeURIComponent(projectId)}/estado-del-arte`;
}

interface SourcesSectionProps {
    projectId: string;
    sources: DeskSourcesSummary;
    /** La fase `sources` del recorrido: su estado y su evidencia. */
    phase: DeskPhase | undefined;
    /** El número de la fase en el recorrido del tipo (2 en Exegético y en Curso). */
    phaseNumber: number;
    /** Un título propio («Fuentes del curso»); por defecto, «Fuentes». */
    title?: ReactNode;
    /** Lo propio de un tipo (Curso: la cobertura por tipo de trabajo). */
    children?: ReactNode;
    /**
     * Posterior a la fase activa y sin bibliografía: una línea, sin acción
     * (el vacío completo es solo para la fase activa). Por defecto, no.
     */
    later?: boolean;
    /** Cuándo se abre, en esa línea. Por defecto, la del Exegético («cuando escribas tu lectura del libro»). */
    laterReason?: string;
}

/**
 * Fase 2 · «Fuentes», compartida por el Exegético y el Curso. No hay atajo:
 * las fuentes se eligen en el estado del arte (la lista razonada de obras
 * con que se va a trabajar), y esta sección solo resume y lleva allí. Lo
 * que ya se agregó a mano se cuenta aparte y no retrocede.
 */
export function SourcesSection({ projectId, sources: s, phase, phaseNumber, title, children, later = false, laterReason }: SourcesSectionProps) {
    const { t } = useTranslation('projectDeskExegetical');
    const { t: tp } = useTranslation('projects');
    const deskText = useDeskText();
    const vacia = s.total === 0;
    const url = stateOfArtUrl(projectId);

    const cifras = [
        t('sources.approved', { count: s.approved }),
        s.toAcquire > 0 ? t('sources.toAcquire', { count: s.toAcquire }) : null,
        s.candidates > 0 ? t('sources.candidates', { count: s.candidates }) : null,
        s.requirements.total > 0 ? t('sources.requirements', { met: s.requirements.met, total: s.requirements.total }) : null,
    ].filter((x): x is string => !!x);

    if (vacia && later) {
        return (
            <LaterPhase
                id={deskSectionId('sources')}
                eyebrow={tp('desk.journey.phaseLabel', { number: phaseNumber })}
                title={title ?? t('sources.title')}
                reason={laterReason ?? t('later.sources')}
                data-testid="desk-section-sources"
            />
        );
    }

    return (
        <DeskSection
            id={deskSectionId('sources')}
            phase={phaseNumber}
            title={title ?? t('sources.title')}
            status={phase?.status}
            loading={phase?.loading}
            evidence={phase ? deskText(phase.evidence) : undefined}
            description={t('sources.description')}
            data-testid="desk-section-sources"
            actions={!vacia && (
                <Button asChild size="sm" variant="outline" className={TOUCH}>
                    <Link to={url}>
                        <Library className="h-3.5 w-3.5" aria-hidden />
                        {t('sources.open')}
                    </Link>
                </Button>
            )}
            isEmpty={vacia}
            empty={(
                <EmptyState
                    icon={Library}
                    title={t('sources.emptyTitle')}
                    action={(
                        <Button asChild size="sm" variant="outline" className={TOUCH}>
                            <Link to={url}>{t('sources.choose')}</Link>
                        </Button>
                    )}
                >
                    {t('sources.empty')}
                </EmptyState>
            )}
        >
            <div className="space-y-3">
                <p className="text-sm text-foreground" data-testid="desk-sources-summary">{cifras.join(' · ')}</p>
                {s.manual > 0 && (
                    <p className="text-[13px] text-muted-foreground" data-testid="desk-sources-manual">{t('sources.manual', { count: s.manual })}</p>
                )}
                {s.requirements.incomplete > 0 && (
                    <p className="text-[13px] text-foreground">{t('sources.incomplete', { count: s.requirements.incomplete })}</p>
                )}
                {s.requirements.accepted > 0 && (
                    <p className="text-[13px] text-muted-foreground">{t('sources.accepted', { count: s.requirements.accepted })}</p>
                )}
                {s.requiredToAcquire.length > 0 && (
                    <div className="space-y-1" data-testid="desk-sources-required">
                        <p className="text-[13px] font-medium text-foreground">{t('sources.requiredToAcquire', { count: s.requiredToAcquire.length })}</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-foreground">
                            {s.requiredToAcquire.map(r => <li key={r.entryId}>{r.title}</li>)}
                        </ul>
                    </div>
                )}
                {/* Aprobar decide la obra; tenerla en la biblioteca es otra cosa. */}
                {s.approved > 0 && <p className="text-xs text-muted-foreground">{t('sources.toAcquireNote')}</p>}
                {children}
            </div>
        </DeskSection>
    );
}
