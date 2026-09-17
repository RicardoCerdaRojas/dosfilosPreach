import { describe, expect, it } from 'vitest';
import type { PageNumbering } from '@dosfilos/domain';
import { clampSheet, printedOfSheet, resolveCitationSheet, sheetForPageInput } from '../citationSheet';

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

describe('sheetForPageInput', () => {
    it('el folio que escribe el lector se convierte con la calibración', () => {
        expect(sheetForPageInput(421, { numbering: WO, offset: null })).toBe(439);
    });

    it('un número que ningún tramo produce se toma como hoja', () => {
        expect(sheetForPageInput(900, { numbering: WO, offset: null })).toBe(900);
        expect(sheetForPageInput(12, { numbering: null, offset: null })).toBe(12);
    });

    it('rechaza lo que no es un número de página', () => {
        expect(sheetForPageInput(0, { numbering: WO, offset: null })).toBeNull();
        expect(sheetForPageInput(NaN, { numbering: WO, offset: null })).toBeNull();
        expect(sheetForPageInput(3.5, { numbering: WO, offset: null })).toBeNull();
    });
});

describe('printedOfSheet y clampSheet', () => {
    it('dice qué folio lleva la hoja y no sale del libro', () => {
        expect(printedOfSheet(458, { numbering: WO, offset: null })).toBe('440');
        expect(printedOfSheet(458, { numbering: null, offset: -18 })).toBe(440);
        expect(clampSheet(0, 792)).toBe(1);
        expect(clampSheet(800, 792)).toBe(792);
        expect(clampSheet(800, null)).toBe(800);
    });
});
