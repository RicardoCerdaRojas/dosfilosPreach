import { useQuery } from '@tanstack/react-query';
import { FirebaseChunkRepository } from '@dosfilos/infrastructure';

/** El texto completo de una sección de un libro sin hojas (JFB, A8c). */
export function useTextoDeSeccion(resourceId: string | null, seccion: string | null) {
    return useQuery({
        queryKey: ['texto-de-seccion', resourceId, seccion],
        enabled: !!resourceId && !!seccion,
        staleTime: 30 * 60 * 1000,
        retry: 1,
        queryFn: () => new FirebaseChunkRepository().textoDeLaSeccion(resourceId!, seccion!),
    });
}
