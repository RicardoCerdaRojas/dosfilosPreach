import { Link } from 'react-router-dom';
import { BookOpen, Library, Loader2, MessageSquareQuote, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { ProjectResourceCard } from './ProjectResourceCard';
import { AttachedSource } from '../../hooks/useProjectAttachedSources';

interface SessionLike {
    id: string;
    title?: string;
    passage?: string;
}

interface ProjectResourceGridProps {
    /** Project the cards belong to — used in nav links. */
    projectId: string;
    /** Whether the user is admin — only admins see the "Procesar" reindex button. */
    isAdmin: boolean;

    // Sources
    attachedSources: AttachedSource[];
    reprocessing: Record<string, boolean>;
    onReprocessSource: (source: AttachedSource) => void;
    onOpenSourcePicker: () => void;
    /** Abre el estado del arte, en los proyectos que lo tienen. */
    onOpenStateOfArt?: () => void;

    // Conversations
    projectSessions: SessionLike[];

    // Greek
    projectGreekSessions: SessionLike[];
    hasLinkableGreekSessions: boolean;
    onOpenGreekLinker: () => void;

    // Hebrew
    projectHebrewSessions: SessionLike[];
    hasLinkableHebrewSessions: boolean;
    onOpenHebrewLinker: () => void;

    /** Navigation callback — passes a relative path to the dashboard router. */
    onNavigate: (path: string) => void;
}

/**
 * 4-card grid: Sources, Conversations, Greek, Hebrew. Each card is a
 * `ProjectResourceCard` with domain-specific content as children.
 *
 * Heavy file by JSX volume but logic is minimal — most of it is i18n keys
 * + per-domain navigation paths. Pure presentational.
 */
export function ProjectResourceGrid({
    projectId,
    isAdmin,
    attachedSources,
    reprocessing,
    onReprocessSource,
    onOpenSourcePicker,
    onOpenStateOfArt,
    projectSessions,
    projectGreekSessions,
    hasLinkableGreekSessions,
    onOpenGreekLinker,
    projectHebrewSessions,
    hasLinkableHebrewSessions,
    onOpenHebrewLinker,
    onNavigate,
}: ProjectResourceGridProps) {
    const { t } = useTranslation('projects');

    return (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Sources */}
            <ProjectResourceCard
                icon={Library}
                label={t('resources.sources.label')}
                count={attachedSources.length}
                emptyText={t('resources.sources.empty')}
                primaryCta={{
                    label: attachedSources.length > 0
                        ? t('resources.sources.ctaEdit')
                        : t('resources.sources.ctaAttach'),
                    onClick: onOpenSourcePicker,
                }}
                secondaryCta={onOpenStateOfArt ? { label: t('resources.sources.stateOfArt'), onClick: onOpenStateOfArt } : undefined}
            >
                {attachedSources.map((s) => {
                    const isIndexed = s.indexingStatus === 'ready';
                    const isReprocessing = !!reprocessing[s.id];
                    return (
                        <li key={s.id} className="text-[12.5px] leading-snug">
                            <div className="font-medium text-foreground truncate">{s.title}</div>
                            <div className="text-muted-foreground truncate flex items-center gap-1.5">
                                <span className="truncate">{s.author}</span>
                                {!isIndexed && (
                                    <span className="text-warning-subtle-foreground shrink-0">
                                        {t('resources.sources.byProcess')}
                                    </span>
                                )}
                                {!isIndexed && isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => onReprocessSource(s)}
                                        disabled={isReprocessing}
                                        title={t('resources.sources.processTitle')}
                                        className="shrink-0 inline-flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isReprocessing
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <RefreshCw className="h-3 w-3" />}
                                        <span className="text-[11px]">
                                            {isReprocessing
                                                ? t('resources.sources.processing')
                                                : t('resources.sources.process')}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ProjectResourceCard>

            {/* Conversations */}
            <ProjectResourceCard
                icon={MessageSquareQuote}
                label={t('resources.conversations.label')}
                count={projectSessions.length}
                emptyText={t('resources.conversations.empty')}
                primaryCta={{
                    label: t('resources.conversations.ctaStart'),
                    onClick: () => onNavigate(`/dashboard/faculty?projectId=${projectId}`),
                }}
            >
                {projectSessions.slice(0, 3).map((s) => (
                    <li key={s.id}>
                        <Link
                            to={`/dashboard/faculty/${s.id}`}
                            className="block text-[12.5px] py-1 -mx-1 px-1 rounded hover:bg-muted/40 truncate text-foreground hover:text-primary transition-colors"
                        >
                            {s.title || ''}
                        </Link>
                    </li>
                ))}
            </ProjectResourceCard>

            {/* Greek */}
            <ProjectResourceCard
                icon={BookOpen}
                label={t('resources.greek.label')}
                count={projectGreekSessions.length}
                emptyText={t('resources.greek.empty')}
                primaryCta={{
                    label: t('resources.greek.ctaStudy'),
                    onClick: () => onNavigate(`/dashboard/greek-tutor?projectId=${projectId}`),
                }}
                secondaryCta={
                    hasLinkableGreekSessions
                        ? { label: t('resources.greek.ctaLink'), onClick: onOpenGreekLinker }
                        : undefined
                }
            >
                {projectGreekSessions.slice(0, 3).map((s) => (
                    <li key={s.id}>
                        <Link
                            to={`/dashboard/greek-tutor?sessionId=${s.id}`}
                            className="block text-[12.5px] py-1 -mx-1 px-1 rounded hover:bg-muted/40 truncate text-foreground hover:text-primary transition-colors"
                        >
                            {s.passage}
                        </Link>
                    </li>
                ))}
            </ProjectResourceCard>

            {/* Hebrew */}
            <ProjectResourceCard
                icon={BookOpen}
                label={t('resources.hebrew.label')}
                count={projectHebrewSessions.length}
                emptyText={t('resources.hebrew.empty')}
                primaryCta={{
                    label: t('resources.hebrew.ctaAnalyze'),
                    onClick: () => onNavigate(`/dashboard/hebrew-tutor?projectId=${projectId}`),
                }}
                secondaryCta={
                    hasLinkableHebrewSessions
                        ? { label: t('resources.hebrew.ctaLink'), onClick: onOpenHebrewLinker }
                        : undefined
                }
            >
                {projectHebrewSessions.slice(0, 3).map((s) => (
                    <li key={s.id}>
                        <Link
                            to="/dashboard/hebrew-tutor"
                            className="block text-[12.5px] py-1 -mx-1 px-1 rounded hover:bg-muted/40 truncate text-foreground hover:text-primary transition-colors"
                        >
                            {s.passage}
                        </Link>
                    </li>
                ))}
            </ProjectResourceCard>
        </section>
    );
}
