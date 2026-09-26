import { describe, expect, it } from 'vitest';
import { findQuoteInPageText } from '@dosfilos/domain';
import { foldForSearch, lemmaOccurrencesIn, occurrencesIn, snippetAround, soloConsonantes, referenceOccurrencesIn, referenceRegExp } from '../documentTextSearch';

/**
 * Los dos buscadores tienen que plegar IGUAL.
 *
 * Uno corre en el servidor sobre los fragmentos del libro y dice «está en
 * la hoja 454»; el otro corre en el navegador sobre la capa de texto de
 * esa hoja y la resalta. Si uno cuenta una palabra partida por el guion
 * del renglón y el otro no, el libro manda al lector a una hoja que
 * responde «sin coincidencias».
 */
describe('paridad con el buscador de la hoja abierta (@dosfilos/domain)', () => {
    const casos: Array<[string, string]> = [
        ['Polel', 'to restore (Polel for Piel) (lit., make restored)'],
        ['polel', 'The Polel functions as the Piel'],           // mayúsculas
        ['restored', 'make re-\nstored Jacob to him'],           // guion de renglón
        ['la casa', 'entró en lacasa'],                          // espacios
        ['"cita"', 'una «cita» entre comillas'],                 // comillas
    ];

    it.each(casos)('«%s» se encuentra en los dos lados', (termino, texto) => {
        expect(occurrencesIn(texto, foldForSearch(termino).text).length).toBeGreaterThan(0);
        expect(findQuoteInPageText(termino, texto)).not.toBeNull();
    });

    it('lo que no está, no está en ninguno de los dos', () => {
        const texto = 'The Hiphil delocutive pertains to the causing of an event.';
        expect(occurrencesIn(texto, foldForSearch('Polel').text)).toEqual([]);
        expect(findQuoteInPageText('Polel', texto)).toBeNull();
    });
});

describe('occurrencesIn', () => {
    it('cuenta todas las apariciones, no la primera', () => {
        expect(occurrencesIn('Polel, Polal y Polel otra vez', foldForSearch('polel').text)).toHaveLength(2);
    });

    it('las posiciones apuntan al texto original', () => {
        const texto = 'antes del Polel';
        const [at] = occurrencesIn(texto, foldForSearch('Polel').text);
        expect(texto.slice(at!, at! + 5)).toBe('Polel');
    });

    it('un término vacío no encuentra nada', () => {
        expect(occurrencesIn('cualquier cosa', '')).toEqual([]);
    });
});

describe('snippetAround', () => {
    it('devuelve una sola línea con el término dentro', () => {
        const texto = 'The same difference can be seen with שוב.\n2a. to restore (Polel for Piel) (lit., make restored) Jacob to him';
        const [at] = occurrencesIn(texto, foldForSearch('Polel').text);
        const s = snippetAround(texto, at!);
        expect(s).toContain('Polel');
        expect(s).not.toContain('\n');
    });

    it('marca con puntos suspensivos que hay más texto alrededor', () => {
        const largo = `${'x'.repeat(500)}Polel${'y'.repeat(500)}`;
        const s = snippetAround(largo, 500);
        expect(s.startsWith('…')).toBe(true);
        expect(s.endsWith('…')).toBe(true);
    });
});

describe('búsqueda por lema', () => {
    it('exige palabra entera: «שוב» no cuenta dentro de otra palabra', () => {
        const texto = 'וַיָּשׁוּבוּ el verbo compuesto';
        expect(lemmaOccurrencesIn(texto, soloConsonantes('שׁוּב'))).toEqual([]);
    });

    it('encuentra la entrada del léxico aunque las vocales no coincidan', () => {
        // El análisis escribe «שׁוּב»; el léxico encabeza «שוב».
        const entrada = '7725 שוב QAL: Volver, regresar';
        expect(lemmaOccurrencesIn(entrada, soloConsonantes('שׁוּב'))).toHaveLength(1);
    });

    it('cuenta todas las veces que la entrada nombra su lema', () => {
        const texto = 'נפש alma; נפש vida; נפשי mi alma';
        expect(lemmaOccurrencesIn(texto, soloConsonantes('נֶפֶשׁ'))).toHaveLength(2);
    });

    it('un lema sin consonantes no busca nada', () => {
        expect(lemmaOccurrencesIn('cualquier texto', soloConsonantes('...'))).toEqual([]);
    });
});

describe('modo referencia — dónde nombra el libro al pasaje', () => {
    const NOMBRES = ['santiago', 'james', 'stg', 'jas', 'sant', 'jam'];
    const santiago2 = (c: number, v: number) => c === 2 && v >= 1 && v <= 13;
    const buscar = (texto: string) =>
        referenceOccurrencesIn(texto, referenceRegExp(NOMBRES), santiago2);

    it('encuentra la cita tal como Wallace la escribe', () => {
        // El caso testigo: la hoja 515 de Wallace, donde discute el participio
        // adverbial de 2:9 y dice «otra opción posible es la de resultado».
        const r = buscar('Santiago 2:9 εἰ δὲ προσωπολημπτεῖτε, ἁμαρτίαν ἐργάζεσθε');
        expect(r.verses).toEqual([9]);
        expect(r.at).toHaveLength(1);
    });

    it('y las grafías abreviadas que usan el léxico y la gramática', () => {
        expect(buscar('la partícula aparece en Stg. 2.8 y en otros').verses).toEqual([8]);
        expect(buscar('cf. Jas 2:2 for the example').verses).toEqual([2]);
        expect(buscar('James 2 : 9 con el corte de renglón').verses).toEqual([9]);
    });

    it('un versículo de otro capítulo del mismo libro NO cuenta', () => {
        // Porter cita «Jas. 5:2-3» en la hoja 41 como ejemplo de otra cosa.
        // Ocho de once tramos propuestos entraron por citas así.
        expect(buscar('como en Jas. 5:2-3, el perfecto').verses).toEqual([]);
        expect(buscar('Santiago 2:14 ya es otro párrafo').verses).toEqual([]);
    });

    it('una hoja que discute varios versículos los reporta todos', () => {
        const r = buscar('compárese Santiago 2:2 con Stg. 2:4 y con 2:6');
        expect(r.verses).toEqual([2, 4]);
    });

    it('un nombre que no es el del libro no dispara nada', () => {
        expect(buscar('Juan 2:9 convirtió el agua en vino').verses).toEqual([]);
    });

    it('la grafía más larga gana, aunque llegue última en la lista', () => {
        // La alternancia de JavaScript se queda con la PRIMERA que entra. Con
        // «jas» antes que «james», el motor consume «jas» de «james 2:9»,
        // falla al pedir la cifra contra la «e», y la cita se pierde.
        const alReves = referenceRegExp(['jas', 'jam', 'james']);
        expect(referenceOccurrencesIn('James 2:9 dice', alReves, santiago2).verses).toEqual([9]);
        expect(referenceOccurrencesIn('Jas 2:9 dice', alReves, santiago2).verses).toEqual([9]);
    });

    it('las grafías se escapan: un punto del alias no es comodín', () => {
        // Sin escapar, «s.g» de un alias con punto haría de «sog 2:9» una cita.
        expect(referenceOccurrencesIn('sxg 2:9', referenceRegExp(['s.g']), santiago2).verses).toEqual([]);
        expect(referenceOccurrencesIn('s.g 2:9', referenceRegExp(['s.g']), santiago2).verses).toEqual([9]);
    });
});
