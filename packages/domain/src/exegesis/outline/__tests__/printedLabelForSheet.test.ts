import { describe, it, expect } from 'vitest';
import { printedLabelForSheet, type PageNumbering } from '../pageNumbering';

/**
 * El selector rotulaba la misma hoja con dos números: la columna, el visor y
 * el carrito con el desfase único; los paneles con la numeración por tramos.
 */
describe('printedLabelForSheet', () => {
    const numeracion = { origin: 'confirmed', segments: [{ fromSheet: 10, toSheet: 500, offset: -4 }] } as unknown as PageNumbering;

    it('manda la numeración confirmada', () => {
        expect(printedLabelForSheet(440, numeracion, -2)).toBe('436');
    });

    it('fuera de sus tramos, o sin numeración, cae al desfase', () => {
        expect(printedLabelForSheet(600, numeracion, -2)).toBe('598');
        expect(printedLabelForSheet(440, null, -2)).toBe('438');
    });

    it('sin nada, no inventa', () => {
        expect(printedLabelForSheet(440, null, null)).toBeNull();
    });

    it('en un tramo sin folio dice hoja, como el ancla de la cita (revisión adversarial de B1)', () => {
        const conLaminas = { origin: 'confirmed', segments: [
            { fromSheet: 10, toSheet: 500, offset: -4 },
            { fromSheet: 501, toSheet: 520, offset: null },
        ] } as unknown as PageNumbering;
        expect(printedLabelForSheet(510, conLaminas, -2)).toBeNull();
        expect(printedLabelForSheet(600, conLaminas, -2)).toBe('598');
    });
});
