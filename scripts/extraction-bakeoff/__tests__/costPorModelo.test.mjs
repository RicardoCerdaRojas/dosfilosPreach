import { describe, it, expect } from 'vitest';
import { computeCost } from '../lib/cost.mjs';

/**
 * Cada motor de la comparación se tarifa con el precio de SU modelo. Si un
 * motor cayera a la tarifa genérica de Gemini, la tabla compararía precios
 * inventados con la misma seguridad que los reales.
 */
const rates = {
    gemini: { usdPorMillonTokensEntrada: 1.5, usdPorMillonTokensSalida: 7.5 },
    modelos: {
        'gpt-6-luna': { entrada: 0.1, salida: 0.5 },
        'gemini-3.8-flash': { entrada: null, salida: null },
    },
};

describe('computeCost por modelo', () => {
    it('usa la tarifa del modelo que corrió, con el razonamiento como salida', () => {
        const r = computeCost({
            id: 'gpt-6-luna', model: 'gpt-6-luna',
            billing: { inputTokens: 1_000_000, outputTokens: 800_000, totalTokens: 2_000_000 },
        }, rates);
        // 1M × 0,10 + (2M − 1M) × 0,50 = 0,60: los 200K de razonamiento se cobran.
        expect(r.usd).toBeCloseTo(0.6);
    });

    it('sin tarifa no inventa dinero', () => {
        const r = computeCost({
            id: 'gemini-3.8-flash', model: 'gemini-3.8-flash',
            billing: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        }, rates);
        expect(r.usd).toBeNull();
        expect(r.caveat).toContain('gemini-3.8-flash');
    });

    it('el motor histórico `gemini` conserva su tarifa propia', () => {
        const r = computeCost({
            id: 'gemini',
            billing: { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 },
        }, rates);
        expect(r.usd).toBeCloseTo(9);
    });
});
