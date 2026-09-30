import type { GenerateContentResponse } from '@google/genai';

/**
 * El texto de una respuesta de Gemini, o un error que diga por qué no lo hay.
 *
 * El SDK viejo (`@google/generative-ai`) LANZABA desde `response.text()` cuando
 * el pedido quedaba bloqueado o no había candidato; el nuevo (`@google/genai`)
 * devuelve `undefined` en `response.text` y sigue de largo. Sin esto, la
 * migración convertía un bloqueo —que hoy llega al usuario como un error— en
 * una respuesta vacía que los adaptadores parsean como si fuera buena.
 */
export function textoDeGemini(res: GenerateContentResponse): string {
    const texto = res.text;
    if (texto !== undefined) return texto;
    const bloqueo = res.promptFeedback?.blockReason;
    if (bloqueo) throw new Error(`Gemini bloqueó el pedido (${bloqueo})`);
    const fin = res.candidates?.[0]?.finishReason;
    throw new Error(`Gemini no devolvió texto (finishReason=${fin ?? 'desconocido'})`);
}
