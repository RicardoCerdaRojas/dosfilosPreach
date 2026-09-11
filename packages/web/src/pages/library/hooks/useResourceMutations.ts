import { useCallback, useState } from 'react';
import { libraryService } from '@dosfilos/application';
import { ResourceType, type BibleBookId, type LibraryResourceScope } from '@dosfilos/domain';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';

export interface ResourceUpdates {
    title: string;
    author: string;
    type: ResourceType;
    isCore?: boolean;
    coreContext?: 'exegesis' | 'homiletics' | 'generic';
    /**
     * v1.7 smart-match metadata. Optional in the type so existing
     * callers (which only edit title/author/type) still compile;
     * the EditResourceModal always sends both since it owns the
     * full state.
     */
    coversBibleBooks?: ReadonlyArray<BibleBookId>;
    scope?: LibraryResourceScope;
}

interface UseResourceMutationsResult {
    /** Delete a resource by id. Toasts success/error. Caller handles UI close. */
    deleteResource: (id: string) => Promise<void>;
    /**
     * Id of the resource currently being deleted (for spinner / disabled
     * states in the confirm dialog and the per-card visual). Null when
     * no delete is in flight.
     */
    deletingResourceId: string | null;
    /** Save resource metadata updates. Throws on error so caller can keep modal open. */
    saveResource: (id: string, updates: ResourceUpdates) => Promise<void>;
    /**
     * Re-runs LlamaParse extraction. Call when the card's extraction
     * cascade degraded from the user's requested Premium tier so the
     * user can retry without re-uploading.
     */
    retryWithPremium: (id: string) => Promise<void>;
    /** Vuelve a extraer leyendo las páginas como imagen, desde el PDF guardado. */
    reextractFromImages: (id: string) => Promise<void>;
    /** Id of the resource currently being retried with Premium (spinner state). Null when none. */
    retryingResourceId: string | null;
    /**
     * Cancels an in-progress extraction by deleting the resource +
     * its chunks + storage objects. Used by the "Cancelar" inline
     * action on the card during pending/processing/indexing.
     */
    cancelExtraction: (id: string) => Promise<void>;
    /** Id of the resource currently being cancelled (spinner state). Null when none. */
    cancellingResourceId: string | null;
}

/**
 * Encapsulates resource CRUD operations (delete + metadata update).
 *
 * Each method:
 * - Calls the service
 * - Shows a toast on success or error
 * - For `saveResource`: re-throws the error so the caller (e.g. EditResourceModal)
 *   can keep itself open if the save failed
 *
 * Real-time Firestore subscription in `useLibraryResources` will pick up the
 * changes — no explicit refetch is needed here.
 *
 * Exposes `deletingResourceId` so the calling page can dim/spinner the
 * specific row being deleted and disable the confirm button while the
 * delete request is in flight (Storage object delete + chunk
 * cleanup + Firestore doc delete can take 1-3s for big resources, and
 * the user shouldn't be able to mash the button or move on without
 * feedback).
 */
export function useResourceMutations(): UseResourceMutationsResult {
    const { t } = useTranslation('library');
    const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
    const [retryingResourceId, setRetryingResourceId] = useState<string | null>(null);
    const [cancellingResourceId, setCancellingResourceId] = useState<string | null>(null);

    const deleteResource = useCallback(async (id: string) => {
        setDeletingResourceId(id);
        try {
            await libraryService.deleteResource(id);
            toast.success(t('toast.deleteSuccess'));
        } catch (error) {
            console.error('Delete error:', error);
            toast.error(t('toast.deleteError'));
        } finally {
            setDeletingResourceId(null);
        }
    }, [t]);

    const saveResource = useCallback(async (id: string, updates: ResourceUpdates) => {
        try {
            await libraryService.updateResource(id, updates);
            toast.success(t('toast.updateSuccess'));
        } catch (error) {
            console.error('Update error:', error);
            toast.error(t('toast.updateError'));
            throw error;
        }
    }, [t]);

    /**
     * Vuelve a extraer leyendo las páginas como imagen.
     *
     * La contraparte que faltaba de «reintentar premium». El botón de
     * reprocesar de la tarjeta re-indexa el texto YA extraído —el mismo texto
     * malo—, así que un libro leído por la ruta equivocada sólo se arreglaba
     * borrándolo y subiéndolo de nuevo, con el PDF ya guardado del otro lado.
     */
    const reextractFromImages = useCallback(async (id: string) => {
        setRetryingResourceId(id);
        const promise = libraryService.reextractFromImages(id);
        toast.promise(promise, {
            loading: t('toast.reextractLoading'),
            success: t('toast.reextractSuccess'),
            error: (err: any) => {
                const code = err?.code as string | undefined;
                if (code === 'functions/resource-exhausted') return err?.message ?? t('toast.reextractNoBalance');
                if (code === 'functions/permission-denied') return t('toast.reextractDenied');
                return t('toast.reextractError');
            },
        });
        try { await promise; } catch { /* ya se informó en el toast */ }
        finally { setRetryingResourceId(null); }
    }, [t]);

    const retryWithPremium = useCallback(async (id: string) => {
        setRetryingResourceId(id);
        // Long-running call (1-15 min). Loading toast persists while we
        // wait — sonner promise toast keeps the user informed without
        // blocking the rest of the UI.
        const promise = libraryService.retryWithPremium(id);
        toast.promise(promise, {
            loading: t('toast.retryPremiumLoading'),
            success: t('toast.retryPremiumSuccess'),
            // Surface the typed Cloud Function error code/message so
            // "saldo insuficiente" / "no LlamaParse account" don't get
            // hidden behind a generic toast.
            error: (err: any) => {
                const code = err?.code as string | undefined;
                if (code === 'functions/resource-exhausted') {
                    return err?.message ?? t('toast.retryPremiumNoBalance');
                }
                if (code === 'functions/permission-denied') {
                    return t('toast.retryPremiumDenied');
                }
                return t('toast.retryPremiumError');
            },
        });
        try {
            await promise;
        } catch {
            // Already surfaced via toast.promise — swallow so the calling
            // component doesn't need to wrap in its own try/catch.
        } finally {
            setRetryingResourceId(null);
        }
    }, [t]);

    const cancelExtraction = useCallback(async (id: string) => {
        setCancellingResourceId(id);
        try {
            await libraryService.cancelExtraction(id);
            toast.success(t('toast.cancelSuccess'));
        } catch (error: any) {
            console.error('Cancel error:', error);
            const code = error?.code as string | undefined;
            // Most useful failure mode to surface specifically: trying
            // to cancel a resource that already finished extracting.
            // The cloud function rejects with failed-precondition and
            // the user should use the regular Delete action.
            if (code === 'functions/failed-precondition') {
                toast.error(t('toast.cancelTooLate'));
            } else {
                toast.error(t('toast.cancelError'));
            }
        } finally {
            setCancellingResourceId(null);
        }
    }, [t]);

    return {
        deleteResource,
        deletingResourceId,
        saveResource,
        retryWithPremium,
        reextractFromImages,
        retryingResourceId,
        cancelExtraction,
        cancellingResourceId,
    };
}
