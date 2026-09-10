import { describe, it, expect } from 'vitest';
import {
    parseLlmResponse,
    VERIFIER_MAX_OUTPUT_TOKENS,
} from '../GeminiLlmCitationVerifier';

/**
 * El verificador estuvo en producción sin verificar nada: 29 de 32 citas de un
 * trabajo real volvieron como «revisión manual».
 *
 * La causa no estaba en las citas ni en el prompt. `gemini-2.5-pro` razona
 * antes de responder y esos tokens salen del MISMO `maxOutputTokens`, que
 * estaba en 1.024. El modelo gastaba el cupo pensando y no emitía JSON. Nada en
 * la interfaz decía eso: la fila se veía igual que una cita defectuosa, así que
 * el defecto se leía como un problema del trabajo.
 *
 * Lo que se fija acá es la lección, no el número: que el presupuesto tenga
 * margen sobre lo que ocupa la respuesta, y que cuando aún así se corte, el
 * sistema lo DIGA en vez de dejar al usuario revisando una cita que estaba bien.
 */
describe('verificador de citas — presupuesto de salida', () => {
    it('deja margen para el razonamiento, que se cobra del mismo cupo', () => {
        // El JSON del verificador son cuatro campos: unos cientos de tokens.
        // Todo el resto es para pensar. 1.024 no alcanzaba ni para eso.
        expect(VERIFIER_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(4096);
    });
});

describe('verificador de citas — por qué no pudo opinar', () => {
    it('nombra el corte por tope cuando el servidor lo informa', () => {
        const out = parseLlmResponse('{"status":"veri', 'MAX_TOKENS');
        expect(out.status).toBe('manual-pending');
        expect(out.reasoning).toContain('tope de tokens');
        // La frase tiene que absolver a la cita: el usuario que lee esto está
        // por ir a buscar el libro a la biblioteca sin motivo.
        expect(out.reasoning).toContain('No es un problema de la cita');
    });

    it('no inventa el motivo cuando el corte no fue por tope', () => {
        const out = parseLlmResponse('no soy json', 'STOP');
        expect(out.status).toBe('manual-pending');
        expect(out.reasoning).not.toContain('tope de tokens');
    });

    it('una respuesta vacía también cae acá, no explota', () => {
        expect(parseLlmResponse('', 'MAX_TOKENS').status).toBe('manual-pending');
    });

    it('un veredicto legible pasa entero', () => {
        const out = parseLlmResponse(JSON.stringify({
            status: 'verified',
            confidence: 0.9,
            bestPageHint: 'p. 61',
            reasoning: 'Adamson sostiene que el rico es un hermano.',
        }));
        expect(out.status).toBe('verified');
        expect(out.confidence).toBe(0.9);
        expect(out.bestPageHint).toBe('p. 61');
    });

    it('un status fuera del catálogo no se cuela como veredicto', () => {
        expect(parseLlmResponse('{"status":"probablemente"}').status).toBe('manual-pending');
    });
});
