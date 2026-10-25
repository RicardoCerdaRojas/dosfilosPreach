import { describe, expect, it } from 'vitest';
import { countOshbVerbTypes, describeOshbCode, describeOshbSegment, isAramaicOshbCode } from '../oshbMorphology';

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
});

/**
 * El arameo usa las mismas letras para otros tallos (tabla oficial de OSHB,
 * «Verb stems (Aramaic)»). Antes se le aplicaba la tabla hebrea y esta prueba
 * afirmaba «qal perfecto» para `AVqp3ms`: fijaba el defecto.
 */
describe('describeOshbCode — el arameo tiene sus propios tallos', () => {
    it('peal, no qal', () => {
        expect(describeOshbCode('AVqp3ms')).toBe('peal perfecto 3ª masculino singular (arameo)');
    });

    it('haphel, no hifil', () => {
        expect(describeOshbCode('AVhp3ms')).toContain('haphel perfecto');
        expect(describeOshbCode('AVhp3ms')).not.toContain('hifil');
    });

    it('pael, no piel', () => {
        expect(describeOshbCode('AVpp3ms')).toContain('pael perfecto');
    });

    it('los tallos que el hebreo no tiene también se nombran (hithpeel, shaphel)', () => {
        expect(describeOshbCode('AVui3ms')).toContain('hithpeel imperfecto');
        expect(describeOshbCode('AVep3ms')).toContain('shaphel perfecto');
    });

    it('el hebreo no cambia', () => {
        expect(describeOshbCode('HVqp3ms')).toBe('qal perfecto 3ª masculino singular');
        expect(describeOshbCode('HVhp3ms')).toContain('hifil perfecto');
    });

    it('un adjetivo hebreo con prefijo sigue siendo hebreo', () => {
        expect(describeOshbCode('HAampa')).toBe('adjetivo');
        expect(isAramaicOshbCode('HAampa')).toBe(false);
    });

    it('el sustantivo arameo dice su lengua (Dn 2:4 cambia de lengua dentro del versículo)', () => {
        expect(describeOshbCode('ANcmsd')).toBe('sustantivo masculino singular determinado (arameo)');
        expect(describeOshbCode('AC/Np')).toBe('conjunción + sustantivo propio (arameo)');
    });

    it('formato del paquete npm: `Aampa` es un adjetivo hebreo sin prefijo, no arameo', () => {
        // El npm de morphhb quita la H del hebreo y deja la A del arameo.
        expect(isAramaicOshbCode('Aampa')).toBe(false);
        expect(describeOshbCode('Aampa')).toBe('adjetivo');
        expect(isAramaicOshbCode('AVqp3ms')).toBe(true);
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

    it('el arameo se cuenta aparte, con su nombre', () => {
        // Esd 4:8 junto a un verso hebreo: sumar peal con qal mezclaría dos
        // sistemas verbales.
        const c = countOshbVerbTypes(['AVqp3mp', 'HVqp3ms', 'AVhp3ms', 'AVqp3ms']);
        expect(c).toEqual({
            'perfecto peal arameo': 2,
            'perfecto qal': 1,
            'perfecto haphel arameo': 1,
        });
    });

    it('una letra fuera de la tabla aramea tampoco se cuenta', () => {
        expect(countOshbVerbTypes(['AVxp3ms'])).toEqual({});
    });
});
