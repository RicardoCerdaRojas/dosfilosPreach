import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { fidelidadDeEscritura } from '../fidelidadDeEscritura';

/**
 * La ficha de producción y el bakeoff tienen que medir lo mismo.
 *
 * `fidelidadDeEscritura` es la copia de `scriptFidelity` del bakeoff: una corre
 * sobre cada libro real, la otra compara motores fuera de línea. Si alguien
 * afina una sola, el panel y el bakeoff empiezan a hablar de números distintos
 * con el mismo nombre, y nadie lo nota porque los dos siguen verdes.
 *
 * Se importa el `.mjs` del bakeoff por ruta de archivo: el script vive fuera del
 * paquete y no se publica, así que no hay otra forma de cruzar el borde.
 */
const METRICAS = join(__dirname, '../../../../../scripts/extraction-bakeoff/lib/metrics.mjs');

const TEXTOS: Array<[string, string]> = [
    ['vacío', ''],
    ['español acentuado, sin escritura original', 'La exégesis de Santiago 1:1-5 según él.'],
    ['griego politónico precompuesto', 'Ἰάκωβος θεοῦ καὶ κυρίου Ἰησοῦ Χριστοῦ δοῦλος'],
    ['griego descompuesto (NFD)', 'Ἰάκωβος θεοῦ'.normalize('NFD')],
    ['griego sin marcas', 'Ιακωβος θεου και κυριου'],
    ['hebreo puntuado con cantilación', 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים'],
    ['hebreo sin niqqud', 'בראשית ברא אלהים'],
    ['marcas huérfanas y U+FFFD', ' ́α ְב ��'],
    ['mezcla', 'Según Wallace, ἐν ἀρχῇ (Jn 1:1) y בְּרֵאשִׁית (Gn 1:1) �'],
];

describe('fidelidadDeEscritura coincide con scriptFidelity del bakeoff', async () => {
    const { scriptFidelity } = (await import(pathToFileURL(METRICAS).href)) as {
        scriptFidelity: (t: string) => Record<string, number>;
    };

    for (const [nombre, texto] of TEXTOS) {
        it(nombre, () => {
            expect(fidelidadDeEscritura(texto)).toEqual(scriptFidelity(texto));
        });
    }
});

describe('fidelidadDeEscritura distingue lo que el censo no ve', () => {
    it('griego con marcas vs. el mismo griego sin ellas', () => {
        const con = fidelidadDeEscritura('Ἰάκωβος θεοῦ καὶ κυρίου');
        const sin = fidelidadDeEscritura('Ιακωβος θεου και κυριου');
        expect(con.greekLetters).toBe(sin.greekLetters);
        expect(con.greekDiacriticRatio).toBeGreaterThan(0.2);
        expect(sin.greekDiacriticRatio).toBe(0);
    });
});
