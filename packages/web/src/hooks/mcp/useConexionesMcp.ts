import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    listarConexionesMcp,
    resolverSolicitudDeConexion,
    revocarConexionMcpCliente,
    verSolicitudDeConexion,
} from '@dosfilos/infrastructure';

const CLAVE = ['mcp', 'conexiones'] as const;

/** La solicitud de conexión que llega desde la aplicación (A9). */
export function useSolicitudDeConexion(solicitud: string | null, habilitada: boolean) {
    return useQuery({
        queryKey: ['mcp', 'solicitud', solicitud],
        enabled: habilitada && !!solicitud,
        retry: false,
        staleTime: Infinity,
        queryFn: () => verSolicitudDeConexion(solicitud!),
    });
}

export function useResolverSolicitud(solicitud: string | null) {
    return useMutation({ mutationFn: (aprobar: boolean) => resolverSolicitudDeConexion(solicitud!, aprobar) });
}

export function useConexionesMcp(habilitada: boolean) {
    return useQuery({ queryKey: CLAVE, enabled: habilitada, queryFn: listarConexionesMcp });
}

export function useRevocarConexionMcp() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => revocarConexionMcpCliente(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
    });
}
