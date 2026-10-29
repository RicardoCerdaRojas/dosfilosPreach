import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ProjectHeaderProps {
    /** Main project title. */
    title: string;
    /** Optional context note shown in italics next to the title. */
    contextNote?: string;
    /** Localised type label (e.g. "Serie de sermones") rendered in the breadcrumb. */
    typeLabel: string;
    /** Icon for the project type — comes from `getProjectTypeMeta(...)`. */
    TypeIcon: React.ComponentType<{ className?: string }>;
    /**
     * Color marker (one of the project palette: indigo, emerald, amber...).
     * We render an inline `style` background to avoid dynamic Tailwind classes
     * that won't be picked up at build time.
     */
    accentColorVar?: string;
}

/**
 * Compact editorial header for the project dashboard: breadcrumb back-link,
 * type marker + label, project title, and optional context note.
 */
export function ProjectHeader({
    title,
    contextNote,
    typeLabel,
    TypeIcon,
    accentColorVar,
}: ProjectHeaderProps) {
    const { t } = useTranslation('projects');
    return (
        <div className="pb-3 border-b border-border/60 space-y-1">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] font-medium">
                <Link
                    to="/dashboard/projects"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary-text"
                >
                    <ArrowLeft className="h-3 w-3" />
                    {t('breadcrumb.back')}
                </Link>
                <span className="text-border">/</span>
                <span className="inline-flex items-center gap-1.5 text-primary-text">
                    {accentColorVar && (
                        <span
                            className={cn('h-1.5 w-1.5 rounded-full')}
                            // Inline style avoids dynamic Tailwind class generation
                            // for arbitrary project palette colours.
                            style={{ backgroundColor: accentColorVar }}
                        />
                    )}
                    <TypeIcon className="h-3 w-3" />
                    <span>{typeLabel}</span>
                </span>
            </div>
            <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
                <h1 className="font-reading text-[24px] md:text-[28px] leading-tight tracking-[-0.01em] text-foreground">
                    {title}
                </h1>
                {contextNote && (
                    <p className="text-[13px] leading-snug text-muted-foreground italic line-clamp-1 md:line-clamp-2 md:flex-1">
                        — {contextNote}
                    </p>
                )}
            </div>
        </div>
    );
}
