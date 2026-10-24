import { describe, it, expect, vi } from 'vitest';
import { ThinkingLevel } from '@google/genai';
import { configDeRazonamiento, conRespaldoSinRazonamiento } from '../razonamiento';

/** Bajar el razonamiento en las tareas de copiar datos (lector de bibliografía, 2026-10-24). */
describe('nivel de razonamiento', () => {
    it('solo niveles conocidos y solo para gemini-3', () => {
        expect(configDeRazonamiento('minimal', 'gemini-3.8-flash')).toEqual({ thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } });
        expect(configDeRazonamiento('low', 'gemini-3.8-flash')).toEqual({ thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } });
        expect(configDeRazonamiento('minimal', 'gemini-2.5-flash')).toEqual({});
        expect(configDeRazonamiento('cero', 'gemini-3.8-flash')).toEqual({});
        expect(configDeRazonamiento(undefined, 'gemini-3.8-flash')).toEqual({});
    });

    it('si el modelo rechaza el nivel, se repite sin él; otro error se propaga', async () => {
        const llamar = vi.fn()
            .mockRejectedValueOnce(new Error('400 INVALID_ARGUMENT: thinking_level MINIMAL is not supported'))
            .mockResolvedValueOnce('ok');
        await expect(conRespaldoSinRazonamiento({ temperature: 0.1, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }, llamar, 'x')).resolves.toBe('ok');
        expect(llamar).toHaveBeenNthCalledWith(2, { temperature: 0.1 });
        const otro = vi.fn().mockRejectedValue(new Error('503 overloaded'));
        await expect(conRespaldoSinRazonamiento({ thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }, otro, 'x')).rejects.toThrow('503');
        expect(otro).toHaveBeenCalledTimes(1);
        const sinNivel = vi.fn().mockRejectedValue(new Error('thinking failed'));
        await expect(conRespaldoSinRazonamiento({}, sinNivel, 'x')).rejects.toThrow();
        expect(sinNivel).toHaveBeenCalledTimes(1);
    });
});
