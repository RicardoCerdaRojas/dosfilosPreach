import { describe, expect, it } from 'vitest';
import type { PageNumbering } from '@dosfilos/domain';
import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { enlazarFuentes, etiquetaDeFuente, PREFIJO_FUENTE, textoConCitas, type LibroParaCitar } from '../citasDeRespuesta';

const fuente = (n: number, resourceId: string, hoja: number): FuenteDeConsulta => ({
    n, resourceId, titulo: `Libro ${resourceId}`, autor: 'Varner, William', hoja, seccion: '', extracto: '',
});
/** Varner: la hoja 192 lleva impreso el 188. */
const calibrada: PageNumbering = { segments: [{ fromSheet: 5, toSheet: 244, offset: -4 }], origin: 'confirmed' } as PageNumbering;

describe('etiquetaDeFuente', () => {
    it('con numeración confirmada, la página impresa; sin ella, la hoja', () => {
        expect(etiquetaDeFuente(fuente(1, 'v', 192), { author: 'William Varner', pageNumbering: calibrada })).toBe('(Varner, p. 188)');
        expect(etiquetaDeFuente(fuente(1, 'v', 192), { author: 'William Varner', pageNumbering: null })).toBe('(Varner, hoja 192)');
    });
    it('una numeración sólo detectada (sin confirmar) no da página impresa, como en el visor', () => {
        const detectada = { ...calibrada, origin: 'detected' } as PageNumbering;
        expect(etiquetaDeFuente(fuente(1, 'v', 192), { author: 'William Varner', pageNumbering: detectada })).toBe('(Varner, hoja 192)');
    });
    it('sin el libro a mano, usa el autor guardado en la fuente', () => {
        expect(etiquetaDeFuente(fuente(1, 'v', 10), undefined)).toBe('(Varner, hoja 10)');
    });
});

describe('enlazarFuentes y textoConCitas', () => {
    const libros = new Map<string, LibroParaCitar>([['v', { author: 'William Varner', pageNumbering: calibrada }], ['m', { author: 'Douglas J. Moo' }]]);
    const fuentes = [fuente(1, 'v', 192), fuente(2, 'v', 194), { ...fuente(4, 'm', 30), autor: 'Douglas J. Moo' }];

    it('cada corrida de marcas es un enlace con sus fuentes; las marcas sin fuente se quitan', () => {
        const r = enlazarFuentes('Varner dice X [F1][F4]. Y [F2]. Z [F9].', fuentes, libros);
        expect(r.markdown).toBe(`Varner dice X [(Varner, p. 188; Moo, hoja 30)](${PREFIJO_FUENTE}0). Y [(Varner, p. 190)](${PREFIJO_FUENTE}1). Z .`);
        expect(r.enlaces.map(e => e.map(f => f.n))).toEqual([[1, 4], [2]]);
    });
    it('dos marcas de la misma página no repiten la cita', () => {
        expect(textoConCitas('X [F1][F1].', fuentes, libros)).toBe('X (Varner, p. 188).');
    });
    it('el texto para copiar lleva las citas armadas', () => {
        expect(textoConCitas('Varner dice X [F1]. Moo, Y [F4].', fuentes, libros)).toBe('Varner dice X (Varner, p. 188). Moo, Y (Moo, hoja 30).');
    });
});
