import { useEffect, useState } from 'react';

/** Cada cuánto se recalcula «ahora» (plazos de 72 h, «vence hoy», la medianoche). */
export const DESK_CLOCK_MS = 60_000;

/**
 * La hora del escritorio, que avanza sola cada minuto: una página abierta
 * de noche cambia de día y un plazo entra en las 72 h sin recargar.
 */
export function useDeskClock(intervalMs = DESK_CLOCK_MS): Date {
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        const id = window.setInterval(() => setAhora(new Date()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return ahora;
}
