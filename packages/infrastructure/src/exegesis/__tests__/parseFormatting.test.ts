import { describe, it, expect } from 'vitest';
import { parseFormatting } from '../GeminiPaperRubricExtractor';

/**
 * Lo que el sílabo dice sobre maquetación, leído del modelo y NO confiado.
 *
 * Un `"lineSpacing": "doble"` o `"1.5"` produciría un interlineado que el
 * exportador no sabe traducir, y el documento saldría con la maquetación de la
 * casa sin que nadie se entere. Ante la duda, `null` —la guía de la casa, que
 * es lo que el sistema hacía antes del campo y no sorprende a nadie—.
 */
describe('parseFormatting', () => {
    it('lee los tres interlineados del catálogo', () => {
        for (const lineSpacing of ['single', 'one-and-a-half', 'double'] as const) {
            expect(parseFormatting({ lineSpacing, blankLineBetweenParagraphs: true }))
                .toEqual({ lineSpacing, blankLineBetweenParagraphs: true });
        }
    });

    it('un interlineado fuera del catálogo cae a la guía de la casa', () => {
        expect(parseFormatting({ lineSpacing: 'doble' })).toBeNull();
        expect(parseFormatting({ lineSpacing: '1.5' })).toBeNull();
        expect(parseFormatting({ lineSpacing: 2 })).toBeNull();
    });

    it('el sílabo que no dice nada devuelve null', () => {
        expect(parseFormatting(null)).toBeNull();
        expect(parseFormatting(undefined)).toBeNull();
        expect(parseFormatting('espacio simple')).toBeNull();
        expect(parseFormatting({})).toBeNull();
    });

    it('la línea entre párrafos sólo es verdadera si el modelo dice true', () => {
        // Un `"sí"` o un `1` no cuentan: la maquetación se afirma, no se
        // interpreta.
        expect(parseFormatting({ lineSpacing: 'single' })!.blankLineBetweenParagraphs).toBe(false);
        expect(parseFormatting({ lineSpacing: 'single', blankLineBetweenParagraphs: 'sí' })!.blankLineBetweenParagraphs).toBe(false);
        expect(parseFormatting({ lineSpacing: 'single', blankLineBetweenParagraphs: true })!.blankLineBetweenParagraphs).toBe(true);
    });
});
