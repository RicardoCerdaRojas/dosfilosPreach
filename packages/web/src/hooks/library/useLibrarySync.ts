import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryService } from '@dosfilos/application';
import type { LibraryResourceEntity } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { libraryQueryKey } from './useLibrary';

/**
 * Mounts ONE Firestore real-time listener for the user's library and
 * pushes every snapshot into the React Query cache slot that
 * `useLibrary()` reads from. Mount this once at the authenticated
 * shell (DashboardLayout) — every other consumer in the app just
 * reads from the cache and gets live updates for free.
 *
 * Also owns the indexing-transition toasts ("X listo" / "X falló").
 * Lives here rather than in `useLibraryResources` (the LibraryManager
 * page hook) so notifications fire wherever the user is in the app —
 * if a 200-page upload finishes indexing while you're writing in the
 * exegesis module, you still want to know.
 *
 * Returns nothing — pure side effect.
 */
export function useLibrarySync(): void {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const { t } = useTranslation('library');

    // Last seen `indexingStatus` per resource. Used to detect
    // transitions across listener emissions and fire EXACTLY one toast
    // per resource entering a terminal state.
    const lastIndexingState = useRef<Map<string, string>>(new Map());
    // Skip toasts on the very first emission so existing-on-load
    // resources don't toast all at once when the listener hydrates.
    const initialEmissionDone = useRef(false);

    useEffect(() => {
        if (!user?.uid) return;
        const uid = user.uid;
        // Reset transition tracking when the user changes (e.g.
        // re-login). Stale state from a previous session would
        // otherwise mis-detect transitions.
        lastIndexingState.current = new Map();
        initialEmissionDone.current = false;

        // System sources (SBL GNT etc.) are fetched once and prepended
        // to every snapshot the user listener emits. They live under
        // the sentinel `__system__` userId, so the per-user listener
        // never sees them on its own. Mutations to system docs are
        // platform-side and rare enough that one-shot fetching is fine.
        //
        // Two updaters share the cache write: the user listener (fires
        // on every Firestore snapshot) and the one-shot system fetch
        // (fires once when the promise resolves). Both go through
        // `pushMerged` so whichever finishes first still emits a valid
        // merged list, and the slower one re-pushes once it lands.
        // La lista la escribe este escucha, no un `useQuery`: fuera de las
        // páginas que la leen no tiene observadores, y React Query la borraba
        // a los 5 minutos. Al volver al escritorio del proyecto se descargaba
        // entera otra vez (39 MB, ~10 s) y el escritorio quedaba en esqueleto
        // (fundador, 2026-10-29). El escucha la mantiene al día: no caduca.
        queryClient.setQueryDefaults(libraryQueryKey(uid), { gcTime: Infinity });

        let systemResources: LibraryResourceEntity[] = [];
        let userResources: LibraryResourceEntity[] = [];
        let cancelled = false;
        const pushMerged = () => {
            queryClient.setQueryData(
                libraryQueryKey(uid),
                [...systemResources, ...userResources],
            );
        };
        libraryService.getSystemResources().then(rs => {
            if (cancelled) return;
            systemResources = rs;
            pushMerged();
        }).catch(err => console.error('[useLibrarySync] system fetch failed', err));

        const unsubscribe = libraryService.subscribeToUserResources(
            uid,
            (resources: LibraryResourceEntity[]) => {
                userResources = resources;
                pushMerged();

                if (initialEmissionDone.current) {
                    for (const r of resources) {
                        const prev = lastIndexingState.current.get(r.id);
                        const curr = r.indexingStatus ?? 'unknown';
                        if (prev && prev !== curr) {
                            if (curr === 'ready') {
                                const chunks = (r as { indexedChunkCount?: number }).indexedChunkCount;
                                toast.success(
                                    t('toast.processSuccess', {
                                        title: r.title,
                                        chunks: chunks ?? '?',
                                    }),
                                );
                            } else if (curr === 'failed') {
                                toast.error(
                                    t('toast.processError') + (r.title ? ` — ${r.title}` : ''),
                                );
                            }
                        }
                        lastIndexingState.current.set(r.id, curr);
                    }
                } else {
                    for (const r of resources) {
                        lastIndexingState.current.set(r.id, r.indexingStatus ?? 'unknown');
                    }
                    initialEmissionDone.current = true;
                }
            },
            (error) => {
                console.error('[useLibrarySync] subscription error', error);
            },
        );
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [user?.uid, queryClient, t]);
}
