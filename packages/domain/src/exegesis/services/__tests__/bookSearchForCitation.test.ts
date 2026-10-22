import { describe, it, expect } from 'vitest';
import { candidateSheets, searchTermsForCitation, sheetsAroundCitation } from '../bookSearchForCitation';

/**
 * TP #8 (2026-10-21, fase 8b, D1): antes de declarar «no encontrada», leer la
 * página citada, sus vecinas y el libro. Adamson 171 → 170 y McCartney 203
 * (TP #7) estaban a una página.
 */
const NUMERACION = { origin: 'confirmed' as const, segments: [{ fromSheet: 1, toSheet: 999, offset: -278 }] };

describe('sheetsAroundCitation', () => {
    it('página impresa → hoja, con dos vecinas a cada lado', () => {
        // Mayor p. 133 = hoja 411.
        expect(sheetsAroundCitation({ pages: '133', raw: 'Mayor, p. 133' }, NUMERACION as never)).toEqual([409, 410, 411, 412, 413]);
    });

    it('un rango cubre todas sus hojas más las vecinas', () => {
        expect(sheetsAroundCitation({ pages: '133–134', raw: 'Mayor, p. 133–134' }, NUMERACION as never)).toEqual([409, 410, 411, 412, 413, 414]);
    });

    it('«hoja N» o un libro sin numeración: el número es la hoja', () => {
        expect(sheetsAroundCitation({ pages: '411', raw: 'Mayor, hoja 411' }, NUMERACION as never, 1)).toEqual([410, 411, 412]);
        expect(sheetsAroundCitation({ pages: '5', raw: 'X, p. 5' }, null, 1)).toEqual([4, 5, 6]);
    });

    it('sin página, o una impresa que la numeración no traduce, nada', () => {
        expect(sheetsAroundCitation({ pages: null, raw: 'Mayor' }, NUMERACION as never)).toEqual([]);
        expect(sheetsAroundCitation({ pages: '5000', raw: 'Mayor, p. 5000' }, NUMERACION as never)).toEqual([]);
    });

    it('no pasa de la hoja 1', () => {
        expect(sheetsAroundCitation({ pages: '1', raw: 'X, hoja 1' }, null)).toEqual([1, 2, 3]);
    });
});

describe('searchTermsForCitation', () => {
    it('una cita textual: dos tramos literales de seis palabras', () => {
        const q = 'The epexegetical view best fits James’s concerns about the tongue and its control';
        expect(searchTermsForCitation(q, true)).toEqual([
            'The epexegetical view best fits James’s',
            'best fits James’s concerns about the',
            'epexegetical', 'concerns', 'James’s',
        ]);
    });

    it('sin puntuación dentro de la frase, y con las palabras distintivas (revisión de 8b)', () => {
        // El servidor conserva las comas: «the spirit, which» no coincidía con «the spirit which».
        const t = searchTermsForCitation('the spirit, which he made to dwell in us, yearns jealously over us', true);
        expect(t.filter(x => x.split(' ').length > 1).every(x => !/[,.;:]/.test(x))).toBe(true);
        expect(t).toContain('which he made to dwell in');
        expect(t).toContain('jealously');
    });

    it('una paráfrasis: las tres palabras más distintivas, sin relleno', () => {
        expect(searchTermsForCitation('Adamson cataloga las propuestas sobre el origen de la cita: totally unknown', false))
            .toEqual(['propuestas', 'cataloga', 'Adamson']);
    });

    it('las palabras griegas cuentan', () => {
        expect(searchTermsForCitation('el sentido de ἐπιποθεῖ πρός', false)).toContain('ἐπιποθεῖ');
    });
});

describe('candidateSheets', () => {
    it('la hoja que reúne más términos, fuera de las ya leídas', () => {
        const hits = [
            [{ sheet: 170, count: 1 }, { sheet: 30, count: 4 }, { sheet: 411, count: 1 }],
            [{ sheet: 170, count: 2 }, { sheet: 411, count: 1 }],
            [{ sheet: 170, count: 1 }, { sheet: 88, count: 9 }],
        ];
        expect(candidateSheets(hits, new Set([411]))).toEqual([170]);
    });

    it('con un solo término, cualquier hoja que lo tenga', () => {
        // De más apariciones a menos.
        expect(candidateSheets([[{ sheet: 5, count: 1 }, { sheet: 9, count: 3 }]], new Set())).toEqual([9, 5]);
    });

    it('una frase literal hallada sola, sin otra hoja con más, es candidata', () => {
        expect(candidateSheets([[{ sheet: 400, count: 1 }], []], new Set())).toEqual([400]);
    });

    it('sin coincidencias, nada', () => {
        expect(candidateSheets([[], []], new Set())).toEqual([]);
    });
});
