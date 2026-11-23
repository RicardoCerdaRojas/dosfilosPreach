import { createHash } from 'node:crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { firestoreFalso } from './firestoreFalso';

let limite = true;
vi.mock('../../../functions/src/shared/rateLimit', () => ({ consumeRateLimitToken: async () => limite }));
vi.mock('../../../functions/src/library/consulta/recuperarFragmentos', () => ({ buscarPertinentes: async () => ({ reordenado: true, fragmentos: [] }) }));
const { manejar } = await import('../servidor');
const { resolverSolicitudMcp, verSolicitudMcp, conexionesMcp, revocarConexionMcp, requiereUsuarioPropio } = await import('../consentimiento');

const ORIGEN = 'https://app.preach.dosfilos.com';
const CONSENTIMIENTO = 'https://app.preach.dosfilos.com';
const RETORNO = 'https://claude.ai/api/mcp/auth_callback';
const verifier = 'v'.repeat(50);
const challenge = createHash('sha256').update(verifier).digest('base64url');

function respuesta() {
    const r: any = { codigo: 200, cabeceras: {} as Record<string, string>, cuerpo: undefined as unknown, destino: null as string | null };
    r.status = (c: number) => { r.codigo = c; return r; };
    r.set = (k: string, v: string) => { r.cabeceras[k.toLowerCase()] = v; return r; };
    r.json = (b: unknown) => { r.cuerpo = b; };
    r.send = (b?: unknown) => { r.cuerpo = b; };
    r.redirect = (c: number, u: string) => { r.codigo = c; r.destino = u; };
    return r;
}
function pedir(db: unknown, method: string, path: string, opciones: { body?: unknown; query?: Record<string, unknown>; auth?: string } = {}) {
    const res = respuesta();
    const cabeceras: Record<string, string> = { host: 'app.preach.dosfilos.com', ...(opciones.auth ? { authorization: `Bearer ${opciones.auth}` } : {}) };
    return manejar({ method, path, body: opciones.body ?? {}, query: opciones.query ?? {}, ip: '1.2.3.4', get: (k: string) => cabeceras[k.toLowerCase()] },
        res, { db: db as never, origenDeConsentimiento: CONSENTIMIENTO, origenPublico: ORIGEN, geminiKey: 'k' }).then(() => res);
}

/** El recorrido de Claude Desktop hasta tener un token. */
async function conectar(db: any, uid = 'yo') {
    const reg = await pedir(db, 'POST', '/oauth/register', { body: { client_name: 'Claude', redirect_uris: [RETORNO] } });
    const clientId = (reg.cuerpo as { client_id: string }).client_id;
    const aut = await pedir(db, 'GET', '/oauth/authorize', { query: {
        response_type: 'code', client_id: clientId, redirect_uri: RETORNO, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'corpus:read', resource: `${ORIGEN}/mcp`,
    } });
    const solicitud = new URL(aut.destino!).searchParams.get('solicitud')!;
    const { destino } = await resolverSolicitudMcp(db, uid, { solicitud, aprobar: true });
    const code = new URL(destino).searchParams.get('code')!;
    const tok = await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: RETORNO } });
    return { clientId, solicitud, destino, code, tokens: tok.cuerpo as { access_token: string; refresh_token: string }, tok };
}

beforeEach(() => { limite = true; });

describe('servidor de autorización OAuth 2.1 y MCP (A9)', () => {
    it('publica los metadatos del recurso y del servidor de autorización, con PKCE S256 y registro dinámico', async () => {
        const { db } = firestoreFalso();
        const pr = await pedir(db, 'GET', '/.well-known/oauth-protected-resource');
        expect(pr.cuerpo).toMatchObject({ resource: `${ORIGEN}/mcp`, authorization_servers: [ORIGEN] });
        const as = (await pedir(db, 'GET', '/.well-known/oauth-authorization-server')).cuerpo as Record<string, unknown>;
        expect(as).toMatchObject({ issuer: ORIGEN, code_challenge_methods_supported: ['S256'], registration_endpoint: `${ORIGEN}/oauth/register`, token_endpoint_auth_methods_supported: ['none'] });
    });

    it('el recorrido completo: registro, consentimiento, código con PKCE, token, herramientas, refresco y revocación', async () => {
        const { db } = firestoreFalso();
        const c = await conectar(db);
        expect(c.destino).toContain('state=xyz');
        expect(c.tok.codigo).toBe(200);
        expect(c.tok.cabeceras['cache-control']).toBe('no-store');
        // Las herramientas.
        const lista = await pedir(db, 'POST', '/mcp', { auth: c.tokens.access_token, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
        expect((lista.cuerpo as any).result.tools.map((t: any) => t.name)).toContain('leer_hoja');
        // Un token de refresco no abre el MCP.
        expect((await pedir(db, 'POST', '/mcp', { auth: c.tokens.refresh_token, body: { jsonrpc: '2.0', id: 9, method: 'ping' } })).codigo).toBe(401);
        // Refresco con rotación: el viejo deja de valer.
        const r1 = await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: c.tokens.refresh_token, client_id: c.clientId } });
        expect((r1.cuerpo as any).access_token).toBeTruthy();
        const r2 = await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: c.tokens.refresh_token, client_id: c.clientId } });
        expect(r2.cuerpo).toEqual({ error: 'invalid_grant' });
        // Revocar el token de acceso.
        const nuevo = (r1.cuerpo as any).access_token;
        await pedir(db, 'POST', '/oauth/revoke', { body: { token: nuevo } });
        const sin = await pedir(db, 'POST', '/mcp', { auth: nuevo, body: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
        expect(sin.codigo).toBe(401);
        // Un código no se usa dos veces (y presentarlo otra vez corta la conexión: ver «reuso»).
        const otra = await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'authorization_code', code: c.code, code_verifier: verifier, client_id: c.clientId, redirect_uri: RETORNO } });
        expect(otra.cuerpo).toEqual({ error: 'invalid_grant' });
    });

    it('PKCE: otro verifier, otro cliente u otra URI de retorno no canjean el código (y lo queman)', async () => {
        const { db } = firestoreFalso();
        const reg = await pedir(db, 'POST', '/oauth/register', { body: { client_name: 'C', redirect_uris: [RETORNO] } });
        const clientId = (reg.cuerpo as any).client_id;
        const pedirCodigo = async () => {
            const aut = await pedir(db, 'GET', '/oauth/authorize', { query: { response_type: 'code', client_id: clientId, redirect_uri: RETORNO, code_challenge: challenge, code_challenge_method: 'S256' } });
            const { destino } = await resolverSolicitudMcp(db, 'yo', { solicitud: new URL(aut.destino!).searchParams.get('solicitud'), aprobar: true });
            return new URL(destino).searchParams.get('code')!;
        };
        const malos = [
            { code_verifier: 'w'.repeat(50), client_id: clientId, redirect_uri: RETORNO },
            { code_verifier: verifier, client_id: 'mcp_otroclienteXYZ', redirect_uri: RETORNO },
            { code_verifier: verifier, client_id: clientId, redirect_uri: 'https://otro.example/cb' },
        ];
        for (const m of malos) {
            const code = await pedirCodigo();
            expect((await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'authorization_code', code, ...m } })).cuerpo).toEqual({ error: 'invalid_grant' });
            // Quemado: tampoco con los datos buenos.
            expect((await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: RETORNO } })).cuerpo).toEqual({ error: 'invalid_grant' });
        }
    });

    it('autorizar: sin cliente o con una URI no registrada no redirige; sin S256 vuelve con error; el recurso debe ser este', async () => {
        const { db } = firestoreFalso();
        const reg = await pedir(db, 'POST', '/oauth/register', { body: { client_name: 'C', redirect_uris: [RETORNO] } });
        const clientId = (reg.cuerpo as any).client_id;
        const base = { response_type: 'code', client_id: clientId, redirect_uri: RETORNO, code_challenge: challenge, code_challenge_method: 'S256' };
        const malaUri = await pedir(db, 'GET', '/oauth/authorize', { query: { ...base, redirect_uri: 'https://ladron.example/cb' } });
        expect(malaUri.codigo).toBe(400);
        expect(malaUri.destino).toBeNull();
        const plano = await pedir(db, 'GET', '/oauth/authorize', { query: { ...base, code_challenge_method: 'plain' } });
        expect(new URL(plano.destino!).searchParams.get('error')).toBe('invalid_request');
        const alcance = await pedir(db, 'GET', '/oauth/authorize', { query: { ...base, scope: 'admin:all' } });
        expect(new URL(alcance.destino!).searchParams.get('error')).toBe('invalid_scope');
        const recurso = await pedir(db, 'GET', '/oauth/authorize', { query: { ...base, resource: 'https://otro.example/mcp' } });
        expect(new URL(recurso.destino!).searchParams.get('error')).toBe('invalid_target');
    });

    it('registro: solo el retorno de Claude o un puerto local, clientes públicos y con tope', async () => {
        const { db } = firestoreFalso();
        expect((await pedir(db, 'POST', '/oauth/register', { body: { redirect_uris: ['http://ladron.example/cb'] } })).codigo).toBe(400);
        // Un https cualquiera tampoco: un tercero no puede registrarse como «Claude» con su propio retorno.
        expect((await pedir(db, 'POST', '/oauth/register', { body: { client_name: 'Claude', redirect_uris: ['https://claude-ai.ladron.example/cb'] } })).codigo).toBe(400);
        expect((await pedir(db, 'POST', '/oauth/register', { body: { redirect_uris: ['https://claude.com/api/mcp/auth_callback'] } })).codigo).toBe(201);
        expect((await pedir(db, 'POST', '/oauth/register', { body: { redirect_uris: ['http://127.0.0.1:33418/cb'] } })).codigo).toBe(201);
        expect((await pedir(db, 'POST', '/oauth/register', { body: { redirect_uris: [RETORNO], token_endpoint_auth_method: 'client_secret_basic' } })).codigo).toBe(400);
        limite = false;
        expect((await pedir(db, 'POST', '/oauth/register', { body: { redirect_uris: [RETORNO] } })).codigo).toBe(429);
    });

    it('consentimiento: la solicitud se ve y se decide una sola vez; negar vuelve con access_denied', async () => {
        const { db } = firestoreFalso();
        const reg = await pedir(db, 'POST', '/oauth/register', { body: { client_name: 'Claude', redirect_uris: [RETORNO] } });
        const aut = await pedir(db, 'GET', '/oauth/authorize', { query: { response_type: 'code', client_id: (reg.cuerpo as any).client_id, redirect_uri: RETORNO, code_challenge: challenge, code_challenge_method: 'S256', state: 's1' } });
        const solicitud = new URL(aut.destino!).searchParams.get('solicitud')!;
        expect(aut.destino!.startsWith(`${CONSENTIMIENTO}/conectar?`)).toBe(true);
        expect(await verSolicitudMcp(db, 'yo', { solicitud })).toEqual({ cliente: 'Claude', destino: 'claude.ai', alcances: ['corpus:read'] });
        const { destino } = await resolverSolicitudMcp(db, 'yo', { solicitud, aprobar: false });
        expect(new URL(destino).searchParams.get('error')).toBe('access_denied');
        expect(new URL(destino).searchParams.get('state')).toBe('s1');
        await expect(resolverSolicitudMcp(db, 'yo', { solicitud, aprobar: true })).rejects.toThrow('venció o ya se usó');
        await expect(verSolicitudMcp(db, 'yo', { solicitud })).rejects.toThrow('venció o ya se usó');
    });

    it('conexiones: el usuario ve las suyas y al revocar una se cortan sus tokens y su refresco; no revoca las ajenas', async () => {
        const { db } = firestoreFalso();
        const c = await conectar(db);
        const { conexiones } = await conexionesMcp(db, 'yo');
        expect(conexiones).toHaveLength(1);
        expect((await conexionesMcp(db, 'otro')).conexiones).toHaveLength(0);
        await expect(revocarConexionMcp(db, 'otro', { conexion: conexiones[0]!.id })).rejects.toThrow('No encontré');
        await revocarConexionMcp(db, 'yo', { conexion: conexiones[0]!.id });
        expect((await pedir(db, 'POST', '/mcp', { auth: c.tokens.access_token, body: { jsonrpc: '2.0', id: 1, method: 'ping' } })).codigo).toBe(401);
        expect((await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: c.tokens.refresh_token, client_id: c.clientId } })).cuerpo).toEqual({ error: 'invalid_grant' });
        expect((await conexionesMcp(db, 'yo')).conexiones).toHaveLength(0);
    });

    it('MCP: sin token, 401 con la dirección de los metadatos; initialize, notificaciones, lotes y errores', async () => {
        const { db, agregados } = firestoreFalso();
        const sin = await pedir(db, 'POST', '/mcp', { body: { jsonrpc: '2.0', id: 1, method: 'initialize' } });
        expect(sin.codigo).toBe(401);
        expect(sin.cabeceras['www-authenticate']).toBe(`Bearer resource_metadata="${ORIGEN}/.well-known/oauth-protected-resource"`);
        const { tokens } = await conectar(db);
        const ini = await pedir(db, 'POST', '/mcp', { auth: tokens.access_token, body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } } });
        expect((ini.cuerpo as any).result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} } });
        const notif = await pedir(db, 'POST', '/mcp', { auth: tokens.access_token, body: { jsonrpc: '2.0', method: 'notifications/initialized' } });
        expect(notif.codigo).toBe(202);
        // Sin lotes (los quitó 2025-06-18; multiplicaban búsquedas en paralelo).
        const lote = await pedir(db, 'POST', '/mcp', { auth: tokens.access_token, body: [{ jsonrpc: '2.0', id: 1, method: 'ping' }] });
        expect(lote.codigo).toBe(400);
        expect((lote.cuerpo as any).error.code).toBe(-32600);
        const nada = await pedir(db, 'POST', '/mcp', { auth: tokens.access_token, body: { jsonrpc: '2.0', id: 2, method: 'nada' } });
        expect((nada.cuerpo as any).error.code).toBe(-32601);
        const get = await pedir(db, 'GET', '/mcp', { auth: tokens.access_token });
        expect(get.codigo).toBe(405);
        // Un error de herramienta vuelve como resultado legible, y queda auditado.
        const err = await pedir(db, 'POST', '/mcp', { auth: tokens.access_token, body: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'leer_hoja', arguments: { libro: 'no-existe', hoja: 1 } } } });
        expect((err.cuerpo as any).result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'No encontré ese libro en tu biblioteca.' }] });
        expect(agregados.find(a => a.coleccion === 'corpus_audit_log')?.datos).toMatchObject({ uid: 'yo', herramienta: 'leer_hoja', ok: false });
    });

    it('revocar y volver a aprobar no revive los tokens viejos (generación de la conexión)', async () => {
        const { db } = firestoreFalso();
        const viejo = await conectar(db);
        const [g] = (await conexionesMcp(db, 'yo')).conexiones;
        await revocarConexionMcp(db, 'yo', { conexion: g!.id });
        // Se vuelve a aprobar el MISMO cliente (Claude reusa su client_id).
        const aut = await pedir(db, 'GET', '/oauth/authorize', { query: { response_type: 'code', client_id: viejo.clientId, redirect_uri: RETORNO, code_challenge: challenge, code_challenge_method: 'S256' } });
        await resolverSolicitudMcp(db, 'yo', { solicitud: new URL(aut.destino!).searchParams.get('solicitud'), aprobar: true });
        expect((await pedir(db, 'POST', '/mcp', { auth: viejo.tokens.access_token, body: { jsonrpc: '2.0', id: 1, method: 'ping' } })).codigo).toBe(401);
        expect((await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: viejo.tokens.refresh_token, client_id: viejo.clientId } })).cuerpo).toEqual({ error: 'invalid_grant' });
        expect((await conexionesMcp(db, 'yo')).conexiones[0]).toMatchObject({ cliente: 'Claude', destino: 'claude.ai' });
    });

    it('reuso: un código o un refresco presentados otra vez cortan la conexión entera', async () => {
        const a = firestoreFalso();
        const c1 = await conectar(a.db);
        await pedir(a.db, 'POST', '/oauth/token', { body: { grant_type: 'authorization_code', code: c1.code, code_verifier: verifier, client_id: c1.clientId, redirect_uri: RETORNO } });
        expect((await pedir(a.db, 'POST', '/mcp', { auth: c1.tokens.access_token, body: { jsonrpc: '2.0', id: 1, method: 'ping' } })).codigo).toBe(401);
        const b = firestoreFalso();
        const c2 = await conectar(b.db);
        const nuevo = (await pedir(b.db, 'POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: c2.tokens.refresh_token, client_id: c2.clientId } })).cuerpo as any;
        // El refresco viejo vuelve (lo tenía un ladrón): se corta también el nuevo.
        await pedir(b.db, 'POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: c2.tokens.refresh_token, client_id: c2.clientId } });
        expect((await pedir(b.db, 'POST', '/mcp', { auth: nuevo.access_token, body: { jsonrpc: '2.0', id: 1, method: 'ping' } })).codigo).toBe(401);
    });

    it('el recurso pedido al canjear tiene que ser el del código', async () => {
        const { db } = firestoreFalso();
        const reg = await pedir(db, 'POST', '/oauth/register', { body: { client_name: 'C', redirect_uris: [RETORNO] } });
        const clientId = (reg.cuerpo as any).client_id;
        const aut = await pedir(db, 'GET', '/oauth/authorize', { query: { response_type: 'code', client_id: clientId, redirect_uri: RETORNO, code_challenge: challenge, code_challenge_method: 'S256', resource: `${ORIGEN}/mcp` } });
        const { destino } = await resolverSolicitudMcp(db, 'yo', { solicitud: new URL(aut.destino!).searchParams.get('solicitud'), aprobar: true });
        const code = new URL(destino).searchParams.get('code')!;
        expect((await pedir(db, 'POST', '/oauth/token', { body: { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: RETORNO, resource: 'https://otro.example/mcp' } })).cuerpo).toEqual({ error: 'invalid_grant' });
    });

    it('autorizar tiene tope por cliente; aprobar no se puede entrando como otro usuario', async () => {
        const { db } = firestoreFalso();
        const reg = await pedir(db, 'POST', '/oauth/register', { body: { client_name: 'C', redirect_uris: [RETORNO] } });
        limite = false;
        const aut = await pedir(db, 'GET', '/oauth/authorize', { query: { response_type: 'code', client_id: (reg.cuerpo as any).client_id, redirect_uri: RETORNO, code_challenge: challenge, code_challenge_method: 'S256' } });
        expect(new URL(aut.destino!).searchParams.get('error')).toBe('temporarily_unavailable');
        expect(() => requiereUsuarioPropio({ uid: 'pastor', token: { impersonatorUid: 'admin' } })).toThrow('entras como otro usuario');
        expect(requiereUsuarioPropio({ uid: 'pastor', token: {} })).toBe('pastor');
    });
});
