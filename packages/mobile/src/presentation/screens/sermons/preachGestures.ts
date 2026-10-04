/**
 * Los toques del atril (A3 de la fase Púlpito premium).
 *
 * Antes, CUALQUIER par de toques en menos de 300 ms apagaba la pantalla. El
 * comentario decía «doble toque con dos dedos», pero el código no miraba los
 * dedos: avanzar dos páginas rápido —lo que hace un predicador que se pasó de
 * largo— dejaba la pantalla en negro frente a la congregación.
 *
 * Ahora:
 * - Un dedo, cualquier cadencia: pasa página (o muestra los controles en el
 *   centro). Dos toques rápidos son dos páginas, como se espera.
 * - Dos dedos dos veces seguidas: pantalla negra. Es un gesto que no se hace
 *   por accidente con el pulgar mientras se predica.
 * - El toque de un dedo que llega durante un gesto de dos dedos NO pasa
 *   página: el primer dedo de un toque con dos también dispara el toque
 *   simple, y sin este filtro el apagado avanzaba una página antes.
 */
export const BLACKOUT_WINDOW_MS = 450;
export const MULTI_TOUCH_GRACE_MS = 400;

export type TapZone = 'back' | 'center' | 'forward';

export function tapZone(x: number, width: number): TapZone {
    if (x < width / 3) return 'back';
    if (x > (width * 2) / 3) return 'forward';
    return 'center';
}

export interface GestureGate {
    /** Al tocar la pantalla. Devuelve true si ese toque completa el apagado. */
    touchStart(touchCount: number, now: number): boolean;
    /** Un toque simple: ¿se atiende o es parte de un gesto de dos dedos? */
    acceptsTap(now: number): boolean;
}

export function createGestureGate(): GestureGate {
    let lastMultiAt = -Infinity;
    let suppressUntil = -Infinity;
    return {
        touchStart(touchCount, now) {
            if (touchCount < 2) return false;
            suppressUntil = now + MULTI_TOUCH_GRACE_MS;
            const completes = now - lastMultiAt <= BLACKOUT_WINDOW_MS;
            // Tras apagar, el próximo par empieza de cero: tres toques no
            // apagan y vuelven a apagar.
            lastMultiAt = completes ? -Infinity : now;
            return completes;
        },
        acceptsTap(now) {
            return now > suppressUntil;
        },
    };
}
