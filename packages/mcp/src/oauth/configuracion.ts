/** Los alcances que entiende este servidor (diseño §8.1). En A9, solo lectura. */
export const ALCANCES_SOPORTADOS = ['corpus:read'] as const;

/** Vigencias. */
export const VIGENCIA = {
    solicitudMs: 10 * 60 * 1000,
    codigoMs: 5 * 60 * 1000,
    accesoS: 60 * 60,
    refrescoMs: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Las URIs de retorno https que se aceptan: las de Claude. Cualquier https
 * dejaba que un tercero registrara un cliente llamado «Claude» con retorno a
 * su propio dominio y pidiera al usuario aprobarlo («consent phishing»), y
 * convertía /oauth/authorize en un redirector abierto (revisión de A9). Otro
 * cliente se agrega aquí, a conciencia.
 */
export const RETORNOS_HTTPS_PERMITIDOS: ReadonlyArray<string> = [
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.com/api/mcp/auth_callback',
];

/**
 * Una URI de retorno aceptable: una de las permitidas, o un puerto local para
 * clientes de escritorio (RFC 8252), que no puede recibir un código ajeno.
 */
export function uriDeRetornoValida(uri: unknown): uri is string {
    if (typeof uri !== 'string' || uri.length > 500) return false;
    if (RETORNOS_HTTPS_PERMITIDOS.includes(uri)) return true;
    let u: URL;
    try { u = new URL(uri); } catch { return false; }
    if (u.hash || u.username || u.password) return false;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]');
}

/** Los alcances pedidos, si todos se soportan; sin pedir, lectura. */
export function alcancesPedidos(scope: unknown): string[] | null {
    if (scope === undefined || scope === null || scope === '') return ['corpus:read'];
    if (typeof scope !== 'string') return null;
    const pedidos = [...new Set(scope.split(/\s+/).filter(Boolean))];
    return pedidos.every(a => (ALCANCES_SOPORTADOS as readonly string[]).includes(a)) ? pedidos : null;
}
