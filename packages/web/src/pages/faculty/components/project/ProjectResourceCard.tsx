import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ResourceCardCta {
    label: string;
    onClick: () => void;
}

interface ProjectResourceCardProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    count: number;
    /** Shown when `count === 0`. */
    emptyText: string;
    /** Primary action — always visible at the bottom. */
    primaryCta: ResourceCardCta;
    /** Optional secondary action — shown in the header (e.g. "Link existing"). */
    secondaryCta?: ResourceCardCta;
    /** Resource list rendered when `count > 0` (typically a `<li>` per item). */
    children?: React.ReactNode;
}

/**
 * Generic resource card used in the Project dashboard's 4-card grid (Sources,
 * Conversations, Greek, Hebrew). Pure presentation — caller owns the data.
 */
export function ProjectResourceCard({
    icon: Icon,
    label,
    count,
    emptyText,
    primaryCta,
    secondaryCta,
    children,
}: ProjectResourceCardProps) {
    const isEmpty = count === 0;
    return (
        <article className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3 min-h-[180px]">
            <header className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary-text font-medium inline-flex items-center gap-1.5">
                    <Icon className="h-3 w-3" />
                    <span>{label}</span>
                    <span className="text-border normal-case tracking-normal">·</span>
                    <span className="text-muted-foreground normal-case tracking-normal font-mono">
                        {count}
                    </span>
                </div>
                {secondaryCta && (
                    <button
                        type="button"
                        onClick={secondaryCta.onClick}
                        className="text-[11px] text-muted-foreground hover:text-primary-text transition-colors"
                    >
                        {secondaryCta.label}
                    </button>
                )}
            </header>
            <div className="flex-1 min-h-0">
                {isEmpty ? (
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                        {emptyText}
                    </p>
                ) : (
                    <ul className="space-y-1.5">{children}</ul>
                )}
            </div>
            <Button
                onClick={primaryCta.onClick}
                variant="outline"
                className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground hover:border-foreground/30 font-medium gap-1.5 h-8 text-[12.5px] w-full justify-center"
            >
                <Plus className="h-3.5 w-3.5" />
                {primaryCta.label}
            </Button>
        </article>
    );
}
