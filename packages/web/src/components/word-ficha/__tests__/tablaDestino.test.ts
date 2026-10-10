import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** La tabla de destino (`docs/FICHA_DE_PALABRA.md`) tiene que estar al día con los registros de bloques. */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { BLOQUES_HEBREO } = await import('@/pages/hebrew-tutor/ficha/bloquesHebreo');
const { BLOQUES_GRIEGO } = await import('@/pages/greek-analyzer/ficha/bloquesGriego');
const { filasDestino } = await import('../fichaRegistro');
const { tablaMarkdown } = await import('../tablaDestino');

// Relativo a ESTE archivo: CI corre las pruebas desde la raíz del repo (`--root packages/web`), en local desde el paquete.
const DOC = resolve(__dirname, '../../../../../../docs/FICHA_DE_PALABRA.md');

describe('tabla de destino de la ficha de palabra', () => {
    const generada = tablaMarkdown([...filasDestino('he', BLOQUES_HEBREO), ...filasDestino('gr', BLOQUES_GRIEGO)]);
    it('el documento coincide con los registros (regenerar con ACTUALIZAR_TABLA=1)', () => {
        if (process.env.ACTUALIZAR_TABLA) writeFileSync(DOC, generada);
        expect(readFileSync(DOC, 'utf8')).toBe(generada);
    });
    it('cada bloque dice dónde estaba antes, salvo los nuevos del rediseño', () => {
        for (const f of [...filasDestino('he', BLOQUES_HEBREO), ...filasDestino('gr', BLOQUES_GRIEGO)]) expect(f.antes.length, f.id).toBeGreaterThan(0);
    });
});
