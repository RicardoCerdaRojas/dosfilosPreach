import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { huella, pkceValido, secreto } from './cripto';
import { VIGENCIA } from './configuracion';

/**
 * Lo que guarda el servidor de autorización (diseño §8.1). Todo en colecciones
 * que las reglas no dejan leer al cliente; los secretos (códigos y tokens) se
 * guardan por su huella, nunca en claro.
 *
 *   mcp_clients/{clientId}        clientes registrados (registro dinámico)
 *   mcp_auth_requests/{id}        una autorización pedida, hasta que el usuario decide
 *   mcp_codes/{huella}            código de un solo uso (5 min), atado a PKCE
 *   mcp_grants/{uid_clientId}     la conexión que el usuario ve y revoca en la web
 *   mcp_tokens/{huella}           tokens de acceso (1 h) y de refresco (30 días)
 *
 * Cada aprobación sube la GENERACIÓN de la conexión, y un token solo vale para
 * la suya: revocar y volver a aprobar no revive los tokens viejos (revisión
 * de A9). Presentar otra vez un código o un refresco ya usados revoca la
 * conexión entera (OAuth 2.1: quien lo presenta puede ser un ladrón).
 * `expiraEn` es para una política de TTL de Firestore que limpie lo vencido.
 */

export interface Cliente {
    client_id: string;
    client_name: string;
    redirect_uris: string[];
}

export interface Tokens {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
}

export interface Acceso {
    uid: string;
    clienteId: string;
    alcances: string[];
    grantId: string;
}

interface Concesion { uid: string; clienteId: string; grantId: string; generacion: number; alcances: string[] }

const ahora = () => Date.now();

export async function registrarCliente(db: Firestore, datos: { nombre: string; uris: string[] }): Promise<Cliente> {
    const ref = db.collection('mcp_clients').doc(`mcp_${secreto(12)}`);
    const cliente = { client_id: ref.id, client_name: datos.nombre, redirect_uris: datos.uris };
    await ref.set({ ...cliente, creado: ahora() });
    return cliente;
}

export async function cliente(db: Firestore, id: string): Promise<Cliente | null> {
    if (!/^mcp_[A-Za-z0-9_-]{8,40}$/.test(id)) return null;
    const snap = await db.collection('mcp_clients').doc(id).get();
    return snap.exists ? (snap.data() as Cliente) : null;
}

export async function crearSolicitud(db: Firestore, s: {
    clienteId: string; uriDeRetorno: string; state: string | null; challenge: string; alcances: string[]; recurso: string | null;
}): Promise<string> {
    const id = secreto(24);
    const vence = ahora() + VIGENCIA.solicitudMs;
    await db.collection('mcp_auth_requests').doc(id).set({ ...s, vence, expiraEn: new Date(vence), usada: false });
    return id;
}

/** Lo que la página de consentimiento muestra; null si venció, se usó o no existe. */
export async function verSolicitud(db: Firestore, id: string): Promise<{ cliente: string; destino: string; alcances: string[] } | null> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(id)) return null;
    const s = (await db.collection('mcp_auth_requests').doc(id).get()).data();
    if (!s || s.usada || s.vence < ahora()) return null;
    const c = await cliente(db, s.clienteId);
    if (!c) return null;
    return { cliente: c.client_name, destino: new URL(s.uriDeRetorno).host, alcances: s.alcances };
}

function conParametros(uri: string, params: Record<string, string | null>): string {
    const u = new URL(uri);
    for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v);
    return u.toString();
}

/**
 * El usuario (ya autenticado en la web) decide. La solicitud se usa una sola
 * vez; si aprueba, nace o se renueva su conexión y sale un código de un solo
 * uso. Devuelve a dónde volver: la URI que el cliente registró, nunca otra.
 */
export async function resolverSolicitud(db: Firestore, uid: string, id: string, aprobar: boolean): Promise<string | null> {
    const ref = db.collection('mcp_auth_requests').doc(id);
    return db.runTransaction(async tx => {
        // Todas las lecturas antes que las escrituras (regla de las transacciones).
        const s = (await tx.get(ref)).data();
        if (!s || s.usada || s.vence < ahora()) return null;
        const c = await cliente(db, s.clienteId);
        const grantId = `${uid}_${s.clienteId}`;
        const grantRef = db.collection('mcp_grants').doc(grantId);
        const previa = (await tx.get(grantRef)).data();
        tx.update(ref, { usada: true });
        if (!aprobar) return conParametros(s.uriDeRetorno, { error: 'access_denied', state: s.state });
        if (!c) return null;
        const generacion = Number(previa?.generacion ?? 0) + 1;
        tx.set(grantRef, {
            uid, clienteId: s.clienteId, cliente: c.client_name, destino: new URL(s.uriDeRetorno).host,
            alcances: s.alcances, generacion, creado: ahora(), revocado: null,
        });
        const codigo = secreto();
        const vence = ahora() + VIGENCIA.codigoMs;
        tx.set(db.collection('mcp_codes').doc(huella(codigo)), {
            uid, clienteId: s.clienteId, grantId, generacion, uriDeRetorno: s.uriDeRetorno, challenge: s.challenge,
            alcances: s.alcances, recurso: s.recurso, vence, expiraEn: new Date(vence), usado: false,
        });
        return conParametros(s.uriDeRetorno, { code: codigo, state: s.state });
    });
}

function emitir(tx: Transaction, db: Firestore, g: Concesion): Tokens {
    const acceso = secreto();
    const refresco = secreto();
    const base = { uid: g.uid, clienteId: g.clienteId, grantId: g.grantId, generacion: g.generacion, alcances: g.alcances, revocado: false };
    const venceAcceso = ahora() + VIGENCIA.accesoS * 1000;
    const venceRefresco = ahora() + VIGENCIA.refrescoMs;
    tx.set(db.collection('mcp_tokens').doc(huella(acceso)), { ...base, tipo: 'acceso', vence: venceAcceso, expiraEn: new Date(venceAcceso) });
    tx.set(db.collection('mcp_tokens').doc(huella(refresco)), { ...base, tipo: 'refresco', vence: venceRefresco, expiraEn: new Date(venceRefresco) });
    return { access_token: acceso, token_type: 'Bearer', expires_in: VIGENCIA.accesoS, refresh_token: refresco, scope: g.alcances.join(' ') };
}

/** La conexión de un código o un token, si sigue viva y en la MISMA generación. */
async function conexionViva(tx: Transaction, db: Firestore, grantId: string, generacion: unknown): Promise<{ viva: boolean; ref: FirebaseFirestore.DocumentReference; generacion: unknown }> {
    const ref = db.collection('mcp_grants').doc(grantId);
    const g = (await tx.get(ref)).data();
    return { viva: !!g && !g.revocado && g.generacion === generacion, ref, generacion: g?.generacion };
}

/** authorization_code + PKCE. Un código vencido, usado, de otro cliente o con otro verifier: `invalid_grant`. */
export async function canjearCodigo(db: Firestore, p: { codigo: string; verifier: string; clienteId: string; uriDeRetorno: string; recurso?: string | null }): Promise<Tokens | null> {
    const ref = db.collection('mcp_codes').doc(huella(p.codigo));
    return db.runTransaction(async tx => {
        const c = (await tx.get(ref)).data();
        if (!c) return null;
        const conexion = await conexionViva(tx, db, c.grantId, c.generacion);
        if (c.usado) {
            // Un código presentado dos veces: lo que ya emitió puede estar en otras manos.
            if (conexion.viva) tx.update(conexion.ref, { revocado: ahora() });
            return null;
        }
        if (c.vence < ahora()) return null;
        // Se quema aunque falle lo demás: un código no se prueba dos veces.
        tx.update(ref, { usado: true });
        if (c.clienteId !== p.clienteId || c.uriDeRetorno !== p.uriDeRetorno || !pkceValido(p.verifier, c.challenge)) return null;
        if (p.recurso && c.recurso && p.recurso !== c.recurso) return null;
        if (!conexion.viva) return null;
        return emitir(tx, db, c as Concesion);
    });
}

/** refresh_token, con rotación: el refresco usado queda revocado. */
export async function refrescar(db: Firestore, p: { refresco: string; clienteId: string }): Promise<Tokens | null> {
    const ref = db.collection('mcp_tokens').doc(huella(p.refresco));
    return db.runTransaction(async tx => {
        const t = (await tx.get(ref)).data();
        if (!t || t.tipo !== 'refresco' || t.clienteId !== p.clienteId) return null;
        const conexion = await conexionViva(tx, db, t.grantId, t.generacion);
        if (t.revocado) {
            // Un refresco ya rotado que vuelve: alguien más lo tiene. Se corta la conexión.
            if (conexion.viva) tx.update(conexion.ref, { revocado: ahora() });
            return null;
        }
        if (t.vence < ahora() || !conexion.viva) return null;
        tx.update(ref, { revocado: true });
        return emitir(tx, db, t as Concesion);
    });
}

/** RFC 7009: revocar un token (de acceso o de refresco). Desconocido: no pasa nada. */
export async function revocarToken(db: Firestore, token: string): Promise<void> {
    const ref = db.collection('mcp_tokens').doc(huella(token));
    const snap = await ref.get();
    if (snap.exists) await ref.update({ revocado: true });
}

/** El acceso de un token de portador, o null (vencido, revocado, de refresco o de una conexión revocada). */
export async function validarAcceso(db: Firestore, token: string): Promise<Acceso | null> {
    if (!token || token.length > 200) return null;
    const t = (await db.collection('mcp_tokens').doc(huella(token)).get()).data();
    if (!t || t.tipo !== 'acceso' || t.revocado || t.vence < ahora()) return null;
    const g = (await db.collection('mcp_grants').doc(t.grantId).get()).data();
    if (!g || g.revocado || g.generacion !== t.generacion) return null;
    return { uid: t.uid, clienteId: t.clienteId, alcances: t.alcances, grantId: t.grantId };
}

/** Las conexiones del usuario, para verlas y revocarlas en la web. */
export async function conexiones(db: Firestore, uid: string): Promise<Array<{ id: string; cliente: string; destino: string | null; alcances: string[]; creado: number }>> {
    const snap = await db.collection('mcp_grants').where('uid', '==', uid).get();
    return snap.docs
        .map(d => ({ id: d.id, ...(d.data() as { cliente: string; destino?: string; alcances: string[]; creado: number; revocado: number | null }) }))
        .filter(g => !g.revocado)
        .map(({ id, cliente: c, destino, alcances, creado }) => ({ id, cliente: c, destino: destino ?? null, alcances, creado }));
}

/** Revocar una conexión propia: corta todos sus tokens de inmediato. */
export async function revocarConexion(db: Firestore, uid: string, grantId: string): Promise<boolean> {
    const ref = db.collection('mcp_grants').doc(grantId);
    const g = (await ref.get()).data();
    if (!g || g.uid !== uid) return false;
    await ref.update({ revocado: ahora() });
    return true;
}
