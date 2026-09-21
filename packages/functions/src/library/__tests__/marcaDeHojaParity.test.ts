import { describe, expect, it } from 'vitest';
import { pagesToMarkedText } from '../llamaParseClient';

/**
 * La marca de hoja del texto extraído, fijada a los dos lados.
 *
 * `packages/domain` parte el arranque de un libro por estas marcas para
 * separar la portada de la página legal y NO mostrarle el prefacio al
 * modelo que lee la ficha bibliográfica. No puede importar nada de este
 * paquete, así que si el formato cambiara aquí, allá simplemente dejaría
 * de haber hojas y la lectura caería al recorte por letras —que deja
 * pasar el prefacio— sin que nadie se enterara.
 *
 * Su hermana vive en `bibliographyFromText.test.ts`, «la marca es la que
 * escribe el extractor».
 */
describe('marca de hoja del texto extraído', () => {
    it('se escribe como «[PAGE n]» al principio de cada hoja', () => {
        const texto = pagesToMarkedText([
            { page: 1, text: 'portada' },
            { page: 2, text: 'página legal' },
        ] as Parameters<typeof pagesToMarkedText>[0]);

        expect(texto).toContain('[PAGE 1]');
        expect(texto).toContain('[PAGE 2]');
        expect(/\[PAGE \d+\]/.test(texto)).toBe(true);
    });
});
