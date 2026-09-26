import { describe, expect, it } from 'vitest';
import { countOshbVerbTypes, describeOshbCode, describeOshbSegment } from '../oshbMorphology';

/**
 * Los casos vienen del Salmo 23:1-3 en morphhb, contrastados contra el
 * análisis que el autor escribió A MANO para ese mismo trabajo.
 */
describe('describeOshbCode — contra el análisis escrito a mano', () => {
    it('יְשׁוֹבֵב es polel imperfecto, como dice su trabajo', () => {
        expect(describeOshbCode('HVoi3ms')).toBe('polel imperfecto 3ª masculino singular');
    });

    it('יַנְחֵנִי es hifil, y arrastra su sufijo pronominal', () => {
        // Su trabajo dice «Hifíl»; su encuadre, «imperfecto 3ms + 1cs».
        expect(describeOshbCode('HVhi3ms/Sp1cs'))
            .toBe('hifil imperfecto 3ª masculino singular + sufijo pronominal 1ª común singular');
    });

    it('אֶחְסָר es qal imperfecto 1cs', () => {
        expect(describeOshbCode('HVqi1cs')).toBe('qal imperfecto 1ª común singular');
    });

    it('יְנַהֲלֵנִי es piel, el paralelo del hifil', () => {
        expect(describeOshbCode('HVpi3ms/Sp1cs')).toContain('piel imperfecto');
    });
});

describe('describeOshbCode — las junturas de la palabra', () => {
    it('preposición pegada a sustantivo se describe entera', () => {
        // בִּ/נְא֣וֹת — el trabajo discute justamente esas junturas.
        expect(describeOshbCode('HR/Ncfpc')).toBe('preposición + sustantivo femenino plural constructo');
    });

    it('el nombre propio no finge género ni número', () => {
        expect(describeOshbCode('HNp')).toBe('sustantivo propio');
    });

    it('el estado del sustantivo sale del último carácter', () => {
        expect(describeOshbCode('HNcmsa')).toBe('sustantivo masculino singular absoluto');
        expect(describeOshbCode('HNcmsc')).toBe('sustantivo masculino singular constructo');
    });

    it('el arameo se lee igual: cambia la letra de lengua, no el código', () => {
        expect(describeOshbCode('AVqp3ms')).toContain('qal perfecto');
    });
});

describe('lo que NO se traduce', () => {
    it('un tallo fuera de los verificados sale con su código crudo', () => {
        // Ocho tallos cubren el 99,1 % de las formas medidas. Inventar un
        // nombre para el 0,9 % restante sería inventar precisión sobre
        // morfología, que es peor que no darla.
        expect(describeOshbSegment('Vzi3ms')).toBeNull();
        expect(describeOshbCode('HVzi3ms')).toBe('Vzi3ms');
    });

    it('una categoría desconocida también', () => {
        expect(describeOshbCode('HXyz')).toBe('Xyz');
    });

    it('un código vacío no inventa nada', () => {
        expect(describeOshbSegment('  ')).toBeNull();
    });
});

describe('countOshbVerbTypes — el recuento', () => {
    it('cuenta OCURRENCIAS y no formas distintas', () => {
        // Mismo criterio que el griego, y por el mismo motivo.
        const c = countOshbVerbTypes(['HVqi1cs', 'HVqi1cs', 'HVhi3ms/Sp1cs']);
        expect(c['imperfecto qal']).toBe(2);
        expect(c['imperfecto hifil']).toBe(1);
    });

    it('el verbo dentro de una palabra compuesta cuenta igual', () => {
        // רֹעִי es participio qal con sufijo: la juntura no lo esconde.
        expect(countOshbVerbTypes(['HVqrmsc/Sp1cs'])['participio qal']).toBe(1);
    });

    it('lo que no es verbo no entra', () => {
        expect(countOshbVerbTypes(['HR/Ncfpc', 'HTn', 'HNp'])).toEqual({});
    });

    it('un tallo sin verificar no se cuenta con nombre inventado', () => {
        expect(countOshbVerbTypes(['HVzi3ms'])).toEqual({});
    });
});
