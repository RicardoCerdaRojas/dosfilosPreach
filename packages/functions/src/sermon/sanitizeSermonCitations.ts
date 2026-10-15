import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { clientePorRuta } from '../llm/clientePorRuta';
import type { ILlmClient } from '../llm/LlmClient';

/**
 * Fidelidad de citas en la redacción (opción B, parte 2) — SANITIZADO quirúrgico.
 *
 * Recibe párrafos del borrador que contienen citas atribuidas SIN respaldo en las
 * fuentes (detectadas por verifyDraftCitations, determinista) y los reescribe para
 * QUITAR la atribución fabricada, conservando la idea. NO inventa otra cita ni
 * otro autor (fail-closed: si no puede sostener la idea sin la cita, la vuelve
 * afirmación propia del predicador, sin nombre). Tier Sonnet.
 *
 * Se llama en la REDACCIÓN (tras generar, antes de mostrar) — no en runtime del
 * pastor ni por query. El gate de publicación permanece como red final.
 */

function str(v: unknown): string {
    return String(v ?? '').trim();
}

const SYSTEM_PROMPT = `Eres un editor de sermones. Tu tarea: reescribir un párrafo para QUITAR una o más citas atribuidas a autores que NO están respaldadas por las fuentes (probablemente inventadas por el modelo).

Reglas ESTRICTAS:
- Conserva la IDEA y el tono del párrafo.
- Elimina las comillas textuales y la atribución al autor señalado.
- Si la idea se sostiene sin la cita, mantenla como afirmación propia del predicador o como enseñanza general SIN nombre de autor.
- NUNCA inventes otra cita, otro autor, ni un versículo para reemplazarla.
- No agregues contenido nuevo; solo quita lo no respaldado y ajusta la redacción para que fluya.

Devuelves SOLO el párrafo reescrito, sin comentarios ni comillas envolventes.`;

interface SanitizeItem {
    text: string;
    fabricated: Array<{ author: string; quote: string }>;
}

async function rewriteOne(client: ILlmClient, item: SanitizeItem): Promise<string> {
    if (!item.text.trim() || item.fabricated.length === 0) return item.text;
    const list = item.fabricated
        .map((f) => `- ${f.author || '(autor)'}: "${f.quote}"`)
        .join('\n');
    const prompt = `Párrafo:
"""
${item.text}
"""

Citas a QUITAR (no respaldadas por las fuentes):
${list}

Reescribe el párrafo quitando esa(s) atribución(es). Devuelve solo el párrafo reescrito.`;
    const out = await client.generate({ system: SYSTEM_PROMPT, prompt, temperature: 0.2 });
    const cleaned = out.trim();
    // Fail-safe: si el modelo devuelve vacío, deja el texto original (el gate de
    // publicación lo volverá a marcar; nunca peor que el estado actual).
    return cleaned || item.text;
}

export const sanitizeSermonCitations = onCall(
    { ...appCheckCallableOptions(), secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'], timeoutSeconds: 120 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

        const rawItems = Array.isArray(request.data?.items) ? request.data.items : [];
        const items: SanitizeItem[] = rawItems.slice(0, 30).map((it: Record<string, unknown>) => ({
            text: str(it?.text),
            fabricated: Array.isArray(it?.fabricated)
                ? (it.fabricated as Array<Record<string, unknown>>)
                      .map((f) => ({ author: str(f?.author), quote: str(f?.quote) }))
                      .filter((f) => f.quote)
                      .slice(0, 10)
                : [],
        }));
        if (items.length === 0) throw new HttpsError('invalid-argument', 'items is required');

        try {
            const sonnet = await clientePorRuta({
                usage: { feature: 'sanitizeSermonCitations', userId: request.auth?.uid },
                timeoutSeconds: 120,
            });
            const rewritten: string[] = [];
            for (const item of items) {
                rewritten.push(await rewriteOne(sonnet, item));
            }
            return { texts: rewritten };
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            console.error('[sanitizeSermonCitations] failed', err);
            throw new HttpsError('internal', err instanceof Error ? err.message : 'sanitizeSermonCitations failed');
        }
    },
);
