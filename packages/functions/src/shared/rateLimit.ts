import { FieldValue } from 'firebase-admin/firestore';

/**
 * Rate-limit de ventana deslizante, compartido.
 *
 * Nació enterrado dentro de `captureLead` (única superficie que lo tenía) y se
 * extrae acá porque el proxy de LLM lo necesita: una llamada al modelo cuesta
 * dinero, así que un usuario autenticado sin tope es una fuga esperando ocurrir.
 *
 * FAIL-OPEN por diseño: si la lectura falla, se PERMITE. Un problema de
 * Firestore no puede dejar sin servicio a un pastor; el techo duro del gasto es
 * el presupuesto de la nube, no este contador.
 */

export interface RateLimitOptions {
    /** Prefijo del bucket — separa dominios (`llm_proxy`, `lead_magnet`…). */
    bucket: string;
    /** Identidad a limitar: uid, IP, lo que corresponda al dominio. */
    key: string;
    windowMs: number;
    max: number;
}

/** Saneo para id de documento: Firestore prohíbe `/` y compañía. */
export function rateLimitDocId(bucket: string, key: string): string {
    const safe = (key ?? '').replace(/[^a-zA-Z0-9.:_-]/g, '_').slice(0, 80);
    return `${bucket}__${safe}`;
}

/**
 * Decisión pura: ¿la ventana ya está llena? Separada del IO para poder probar
 * la política sin Firestore.
 */
export function windowIsFull(recentMs: number[], nowMs: number, windowMs: number, max: number): boolean {
    const start = nowMs - windowMs;
    return recentMs.filter((ms) => typeof ms === 'number' && ms >= start).length >= max;
}

/** Devuelve `true` si la llamada se permite (y la registra); `false` si topó. */
export async function consumeRateLimitToken(
    db: FirebaseFirestore.Firestore,
    opts: RateLimitOptions,
): Promise<boolean> {
    const { bucket, key, windowMs, max } = opts;
    if (!key) return true;
    try {
        const ref = db.collection('rate_limits').doc(rateLimitDocId(bucket, key));
        // En una transacción: leer y escribir por separado dejaba pasar N
        // pedidos simultáneos con el mismo contador (revisión de A9: un lote
        // de 20 búsquedas del MCP pasaba entero).
        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const now = Date.now();
            const recentRaw = ((snap.exists ? snap.data() : null)?.recentMs as number[] | undefined) ?? [];
            const recent = recentRaw.filter((ms) => typeof ms === 'number' && ms >= now - windowMs);

            if (recent.length >= max) return false;

            recent.push(now);
            tx.set(ref, { recentMs: recent, lastSeenAt: FieldValue.serverTimestamp(), key }, { merge: true });
            return true;
        });
    } catch (err) {
        console.warn(`[rateLimit] no se pudo evaluar ${bucket}; se permite (fail-open)`, err);
        return true;
    }
}
