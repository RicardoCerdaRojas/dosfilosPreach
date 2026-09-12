import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * INVARIANTE ESTRUCTURAL: toda llamada a visión desde el disparador de subida
 * tiene que intentar encolar antes.
 *
 * EL DEFECTO QUE LO MOTIVA, del 12-09-2026. El disparador llama a
 * `extractWithGemini` en DOS sitios —la degradación tras fallar LlamaParse, y
 * el camino directo cuando no hay LlamaParse o el usuario eligió estándar— y el
 * encolado se agregó a uno solo. El comentario de Sasson entró por el otro,
 * extrajo en línea y murió a los 540 s exactamente como antes del cambio:
 *
 *     ⚠️ All 2 LlamaParse account(s) failed; falling back to Gemini
 *     🪓 392 páginas; primera tanda de 24        ← en línea, sin encolar
 *     ⏱️ Tiempo agotado
 *
 * Es la pregunta §1 de `docs/REVISION_ADVERSARIAL.md` aplicada a sitios de
 * llamada en vez de a constantes: **¿esto tiene una hermana?**
 *
 * POR QUÉ SE PRUEBA LEYENDO EL FUENTE. El guardián vive dentro del cuerpo de un
 * disparador de Storage, que no se puede invocar sin un evento de la
 * plataforma. Lo que sí se puede comprobar sin nube es la forma del código, y
 * la forma es justamente lo que falló: no un cálculo equivocado, sino una
 * llamada que quedó sin su guardia. Un chequeo así es feo y es el único que
 * ataca este defecto.
 */
const FUENTE = path.join(__dirname, '..', 'extractPdfWithGemini.ts');

describe('el disparador de subida encola por TODOS sus caminos a visión', () => {
    const lineas = fs.readFileSync(FUENTE, 'utf8').split('\n');

    /** Índices (0-based) de las líneas que llaman a la extracción por visión. */
    const sitiosDeLlamada = lineas
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => /\bextractWithGemini\s*\(/.test(l) && !l.trim().startsWith('import'))
        .map(({ i }) => i);

    it('hay al menos dos sitios de llamada — si queda uno solo, esta prueba se volvió trivial', () => {
        // Si alguien unifica los caminos y queda una sola llamada, mejor; pero
        // la prueba tiene que DECIRLO en vez de pasar en verde sin comprobar
        // nada. Una prueba que se vuelve vacía en silencio es peor que ninguna.
        expect(sitiosDeLlamada.length).toBeGreaterThanOrEqual(2);
    });

    it('cada sitio de llamada tiene su intento de encolar antes', () => {
        /** Cuántas líneas atrás se admite el guardia. Suficiente para el `try` y sus comentarios. */
        const VENTANA = 40;

        for (const sitio of sitiosDeLlamada) {
            const antes = lineas.slice(Math.max(0, sitio - VENTANA), sitio).join('\n');
            expect(
                /intentarEncolar\s*\(\s*\)/.test(antes),
                `La llamada a extractWithGemini de la línea ${sitio + 1} no intenta encolar antes. ` +
                `Un libro largo que entre por ahí se va a extraer en línea y morir contra el tope de 540 s, ` +
                `que es exactamente lo que le pasó a Sasson el 12-09-2026.`,
            ).toBe(true);
        }
    });

    it('el guardia desarma el plazo antes de salir', () => {
        // Salir sin desarmarlo dejaría al guardia marcando `failed` un trabajo
        // que está avanzando bien en la cola. Un estado falso es peor que no
        // tener guardia.
        const fuente = lineas.join('\n');
        const cuerpo = fuente.slice(
            fuente.indexOf('const intentarEncolar'),
            fuente.indexOf('const intentarEncolar') + 1600,
        );
        expect(cuerpo).toContain('deadlineGuard?.disarm()');
    });
});
