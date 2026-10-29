import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FirestoreGreekSessionRepository, FirestoreHebrewStudySessionRepository } from '@dosfilos/infrastructure';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';

export type SessionDomain = 'greek' | 'hebrew';

interface UseLinkProjectSessionOptions {
    /** Project to link sessions to. Hook is a no-op if null. */
    projectId: string | null | undefined;
    /** Which domain — drives the repository + react-query cache key. */
    domain: SessionDomain;
}

interface UseLinkProjectSessionResult {
    /** Session ID currently being linked (or null). Used to disable the row. */
    linkingId: string | null;
    /** Link a session to the project. Toasts success/error and invalidates cache. */
    link: (sessionId: string) => Promise<void>;
}

/** Quien escribe el vínculo (infraestructura) y la caché que lo muestra. */
const DOMAIN_CONFIG: Record<SessionDomain, { linkToProject: (sessionId: string, projectId: string) => Promise<void>; queryKey: [string, string] }> = {
    greek: {
        linkToProject: (sessionId, projectId) => new FirestoreGreekSessionRepository().linkToProject(sessionId, projectId),
        queryKey: ['greek', 'sessions'],
    },
    hebrew: {
        linkToProject: (sessionId, projectId) => new FirestoreHebrewStudySessionRepository().linkToProject(sessionId, projectId),
        queryKey: ['hebrew', 'sessions'],
    },
};

/**
 * Encapsulates the "link an existing tutor session to this project" flow for
 * Greek and Hebrew domains. They share the same shape (the repository's
 * `linkToProject` + react-query cache invalidation) so we expose one hook
 * keyed by `domain`.
 *
 * Caller component decides when to close its modal — hook just performs the
 * mutation and reports state via `linkingId`.
 */
export function useLinkProjectSession({
    projectId,
    domain,
}: UseLinkProjectSessionOptions): UseLinkProjectSessionResult {
    const { t } = useTranslation('projects');
    const queryClient = useQueryClient();
    const [linkingId, setLinkingId] = useState<string | null>(null);
    const config = DOMAIN_CONFIG[domain];

    const link = useCallback(async (sessionId: string) => {
        if (!projectId) return;
        setLinkingId(sessionId);
        try {
            await config.linkToProject(sessionId, projectId);
            await queryClient.invalidateQueries({ queryKey: config.queryKey });
            toast.success(t('linkSession.toastSuccess'));
        } catch (err: unknown) {
            // El detalle técnico va a la consola; el pastor ve un aviso llano.
            console.error(`[useLinkProjectSession.${domain}]`, err);
            toast.error(t('linkSession.toastError'));
        } finally {
            setLinkingId(null);
        }
    }, [projectId, domain, config, queryClient, t]);

    return { linkingId, link };
}
