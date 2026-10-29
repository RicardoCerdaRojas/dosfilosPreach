import { describe, expect, it } from 'vitest';

import {
    defaultPageJumpMode,
    hasKnownPrintedNumbering,
    resolvePageJump,
    type PageJumpContext,
} from '../pageJump';
import type { PageNumbering } from '../pageNumbering';

/**
 * TP #9, B27: en el NA28 la hoja 803 lleva impresa la p. 692. El fundador
 * escribió 803 queriendo la hoja y el cuadro lo llevó a la p. 803.
 */
const NA28: PageJumpContext = {
    numbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 1000, offset: -111 }] },
    offset: null,
    totalSheets: 1000,
};

/** Un libro con introducción en romanos, láminas sin número y el cuerpo en arábigas. */
const MAYOR: PageNumbering = {
    origin: 'confirmed',
    segments: [
        { fromSheet: 1, toSheet: 4, offset: null },
        { fromSheet: 5, toSheet: 28, offset: -4, style: 'roman' },
        { fromSheet: 29, toSheet: 40, offset: -28 },
        { fromSheet: 41, toSheet: 44, offset: null },
        { fromSheet: 45, toSheet: 300, offset: -32 },
    ],
};
const mayor: PageJumpContext = { numbering: MAYOR, offset: null, totalSheets: 300 };

describe('resolvePageJump — página impresa', () => {
    it('la p. 692 del NA28 es la hoja 803', () => {
        expect(resolvePageJump('692', 'printed', NA28)).toEqual({ kind: 'go', sheet: 803 });
    });

    it('«h. 803» va a la HOJA 803 aunque el cuadro pida la impresa', () => {
        expect(resolvePageJump('h. 803', 'printed', NA28)).toEqual({ kind: 'go', sheet: 803 });
        expect(resolvePageJump('hoja 803', 'printed', NA28)).toEqual({ kind: 'go', sheet: 803 });
        expect(resolvePageJump('H803', 'printed', NA28)).toEqual({ kind: 'go', sheet: 803 });
        expect(resolvePageJump('s. 803', 'printed', NA28)).toEqual({ kind: 'go', sheet: 803 });
    });

    it('«p. 692» va a la impresa aunque el cuadro pida la hoja', () => {
        expect(resolvePageJump('p. 692', 'sheet', NA28)).toEqual({ kind: 'go', sheet: 803 });
    });

    it('una página que el libro no tiene se dice, no salta a la hoja con ese número', () => {
        expect(resolvePageJump('950', 'printed', NA28)).toEqual({ kind: 'printedOutOfBook', page: '950', first: '1', last: '889' });
    });

    it('un romano se busca en el tramo romano', () => {
        // Hoja 16: −4 + 16 = 12 → «xii».
        expect(resolvePageJump('xii', 'printed', mayor)).toEqual({ kind: 'go', sheet: 16 });
    });

    it('un número que cae en láminas sin numerar avisa que no tiene hoja', () => {
        // Las láminas (hojas 41–44) interrumpen la cuenta: la p. 42 está dentro
        // de lo que el libro numera, pero ninguna hoja la lleva.
        const conHueco: PageJumpContext = {
            numbering: { origin: 'confirmed', segments: [
                { fromSheet: 1, toSheet: 40, offset: 0 },
                { fromSheet: 41, toSheet: 44, offset: null },
                { fromSheet: 45, toSheet: 100, offset: 0 },
            ] },
            offset: null,
            totalSheets: 100,
        };
        expect(resolvePageJump('42', 'printed', conHueco)).toEqual({ kind: 'printedUnnumbered', page: '42' });
    });

    it('un romano fuera de la introducción dice hasta dónde llega', () => {
        expect(resolvePageJump('xxx', 'printed', mayor)).toEqual({ kind: 'printedOutOfBook', page: 'xxx', first: 'i', last: 'xxiv' });
    });

    it('la serie con asterisco no se confunde con la arábiga', () => {
        const bhq: PageJumpContext = {
            numbering: { origin: 'confirmed', segments: [
                { fromSheet: 1, toSheet: 100, offset: 0, style: 'asterisked' },
                { fromSheet: 101, toSheet: 200, offset: -100 },
            ] },
            offset: null,
            totalSheets: 200,
        };
        expect(resolvePageJump('42*', 'printed', bhq)).toEqual({ kind: 'go', sheet: 42 });
        expect(resolvePageJump('42', 'printed', bhq)).toEqual({ kind: 'go', sheet: 142 });
    });

    it('con el desfase único del índice (sin tramos)', () => {
        const robertson: PageJumpContext = { numbering: null, offset: -79, totalSheets: 1500 };
        expect(resolvePageJump('534', 'printed', robertson)).toEqual({ kind: 'go', sheet: 613 });
    });

    it('un libro sin numeración conocida no acepta página impresa', () => {
        const sin: PageJumpContext = { numbering: null, offset: null, totalSheets: 300 };
        expect(resolvePageJump('p. 12', 'sheet', sin)).toEqual({ kind: 'noNumbering' });
    });

    it('lo que no es número es inválido', () => {
        expect(resolvePageJump('abc', 'printed', NA28)).toEqual({ kind: 'invalid', mode: 'printed' });
        expect(resolvePageJump('', 'printed', NA28)).toEqual({ kind: 'invalid', mode: 'printed' });
        expect(resolvePageJump('0', 'printed', NA28)).toEqual({ kind: 'invalid', mode: 'printed' });
        expect(resolvePageJump('3.5', 'sheet', NA28)).toEqual({ kind: 'invalid', mode: 'sheet' });
    });
});

describe('resolvePageJump — hoja del archivo', () => {
    it('la hoja va tal cual', () => {
        expect(resolvePageJump('803', 'sheet', NA28)).toEqual({ kind: 'go', sheet: 803 });
    });

    it('una hoja que el archivo no tiene se dice', () => {
        expect(resolvePageJump('1200', 'sheet', NA28)).toEqual({ kind: 'sheetOutOfBook', total: 1000 });
    });
});

describe('modo por defecto', () => {
    it('con numeración conocida pide la impresa; sin ella, la hoja', () => {
        expect(defaultPageJumpMode(NA28.numbering, null)).toBe('printed');
        expect(defaultPageJumpMode(null, -79)).toBe('printed');
        expect(defaultPageJumpMode(null, null)).toBe('sheet');
        // Una numeración confirmada SIN folios (Wallace en español) no es numeración conocida.
        expect(hasKnownPrintedNumbering({ origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 300, offset: null }] }, null)).toBe(false);
    });
});
