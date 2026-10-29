import { useQuery } from '@tanstack/react-query';
import { libraryService } from '@dosfilos/application';
import type { LibraryResourceEntity } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';

/**
 * Stable React Query key for the user's library resources. Exported so
 * the background sync hook (`useLibrarySync`) and any other consumer
 * write/read against the SAME cache slot — that's the whole point of
 * this hook: every place in the app that needs the library shares one
 * subscription.
 */
export const libraryQueryKey = (userId: string | null | undefined) =>
    ['library', 'resources', userId] as const;

interface UseLibraryResult {
    resources: LibraryResourceEntity[];
    /** True only on the very first cold read for this user in the session. */
    isLoading: boolean;
    /** La lectura falló y no hay datos. */
    isError: boolean;
}

/**
 * Lightweight reader for the user's library. Reads from a globally
 * synced React Query cache that `useLibrarySync()` (mounted once at
 * the dashboard shell) keeps fresh via a Firestore real-time listener.
 *
 * `staleTime: Infinity` because the sync hook is the source of truth —
 * we never want React Query to fire its own background refetches that
 * would just stomp the snapshot the listener already pushed. The
 * `queryFn` is a fallback for the case where the sync hook hasn't
 * mounted yet (e.g. an early consumer renders before the dashboard
 * shell), so a one-shot fetch fills the gap until the listener
 * catches up.
 *
 * Use this in any consumer that just needs the resources list — paper
 * setup modal, faculty source picker, planner wizard, etc. The richer
 * `useLibraryResources` hook (LibraryManager page) layers index-status
 * tracking + counts on top and stays separate.
 */
export function useLibrary(): UseLibraryResult {
    const { user } = useFirebase();

    const query = useQuery({
        queryKey: libraryQueryKey(user?.uid),
        queryFn: async () => {
            if (!user?.uid) return [] as LibraryResourceEntity[];
            return libraryService.getUserResourcesWithSystem(user.uid);
        },
        enabled: !!user?.uid,
        staleTime: Infinity,
    });

    return {
        resources: query.data ?? [],
        isLoading: query.isLoading,
        // El escritorio del proyecto no afirma «sin fuentes» si la lectura falló.
        isError: query.isError,
    };
}
