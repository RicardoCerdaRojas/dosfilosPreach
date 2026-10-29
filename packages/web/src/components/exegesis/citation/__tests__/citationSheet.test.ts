import { describe, expect, it } from 'vitest';
import type { PageNumbering } from '@dosfilos/domain';
import { clampSheet, printedOfSheet, resolveCitationSheet } from '../citationSheet';

// Waltke-O'Connor: un tramo, la p. 440 vive en la hoja 458.
const WO: PageNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 792, offset: -18 }] };
// Ortiz: tres desfases distintos.
const ORTIZ: PageNumbering = { origin: 'confirmed', segments: [
    { fromSheet: 1, toSheet: 158, offset: 0 },
    { fromSheet: 159, toSheet: 417, offset: -1 },
    { fromSheet: 418, toSheet: 807, offset: -2 },
] };

describe('resolveCitationSheet', () => {
    it('una cita en página impresa abre la hoja que la lleva', () => {
        expect(resolveCitationSheet({ page: 440, pageKind: 'printed' }, { numbering: WO, offset: null })).toBe(458);
        expect(resolveCitationSheet({ page: 430, pageKind: 'printed' }, { numbering: ORTIZ, offset: null })).toBe(432);
    });

    it('sin calibración usa el desfase deducido; sin nada, el número es hoja', () => {
        expect(resolveCitationSheet({ page: 440, pageKind: 'printed' }, { numbering: null, offset: -18 })).toBe(458);
        expect(resolveCitationSheet({ page: 440, pageKind: 'printed' }, { numbering: null, offset: null })).toBe(440);
    });

    it('una cita sin tipo, o en hoja, no se convierte aunque el libro esté calibrado', () => {
        expect(resolveCitationSheet({ page: 440 }, { numbering: WO, offset: -18 })).toBe(440);
        expect(resolveCitationSheet({ page: 440, pageKind: 'sheet' }, { numbering: WO, offset: -18 })).toBe(440);
    });
});

describe('printedOfSheet y clampSheet', () => {
    it('dice qué folio lleva la hoja y no sale del libro', () => {
        expect(printedOfSheet(458, { numbering: WO, offset: null })).toBe('440');
        expect(printedOfSheet(458, { numbering: null, offset: -18 })).toBe('440'); // Un solo formato: el rótulo, como en el selector.
        expect(clampSheet(0, 792)).toBe(1);
        expect(clampSheet(800, 792)).toBe(792);
        expect(clampSheet(800, null)).toBe(800);
    });
});

/**
 * Revisión de B27 (H5): con una numeración por tramos que no cubre todas las
 * hojas más el desfase del índice, «Ir a 150» va a la hoja 155 y la cabecera
 * tiene que rotular esa hoja como p. 150: «Ir a» y la cabecera, una regla.
 */
describe('la cabecera y «Ir a» rotulan la hoja con la misma regla', () => {
    const PARCIAL: PageNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 100, offset: -5 }] };
    it('la hoja a la que salta «Ir a» lleva el número pedido', async () => {
        const { resolvePageJump } = await import('@dosfilos/domain');
        const ctx = { numbering: PARCIAL, offset: -5 };
        const r = resolvePageJump('150', 'printed', { ...ctx, totalSheets: 300 });
        expect(r).toEqual({ kind: 'go', sheet: 155 });
        expect(printedOfSheet(155, ctx)).toBe('150');
        // Dentro del tramo calibrado, la calibración.
        expect(printedOfSheet(50, ctx)).toBe('45');
    });
});
