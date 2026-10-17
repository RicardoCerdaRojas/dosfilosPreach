import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { appCheckCallableOptions } from '../config/appCheckOptions';

/**
 * Los libros de una biblioteca con lo que hace falta para decidir un
 * reproceso en lote (fase «el reproceso en lote desde el panel de super
 * admin», PR 1: ver, auditar y estimar). Sólo lectura y sólo super admin.
 *
 * Callable FINO, como `getExtractionRuns`: devuelve los campos de medición
 * de cada recurso, SIN su texto (`select`), y el diagnóstico y el costo los
 * calcula el cliente en funciones puras con pruebas. Leer `library_resources`
 * desde el navegador traería `textContent` entero de cada libro.
 */

export interface CandidatoCrudo {
    id: string;
    titulo: string;
    autor: string;
    mimeType: string | null;
    sizeBytes: number | null;
    pdfPageCount: number | null;
    pageCount: number | null;
    paginasFaltantes: { total: number; paginas: number[] } | null;
    textoEstructuradoVacio: boolean;
    extractionVersion: string | null;
    extractionModel: string | null;
    textExtractionStatus: string | null;
    reprocesadoEnLote: { lote: string; fecha: string | null; motivo: string | null } | null;
}

const CAMPOS = [
    'title', 'author', 'mimeType', 'sizeBytes', 'pdfPageCount', 'pageCount', 'paginasFaltantes',
    'textoEstructuradoVacio', 'extractionVersion', 'extractionModel', 'textExtractionStatus', 'reprocesadoEnLote',
] as const;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const fecha = (v: unknown) => {
    const d = (v as { toDate?: () => Date } | null)?.toDate?.() ?? (v instanceof Date ? v : null);
    return d ? d.toISOString() : null;
};

/** Un recurso de Firestore → la fila del panel (sólo metadatos, nunca texto). */
export function aCandidato(id: string, d: FirebaseFirestore.DocumentData): CandidatoCrudo {
    const faltan = d.paginasFaltantes as { total?: unknown; paginas?: unknown } | undefined;
    const lote = d.reprocesadoEnLote as { lote?: unknown; fecha?: unknown; motivo?: unknown } | undefined;
    return {
        id,
        titulo: String(d.title ?? ''),
        autor: String(d.author ?? ''),
        mimeType: str(d.mimeType),
        sizeBytes: num(d.sizeBytes),
        pdfPageCount: num(d.pdfPageCount),
        pageCount: num(d.pageCount),
        paginasFaltantes: faltan && num(faltan.total) !== null
            ? { total: num(faltan.total)!, paginas: Array.isArray(faltan.paginas) ? faltan.paginas.filter((p): p is number => typeof p === 'number').slice(0, 50) : [] }
            : null,
        textoEstructuradoVacio: d.textoEstructuradoVacio === true,
        extractionVersion: str(d.extractionVersion),
        extractionModel: str(d.extractionModel),
        textExtractionStatus: str(d.textExtractionStatus),
        reprocesadoEnLote: lote && str(lote.lote) ? { lote: str(lote.lote)!, fecha: fecha(lote.fecha), motivo: str(lote.motivo) } : null,
    };
}

export const getBatchCandidates = onCall({ ...appCheckCallableOptions() }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');
    const db = admin.firestore();
    const llamador = await db.collection('users').doc(request.auth.uid).get();
    if (!llamador.exists || llamador.data()?.role !== 'super_admin') throw new HttpsError('permission-denied', 'Super admin only');

    const pedido = (request.data as { ownerUid?: unknown } | undefined)?.ownerUid;
    const dueno = typeof pedido === 'string' && pedido.trim() ? pedido.trim() : request.auth.uid;

    const [recursos, usuarios] = await Promise.all([
        db.collection('library_resources').where('userId', '==', dueno).select(...CAMPOS).get(),
        // Para elegir la biblioteca: quiénes hay (pocos usuarios: se listan todos, sólo el correo).
        db.collection('users').select('email').get(),
    ]);
    return {
        dueno,
        candidatos: recursos.docs.map(d => aCandidato(d.id, d.data())),
        duenos: usuarios.docs
            .map(u => ({ uid: u.id, email: String(u.data().email ?? u.id) }))
            .sort((x, y) => x.email.localeCompare(y.email)),
    };
});
