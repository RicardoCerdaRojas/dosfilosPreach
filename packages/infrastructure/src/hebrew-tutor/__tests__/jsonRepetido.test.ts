import { describe, it, expect, vi } from 'vitest';

/**
 * Banco de la waw disyuntiva (revisión del profesor, 2026-11): gpt-6-luna a veces
 * repite el JSON entero detrás del primero hasta agotar los tokens. Del primer
 * «{» al último «}» eso no parsea y el análisis se perdía.
 */
const respuesta = vi.hoisted(() => ({ texto: '' }));
vi.mock('../../llm/callableLlm', () => ({ runLlmPrompt: vi.fn(async () => respuesta.texto) }));
const { HebrewAnalysisService, primerObjetoCompleto } = await import('../gemini-hebrew-service');

const verse = { reference: 'Ruth.2.10', displayReference: 'Rut 2:10', hebrewText: 'x', words: [] };

describe('respuesta con el JSON repetido', () => {
    it('se lee el primer objeto completo y se ignora la repetición', async () => {
        const uno = JSON.stringify({ words: [], verbTable: [], fluidTranslation: 'siendo yo {extranjera}' });
        respuesta.texto = `${uno} \nbayes${uno}`; // como la respuesta real de Rut 2:10: el objeto entero, dos veces
        const a = await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', []);
        expect(a.fluidTranslation).toBe('siendo yo {extranjera}');
    });
    it('las llaves dentro de una cadena no cuentan; sin objeto cerrado, null', () => {
        expect(primerObjetoCompleto('xx {"a":"}{","b":{"c":1}} {"d":2}')).toBe('{"a":"}{","b":{"c":1}}');
        // Una comilla escapada dentro de la cadena no la cierra: «x"}y» es todo el valor.
        expect(primerObjetoCompleto('{"a":"x\\"}y"} resto')).toBe('{"a":"x\\"}y"}');
        expect(primerObjetoCompleto('{"a":[1,2')).toBeNull();
    });
});
