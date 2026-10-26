import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Link2, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { SessionDomain } from '../../hooks/useLinkProjectSession';

interface LinkableSession {
    id: string;
    passage: string;
    updatedAt: string | Date;
    projectId?: string | null;
    /** Optional status used by Greek sessions (COMPLETED / IN_PROGRESS). */
    status?: string;
}

interface OtherProjectLookup {
    /** Returns a project's title given its id, or null if not found. */
    findProjectTitle: (id: string) => string | null;
}

interface ProjectLinkSessionDialogProps {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    /** Drives copy + (in greek case) "in progress / completed" status text. */
    domain: SessionDomain;
    /** Sessions eligible for linking (already filtered to exclude current project). */
    sessions: LinkableSession[];
    /** Projects lookup so we can show "in 'Other project'" hints. */
    projects: OtherProjectLookup;
    /** Session ID currently being linked (null if idle). */
    linkingId: string | null;
    /** Triggered when the user clicks a session row. */
    onLink: (sessionId: string) => void;
}

/**
 * Generic dialog for linking an existing tutor session (Greek or Hebrew) to
 * the current project. Same UI shape for both domains — we differentiate via
 * the `domain` prop which selects the correct i18n keys + status rendering.
 */
export function ProjectLinkSessionDialog({
    open,
    onOpenChange,
    domain,
    sessions,
    projects,
    linkingId,
    onLink,
}: ProjectLinkSessionDialogProps) {
    const { t } = useTranslation('projects');
    const dateLocale = 'es';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg bg-card p-0 overflow-hidden border-border/60">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-primary-text font-medium mb-2">
                        {t(`linkSession.${domain}.title`)}
                    </div>
                    <DialogTitle className="font-reading text-[24px] leading-tight text-foreground">
                        {t(`linkSession.${domain}.description`).split(' — ')[0]}
                    </DialogTitle>
                    <DialogDescription className="text-[14px] text-muted-foreground">
                        {t(`linkSession.${domain}.description`)}
                    </DialogDescription>
                </DialogHeader>
                <div className="px-6 pb-6 max-h-[420px] overflow-y-auto">
                    {sessions.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground py-8 text-center">
                            {t(`linkSession.${domain}.empty`)}
                        </p>
                    ) : (
                        <ul className="divide-y divide-border/40 -mx-2">
                            {sessions.map(s => {
                                const otherTitle = s.projectId
                                    ? projects.findProjectTitle(s.projectId)
                                    : null;
                                const isLinking = linkingId === s.id;
                                const updatedAt = new Date(s.updatedAt);
                                return (
                                    <li key={s.id}>
                                        <button
                                            type="button"
                                            onClick={() => onLink(s.id)}
                                            disabled={isLinking}
                                            className="w-full text-left py-3 px-2 flex items-center gap-3 hover:bg-muted/40 rounded transition-colors disabled:opacity-50 group"
                                        >
                                            <BookOpen className="h-4 w-4 text-muted-foreground/70 shrink-0 group-hover:text-primary-text transition-colors" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[14px] font-medium text-foreground truncate">
                                                    {s.passage}
                                                </div>
                                                <div className="text-[12px] text-muted-foreground mt-0.5">
                                                    {/* Domain-specific date prefix is handled in the same line */}
                                                    {updatedAt.toLocaleDateString(dateLocale)}
                                                    {otherTitle && (
                                                        <>
                                                            {' · '}
                                                            <span className="italic">"{otherTitle}"</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {isLinking ? (
                                                <Loader2 className="h-4 w-4 text-primary-text animate-spin shrink-0" />
                                            ) : (
                                                <Link2 className="h-4 w-4 text-border group-hover:text-primary-text shrink-0 transition-colors" />
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
