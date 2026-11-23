import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Resultado } from './herramientas/tipos';

/**
 * Cada llamada del MCP queda en `corpus_audit_log` (diseño §2.6; distinta de
 * `admin_audit_log`, que es de impersonación): quién, con qué cliente, qué
 * herramienta, con qué argumentos (recortados) y qué libros y hojas leyó. Si
 * escribir falla, la llamada no se cae: se avisa en el registro del servidor.
 */
export async function auditar(db: Firestore, entrada: {
    uid: string;
    clienteId: string;
    herramienta: string;
    args: Record<string, unknown>;
    ok: boolean;
    error?: string;
    leido?: Resultado['leido'];
}): Promise<void> {
    try {
        await db.collection('corpus_audit_log').add({
            uid: entrada.uid,
            clienteId: entrada.clienteId,
            herramienta: entrada.herramienta,
            args: JSON.stringify(entrada.args).slice(0, 1000),
            ok: entrada.ok,
            ...(entrada.error ? { error: entrada.error.slice(0, 300) } : {}),
            leido: entrada.leido ?? [],
            at: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.warn('[mcp] no se pudo auditar', entrada.herramienta, err instanceof Error ? err.message : err);
    }
}
