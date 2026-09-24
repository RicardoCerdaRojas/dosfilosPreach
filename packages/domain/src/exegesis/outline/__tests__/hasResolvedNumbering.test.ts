import { describe, it, expect } from 'vitest';
import { hasResolvedNumbering } from '../pageNumbering';

describe('hasResolvedNumbering', () => {
    it('un libro entero declarado sin folio no resuelve ninguna página', () => {
        // Es la numeración real de la «Gramática Griega»: un tramo, hojas
        // 1-711, `offset: null`, y marcada como confirmada. El objeto existe
        // —preguntar por él da «sí»— y no puede producir una sola página.
        expect(hasResolvedNumbering({
            segments: [{ fromSheet: 1, toSheet: 711, offset: null }],
            origin: 'confirmed',
        })).toBe(false);
    });

    it('basta un tramo que resuelva para poder citar páginas', () => {
        // Mayor: 18 hojas sin folio, la introducción en romanos, y el cuerpo
        // en arábigos. El libro se cita por página aunque tenga tramos mudos.
        expect(hasResolvedNumbering({
            segments: [
                { fromSheet: 1, toSheet: 18, offset: null },
                { fromSheet: 19, toSheet: 278, offset: -18, style: 'roman' },
                { fromSheet: 279, toSheet: 540, offset: -278 },
            ],
            origin: 'confirmed',
        })).toBe(true);
    });

    it('sin numeración guardada tampoco resuelve', () => {
        expect(hasResolvedNumbering(null)).toBe(false);
        expect(hasResolvedNumbering(undefined)).toBe(false);
    });

    it('un desfase de cero es un desfase, no una ausencia', () => {
        // Porter: la hoja N imprime N. `offset: 0` es falsy y confundirlo con
        // «no hay numeración» condenaría a hoja a un libro perfectamente
        // citable.
        expect(hasResolvedNumbering({
            segments: [{ fromSheet: 1, toSheet: 339, offset: 0 }],
            origin: 'confirmed',
        })).toBe(true);
    });
});
