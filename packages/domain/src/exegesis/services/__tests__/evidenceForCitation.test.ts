import { describe, it, expect } from 'vitest';
import { parsePageRange, prioritizeChunksForCitedPage, pagesOverlap } from '../evidenceForCitation';

/**
 * El caso medido en Sal 23:1: Craigie admitido en las hojas 205–210 (pp. 203–208),
 * cita a la p. 206, y el verificador con tope de 8 fragmentos veía solo hasta
 * la 205.
 */
const chunk = (page: number | null, i: number) => ({ text: `frag ${i}`, pageHint: page === null ? null : `p. ${page}` });
const CRAIGIE = [203, 203, 204, 204, 205, 205, 206, 206, 207, 207, 208].map(chunk);

describe('prioritizeChunksForCitedPage', () => {
    it('pone primero los fragmentos de la página citada y sus vecinas', () => {
        const out = prioritizeChunksForCitedPage(CRAIGIE, '206');
        expect(out.slice(0, 6).map(c => c.pageHint)).toEqual(['p. 205', 'p. 205', 'p. 206', 'p. 206', 'p. 207', 'p. 207']);
        expect(out).toHaveLength(CRAIGIE.length);
    });

    it('con un tope de 8, la página citada sobrevive al recorte (el defecto)', () => {
        const top8 = prioritizeChunksForCitedPage(CRAIGIE, '206').slice(0, 8);
        expect(top8.some(c => c.pageHint === 'p. 206')).toBe(true);
    });

    it('un rango citado cubre todas sus páginas', () => {
        const out = prioritizeChunksForCitedPage(CRAIGIE, '206–207');
        expect(out.slice(0, 7).map(c => c.pageHint)).toEqual(['p. 205', 'p. 205', 'p. 206', 'p. 206', 'p. 207', 'p. 207', 'p. 208']);
    });

    it('sin página citada no reordena', () => {
        expect(prioritizeChunksForCitedPage(CRAIGIE, null)).toEqual(CRAIGIE);
    });

    it('los fragmentos sin página van al final, no se pierden', () => {
        const conTexto = [...CRAIGIE, chunk(null, 99)];
        const out = prioritizeChunksForCitedPage(conTexto, '206');
        expect(out[out.length - 1]!.pageHint).toBeNull();
    });

    it('«hoja N» también cuenta como página cuando la cita habla en hojas', () => {
        const hojas = [{ text: 'a', pageHint: 'hoja 10' }, { text: 'b', pageHint: 'hoja 42' }];
        expect(prioritizeChunksForCitedPage(hojas, '42')[0]!.pageHint).toBe('hoja 42');
    });
});

describe('parsePageRange', () => {
    it('lee un número, un rango y un rango abreviado', () => {
        expect(parsePageRange('559')).toEqual({ start: 559, end: 559 });
        expect(parsePageRange('559–561')).toEqual({ start: 559, end: 561 });
        expect(parsePageRange('559-61')).toEqual({ start: 559, end: 561 });
        expect(parsePageRange('563–64')).toEqual({ start: 563, end: 564 });
    });
    it('una lista toma su primer tramo', () => {
        expect(parsePageRange('203, 206')).toEqual({ start: 203, end: 203 });
    });
    it('nada numérico es null', () => {
        expect(parsePageRange(null)).toBeNull();
        expect(parsePageRange('ccxxii')).toBeNull();
    });
});

describe('pagesOverlap — el mismo criterio para los tres verificadores', () => {
    it('la misma página, o una dentro del rango citado, coinciden', () => {
        expect(pagesOverlap('440', '440')).toBe(true);
        expect(pagesOverlap('559-562', '560')).toBe(true);
        expect(pagesOverlap('560', '559-562')).toBe(true);
    });

    it('un rango abreviado se lee entero: «559–61» es 559–561', () => {
        // Las copias que vivían en cada verificador leían 61 como final y
        // marcaban «página no coincide» sobre una cita correcta.
        expect(pagesOverlap('559–61', '560')).toBe(true);
    });

    it('páginas distintas no coinciden', () => {
        expect(pagesOverlap('440', '436')).toBe(false);
        expect(pagesOverlap('559-560', '562')).toBe(false);
    });

    it('sin número, se comparan como texto', () => {
        expect(pagesOverlap('ad loc.', 'ad loc.')).toBe(true);
        expect(pagesOverlap('ad loc.', 'ci')).toBe(false);
    });
});
