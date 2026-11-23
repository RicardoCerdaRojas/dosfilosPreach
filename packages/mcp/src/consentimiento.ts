import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { conexiones, resolverSolicitud, revocarConexion, verSolicitud } from './oauth/almacen';

/**
 * Lo que hace la página «Conectar con Claude» de la web, ya con la sesión de
 * Firebase del usuario: ver la solicitud, decidir, y ver o revocar sus
 * conexiones. La identidad la pone Firebase Auth; el servidor de autorización
 * solo confía en el `uid` del callable.
 */
export function requiereUsuario(auth: { uid: string; token?: Record<string, unknown> } | undefined): string {
    if (!auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
    return auth.uid;
}

/**
 * Para APROBAR, además, sin «Entrar como usuario»: un administrador que
 * aprobara su propio cliente se quedaría con lectura renovable de los libros
 * del usuario, fuera de la ventana auditada (revisión de A9).
 */
export function requiereUsuarioPropio(auth: { uid: string; token?: Record<string, unknown> } | undefined): string {
    const uid = requiereUsuario(auth);
    if (auth?.token?.impersonatorUid) throw new HttpsError('permission-denied', 'No se puede conectar una aplicación mientras entras como otro usuario.');
    return uid;
}

const id = (v: unknown, campo: string): string => {
    if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{8,120}$/.test(v)) throw new HttpsError('invalid-argument', `«${campo}» inválido.`);
    return v;
};

export async function verSolicitudMcp(db: Firestore, uid: string, data: { solicitud?: unknown }) {
    void uid;
    const s = await verSolicitud(db, id(data.solicitud, 'solicitud'));
    if (!s) throw new HttpsError('not-found', 'La solicitud venció o ya se usó. Vuelve a conectar desde Claude.');
    return s;
}

export async function resolverSolicitudMcp(db: Firestore, uid: string, data: { solicitud?: unknown; aprobar?: unknown }) {
    const destino = await resolverSolicitud(db, uid, id(data.solicitud, 'solicitud'), data.aprobar === true);
    if (!destino) throw new HttpsError('not-found', 'La solicitud venció o ya se usó. Vuelve a conectar desde Claude.');
    return { destino };
}

export async function conexionesMcp(db: Firestore, uid: string) {
    return { conexiones: await conexiones(db, uid) };
}

export async function revocarConexionMcp(db: Firestore, uid: string, data: { conexion?: unknown }) {
    const ok = await revocarConexion(db, uid, id(data.conexion, 'conexion'));
    if (!ok) throw new HttpsError('not-found', 'No encontré esa conexión.');
    return { ok: true };
}
