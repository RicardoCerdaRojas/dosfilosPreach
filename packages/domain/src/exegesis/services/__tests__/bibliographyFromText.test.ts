import { describe, expect, it } from 'vitest';
import {
    completeWithProposal,
    frontMatterOf,
    isbnsIn,
    keepOnlyWhatIsWritten,
    proposeIsbn,
} from '../bibliographyFromText';

const CREDITOS = [
    'A Commentary on the Psalms',
    'Volume 1: 1—41',
    'Kregel Exegetical Library',
    'Allen P. Ross',
    '© 2011 by Allen P. Ross',
    'Published by Kregel Publications, Grand Rapids, Michigan 49501',
    'ISBN 978-0-8254-2562-2',
].join('\n');

describe('frontMatterOf', () => {
    it('devuelve el arranque cuando ahí están los créditos', () => {
        expect(frontMatterOf(CREDITOS)).toBe(CREDITOS);
    });

    it('persigue la página de créditos cuando detrás de un índice largo', () => {
        // Salido de ejemplares reales: abren con veinte páginas de índice y
        // la portada legal queda fuera de las primeras letras.
        const indice = 'Contenido '.repeat(300);
        const tramo = frontMatterOf(`${indice}${CREDITOS}`, 500);
        expect(tramo).toContain('Kregel Publications');
        expect(tramo).toContain('[…]');
    });

    it('no persigue nada cuando el libro no trae créditos: el cuerpo no es portada', () => {
        // Una editorial nombrada en el cuerpo es la de OTRO libro citado.
        const cuerpo = 'El salmista abre con una confesión personal. '.repeat(200);
        const tramo = frontMatterOf(cuerpo, 500);
        expect(tramo).toHaveLength(500);
        expect(tramo).not.toContain('[…]');
    });

    it('un texto vacío no tiene portada', () => {
        expect(frontMatterOf('')).toBe('');
    });
});

describe('isbnsIn', () => {
    it('lee el ISBN de trece con guiones', () => {
        expect(isbnsIn(CREDITOS)).toEqual(['9780825425622']);
    });

    it('lee el ISBN de diez, incluida la X de control', () => {
        expect(isbnsIn('ISBN: 0-8254-3548-X')).toEqual(['082543548X']);
    });

    it('descarta la tira de dígitos que no valida: apuntaría a otra edición', () => {
        // Sin dígito de control, cualquier número de un índice pasa por
        // ISBN, y un ISBN equivocado trae los datos de OTRO ejemplar.
        expect(isbnsIn('ISBN 978-0-8254-2562-9')).toEqual([]);
        expect(isbnsIn('1234567890123456')).toEqual([]);
    });
});

describe('keepOnlyWhatIsWritten', () => {
    it('acepta lo que está impreso en la portada', () => {
        const { data, discarded } = keepOnlyWhatIsWritten({
            author: 'Allen P. Ross',
            title: 'A Commentary on the Psalms',
            city: 'Grand Rapids',
            publisher: 'Kregel Publications',
            year: '2011',
        }, CREDITOS);
        expect(data.publisher).toBe('Kregel Publications');
        expect(data.year).toBe('2011');
        expect(discarded).toEqual([]);
    });

    it('descarta el dato que el modelo sabe de memoria pero el libro no dice', () => {
        // ESTE es el defecto que el módulo existe para evitar: en el trabajo
        // de Salmo 23 la ciudad y el año salieron del modelo y hubo que
        // corregirlos a mano contra los ejemplares.
        const { data, discarded } = keepOnlyWhatIsWritten({
            title: 'A Commentary on the Psalms',
            city: 'Nashville',
            publisher: 'Zondervan',
        }, CREDITOS);
        expect(data.title).toBe('A Commentary on the Psalms');
        expect(data.city).toBeUndefined();
        expect(data.publisher).toBeUndefined();
        expect(discarded).toEqual(['city', 'publisher']);
    });

    it('cruza el salto de línea del PDF: el título partido sigue siendo el título', () => {
        const partido = 'A Commentary\non the   Psalms';
        const { data } = keepOnlyWhatIsWritten({ title: 'A Commentary on the Psalms' }, partido);
        expect(data.title).toBe('A Commentary on the Psalms');
    });

    it('ignora acentos y mayúsculas: la portada grita y la ficha no', () => {
        const { data } = keepOnlyWhatIsWritten(
            { publisher: 'Ediciones Sígueme', city: 'Salamanca' },
            'EDICIONES SIGUEME, S.A.U.\nSALAMANCA 2019',
        );
        expect(data.publisher).toBe('Ediciones Sígueme');
        expect(data.city).toBe('Salamanca');
    });

    it('acepta el nombre ordenado porque solo reordena lo ya aceptado', () => {
        const { data } = keepOnlyWhatIsWritten(
            { author: 'Allen P. Ross', authorSorted: 'Ross, Allen P.' },
            CREDITOS,
        );
        expect(data.authorSorted).toBe('Ross, Allen P.');
    });

    it('descarta el nombre ordenado que agrega un nombre que nadie escribió', () => {
        const { data, discarded } = keepOnlyWhatIsWritten(
            { author: 'Allen P. Ross', authorSorted: 'Ross, Allen Patrick' },
            CREDITOS,
        );
        expect(data.authorSorted).toBeUndefined();
        expect(discarded).toContain('authorSorted');
    });

    it('acepta el título corto solo si sale de recortar el largo', () => {
        const bueno = keepOnlyWhatIsWritten(
            { title: 'A Commentary on the Psalms', shortTitle: 'Commentary on the Psalms' },
            CREDITOS,
        );
        expect(bueno.data.shortTitle).toBe('Commentary on the Psalms');

        const malo = keepOnlyWhatIsWritten(
            { title: 'A Commentary on the Psalms', shortTitle: 'Psalms Commentary' },
            CREDITOS,
        );
        expect(malo.data.shortTitle).toBeUndefined();
    });

    it('descarta el año imposible aunque esté escrito', () => {
        // «1 2 3» de una numeración de página pliega a algo que el texto
        // contiene; el año de imprenta tiene un rango.
        const { discarded } = keepOnlyWhatIsWritten({ year: '0123' }, 'página 0123 del índice');
        expect(discarded).toContain('year');
    });

    it('descarta el párrafo entero colado como editorial', () => {
        const parrafo = 'x'.repeat(400);
        const { discarded } = keepOnlyWhatIsWritten({ publisher: parrafo }, parrafo);
        expect(discarded).toContain('publisher');
    });

    it('sin propuesta no hay ficha', () => {
        expect(keepOnlyWhatIsWritten(null, CREDITOS).data).toEqual({});
    });
});

describe('completeWithProposal', () => {
    it('llena los huecos y no pisa lo que la persona escribió', () => {
        // Quien tiene el ejemplar en la mano gana: el lector solo vio el PDF.
        const { data, filled } = completeWithProposal(
            { city: 'Grand Rapids', publisher: 'Kregel' },
            { city: 'Michigan', publisher: 'Kregel Publications', year: '2011' },
        );
        expect(data.city).toBe('Grand Rapids');
        expect(data.publisher).toBe('Kregel');
        expect(data.year).toBe('2011');
        expect(filled).toEqual(['year']);
    });

    it('sobre una ficha vacía llena todo', () => {
        const { filled } = completeWithProposal(null, { title: 'Salmos', year: '2011' });
        expect(filled).toEqual(['title', 'year']);
    });
});

describe('proposeIsbn', () => {
    it('propone el ISBN cuando el libro declara uno solo', () => {
        expect(proposeIsbn(CREDITOS)).toBe('9780825425622');
    });

    it('no propone nada cuando hay varios: tapa dura y rústica no comparten tirada', () => {
        const dos = 'ISBN 978-0-8254-2562-2 (hardcover)\nISBN 0-8499-1234-2 (ebook)';
        expect(proposeIsbn(dos)).toBeNull();
    });

    it('no propone nada cuando el libro no trae ISBN', () => {
        expect(proposeIsbn('Salamanca: Ediciones Sígueme, 2019')).toBeNull();
    });
});

describe('invariantes del tramo que se manda al modelo', () => {
    it('el tramo nunca pasa del arranque más la ventana de los créditos', () => {
        // Ata las cuatro constantes que deciden el tamaño: subir una sin
        // mirar las otras engordaría el prompt en silencio.
        const enorme = `${'a'.repeat(200_000)}ISBN 978-0-8254-2562-2${'b'.repeat(50_000)}`;
        expect(frontMatterOf(enorme).length).toBeLessThan(25_000);
    });

    it('cabe de sobra en lo que el extractor guarda del libro', () => {
        // `textContent` se corta a 800 KB y los créditos viven al principio:
        // si el tramo creciera hasta ahí, leeríamos cuerpo del libro.
        expect(frontMatterOf('x'.repeat(900_000)).length).toBeLessThan(800_000);
    });
});

describe('isbnsIn, casos del mundo real', () => {
    it('lee el ISBN escondido en la URL del catálogo de la editorial', () => {
        // Medido en el ejemplar de Arnold: el único ISBN del libro está en
        // «www.cambridge.org/9780521826099», sin la palabra ISBN al lado.
        expect(isbnsIn('Information on this title: www.cambridge.org/9780521826099')).toEqual(['9780521826099']);
    });

    it('no toma por ISBN un número suelto de diez dígitos', () => {
        // Uno de cada once pasa la comprobación por azar. Sin la palabra
        // «ISBN» al lado no hay razón para creerle a una tira de dígitos.
        expect(isbnsIn('Library of Congress 2010028703 y el número 0852440014')).toEqual([]);
    });
});
