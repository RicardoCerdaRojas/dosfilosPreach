import { describe, it, expect } from 'vitest';
import type { PassageReference } from '../../../bible/canon/passage-reference';
import { formatPericopeContext, pericopeContextRange } from '../pericopeContext';

const santiago2: PassageReference = {
    bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13,
};
const verso = (n: number): PassageReference => ({
    bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: n, verseEnd: n,
});

describe('pericopeContextRange — los tres casos que el defecto dejó pasar', () => {
    it('2:2 alcanza su apódosis en 2:4', () => {
        const r = pericopeContextRange(santiago2, verso(2));
        expect(r.from).toBe(1);
        expect(r.to).toBeGreaterThanOrEqual(4);
    });

    it('2:8 alcanza el contraste de 2:6-7', () => {
        const r = pericopeContextRange(santiago2, verso(8));
        expect(r.from).toBeLessThanOrEqual(6);
    });

    it('2:9 alcanza el argumento de 2:10-11', () => {
        const r = pericopeContextRange(santiago2, verso(9));
        expect(r.to).toBeGreaterThanOrEqual(11);
    });
});

describe('pericopeContextRange — los recortes', () => {
    it('no sale del pasaje del trabajo', () => {
        // 2:13 es el último del trabajo: el contexto no puede ofrecer 2:14,
        // que es otra perícopa y nadie está estudiando.
        expect(pericopeContextRange(santiago2, verso(13)).to).toBe(13);
        expect(pericopeContextRange(santiago2, verso(1)).from).toBe(1);
    });

    it('un trabajo sobre un capítulo entero no mete cincuenta versículos', () => {
        const capitulo: PassageReference = {
            bookId: 'PSA', chapterStart: 119, chapterEnd: 119, verseStart: 1, verseEnd: 176,
        };
        const r = pericopeContextRange(capitulo, { ...capitulo, verseStart: 90, verseEnd: 90 });
        expect(r.to - r.from + 1).toBeLessThanOrEqual(9);
    });

    it('el versículo analizado manda aunque quede fuera del pasaje', () => {
        // Pasa al reencuadrar un trabajo ya empezado: el paso existe con un
        // verso que el pasaje nuevo ya no cubre, y igual hay que analizarlo.
        const r = pericopeContextRange(santiago2, verso(20));
        expect(r.from).toBeLessThanOrEqual(20);
        expect(r.to).toBeGreaterThanOrEqual(20);
    });

    it('en un trabajo de varios capítulos, el del medio va entero', () => {
        const largo: PassageReference = {
            bookId: 'ROM', chapterStart: 8, chapterEnd: 10, verseStart: 18, verseEnd: 21,
        };
        const r = pericopeContextRange(largo, { ...largo, chapterStart: 9, chapterEnd: 9, verseStart: 15, verseEnd: 15 });
        expect(r.from).toBe(11);
        expect(r.to).toBe(19);
    });
});

describe('formatPericopeContext', () => {
    const versos = new Map([[1, 'alfa'], [2, 'beta'], [3, 'gamma'], [4, 'delta']]);

    it('señala el versículo analizado', () => {
        // Sin la marca el modelo recibe un bloque de griego y no sabe cuál de
        // esas oraciones tiene que analizar: peor que no darle contexto.
        const out = formatPericopeContext(versos, { from: 1, to: 4 }, { from: 2, to: 2 }, 2);
        expect(out).toContain('► 2:2 beta');
        expect(out).toContain('  2:1 alfa');
        expect(out).not.toContain('► 2:1');
    });

    it('si no hay vecinos, no hay entorno: cadena vacía', () => {
        // Decir el versículo analizado dos veces gasta prompt, no agrega
        // evidencia, y le pone al modelo un bloque titulado «contexto» que no
        // contiene ninguno.
        expect(formatPericopeContext(versos, { from: 2, to: 2 }, { from: 2, to: 2 }, 2)).toBe('');
    });

    it('un versículo que la fuente no trae se omite sin romper la numeración', () => {
        const out = formatPericopeContext(new Map([[1, 'alfa'], [3, 'gamma']]), { from: 1, to: 3 }, { from: 3, to: 3 }, 2);
        expect(out).toContain('2:1 alfa');
        expect(out).toContain('► 2:3 gamma');
        expect(out).not.toContain('2:2');
    });
});
