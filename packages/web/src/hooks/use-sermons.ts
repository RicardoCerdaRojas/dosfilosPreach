import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SermonEntity, FindOptions, type PublishOverrideInput } from '@dosfilos/domain';
import { sermonService, facultyService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';
import { toast } from 'sonner';

/**
 * La lista de sermones del usuario, en la caché de React Query.
 *
 * Antes era un `useState` que volvía a pedir TODA la lista cada vez que una
 * página se montaba: volver al escritorio del proyecto desde un estudio lo
 * dejaba en esqueleto hasta que llegaba (medido por el fundador: ~5 s). La
 * clave `['sermons', uid, …]` es la que ya invalidan otros hooks
 * (`useExegesisPapers`), que hasta ahora no surtía efecto.
 */
export function useSermons(options?: FindOptions) {
    const { user } = useFirebase();
    const query = useQuery({
        queryKey: ['sermons', user?.uid, options ?? null],
        // Lectura recortada: la lista solo necesita los campos del resumen;
        // el sermón entero se carga en su página.
        queryFn: () => sermonService.getUserSermonSummaries(user!.uid, options),
        enabled: !!user,
        staleTime: 60_000,
    });

    const error = query.error ? (query.error as Error).message : null;
    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const refetch = useCallback(async () => {
        await query.refetch();
    }, [query]);

    return {
        sermons: (query.data ?? []) as SermonEntity[],
        // Sin usuario todavía no hay nada que esperar; con datos en caché, no se muestra carga.
        loading: !!user && query.isLoading,
        error,
        refetch,
    };
}

export function useSermon(id: string | undefined) {
    const [sermon, setSermon] = useState<SermonEntity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSermon = async () => {
        if (!id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await sermonService.getSermon(id);
            setSermon(data);
        } catch (err: any) {
            console.error('[useSermon] Error loading sermon:', err);
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSermon();
    }, [id]);

    return { sermon, loading, error, mutate: fetchSermon };
}

export function useCreateSermon() {
    const { user } = useFirebase();
    const [loading, setLoading] = useState(false);

    const createSermon = async (data: {
        title: string;
        content: string;
        bibleReferences?: string[];
        tags?: string[];
        category?: string;
        status?: 'working' | 'draft' | 'published' | 'archived';
        sourceFacultySessionId?: string;
    }) => {
        if (!user) throw new Error('Usuario no autenticado');

        setLoading(true);
        try {
            const sermon = await sermonService.createSermon({
                ...data,
                userId: user.uid,
                authorName: user.displayName || 'Pastor',
            });
            toast.success('Sermón creado exitosamente');
            return sermon;
        } catch (err: any) {
            toast.error(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { createSermon, loading };
}

export function useUpdateSermon() {
    const [loading, setLoading] = useState(false);

    const updateSermon = async (
        id: string,
        data: Partial<{
            title: string;
            content: string;
            bibleReferences: string[];
            tags: string[];
            category: string;
            status: 'working' | 'draft' | 'published' | 'archived';
        }>
    ) => {
        setLoading(true);
        try {
            const sermon = await sermonService.updateSermon(id, data);
            toast.success('Sermón actualizado exitosamente');
            return sermon;
        } catch (err: any) {
            toast.error(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { updateSermon, loading };
}

export function useDeleteSermon() {
    const { user } = useFirebase();
    const [loading, setLoading] = useState(false);

    const deleteSermon = async (id: string) => {
        setLoading(true);
        try {
            await sermonService.deleteSermon(id);
            // Sermon is canonical, but any Faculty Extraction that
            // linked back via externalRef now points at a missing
            // doc. Null the externalRef on those Extractions so the
            // resource library falls back to inline preview instead
            // of trying to navigate to a deleted sermon. The
            // Extraction itself survives — the user keeps the
            // markdown snapshot. Fire-and-forget so a slow orphan
            // pass doesn't block the success toast.
            if (user?.uid) {
                facultyService.orphanExtractionsBySermon
                    .execute(user.uid, id)
                    .catch(err => console.error('[useDeleteSermon] orphan failed', err));
            }
            toast.success('Sermón eliminado exitosamente');
        } catch (err: any) {
            toast.error(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { deleteSermon, loading };
}

export function usePublishSermon() {
    const [loading, setLoading] = useState(false);

    // Toasts are owned by the caller (e.g. `useSermonPublishGate`) so the
    // fidelity gate flow can distinguish a `FidelityGateError` (open the
    // confrontation modal) from a real failure (Phase 3 PR 2). The override
    // is forwarded to the service, which enforces the gate + persists audit.
    const publishSermon = async (id: string, override?: PublishOverrideInput) => {
        setLoading(true);
        try {
            return await sermonService.publishSermon(id, override);
        } finally {
            setLoading(false);
        }
    };

    return { publishSermon, loading };
}

export function useArchiveSermon() {
    const [loading, setLoading] = useState(false);

    const archiveSermon = async (id: string) => {
        setLoading(true);
        try {
            const sermon = await sermonService.archiveSermon(id);
            toast.success('Sermón archivado exitosamente');
            return sermon;
        } catch (err: any) {
            toast.error(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { archiveSermon, loading };
}
