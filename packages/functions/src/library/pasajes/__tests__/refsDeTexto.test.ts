import { describe, expect, it } from 'vitest';
import { BIBLE_CANON } from '@dosfilos/domain';
import { CANON_BIBLICO, GRAFIAS_DE_COMENTARIOS, PREFERENCIA_SI_AMBIGUA } from '../canonBiblico';
import { refsDeConsulta, refsDeFragmento, refsDeTexto, REFS_POR_FRAGMENTO } from '../refsDeTexto';

/**
 * El canon de `functions` es copia del dominio. Si se agrega una grafía allá
 * («stgo») y no acá, el índice de pasajes deja de reconocerla sin que nada
 * falle: esta prueba es la que avisa.
 */
describe('canon bíblico: paridad con el dominio', () => {
    it('mismos libros, en el mismo orden, con los mismos capítulos y grafías', () => {
        const delDominio = BIBLE_CANON.map(b => [b.id, b.chapterCount, [...b.aliases]]);
        const local = CANON_BIBLICO.map(([id, caps, grafias]) => [id, caps, [...grafias]]);
        expect(local).toEqual(delDominio);
    });

    it('las grafías de comentarios no existen en el dominio ni crean ambigüedades nuevas', () => {
        const delDominio = new Set(BIBLE_CANON.flatMap(b => b.aliases));
        for (const [id, grafias] of Object.entries(GRAFIAS_DE_COMENTARIOS)) {
            expect(CANON_BIBLICO.map(([i]) => i), id).toContain(id);
            for (const g of grafias) expect(delDominio.has(g), g).toBe(false);
        }
        const todas = Object.values(GRAFIAS_DE_COMENTARIOS).flat();
        expect(new Set(todas).size).toBe(todas.length);
    });

    it('cada preferencia nombra una grafía que de verdad es ambigua', () => {
        for (const [grafia, id] of Object.entries(PREFERENCIA_SI_AMBIGUA)) {
            const libros = CANON_BIBLICO.filter(([, , g]) => g.includes(grafia)).map(([i]) => i);
            expect(libros.length, grafia).toBeGreaterThan(1);
            expect(libros, grafia).toContain(id);
        }
    });
});

describe('refsDeTexto', () => {
    it('una cita deja la clave del capítulo y la del versículo', () => {
        expect(refsDeTexto('como dice Santiago 5:14, los ancianos')).toEqual(['JAS.5', 'JAS.5.14']);
    });

    it('un rango deja cada versículo', () => {
        expect(refsDeTexto('Stg 5:14-16')).toEqual(['JAS.5', 'JAS.5.14', 'JAS.5.15', 'JAS.5.16']);
        expect(refsDeTexto('Stg 5:14–16')).toEqual(['JAS.5', 'JAS.5.14', 'JAS.5.15', 'JAS.5.16']);
    });

    it('reconoce grafías en inglés y en español, con punto, coma o sin acento', () => {
        expect(refsDeTexto('Jas 5.14')).toEqual(['JAS.5', 'JAS.5.14']);
        expect(refsDeTexto('St 5,14')).toEqual([]); // «st» no es grafía del canon
        expect(refsDeTexto('Génesis 1:1 y Genesis 2:7')).toEqual(['GEN.1', 'GEN.1.1', 'GEN.2', 'GEN.2.7']);
        expect(refsDeTexto('Gn. 3:15')).toEqual(['GEN.3', 'GEN.3.15']);
        expect(refsDeTexto('James 2:9')).toEqual(['JAS.2', 'JAS.2.9']);
    });

    it('libros con número, con o sin espacio', () => {
        expect(refsDeTexto('1 Cor 13:4')).toEqual(['1CO.13', '1CO.13.4']);
        expect(refsDeTexto('1Co 13:4')).toEqual(['1CO.13', '1CO.13.4']);
        expect(refsDeTexto('2 Reyes 5:10')).toEqual(['2KI.5', '2KI.5.10']);
    });

    it('la grafía más larga gana: «Juan» no se lee como «Jn» ni «James» como «Jas»', () => {
        expect(refsDeTexto('1 Juan 4:8')).toEqual(['1JN.4', '1JN.4.8']);
        expect(refsDeTexto('James 5:14')).toEqual(['JAS.5', 'JAS.5.14']);
    });

    it('una grafía ambigua se decide por el capítulo y, si no alcanza, por la preferencia', () => {
        expect(refsDeTexto('Jn 3:16')).toEqual(['JHN.3', 'JHN.3.16']);
        expect(refsDeTexto('Jn 10:11')).toEqual(['JHN.10', 'JHN.10.11']);
        expect(refsDeTexto('Dn 30:1')).toEqual(['DEU.30', 'DEU.30.1']); // Daniel tiene 12 capítulos
    });

    it('capítulo fuera del libro: nada', () => {
        expect(refsDeTexto('Santiago 9:1')).toEqual([]);
        expect(refsDeTexto('Rut 5:1')).toEqual([]);
    });

    it('capítulo solo: sí con el nombre entero, no con una grafía corta', () => {
        expect(refsDeTexto('el capítulo de Santiago 5 trata')).toEqual(['JAS.5']);
        expect(refsDeTexto('Ex 3 y Am 2')).toEqual([]);
    });

    it('en la prosa exige mayúscula: «time is 5:30» no es Isaías', () => {
        expect(refsDeTexto('the time is 5:30 pm')).toEqual([]);
        expect(refsDeTexto('los números 4 y 5')).toEqual([]);
        expect(refsDeTexto('Is 53:5')).toEqual(['ISA.53', 'ISA.53.5']);
    });

    it('no toma el nombre pegado a otra palabra', () => {
        expect(refsDeTexto('Index 3:4')).toEqual([]);
        expect(refsDeTexto('Annex 3:4')).toEqual([]);
        // Sin la regla de la mayúscula, sólo el borde de palabra los separa.
        expect(refsDeTexto('ANNEX 3:4')).toEqual([]);
        expect(refsDeConsulta('annex 3:4')).toEqual([]);
    });

    it('un rango absurdo o que cruza capítulos deja sólo el comienzo', () => {
        expect(refsDeTexto('Sal 1:1-176')).toEqual(['PSA.1', 'PSA.1.1']);
        expect(refsDeTexto('Stg 5:19-6:2')).toEqual(['JAS.5', 'JAS.5.19']);
    });

    it('sin duplicados y con tope', () => {
        expect(refsDeTexto('Stg 5:14; Stg 5:14')).toEqual(['JAS.5', 'JAS.5.14']);
        const muchos = Array.from({ length: 150 }, (_, i) => `Sal ${i + 1}:1`).join('; ');
        expect(refsDeTexto(muchos)).toHaveLength(REFS_POR_FRAGMENTO);
    });

    it('una lista sigue con el mismo libro: «; 8.40» es otro capítulo y «, 12» otro versículo', () => {
        expect(refsDeTexto('see Ac 7.12; 8.40; 9.21.')).toEqual(['ACT.7', 'ACT.7.12', 'ACT.8', 'ACT.8.40', 'ACT.9', 'ACT.9.21']);
        expect(refsDeTexto('(Rom. 2:6, 12; 1 Cor. 1-4)')).toEqual(['ROM.2', 'ROM.2.6', 'ROM.2.12', '1CO.1', '1CO.2', '1CO.3', '1CO.4']);
        expect(refsDeTexto('2 Th 1.1, 2; 2.16')).toEqual(['2TH.1', '2TH.1.1', '2TH.1.2', '2TH.2', '2TH.2.16']);
        expect(refsDeTexto('Sal 146:1, 2a')).toEqual(['PSA.146', 'PSA.146.1', 'PSA.146.2']);
        expect(refsDeTexto('Heb. 3:1; 10:24-25')).toEqual(['HEB.3', 'HEB.3.1', 'HEB.10', 'HEB.10.24', 'HEB.10.25']);
    });

    it('la lista se corta en lo que no es cita', () => {
        expect(refsDeTexto('Jn 3:16; 12 páginas')).toEqual(['JHN.3', 'JHN.3.16']); // cifra sola tras «;»
        expect(refsDeTexto('Jn 3:16, 1995')).toEqual(['JHN.3', 'JHN.3.16']);
        expect(refsDeTexto('Stg 5:14; 9:1')).toEqual(['JAS.5', 'JAS.5.14']); // Santiago no tiene 9 capítulos
        expect(refsDeTexto('Stg 5:14), 15')).toEqual(['JAS.5', 'JAS.5.14']);
    });

    it('griego y hebreo alrededor no estorban', () => {
        expect(refsDeTexto('ἐξομολογεῖσθε (Stg 5:16) — כִּי Gn 2:17')).toEqual(['JAS.5', 'JAS.5.16', 'GEN.2', 'GEN.2.17']);
    });
});

describe('refsDeTexto — revisión adversarial', () => {
    it('abreviaturas de la SBL, de la RVR y romanos cortos', () => {
        expect(refsDeTexto('Matt 5:3; Exod 3:14')).toEqual(['MAT.5', 'MAT.5.3', 'EXO.3', 'EXO.3.14']);
        expect(refsDeTexto('Ezek 37:1, Pss 1:1, Eccl 3:1')).toEqual(['EZK.37', 'EZK.37.1', 'PSA.1', 'PSA.1.1', 'ECC.3', 'ECC.3.1']);
        expect(refsDeTexto('Mr 1:1')).toEqual(['MRK.1', 'MRK.1.1']);
        expect(refsDeTexto('I Co 13:4 y II Cor 3:4')).toEqual(['1CO.13', '1CO.13.4', '2CO.3', '2CO.3.4']);
        expect(refsDeTexto('1 Tm 2:5')).toEqual(['1TI.2', '1TI.2.5']);
    });

    it('libros de un capítulo: la cifra sola es el versículo', () => {
        expect(refsDeTexto('Jude 4')).toEqual(['JUD.1', 'JUD.1.4']);
        expect(refsDeTexto('Phlm 6')).toEqual(['PHM.1', 'PHM.1.6']);
        expect(refsDeTexto('3 John 4')).toEqual(['3JN.1', '3JN.1.4']);
        expect(refsDeTexto('Obad 15')).toEqual(['OBA.1', 'OBA.1.15']);
        expect(refsDeTexto('Jud 4')).toEqual(['JUD.1', 'JUD.1.4']); // «Jud» → Judas por la preferencia
    });

    it('rangos de capítulos y rangos que cruzan de capítulo', () => {
        expect(refsDeTexto('Mateo 5-7')).toEqual(['MAT.5', 'MAT.6', 'MAT.7']);
        expect(refsDeTexto('Romanos 1:18-3:20')).toEqual(['ROM.1', 'ROM.1.18', 'ROM.2', 'ROM.3', 'ROM.3.20']);
    });

    it('una cita no cruza de renglón', () => {
        expect(refsDeTexto('The Book of Acts\n3 Then Naomi')).toEqual([]);
    });

    it('números que no son citas', () => {
        expect(refsDeTexto('vol. 2 p. 3:4')).toEqual([]);
        expect(refsDeTexto('see 1 c. 3.5')).toEqual([]);
        expect(refsDeTexto('Es 3,5 veces')).toEqual([]);
        expect(refsDeTexto('Is 3,5 kg')).toEqual([]);
    });
});

describe('refsDeFragmento — el encabezado da el contexto', () => {
    it('el último encabezado no se pega a la primera cifra del texto', () => {
        expect(refsDeFragmento('3 Then Naomi', ['The Book of Acts'])).toEqual([]);
        expect(refsDeFragmento('7. Conclusion', ['Chapter 4', 'Numbers'])).toEqual([]);
    });

    it('«Santiago 5» › «vv. 13-18» y el «v. 14» del texto', () => {
        expect(refsDeFragmento('En el v. 14 los ancianos', ['Santiago 5', 'vv. 13-14'])).toEqual(['JAS.5', 'JAS.5.13', 'JAS.5.14']);
    });

    it('«Romans» › «8:28-30»', () => {
        expect(refsDeFragmento('texto', ['Romans', '8:28-30'])).toEqual(['ROM.8', 'ROM.8.28', 'ROM.8.29', 'ROM.8.30']);
    });

    it('el «1:17» suelto del texto es del libro del encabezado, pero «Rom 5:14» sigue siendo Romanos', () => {
        expect(refsDeFragmento('compare 1:17 and Rom 5:14', ['James 1:12-18'])).toEqual([
            'JAS.1', 'JAS.1.12', 'JAS.1.13', 'JAS.1.14', 'JAS.1.15', 'JAS.1.16', 'JAS.1.17', 'JAS.1.18', 'ROM.5', 'ROM.5.14',
        ]);
    });

    it('un encabezado que sólo dice «Numbers» no hace de Números las cifras del texto', () => {
        expect(refsDeFragmento('see table 3:4', ['Grammar', 'Numbers'])).toEqual([]);
    });

    it('sin encabezado con libro, el «v. 14» no se resuelve', () => {
        expect(refsDeFragmento('el v. 14', ['Introducción'])).toEqual([]);
    });
});

describe('refsDeConsulta', () => {
    it('en el buscador no exige mayúscula', () => {
        expect(refsDeConsulta('oración por los enfermos santiago 5:14-16')).toEqual(['JAS.5.14', 'JAS.5.15', 'JAS.5.16', 'JAS.5']);
    });

    it('sin versículo, busca por capítulo', () => {
        expect(refsDeConsulta('santiago 5')).toEqual(['JAS.5']);
    });

    it('abreviaturas cortas sin versículo', () => {
        expect(refsDeConsulta('stg 5')).toEqual(['JAS.5']);
        expect(refsDeConsulta('sal 23')).toEqual(['PSA.23']);
        expect(refsDeConsulta('ro 8')).toEqual(['ROM.8']);
    });

    it('más versículos de los que caben: sólo los capítulos', () => {
        expect(refsDeConsulta('mateo 5:1-40')).toEqual(['MAT.5']);
    });

    it('sin pasaje, nada', () => {
        expect(refsDeConsulta('la oración por los enfermos')).toEqual([]);
    });
});

describe('refsDeFragmento', () => {
    it('el encabezado de la sección rige el fragmento aunque el texto sólo diga «v. 14»', () => {
        expect(refsDeFragmento('En el v. 14 los ancianos…', ['Comentario', 'Santiago 5:13-14'])).toEqual(['JAS.5', 'JAS.5.13', 'JAS.5.14']);
    });

    it('sin sección, sólo el texto', () => {
        expect(refsDeFragmento('Stg 5:14', null)).toEqual(['JAS.5', 'JAS.5.14']);
    });
});
