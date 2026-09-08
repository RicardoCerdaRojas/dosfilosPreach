import { describe, it, expect } from 'vitest';
import {
    OSIS_TO_BOOK_ID,
    bookIdFromOsis,
    osisFromBookId,
    parseOsisRef,
} from '../osisBookCodes';
import { BIBLE_CANON } from '../../canon/BibleCanon';

describe('OSIS_TO_BOOK_ID', () => {
    it('cubre los 66 libros del canon, sin faltar ni sobrar ninguno', () => {
        const mapeados = new Set(Object.values(OSIS_TO_BOOK_ID));
        expect(mapeados.size).toBe(66);
        for (const libro of BIBLE_CANON) {
            expect(mapeados.has(libro.id)).toBe(true);
        }
    });

    it('no repite un id del canon en dos códigos OSIS distintos', () => {
        const ids = Object.values(OSIS_TO_BOOK_ID);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('mantiene el orden canónico, que es como se derivó', () => {
        const ids = Object.values(OSIS_TO_BOOK_ID);
        const canonico = BIBLE_CANON.map(l => l.id);
        expect(ids).toEqual(canonico);
    });
});

describe('bookIdFromOsis', () => {
    it('resuelve los códigos que la tabla de alias no resolvía', () => {
        // Estos 45 fallaban con `resolveBibleBook`: la tabla de alias está
        // pensada para texto libre en castellano, no para códigos OSIS.
        expect(bookIdFromOsis('Jonah')).toBe('JON');
        expect(bookIdFromOsis('1Sam')).toBe('1SA');
        expect(bookIdFromOsis('Phlm')).toBe('PHM');
        expect(bookIdFromOsis('Song')).toBe('SNG');
        expect(bookIdFromOsis('Ps')).toBe('PSA');
        expect(bookIdFromOsis('Matt')).toBe('MAT');
        expect(bookIdFromOsis('Rev')).toBe('REV');
    });

    it('devuelve null para los deuterocanónicos, que no son un error', () => {
        // Aparecen en las fuentes como referencias legítimas; la app no los
        // indexa. Distinguirlo de un fallo de lectura importa: uno se ignora,
        // el otro se investiga.
        for (const codigo of ['Sir', 'Tob', 'Wis', '1Macc', '2Macc', '3Macc']) {
            expect(bookIdFromOsis(codigo)).toBeNull();
        }
    });

    it('nunca adivina ante un código desconocido', () => {
        expect(bookIdFromOsis('Genesis')).toBeNull();
        expect(bookIdFromOsis('')).toBeNull();
        expect(bookIdFromOsis('GEN')).toBeNull();
    });
});

describe('osisFromBookId', () => {
    it('es la inversa exacta para los 66', () => {
        for (const [osis, id] of Object.entries(OSIS_TO_BOOK_ID)) {
            expect(osisFromBookId(id)).toBe(osis);
        }
    });
});

describe('parseOsisRef', () => {
    it('lee una referencia a versículo', () => {
        expect(parseOsisRef('Bible:Jonah.1.17')).toEqual({
            bookId: 'JON', chapter: 1, verse: 17,
        });
    });

    it('lee una referencia a capítulo entero', () => {
        expect(parseOsisRef('Bible:Jonah.2')).toEqual({
            bookId: 'JON', chapter: 2, verse: null,
        });
    });

    it('de un rango toma el extremo inicial, que es el ancla del bloque', () => {
        expect(parseOsisRef('Bible:Jonah.1.1-Jonah.1.17')).toEqual({
            bookId: 'JON', chapter: 1, verse: 1,
        });
    });

    it('funciona sin el prefijo Bible:', () => {
        expect(parseOsisRef('Rom.8.28')).toEqual({
            bookId: 'ROM', chapter: 8, verse: 28,
        });
    });

    it('devuelve null cuando el libro está fuera del canon o no se entiende', () => {
        expect(parseOsisRef('Bible:Sir.3.1')).toBeNull();
        expect(parseOsisRef('cualquier cosa')).toBeNull();
        expect(parseOsisRef('')).toBeNull();
    });
});
