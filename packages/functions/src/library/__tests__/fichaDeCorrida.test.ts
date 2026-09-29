import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MOTIVO_MAX, armarCierre, preflightDe, recortarMotivo } from '../fichaDeCorrida';

/**
 * La ficha guarda NÚMEROS de un libro, nunca su texto: los libros son material
 * con derechos. La regla se prueba mirando la forma de lo que se escribe, que es
 * donde un fragmento se colaría sin que nada falle.
 */

/** Todos los strings del objeto, a cualquier profundidad, con su ruta. */
function strings(obj: unknown, ruta = ''): Array<[string, string]> {
    if (typeof obj === 'string') return [[ruta, obj]];
    if (!obj || typeof obj !== 'object' || obj instanceof Date) return [];
    return Object.entries(obj).flatMap(([k, v]) => strings(v, ruta ? `${ruta}.${k}` : k));
}

const LIBRO = 'Ἰάκωβος θεοῦ καὶ κυρίου Ἰησοῦ Χριστοῦ δοῦλος ταῖς δώδεκα φυλαῖς. '.repeat(200);

describe('armarCierre', () => {
    const inicio = new Date('2026-09-29T10:00:00Z');
    const fin = new Date('2026-09-29T10:03:20Z');

    it('del texto del libro sólo quedan números', () => {
        const patch = armarCierre(
            {
                outcome: 'ready',
                extractionVersion: '4.0-gemini-standard',
                pagesExpected: 10,
                pagesEmitted: 10,
                text: LIBRO,
                engines: [{ engine: 'gemini', outcome: 'ok', ms: 1000 }],
            },
            inicio,
            fin,
        );
        const rutas = strings(patch).map(([r]) => r).sort();
        // Los únicos textos admitidos son rótulos nuestros, no contenido.
        expect(rutas).toEqual(['engines.0.engine', 'engines.0.outcome', 'extractionVersion', 'outcome'].sort());
        expect(patch.reason).toBeNull();
        expect(JSON.stringify(patch)).not.toContain('Ἰάκωβος');
    });

    it('mide la fidelidad sobre el texto completo que recibe', () => {
        const patch = armarCierre({ outcome: 'ready', text: LIBRO }, inicio, fin);
        const fidelidad = patch.fidelity as Record<string, number>;
        expect(fidelidad.totalChars).toBe(LIBRO.length);
        expect(fidelidad.greekDiacriticRatio).toBeGreaterThan(0.2);
    });

    it('la duración sale del arranque guardado', () => {
        expect(armarCierre({ outcome: 'failed' }, inicio, fin).durationMs).toBe(200_000);
        expect(armarCierre({ outcome: 'failed' }, null, fin).durationMs).toBeNull();
    });

    it('un motivo largo se recorta: alcanza para un error y no para un párrafo', () => {
        const patch = armarCierre({ outcome: 'failed', reason: LIBRO }, inicio, fin);
        expect((patch.reason as string).length).toBeLessThanOrEqual(MOTIVO_MAX);
    });

    it('sin datos no escribe campos vacíos que pisen a otros', () => {
        const patch = armarCierre({ outcome: 'stalled' }, inicio, fin);
        expect(Object.keys(patch).sort()).toEqual(['durationMs', 'finishedAt', 'outcome', 'reason']);
    });

    it('un éxito después del guardia de plazo no arrastra su motivo', () => {
        // Lo que escribe el guardia, y encima lo que escribe el éxito posterior:
        // así queda la ficha, porque ambos son `set(merge)` sobre el mismo doc.
        const guardia = armarCierre({ outcome: 'failed', reason: 'timeout' }, inicio, fin);
        const exito = armarCierre({ outcome: 'ready', text: LIBRO }, inicio, fin);
        const final = { ...guardia, ...exito };
        expect(final.outcome).toBe('ready');
        expect(final.reason).toBeNull();
    });
});

describe('recortarMotivo', () => {
    it('acepta un Error o cualquier cosa', () => {
        expect(recortarMotivo(new Error('cuota agotada'))).toBe('cuota agotada');
        expect(recortarMotivo(undefined)).toBe('');
    });
});

describe('preflightDe', () => {
    it('copia el veredicto y los números, y deja afuera las razones en texto', () => {
        const limpio = preflightDe({
            verdict: 'escritura-sin-diacriticos',
            pages: 320,
            greekLetters: 1200,
            diacriticRatio: 0.01,
            reasons: ['páginas 150-159: 1200 letras griegas…'],
            muestra: 'Ιακωβος θεου',
        });
        expect(limpio).toEqual({
            verdict: 'escritura-sin-diacriticos',
            pages: 320,
            greekLetters: 1200,
            diacriticRatio: 0.01,
        });
    });

    it('sin veredicto no hay informe', () => {
        expect(preflightDe(undefined)).toBeUndefined();
        expect(preflightDe({ pages: 3 })).toBeUndefined();
    });
});

/**
 * INVARIANTE ESTRUCTURAL: todo camino que deja un recurso en `ready` o `failed`
 * cierra su ficha.
 *
 * Es la pregunta «¿esto tiene una hermana?» de `docs/REVISION_ADVERSARIAL.md`:
 * hay seis sitios que terminan una extracción, y un sitio que no cierre deja
 * fichas «en curso» para siempre — que en el panel se leen como libros que
 * nunca terminan, y sacan de la cuenta justo los fallos que se quería contar.
 */
describe('cada camino que termina una extracción cierra su ficha', () => {
    const ARCHIVOS = [
        'extractPdfWithGemini.ts',
        'extractRangeTask.ts',
        'processWithGemini.ts',
        'reprocessWithLlamaParse.ts',
        'sweepStalledExtractions.ts',
        'cancelExtraction.ts',
    ];

    for (const archivo of ARCHIVOS) {
        it(archivo, () => {
            const fuente = fs.readFileSync(path.join(__dirname, '..', archivo), 'utf8');
            const terminaciones = (fuente.match(/textExtractionStatus:\s*'(ready|failed)'|resourceRef\.delete\(\)/g) ?? []).length;
            const cierres = (fuente.match(/\bcerrarFicha(sAbiertas)?\s*\(/g) ?? []).length;
            expect(terminaciones, `${archivo} no termina ninguna extracción: sacarlo de la lista`).toBeGreaterThan(0);
            expect(
                cierres,
                `${archivo} deja un recurso en ready/failed ${terminaciones} vez/veces y cierra la ficha ${cierres}`,
            ).toBeGreaterThanOrEqual(terminaciones);
        });
    }
});
