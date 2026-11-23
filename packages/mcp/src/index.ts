import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { appCheckCallableOptions } from '../../functions/src/config/appCheckOptions';
import { manejar } from './servidor';
import { conexionesMcp, requiereUsuario, requiereUsuarioPropio, resolverSolicitudMcp, revocarConexionMcp, verSolicitudMcp } from './consentimiento';

if (getApps().length === 0) initializeApp();

/**
 * Dónde vive la página de consentimiento y cuál es el origen público del
 * servidor (issuer y audiencia). En producción, la app (Hosting reescribe a
 * esta función). Para probar antes del merge se pisan con `.env.dosfilosapp`,
 * que no se sube al repositorio. Variables de entorno y no `defineString`:
 * un parámetro sin valor detiene el despliegue no interactivo de CI.
 */
const APP = 'https://app.preach.dosfilos.com';
const origenDeConsentimiento = () => process.env.MCP_CONSENT_ORIGIN || APP;
const origenPublico = () => process.env.MCP_PUBLIC_ORIGIN || APP;

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
                origenDeConsentimiento: origenDeConsentimiento(),
                origenPublico: origenPublico(),
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
