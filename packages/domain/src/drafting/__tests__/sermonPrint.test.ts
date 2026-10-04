import { describe, expect, it } from 'vitest';
import { sermonFileName, sermonPrintAuthor } from '../sermonPrint';

describe('sermonPrintAuthor', () => {
    it('el nombre que escribió el pastor manda', () => {
        expect(sermonPrintAuthor('Ricardo Cerda', 'rdocerda')).toBe('Ricardo Cerda');
    });

    it('«Pastor» es el relleno de fábrica: vale el nombre de la cuenta', () => {
        expect(sermonPrintAuthor('Pastor', 'Ricardo Cerda')).toBe('Ricardo Cerda');
        expect(sermonPrintAuthor('  ', 'Ricardo Cerda')).toBe('Ricardo Cerda');
    });

    it('sin nombre propio ni de cuenta, la hoja no nombra a nadie', () => {
        expect(sermonPrintAuthor('Pastor', null)).toBeNull();
        expect(sermonPrintAuthor(undefined, '  ')).toBeNull();
    });
});

describe('sermonFileName', () => {
    it('sin tildes ni signos, con guiones', () => {
        expect(sermonFileName('Compasión temporal vs misericordia universal', 'pdf'))
            .toBe('compasion-temporal-vs-misericordia-universal.pdf');
        expect(sermonFileName('¿Por qué te enojas? (Jonás 4:9)', 'docx')).toBe('por-que-te-enojas-jonas-4-9.docx');
    });

    it('un título sin letras no deja el archivo sin nombre', () => {
        expect(sermonFileName('¡¿…?!', 'pdf')).toBe('sermon.pdf');
    });
});
