import { describe, expect, it } from 'vitest';
import { findQuoteInPageText } from '@dosfilos/domain';
import { foldForSearch, lemmaOccurrencesIn, occurrencesIn, snippetAround, soloConsonantes } from '../documentTextSearch';

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
