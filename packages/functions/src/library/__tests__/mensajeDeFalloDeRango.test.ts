import { describe, expect, it } from 'vitest';
import { mensajeParaLaPantalla } from '../extractRangeTask';

/**
 * Un fallo que no se puede arreglar reintentando tiene que decirlo. El
 * léxico de Ortiz —PDF protegido— se quedó en «0 de 807 páginas»: tres
 * intentos, el mismo error las tres veces, y después silencio hasta que
 * el barrido lo recogiera veinte minutos más tarde.
 */
describe('mensajeParaLaPantalla', () => {
    it('un PDF protegido dice qué hacer, no «vuelve a intentarlo»', () => {
        const m = mensajeParaLaPantalla(
            'Input document to `PDFDocument.load` is encrypted. You can use ...',
            '1-24',
        );
        expect(m).toMatch(/protegido/i);
        expect(m).toMatch(/quita la protección|sube otra copia/i);
        expect(m).not.toMatch(/vuelve a intentarlo/i);
    });

    it('cualquier otro fallo nombra el rango que rompió', () => {
        expect(mensajeParaLaPantalla('socket hang up', '241-264')).toContain('241-264');
    });
});
