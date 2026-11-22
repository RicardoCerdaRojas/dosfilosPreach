import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { appCheckCallableOptions } from '../../functions/src/config/appCheckOptions';
import { manejar } from './servidor';
import { conexionesMcp, requiereUsuario, requiereUsuarioPropio, resolverSolicitudMcp, revocarConexionMcp, verSolicitudMcp } from './consentimiento';

if (getApps().length === 0) initializeApp();

/**
 * Dónde vive la página de consentimiento. En producción, la app; para probar
 * antes del merge se puede apuntar a la web local con `.env.dosfilosapp`
 * (no se sube al repositorio).
 */
const ORIGEN_DE_CONSENTIMIENTO = defineString('MCP_CONSENT_ORIGIN', { default: 'https://app.preach.dosfilos.com' });
/** El origen público del servidor (issuer y audiencia); en producción, la app, por la reescritura de Hosting. */
const ORIGEN_PUBLICO = defineString('MCP_PUBLIC_ORIGIN', { default: 'https://app.preach.dosfilos.com' });

const REGION = 'us-central1';

/** OAuth 2.1 + MCP de lectura (fase «Asistente del corpus», A9). */
export const mcpGateway = onRequest(
    {
        region: REGION,
        memory: '1GiB',
        timeoutSeconds: 120,
        // La búsqueda reordena con el asistente (ruta `library.rerank`), con Gemini de respaldo.
        secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'],
        invoker: 'public',
    },
    async (req, res) => {
        try {
            await manejar(req, res, {
                db: getFirestore(),
                origenDeConsentimiento: ORIGEN_DE_CONSENTIMIENTO.value(),
                origenPublico: ORIGEN_PUBLICO.value(),
                geminiKey: process.env.GEMINI_API_KEY ?? null,
            });
        } catch (err) {
            console.error('[mcpGateway] error', err);
            if (!res.headersSent) res.status(500).json({ error: 'server_error' });
        }
    },
);

const opcionesDeCallable = { ...appCheckCallableOptions(), region: REGION };

export const mcpSolicitud = onCall(opcionesDeCallable, req =>
    verSolicitudMcp(getFirestore(), requiereUsuario(req.auth), req.data ?? {}));

export const mcpResolverSolicitud = onCall(opcionesDeCallable, req =>
    resolverSolicitudMcp(getFirestore(), requiereUsuarioPropio(req.auth), req.data ?? {}));

export const mcpConexiones = onCall(opcionesDeCallable, req =>
    conexionesMcp(getFirestore(), requiereUsuario(req.auth)));

export const mcpRevocarConexion = onCall(opcionesDeCallable, req =>
    revocarConexionMcp(getFirestore(), requiereUsuario(req.auth), req.data ?? {}));
