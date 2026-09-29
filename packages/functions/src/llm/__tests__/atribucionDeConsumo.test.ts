import { describe, expect, it } from 'vitest';
import { atribucionActual, conAtribucion } from '../atribucionDeConsumo';
import { buildAttributionPatch } from '../llmUsageRecorder';

/**
 * El costo de un libro se reparte en llamadas que viven varias funciones más
 * abajo de quien sabe qué corrida es. Lo que tiene que valer es que el ámbito
 * cruce los `await` —si se pierde en el primero, la ficha dice «$0» de un libro
 * que costó diez dólares, y ese número parece verdadero—.
 */
describe('conAtribucion', () => {
    it('el ámbito llega a quien registra, a través de varios await', async () => {
        const profundo = async (): Promise<string | undefined> => {
            await new Promise((r) => setTimeout(r, 1));
            await Promise.resolve();
            return atribucionActual()?.ruta;
        };
        const ruta = await conAtribucion('extraction_runs/abc', async () => {
            await new Promise((r) => setTimeout(r, 1));
            return profundo();
        });
        expect(ruta).toBe('extraction_runs/abc');
    });

    it('fuera del ámbito no hay atribución', async () => {
        await conAtribucion('extraction_runs/abc', async () => undefined);
        expect(atribucionActual()).toBeUndefined();
    });

    it('dos corridas a la vez no se mezclan', async () => {
        const leer = (ruta: string, espera: number) =>
            conAtribucion(ruta, async () => {
                await new Promise((r) => setTimeout(r, espera));
                return atribucionActual()?.ruta;
            });
        const [a, b] = await Promise.all([leer('extraction_runs/a', 5), leer('extraction_runs/b', 1)]);
        expect(a).toBe('extraction_runs/a');
        expect(b).toBe('extraction_runs/b');
    });
});

describe('buildAttributionPatch', () => {
    it('va anidado bajo `llm`, sin claves con puntos que `set(merge)` escribiría literales', () => {
        const patch = buildAttributionPatch({
            feature: 'library.pdfExtraction',
            model: 'gemini-2.5-flash',
            inputTokens: 1000,
            outputTokens: 200,
            thinkingTokens: 50,
        });
        expect(Object.keys(patch)).toEqual(['llm']);
        expect(Object.keys(patch.llm as object).sort()).toEqual(
            ['calls', 'inputTokens', 'outputTokens', 'thinkingTokens', 'usd'].sort(),
        );
    });
});
