import type { Firestore } from 'firebase-admin/firestore';
import { consumeRateLimitToken } from '../../functions/src/shared/rateLimit';
import { auditar } from './auditoria';
import { herramientasPara } from './herramientas/registro';
import { atender, type Mensaje } from './mcp/protocolo';
import { canjearCodigo, cliente, crearSolicitud, refrescar, registrarCliente, revocarToken, validarAcceso } from './oauth/almacen';
import { ALCANCES_SOPORTADOS, alcancesPedidos, uriDeRetornoValida } from './oauth/configuracion';
import { challengeValido } from './oauth/cripto';

/** Lo mínimo de una petición y una respuesta HTTP (Express, en Cloud Functions). */
export interface Peticion {
    method: string;
    path: string;
    body: unknown;
    query: Record<string, unknown>;
    ip?: string;
    get(nombre: string): string | undefined;
}
export interface Respuesta {
    status(codigo: number): Respuesta;
    set(cabecera: string, valor: string): Respuesta;
    json(cuerpo: unknown): void;
    send(cuerpo?: unknown): void;
    redirect(codigo: number, url: string): void;
}

export interface Configuracion {
    db: Firestore;
    /**
     * El origen público del servidor (issuer y audiencia), fijo por
     * configuración: derivarlo de `x-forwarded-host` dejaba que quien llama
     * directo a la URL de Cloud Run lo falseara (revisión de A9).
     */
    origenPublico: string;
    /** Dónde está la página de consentimiento de la web (la app). */
    origenDeConsentimiento: string;
    geminiKey: string | null;
}

const CABECERAS_CORS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'WWW-Authenticate',
};

function cuerpo(req: Peticion): Record<string, unknown> {
    return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {};
}
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/**
 * La puerta 1 del diseño (§8.1): servidor de autorización OAuth 2.1 (PKCE
 * obligatorio, registro dinámico de clientes, tokens revocables con alcance)
 * delante de Firebase Auth, y el punto MCP de solo lectura.
 */
export async function manejar(req: Peticion, res: Respuesta, cfg: Configuracion): Promise<void> {
    for (const [k, v] of Object.entries(CABECERAS_CORS)) res.set(k, v);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    const origen = cfg.origenPublico;
    const ruta = req.path.replace(/\/+$/, '') || '/';

    if (req.method === 'GET' && ruta.startsWith('/.well-known/oauth-protected-resource')) {
        res.json({
            resource: `${origen}/mcp`,
            authorization_servers: [origen],
            scopes_supported: [...ALCANCES_SOPORTADOS],
            bearer_methods_supported: ['header'],
            resource_name: 'Dos Filos Preach — biblioteca y trabajos',
        });
        return;
    }
    if (req.method === 'GET' && ruta.startsWith('/.well-known/oauth-authorization-server')) {
        res.json({
            issuer: origen,
            authorization_endpoint: `${origen}/oauth/authorize`,
            token_endpoint: `${origen}/oauth/token`,
            registration_endpoint: `${origen}/oauth/register`,
            revocation_endpoint: `${origen}/oauth/revoke`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
            revocation_endpoint_auth_methods_supported: ['none'],
            scopes_supported: [...ALCANCES_SOPORTADOS],
        });
        return;
    }
    if (req.method === 'POST' && ruta === '/oauth/register') return registrar(req, res, cfg);
    if (req.method === 'GET' && ruta === '/oauth/authorize') return autorizar(req, res, cfg, origen);
    if (req.method === 'POST' && ruta === '/oauth/token') return token(req, res, cfg);
    if (req.method === 'POST' && ruta === '/oauth/revoke') {
        const t = str(cuerpo(req).token);
        if (t) await revocarToken(cfg.db, t);
        res.status(200).send('');
        return;
    }
    if (ruta === '/mcp') return mcp(req, res, cfg, origen);
    res.status(404).json({ error: 'not_found' });
}

async function registrar(req: Peticion, res: Respuesta, cfg: Configuracion): Promise<void> {
    const b = cuerpo(req);
    // Por IP y, como la IP llega por una cabecera que el cliente puede poner,
    // también un tope global: el registro escribe un documento por llamada.
    const hora = 60 * 60 * 1000;
    const porIp = await consumeRateLimitToken(cfg.db, { bucket: 'mcp_register', key: (req.ip ?? 'sin-ip').replace(/[^A-Za-z0-9:.]/g, '_'), windowMs: hora, max: 20 });
    const global = porIp && await consumeRateLimitToken(cfg.db, { bucket: 'mcp_register', key: 'global', windowMs: hora, max: 200 });
    if (!porIp || !global) { res.status(429).json({ error: 'too_many_requests' }); return; }
    const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
    if (uris.length === 0 || uris.length > 5 || !uris.every(uriDeRetornoValida)) {
        res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris: la de Claude, o un puerto local.' });
        return;
    }
    const auth = str(b.token_endpoint_auth_method);
    if (auth && auth !== 'none') { res.status(400).json({ error: 'invalid_client_metadata', error_description: 'Solo clientes públicos (token_endpoint_auth_method: none).' }); return; }
    const nombre = (str(b.client_name) ?? 'Cliente MCP').replace(/[\u0000-\u001f<>]/g, '').slice(0, 80);
    const c = await registrarCliente(cfg.db, { nombre, uris: uris as string[] });
    res.status(201).json({
        ...c,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
    });
}

async function autorizar(req: Peticion, res: Respuesta, cfg: Configuracion, origen: string): Promise<void> {
    const q = req.query;
    const c = str(q.client_id) ? await cliente(cfg.db, str(q.client_id)!) : null;
    const uri = str(q.redirect_uri);
    // Sin cliente ni URI registrada no se redirige a ningún lado (RFC 6749 §4.1.2.1).
    if (!c || !uri || !c.redirect_uris.includes(uri)) {
        res.status(400).set('Content-Type', 'text/plain; charset=utf-8').send('Solicitud de autorización inválida: cliente o URI de retorno desconocidos.');
        return;
    }
    const state = str(q.state);
    const volver = (error: string) => {
        const u = new URL(uri);
        u.searchParams.set('error', error);
        if (state) u.searchParams.set('state', state);
        res.redirect(302, u.toString());
    };
    if (q.response_type !== 'code') return volver('unsupported_response_type');
    if (q.code_challenge_method !== 'S256' || !challengeValido(q.code_challenge)) return volver('invalid_request');
    const alcances = alcancesPedidos(q.scope);
    if (!alcances) return volver('invalid_scope');
    const recurso = str(q.resource);
    if (recurso && recurso !== `${origen}/mcp`) return volver('invalid_target');
    // Cada autorización escribe un documento: tope por cliente.
    if (!(await consumeRateLimitToken(cfg.db, { bucket: 'mcp_authorize', key: c.client_id, windowMs: 60 * 60 * 1000, max: 60 }))) return volver('temporarily_unavailable');
    const id = await crearSolicitud(cfg.db, { clienteId: c.client_id, uriDeRetorno: uri, state, challenge: q.code_challenge, alcances, recurso });
    res.redirect(302, `${cfg.origenDeConsentimiento}/conectar?solicitud=${encodeURIComponent(id)}`);
}

async function token(req: Peticion, res: Respuesta, cfg: Configuracion): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const b = cuerpo(req);
    const clienteId = str(b.client_id);
    let t = null;
    if (b.grant_type === 'authorization_code') {
        const codigo = str(b.code), verifier = str(b.code_verifier), uri = str(b.redirect_uri);
        if (!codigo || !verifier || !uri || !clienteId) { res.status(400).json({ error: 'invalid_request' }); return; }
        t = await canjearCodigo(cfg.db, { codigo, verifier, clienteId, uriDeRetorno: uri, recurso: str(b.resource) });
    } else if (b.grant_type === 'refresh_token') {
        const refresco = str(b.refresh_token);
        if (!refresco || !clienteId) { res.status(400).json({ error: 'invalid_request' }); return; }
        t = await refrescar(cfg.db, { refresco, clienteId });
    } else {
        res.status(400).json({ error: 'unsupported_grant_type' });
        return;
    }
    if (!t) { res.status(400).json({ error: 'invalid_grant' }); return; }
    res.json(t);
}

async function mcp(req: Peticion, res: Respuesta, cfg: Configuracion, origen: string): Promise<void> {
    const portador = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '')?.[1]?.trim() ?? '';
    const acceso = await validarAcceso(cfg.db, portador);
    if (!acceso) {
        res.status(401)
            .set('WWW-Authenticate', `Bearer resource_metadata="${origen}/.well-known/oauth-protected-resource"`)
            .json({ error: 'invalid_token' });
        return;
    }
    // Sin SSE: este servidor no inicia mensajes ni guarda sesiones.
    if (req.method !== 'POST') { res.status(405).set('Allow', 'POST').send(''); return; }
    const deps = {
        herramientas: herramientasPara(acceso.alcances),
        ctx: { uid: acceso.uid, clienteId: acceso.clienteId, db: cfg.db, geminiKey: cfg.geminiKey },
        auditar: (e: Parameters<typeof auditar>[1] extends infer T ? Omit<T & object, 'uid' | 'clienteId'> : never) =>
            auditar(cfg.db, { ...e, uid: acceso.uid, clienteId: acceso.clienteId }),
    };
    // Sin lotes: la versión 2025-06-18 los quitó, y un lote de búsquedas en
    // paralelo multiplicaba el costo y pasaba el tiempo de Hosting (60 s).
    if (Array.isArray(req.body)) { res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Lotes no soportados' } }); return; }
    const respuesta = await atender(req.body as Mensaje, deps);
    if (respuesta === null) { res.status(202).send(''); return; }
    res.json(respuesta);
}
