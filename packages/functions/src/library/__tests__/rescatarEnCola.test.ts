import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { convieneParir, salidaCortada } from '../partirTanda';

/**
 * Una pasada única que se corta por falta de salida sigue en cola, no cae a la
 * capa de texto.
 *
 * Caso real, 2026-09-29, detectado por la primera ficha de extracción: una
 * gramática hebrea de 78 páginas —bajo el umbral de 80, por eso fue en una
 * pasada— devolvió `finishReason=MAX_TOKENS` a los 4 min 38 s, costó $0,17 y
 * cayó a la capa de texto, que traía las vocales despegadas de sus letras.
 */
describe('salidaCortada', () => {
    it('reconoce el error que lanza la pasada única', () => {
        expect(salidaCortada(new Error('Gemini stopped early (finishReason=MAX_TOKENS); response truncated'))).toBe(true);
    });

    it('no confunde otros fallos con un corte', () => {
        expect(salidaCortada(new Error('Failed to parse Gemini response as JSON'))).toBe(false);
        expect(salidaCortada(new Error('503 Service Unavailable'))).toBe(false);
    });

    it('es la MISMA regla con la que las tandas deciden partirse', () => {
        const corte = new Error('finishReason=MAX_TOKENS');
        expect(convieneParir(corte, 40)).toBe(salidaCortada(corte));
    });
});

describe('cada caída de la visión intenta la cola antes que la capa de texto', () => {
    const fuente = fs.readFileSync(path.join(__dirname, '..', 'extractPdfWithGemini.ts'), 'utf8');
    const lineas = fuente.split('\n');

    it('todo `catch (geminiError)` del disparador pasa por rescatarEnCola', () => {
        const catches = lineas.map((l, i) => ({ l, i })).filter(({ l }) => /catch \(geminiError\)/.test(l));
        expect(catches.length).toBeGreaterThanOrEqual(2);
        for (const { i } of catches) {
            const bloque = lineas.slice(i, i + 4).join('\n');
            expect(bloque, `el catch de la línea ${i + 1} cae a la capa de texto sin intentar la cola`).toMatch(/rescatarEnCola\(geminiError\)/);
        }
    });

    it('el reproceso por imágenes aplica la misma regla', () => {
        const reproceso = fs.readFileSync(path.join(__dirname, '..', 'processWithGemini.ts'), 'utf8');
        expect(reproceso).toMatch(/salidaCortada\(err\)/);
    });
});
