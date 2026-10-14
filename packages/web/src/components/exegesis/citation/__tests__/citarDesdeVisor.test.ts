import { describe, it, expect } from 'vitest';
import { citaParaInsertar, insertarEnCursor } from '../citarDesdeVisor';

/** Fase F, F2: la cita que arma el visor y dónde cae en el texto. */
describe('citar desde el visor', () => {
    it('arma la cita con la forma que el sistema reconoce', () => {
        expect(citaParaInsertar('McCartney', 'p. 204')).toBe('(McCartney, p. 204)');
        expect(citaParaInsertar(' Robertson ', 'hoja 613 ')).toBe('(Robertson, hoja 613)');
    });

    it('inserta en el cursor, con un espacio si quedaría pegada a una palabra', () => {
        const texto = 'el dativo simple rara vez indica agente. Aunque';
        const pos = texto.indexOf('.');
        expect(insertarEnCursor(texto, pos, pos, '(McCartney, p. 204)')).toEqual({
            valor: 'el dativo simple rara vez indica agente (McCartney, p. 204). Aunque',
            cursor: pos + ' (McCartney, p. 204)'.length,
        });
    });

    it('sin espacio al principio, detrás de un espacio o de un paréntesis abierto', () => {
        expect(insertarEnCursor('', 0, 0, '(A, p. 1)').valor).toBe('(A, p. 1)');
        expect(insertarEnCursor('agente ', 7, 7, '(A, p. 1)').valor).toBe('agente (A, p. 1)');
        expect(insertarEnCursor('ver (', 5, 5, 'A, p. 1)').valor).toBe('ver (A, p. 1)');
        expect(insertarEnCursor('a\nb', 2, 2, '(A, p. 1)').valor).toBe('a\n(A, p. 1)b');
    });

    it('reemplaza lo seleccionado y tolera posiciones fuera del texto', () => {
        expect(insertarEnCursor('agente (X, p. 9).', 7, 16, '(A, p. 1)').valor).toBe('agente (A, p. 1).');
        expect(insertarEnCursor('abc', 99, 120, '(A, p. 1)')).toEqual({ valor: 'abc (A, p. 1)', cursor: 13 });
    });
});
