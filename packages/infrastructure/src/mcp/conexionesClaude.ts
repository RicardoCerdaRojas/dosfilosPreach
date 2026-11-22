import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Conectar Claude (u otro cliente MCP) con la biblioteca y los trabajos del
 * usuario (fase «Asistente del corpus», A9). La web solo ve la solicitud,
 * decide y administra sus conexiones; el servidor de autorización vive en
 * packages/mcp. La capa web no importa Firebase directamente.
 */

export interface SolicitudDeConexion {
    /** El nombre con que se registró el cliente («Claude»). */
    cliente: string;
    /** El sitio al que vuelve («claude.ai»). */
    destino: string;
    alcances: string[];
}

export interface ConexionMcp {
    id: string;
    cliente: string;
    /** El sitio al que vuelve el cliente («claude.ai»): distingue dos clientes con el mismo nombre. */
    destino: string | null;
    alcances: string[];
    /** Milisegundos desde 1970. */
    creado: number;
}

export async function verSolicitudDeConexion(solicitud: string): Promise<SolicitudDeConexion> {
    const f = httpsCallable<{ solicitud: string }, SolicitudDeConexion>(getFunctions(), 'mcpSolicitud');
    return (await f({ solicitud })).data;
}

/** Aprobar o negar: devuelve la dirección de vuelta al cliente (con el código o con el rechazo). */
export async function resolverSolicitudDeConexion(solicitud: string, aprobar: boolean): Promise<string> {
    const f = httpsCallable<{ solicitud: string; aprobar: boolean }, { destino: string }>(getFunctions(), 'mcpResolverSolicitud');
    return (await f({ solicitud, aprobar })).data.destino;
}

export async function listarConexionesMcp(): Promise<ConexionMcp[]> {
    const f = httpsCallable<Record<string, never>, { conexiones: ConexionMcp[] }>(getFunctions(), 'mcpConexiones');
    return (await f({})).data.conexiones;
}

export async function revocarConexionMcpCliente(conexion: string): Promise<void> {
    const f = httpsCallable<{ conexion: string }, { ok: boolean }>(getFunctions(), 'mcpRevocarConexion');
    await f({ conexion });
}
