import { describe, expect, it } from 'vitest';
import { findBibleReferences } from '../referenceSpans';

describe('referencias dentro del manuscrito (C7)', () => {
    it('encuentra las referencias con su posición exacta en el texto', () => {
        const texto = 'Dios dice (Jonás 4:2) que es clemente; ver también 1 Jn 3:16-18.';
        const refs = findBibleReferences(texto);
        expect(refs.map((r) => r.reference)).toEqual(['Jonás 4:2', '1 Jn 3:16-18']);
        for (const r of refs) expect(texto.slice(r.start, r.end)).toBe(r.reference);
    });

    it('al principio del texto y con punto como separador', () => {
        const refs = findBibleReferences('Sal 103.8 lo dice.');
        expect(refs).toEqual([{ reference: 'Sal 103.8', start: 0, end: 9 }]);
    });

    it('no marca un capítulo solo ni palabras que empiezan igual', () => {
        expect(findBibleReferences('Juan 3 es largo. Esdrújula 4:2 no existe.')).toEqual([]);
    });
});
