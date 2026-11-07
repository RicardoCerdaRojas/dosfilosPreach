import { describe, expect, it } from 'vitest';
import { BIBLE_CANON } from '@dosfilos/domain';
import { CANON_BIBLICO, GRAFIAS_DE_COMENTARIOS, PREFERENCIA_SI_AMBIGUA } from '../canonBiblico';
import { etiquetaDePasaje, libroDelTitulo, refsDeConsulta, refsDeFragmento, refsDeTexto, REFS_POR_FRAGMENTO } from '../refsDeTexto';

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
        // En prosa la abreviatura corta no basta: «AB 37» es la Anchor Bible, no Abdías.
        expect(refsDeTexto('Jud 4')).toEqual([]);
        expect(refsDeTexto('(AB 37A; New York: Doubleday, 1995)')).toEqual([]);
        expect(refsDeConsulta('jud 4')).toEqual(['JUD.1.4', 'JUD.1']);
    });

    it('libros de un capítulo: un versículo que no existe no es una cita de ese libro', () => {
        expect(refsDeTexto('19* Amos . 21* Obadiah 23* Jonah')).toEqual([]); // índice: página 23; Abdías tiene 21
        expect(refsDeTexto('Abdías 21')).toEqual(['OBA.1', 'OBA.1.21']);
        expect(refsDeTexto('OBADIAH 91')).toEqual([]);
        expect(refsDeTexto('συναθλεω en Filemon 1:27')).toEqual([]);
        expect(refsDeTexto('Judas 1:24-30')).toEqual(['JUD.1', 'JUD.1.24', 'JUD.1.25']);
    });

    it('rangos de capítulos y rangos que cruzan de capítulo', () => {
        expect(refsDeTexto('Mateo 5-7')).toEqual(['MAT.5', 'MAT.6', 'MAT.7']);
        expect(refsDeTexto('Romanos 1:18-3:20')).toEqual(['ROM.1', 'ROM.1.18', 'ROM.2', 'ROM.3', 'ROM.3.20']);
        // Al indexar, una sección: sus extremos no son menciones de 1:18 ni de 3:20 (PR 2, Adamson h. 200).
        expect(refsDeTexto('Romanos 1:18-3:20', { rangosDeSeccion: true })).toEqual(['ROM.1', 'ROM.2', 'ROM.3']);
        // Lo que entra apenas en el capítulo siguiente sigue siendo de versículos.
        expect(refsDeTexto('Romanos 1:31-2:2', { rangosDeSeccion: true })).toEqual(['ROM.1', 'ROM.1.31', 'ROM.2', 'ROM.2.2']);
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

describe('etiquetaDePasaje (U6)', () => {
    it('la cita como la escribió el pastor, con sus acentos y mayúscula inicial', () => {
        expect(etiquetaDePasaje('¿Qué dicen mis libros sobre santiago 3:13?')).toBe('Santiago 3:13');
        expect(etiquetaDePasaje('qué enseña génesis 2:17 sobre la muerte')).toBe('Génesis 2:17');
        expect(etiquetaDePasaje('stg 5:14-15 y el aceite')).toBe('Stg 5:14-15');
    });
    it('sin pasaje, null', () => {
        expect(etiquetaDePasaje('la oración por los enfermos')).toBeNull();
    });
    it('palabras comunes con una cifra NO son un pasaje (revisión adversarial)', () => {
        for (const q of ['los autores dan 3 razones', 'la sal 2 veces', 'mi 2 pregunta', 'el mal 3 veces', 'he 11', 'est 3 cosas', 'num 3']) {
            expect(etiquetaDePasaje(q), q).toBeNull();
        }
    });
    it('el nombre entero sin versículo sí; un versículo que no existe, no', () => {
        expect(etiquetaDePasaje('santiago 3')).toBe('Santiago 3');
        expect(etiquetaDePasaje('judas 30')).toBeNull();
    });
    it('la mayúscula va en la primera letra', () => {
        expect(etiquetaDePasaje('1 cor 13:4')).toBe('1 Cor 13:4');
    });
});

/**
 * TP #8 (2026-10-21, fase 8a, A3). Encabezados y notas reales de Mayor, *The
 * Epistle of St. James* (fragmentos 812–827 en producción ese día): sus
 * páginas no nombran el libro y el índice de pasajes quedaba vacío.
 */
describe('refsDeFragmento · comentarios clásicos de notas', () => {
    it('lee «IV 2, 3] NOTES» con el libro del documento', () => {
        expect(refsDeFragmento('cualquier texto', ['NOTES', 'IV 2, 3] NOTES'], 'JAS')).toEqual(['JAS.4', 'JAS.4.2', 'JAS.4.3']);
    });

    it('lee un tramo «IV 3–5] NOTES» y uno que cruza capítulos «III 17–IV 1] NOTES»', () => {
        expect(refsDeFragmento('', ['NOTES', 'IV 3–5] NOTES'], 'JAS')).toEqual(['JAS.4', 'JAS.4.3', 'JAS.4.4', 'JAS.4.5']);
        expect(refsDeFragmento('', ['NOTES', 'III 17–IV 1] NOTES'], 'JAS')).toEqual(['JAS.3', 'JAS.3.17', 'JAS.4', 'JAS.4.1']);
    });

    it('suma las notas «N. lema.]» del texto con el capítulo del encabezado', () => {
        const texto = 'οὐκ ἔχετε.] Las palabras…\n\n3. αἰτεῖτε καὶ οὐ λαμβάνετε,] Yet in i. 5 he had said…';
        expect(refsDeFragmento(texto, ['NOTES', 'IV 2] NOTES'], 'JAS')).toEqual(['JAS.4', 'JAS.4.2', 'JAS.4.3']);
    });

    it('una lista numerada sin griego ni hebreo no es una nota', () => {
        expect(refsDeFragmento('1. Introduction]', ['NOTES', 'IV 2] NOTES'], 'JAS')).toEqual(['JAS.4', 'JAS.4.2']);
    });

    it('la coma enumera versículos sueltos, no un tramo', () => {
        expect(refsDeFragmento('', ['NOTES', 'IV 2, 5] NOTES'], 'JAS')).toEqual(['JAS.4', 'JAS.4.2', 'JAS.4.5']);
    });

    it('una nota bajo un encabezado de varios capítulos no inventa el capítulo', () => {
        expect(refsDeFragmento('3. αἰτεῖτε καὶ οὐ λαμβάνετε,]', ['James 4–5'])).toEqual(['JAS.4', 'JAS.5']);
    });

    it('sin el libro del documento, el encabezado de notas no se adivina', () => {
        expect(refsDeFragmento('', ['NOTES', 'IV 2, 3] NOTES'])).toEqual([]);
    });

    it('una nota al pie numerada de otro comentario no es un versículo (revisión de 8a)', () => {
        // Con el capítulo del encabezado «Santiago 4:1-10», no de uno de notas.
        expect(refsDeFragmento('12. Véase πειρασμός [BDAG, 793]\n45. Cf. ἀγάπη [sic]', ['Santiago 4:1-10']))
            .not.toContain('JAS.4.12');
        expect(refsDeFragmento('12. Véase πειρασμός [BDAG, 793]', ['Santiago 4:1-10'])).not.toContain('JAS.4.45');
    });

    it('las notas «N. lema]» sólo se leen bajo un encabezado de notas', () => {
        // Un comentario corriente con la palabra griega al principio de la nota al pie.
        expect(refsDeFragmento('12. πειρασμός, cf. BDAG 793]', ['Santiago 4:1-10'])).not.toContain('JAS.4.12');
    });

    it('la nota tiene que abrir con la palabra griega o hebrea', () => {
        expect(refsDeFragmento('5. Cf. ἀγάπη y otros.]', ['NOTES', 'IV 2] NOTES'], 'JAS')).toEqual(['JAS.4', 'JAS.4.2']);
    });

    it('un capítulo que el libro no tiene no es un encabezado de notas', () => {
        expect(refsDeFragmento('', ['NOTES', 'VI 2] NOTES'], 'JAS')).toEqual([]);
        expect(refsDeFragmento('', ['NOTES', 'IV 17–VI 1] NOTES'], 'JAS')).toEqual([]);
    });

    it('un título que nombra dos libros no presta ninguno', () => {
        expect(libroDelTitulo('Hebrews - James')).toBeNull();
    });

    it('«THE EPISTLE OF ST. JAMES» nombra el libro', () => {
        expect(libroDelTitulo('THE EPISTLE OF ST. JAMES')).toBe('JAS');
        expect(libroDelTitulo('The Epistle of James - the Greek text with introduction')).toBe('JAS');
        expect(libroDelTitulo('Greek Grammar Beyond the Basics')).toBeNull();
    });
});

/**
 * TP #9 (2026-10-28, B18). Encabezados reales de Ropes, ICC (h. 287-301): el
 * capítulo en romanos —con el carácter de numeral romano «Ⅳ»—, coma y los
 * versículos de la página. El índice de pasajes quedaba vacío.
 */
describe('refsDeFragmento · capítulo en romanos con coma (Ropes)', () => {
    it('lee «Ⅳ, 9–11» y «IV, 11-17» con el libro del encabezado de arriba', () => {
        expect(refsDeFragmento('', ['JAMES', 'Ⅳ, 9–11'])).toEqual(['JAS.4', 'JAS.4.9', 'JAS.4.10', 'JAS.4.11']);
        expect(refsDeFragmento('', ['JAMES', 'IV, 11-12'])).toEqual(['JAS.4', 'JAS.4.11', 'JAS.4.12']);
        expect(refsDeFragmento('', ['JAMES', 'iv, 11'])).toEqual(['JAS.4', 'JAS.4.11']);
        expect(refsDeFragmento('', ['JAMES', 'IV. 11'])).toEqual(['JAS.4', 'JAS.4.11']);
        expect(refsDeFragmento('', ['JAMES', 'IV 11-12'])).toEqual(['JAS.4', 'JAS.4.11', 'JAS.4.12']);
        expect(refsDeFragmento('', ['JAMES', 'V, 1-3'])).toEqual(['JAS.5', 'JAS.5.1', 'JAS.5.2', 'JAS.5.3']);
    });

    it('cruza de capítulo', () => {
        expect(refsDeFragmento('', ['JAMES', 'Ⅳ, 17–Ⅴ, 1'])).toEqual(['JAS.4', 'JAS.4.17', 'JAS.5', 'JAS.5.1']);
    });

    it('el «v. 14» del texto se lee con el capítulo del encabezado', () => {
        expect(refsDeFragmento('the latter part of this same verse and v. 15', ['JAMES', 'Ⅳ, 14–15'])).toEqual(['JAS.4', 'JAS.4.14', 'JAS.4.15']);
    });

    it('no lee como capítulo lo que es otra cosa', () => {
        expect(refsDeFragmento('', ['JAMES', 'CHAPTER V.'])).toEqual([]);
        expect(refsDeFragmento('', ['JAMES', 'IV'])).toEqual([]);
        expect(refsDeFragmento('', ['JAMES', 'v. 11'])).toEqual([]);
        expect(refsDeFragmento('', ['JAMES', 'V. 11'])).toEqual([]);
        expect(refsDeFragmento('', ['JAMES', 'VI, 2'])).toEqual([]);
        // Sin libro en el contexto, no se adivina.
        expect(refsDeFragmento('', ['Ⅳ, 9–11'])).toEqual([]);
    });
});

/**
 * PR 2, unidad 3 (2026-11-07): Ropes (ICC) escribe el versículo en superíndice y
 * separa la lista con espacios. Textos tomados de sus hojas 291, 294 y 298.
 */
describe('versículos en superíndice (Ropes)', () => {
    it('con libro: «Mt. 19¹⁷» y la lista separada por espacios «Rom. 2¹ 14⁴»', () => {
        expect(refsDeTexto('Cf. Mt. 19¹⁷ εἷς ἐστὶν ὁ ἀγαθός.')).toEqual(['MAT.19', 'MAT.19.17']);
        expect(refsDeTexto('the thought of Rom. 2¹ 14⁴, but')).toEqual(['ROM.2', 'ROM.2.1', 'ROM.14', 'ROM.14.4']);
        expect(refsDeTexto('So nearly always in N. T., cf. Jas. 2⁷ 3¹³, Mt. 5¹⁶')).toEqual(['JAS.2', 'JAS.2.7', 'JAS.3', 'JAS.3.13', 'MAT.5', 'MAT.5.16']);
    });

    it('rango «2¹⁻⁶» y «1¹⁰ ᶠ˙»', () => {
        expect(refsDeTexto('Jas. 2¹⁻⁶')).toEqual(['JAS.2', 'JAS.2.1', 'JAS.2.2', 'JAS.2.3', 'JAS.2.4', 'JAS.2.5', 'JAS.2.6']);
        expect(refsDeTexto('Jas. 1¹⁰ ᶠ˙ the rich man')).toEqual(['JAS.1', 'JAS.1.10']);
    });

    it('sin libro, con el del encabezado: «cf. on 4¹³» y «5⁹» en Santiago', () => {
        expect(refsDeFragmento('**1. ἄγε νῦν οἱ πλούσιοι,** *cf.* on 4¹³. ὁ κριτής in 5⁹', ['JAMES', 'CHAPTER V.', 'Ⅳ, 17–Ⅴ, 1']))
            .toEqual(expect.arrayContaining(['JAS.4.13', 'JAS.5.9']));
    });

    it('REGRESIÓN (revisión del PR 2): la nota al pie tras «v. 4» o «p. 4» no es versículo', () => {
        expect(refsDeFragmento('In v. 4¹ he says', ['James 4'])).toContain('JAS.4.4');
        expect(refsDeFragmento('In v. 4¹ he says', ['James 4'])).not.toContain('JAS.4.1');
        expect(refsDeFragmento('see v. 14² below', ['James 5'])).toContain('JAS.5.14');
        expect(refsDeFragmento('cited at p. 4²', ['James 4'])).not.toContain('JAS.4.2');
        expect(refsDeFragmento('the word 4² here', ['James 4'])).not.toContain('JAS.4.2');
    });

    it('lo demás queda igual: año con superíndice, nota al pie tras una palabra, cita de siempre', () => {
        expect(refsDeTexto('Mayor, 1910², p. 4')).toEqual([]);
        expect(refsDeTexto('the rich¹ were Christians')).toEqual([]);
        expect(refsDeTexto('Santiago 5:14-15')).toEqual(['JAS.5', 'JAS.5.14', 'JAS.5.15']);
    });
});

/** PR 2, unidad 3: el aviso falso de Mayor h. 441 (B82). */
describe('capítulo en romanos tras el libro (Mayor)', () => {
    it('«1 Pet. v. 1» es 1 Pedro 5:1, y no deja un «v. 1» de Santiago', () => {
        const refs = refsDeFragmento('as in 1 Pet. v. 1, where the elder', ['NOTES', 'V 1] NOTES'], 'JAS');
        expect(refs).toContain('1PE.5.1');
        expect(refs.filter(r => r.startsWith('JAS'))).toEqual(['JAS.5', 'JAS.5.1']);
        expect(refsDeFragmento('as in 1 Pet. v. 3, where', ['NOTES', 'IV 2] NOTES'], 'JAS')).not.toContain('JAS.4.3');
    });
    it('«Rom. viii. 28» y la mayúscula «Jas. IV. 12»', () => {
        expect(refsDeTexto('cf. Rom. viii. 28')).toEqual(['ROM.8', 'ROM.8.28']);
        expect(refsDeTexto('Jas. IV. 12')).toEqual(['JAS.4', 'JAS.4.12']);
    });
    it('sin libro, «cf. v. 1» sigue siendo el versículo', () => {
        expect(refsDeFragmento('cf. v. 3 and i. 5', ['NOTES', 'IV 2] NOTES'], 'JAS')).toContain('JAS.4.3');
        for (const prosa of ['read in v. 3 here', 'this is v. 3', 'as v. 3 shows']) expect(refsDeTexto(prosa)).toEqual([]);
        // En el buscador no se exige mayúscula: ahí la salvaguarda es la única.
        expect(refsDeTexto('this is v. 3', { exigirMayuscula: false })).not.toContain('ISA.5.3');
    });
});

/** PR 2, unidad 3: los avisos falsos de Adamson (B82), con causa cerrada. */
describe('un rango de sección deja el capítulo, no sus versículos', () => {
    it('h. 199: el titulillo «5:1–18 CONCLUSION» no nombra 5:6', () => {
        const refs = refsDeFragmento('else." Thus the phrase can be related', ['CHAPTER 5', '5:1–18 CONCLUSION'], 'JAS');
        expect(refs).toEqual(['JAS.5']);
    });
    it('h. 200: «in 4:1–5:6» de paso no nombra 5:6', () => {
        expect(refsDeFragmento('From the stern rebukes of others in 4:1–5:6, James turns', ['CHAPTER 5'], 'JAS')).not.toContain('JAS.5.6');
    });
    it('hasta diez versículos siguen siendo de versículos: «5:1–6», «4:1-10»', () => {
        expect(refsDeFragmento('Santiago 5:1-6', [])).toContain('JAS.5.6');
        expect(refsDeFragmento('Santiago 4:1-10', [])).toContain('JAS.4.10');
        expect(refsDeFragmento('Santiago 4:1-11', [])).toEqual(['JAS.4']);
    });
    it('REGRESIÓN (revisión del PR 2): la consulta de una perícopa sí pide sus versículos', () => {
        expect(refsDeConsulta('santiago 3:1-12')).toHaveLength(13);
        expect(refsDeConsulta('santiago 5:1-18')).toContain('JAS.5.6');
    });
});
