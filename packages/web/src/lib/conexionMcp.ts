/**
 * La dirección del servidor MCP que se agrega en Claude (u otra aplicación).
 * Hosting la reescribe a la función `mcpGateway` (packages/mcp).
 */
export const DIRECCION_DEL_SERVIDOR_MCP = 'https://app.preach.dosfilos.com/mcp';

const CLAVE = 'conectar.solicitudPendiente';

/** Lo que vive una solicitud en el servidor: después ya no sirve volver a ella. */
const VIGENCIA_MS = 10 * 60 * 1000;

/** Si hay que iniciar sesión primero, se recuerda la solicitud en esta pestaña. */
export function guardarSolicitudPendiente(solicitud: string, ahora = Date.now()): void {
    try { window.sessionStorage.setItem(CLAVE, JSON.stringify({ solicitud, hasta: ahora + VIGENCIA_MS })); } catch { /* sin almacenamiento: se vuelve a conectar desde la aplicación */ }
}

/** Adónde ir después de entrar: la conexión pendiente, si la hay; si no, el escritorio. */
export function destinoTrasEntrar(ahora = Date.now()): string {
    try {
        const crudo = window.sessionStorage.getItem(CLAVE);
        if (crudo) {
            window.sessionStorage.removeItem(CLAVE);
            const { solicitud, hasta } = JSON.parse(crudo) as { solicitud?: unknown; hasta?: unknown };
            // Una solicitud vencida no lleva a ningún lado: al escritorio, como siempre.
            if (typeof solicitud === 'string' && typeof hasta === 'number' && hasta > ahora) return `/conectar?solicitud=${encodeURIComponent(solicitud)}`;
        }
    } catch { /* sin almacenamiento o dato viejo */ }
    return '/dashboard';
}
