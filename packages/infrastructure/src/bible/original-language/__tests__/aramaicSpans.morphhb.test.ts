import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { findBooksByAlias, isAramaicOshbCode, passageHasAramaic, type PassageReference } from '@dosfilos/domain';

/**
 * `ARAMAIC_SPANS` contra el dato: los versículos con algún código arameo en
 * morphhb tienen que ser EXACTAMENTE los de los tramos, en los dos sentidos.
 *
 * El paquete npm de morphhb trae `[palabra, lema, código]` por palabra, con
 * la `H` del hebreo quitada y la `A` del arameo conservada: por eso la
 * detección exige la mayúscula detrás (`Aampa` es un adjetivo hebreo).
 * Vive aquí y no en domain porque el paquete pesa 9,5 MB.
 */
type Palabra = [string, string?, string?];
const morphhb = createRequire(import.meta.url)('morphhb') as Record<string, Palabra[][][]>;

function versiculos(): Array<{ ref: PassageReference; arameo: boolean; etiqueta: string }> {
    const out: Array<{ ref: PassageReference; arameo: boolean; etiqueta: string }> = [];
    for (const [nombre, capitulos] of Object.entries(morphhb)) {
        const libros = findBooksByAlias(nombre);
        if (libros.length !== 1) throw new Error(`libro de morphhb sin id único: ${nombre}`);
        const bookId = libros[0]!.id;
        capitulos.forEach((vs, ci) => vs.forEach((palabras, vi) => {
            const c = ci + 1;
            const v = vi + 1;
            out.push({
                ref: { bookId, chapterStart: c, chapterEnd: c, verseStart: v, verseEnd: v },
                arameo: palabras.some(p => isAramaicOshbCode(p[2] ?? '')),
                etiqueta: `${bookId} ${c}:${v}`,
            });
        }));
    }
    return out;
}

describe('ARAMAIC_SPANS contra morphhb', () => {
    const todos = versiculos();

    it('cubre todo el AT de morphhb', () => {
        expect(todos.length).toBeGreaterThan(23000);
    });

    it('todo versículo con arameo está en un tramo, y todo versículo de un tramo tiene arameo', () => {
        const sobran = todos.filter(x => !x.arameo && passageHasAramaic(x.ref)).map(x => x.etiqueta);
        const faltan = todos.filter(x => x.arameo && !passageHasAramaic(x.ref)).map(x => x.etiqueta);
        expect({ sobran, faltan }).toEqual({ sobran: [], faltan: [] });
    });

    it('los conteos medidos: Esdras 67 y Daniel 200 versículos', () => {
        const cuenta = (id: string) => todos.filter(x => x.ref.bookId === id && x.arameo).length;
        expect(cuenta('EZR')).toBe(67);
        expect(cuenta('DAN')).toBe(200);
        expect(cuenta('GEN')).toBe(1);
        expect(cuenta('JER')).toBe(1);
    });
});
