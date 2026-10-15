import { describe, expect, it } from 'vitest';
import type { PageNumbering } from '@dosfilos/domain';
import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { etiquetaDeFuente } from '../etiquetaDeFuente';

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
    it('sin hoja no inventa página: «s. p.»', () => {
        expect(etiquetaDeFuente({ ...fuente(1, 'v', 1), hoja: null }, { author: 'William Varner', pageNumbering: calibrada })).toBe('(Varner, s. p.)');
    });
    it('la clave del visor manda sobre el apellido', () => {
        expect(etiquetaDeFuente(fuente(1, 'v', 192), { clave: 'Varner2014', author: 'William Varner', pageNumbering: calibrada })).toBe('(Varner2014, p. 188)');
    });
});
