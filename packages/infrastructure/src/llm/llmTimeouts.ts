/**
 * Cuánto espera el navegador a una generación larga del modelo.
 *
 * El SDK de callables corta a los 70 s si no se le dice otra cosa
 * (`options.timeout || 70000`). Ese default alcanza para una respuesta corta y
 * no alcanza para las largas: el compositor académico pide 65.536 tokens de
 * salida, el de sermones 32.768, el análisis morfológico de hebreo otros
 * 32.768. Con el default, el navegador abandona la llamada con el modelo
 * todavía generando — y el usuario ve fallar algo que en el servidor terminó
 * bien y que igual se cobró.
 *
 * 9 minutos es el mismo techo que `timeoutSeconds` del callable: que corte el
 * servidor, no el cliente, para que el error diga qué pasó. Con el tope del
 * cliente, el mensaje es `deadline-exceeded` y no dice nada de por qué.
 *
 * Vive junto a `callableLlm` y no bajo `exegesis/` porque no es una cuestión
 * de composición sino del transporte: la necesita cualquiera que pida una
 * salida grande. Tenerla en un rincón de exégesis es cómo cinco servicios
 * —los dos tutores, el generador de sermones, el asistente expositivo y el
 * analizador griego— terminaron sin ella.
 *
 * REGLA: si pedís `maxOutputTokens` por encima de ~8.000, pasá este tope.
 */
export const LONG_GENERATION_TIMEOUT_MS = 540_000;
