import { describe, it, expect, vi, beforeEach } from 'vitest';

const setGlobalDispatcher = vi.fn();
vi.mock('undici', () => ({
    setGlobalDispatcher: (...args: unknown[]) => setGlobalDispatcher(...args),
    Agent: class {
        constructor(public readonly opciones: Record<string, unknown>) { }
    },
}));

/**
 * El `fetch` de Node aborta a los 300 s. Una lectura densa tarda más, y el
 * error que produce no dice nada útil:
 *
 *     04:06:34  📦 páginas 66-94 de 425
 *     04:11:35  ERROR  TypeError: fetch failed
 *
 * 301 segundos exactos. Un comentario de 425 páginas murió así tras llegar al
 * 16%, y Cloud Tasks reintentó tres veces contra el mismo muro.
 */
describe('permitirEsperasLargas', () => {
    beforeEach(() => {
        setGlobalDispatcher.mockClear();
        vi.resetModules();
    });

    it('sube el tope muy por encima de los 300 s que corta Node', async () => {
        const { permitirEsperasLargas, ESPERA_MAXIMA_MS } = await import('../esperaLargaHttp');
        permitirEsperasLargas();

        expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
        const agente = setGlobalDispatcher.mock.calls[0]![0] as { opciones: Record<string, number> };
        expect(agente.opciones.headersTimeout).toBe(ESPERA_MAXIMA_MS);
        expect(agente.opciones.bodyTimeout).toBe(ESPERA_MAXIMA_MS);
        // El rango más lento medido tardó 352 s: el tope tiene que cubrirlo con
        // margen, y 300 no lo cubría.
        expect(ESPERA_MAXIMA_MS).toBeGreaterThan(352_000);
    });

    it('sigue habiendo un final: no se quita el tope', async () => {
        // Sin tope, una conexión colgada retendría la invocación hasta el techo
        // de la función sin producir nada.
        const { ESPERA_MAXIMA_MS } = await import('../esperaLargaHttp');
        expect(Number.isFinite(ESPERA_MAXIMA_MS)).toBe(true);
        expect(ESPERA_MAXIMA_MS).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it('es idempotente: no reemplaza el despachador en cada invocación', async () => {
        // Reemplazarlo tiraría las conexiones que la instancia tenga abiertas.
        const { permitirEsperasLargas } = await import('../esperaLargaHttp');
        permitirEsperasLargas();
        permitirEsperasLargas();
        permitirEsperasLargas();
        expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
    });
});
