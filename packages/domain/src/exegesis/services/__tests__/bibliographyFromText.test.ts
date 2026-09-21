import { describe, expect, expectTypeOf, it } from 'vitest';
import type { BibliographicData } from '../bibliography';
import { BIBLIOGRAPHY_FIELDS, type BibliographyField } from '../bibliography';
import {
    CORTE_VISIBLE,
    LETRAS_DE_ARRANQUE,
    VENTANA_ANTES,
    VENTANA_DESPUES,
    completeWithProposal,
    creditsRegionOf,
    MARCA_DE_HOJA,
    frontMatterOf,
    readableRegionsOf,
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
        expect(tramo).not.toContain(CORTE_VISIBLE);
    });

    it('un texto vacío no tiene portada', () => {
        expect(frontMatterOf('')).toBe('');
    });
});

describe('isbnsIn', () => {
    it('lee el ISBN de trece con guiones', () => {
        expect(isbnsIn(CREDITOS)).toEqual(['9780825425622']);
    });

    it('el de diez vuelve en trece: es la otra notación del mismo ejemplar', () => {
        expect(isbnsIn('ISBN: 0-8254-3548-X')).toEqual(['9780825435485']);
    });

    it('el par de trece y diez del mismo libro es UN ISBN, no dos', () => {
        // Medio catálogo de los años 2005-2012 imprime los dos, uno debajo
        // del otro. Tomarlos por ediciones distintas dejaba sin ISBN justo
        // a los libros que sí lo declaran.
        expect(isbnsIn('ISBN 978-0-8254-2562-2\nISBN 0-8254-2562-X')).toEqual(['9780825425622']);
    });

    it('la etiqueta con número no se cuela dentro del ISBN', () => {
        expect(isbnsIn('ISBN-13: 978-0-8254-2562-2')).toEqual(['9780825425622']);
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
            '© EDICIONES SIGUEME, S.A.U.\nSALAMANCA 2019',
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

    it('descarta el pie de imprenta de OTRO libro citado en el prefacio', () => {
        // El defecto que encontró la revisión del PR #656: comprobar contra
        // todo el arranque no comprueba nada, porque el prefacio cita otros
        // libros con su ciudad, su editorial y su año. La ficha salía
        // completa, verosímil y falsa, y con el rótulo «del libro».
        const conPrefacio = [
            'A Commentary on the Psalms',
            'Allen P. Ross',
            '© 2011 by Allen P. Ross',
            'Published by Kregel Publications, Grand Rapids, Michigan',
            // Entre la página legal y el prefacio van la dedicatoria y el
            // índice. Esa separación es lo que compran las ventanas: un
            // prefacio pegado a la página legal sigue siendo un límite.
            'CONTENIDO '.repeat(300),
            'PREFACIO',
            'Como bien dice Walter Brueggemann, The Message of the Psalms',
            '(Minneapolis: Augsburg, 1984), el salterio es el libro de oración.',
        ].join('\n');
        const { data, discarded } = keepOnlyWhatIsWritten({
            author: 'Walter Brueggemann',
            title: 'The Message of the Psalms',
            city: 'Minneapolis',
            publisher: 'Augsburg',
            year: '1984',
        }, conPrefacio);
        expect(data).toEqual({});
        expect(discarded).toEqual(['author', 'title', 'city', 'publisher', 'year']);
    });

    it('sin página de créditos no hay ciudad, editorial ni año', () => {
        // Un ejemplar sin portada legal no dice quién lo publicó. El hueco
        // es la respuesta correcta; rellenarlo sería inventar.
        const sinCreditos = 'Lexicón Hebreo-Arameo-Español\nא La letra Alef toma su nombre…';
        const { data, discarded } = keepOnlyWhatIsWritten(
            { title: 'Lexicón Hebreo-Arameo-Español', city: 'Miami', publisher: 'Vida', year: '2000' },
            sinCreditos,
        );
        expect(data.title).toBe('Lexicón Hebreo-Arameo-Español');
        expect(discarded).toEqual(['city', 'publisher', 'year']);
    });

    it('acepta el nombre ordenado de un libro de DOS autores, con sus comas', () => {
        // Exigir la vuelta exacta partiendo por la primera coma descartaba
        // este campo, `formatBibliographyEntry` caía en la propuesta
        // automática y la bibliografía salía con «Choi, Bill T. Arnold and
        // John H.» impreso. Una entrada desordenada se ve en la vista
        // previa; esa basura llega al trabajo entregado.
        const { data } = keepOnlyWhatIsWritten(
            {
                author: 'Bill T. Arnold and John H. Choi',
                authorSorted: 'Arnold, Bill T., and John H. Choi',
            },
            'Bill T. Arnold and John H. Choi\n© 2003 Cambridge University Press',
        );
        expect(data.authorSorted).toBe('Arnold, Bill T., and John H. Choi');
    });

    it('acepta el nombre que la portada ya imprime invertido', () => {
        const { data } = keepOnlyWhatIsWritten(
            { author: 'Ross, Allen P.', authorSorted: 'Ross, Allen P.' },
            CREDITOS.replace('Allen P. Ross', 'Ross, Allen P.'),
        );
        expect(data.authorSorted).toBe('Ross, Allen P.');
    });

    it('descarta el nombre ordenado que repite una palabra', () => {
        const { data } = keepOnlyWhatIsWritten(
            { author: 'Allen P. Ross', authorSorted: 'Ross, Ross Ross' },
            CREDITOS,
        );
        expect(data.authorSorted).toBeUndefined();
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
    it('el tramo mide exactamente el arranque más la ventana de los créditos', () => {
        // Ata las cuatro constantes que deciden el tamaño del prompt. Con
        // una cota floja, subir el arranque de 12.000 a 15.000 pasaba igual
        // y el prompt engordaba en silencio.
        const enorme = `${'a'.repeat(30_000)}ISBN 978-0-8254-2562-2${'b'.repeat(50_000)}`;
        expect(frontMatterOf(enorme)).toHaveLength(
            LETRAS_DE_ARRANQUE + CORTE_VISIBLE.length + VENTANA_ANTES + VENTANA_DESPUES,
        );
    });

    it('sin marca de créditos no se persigue nada: el tramo es el arranque', () => {
        expect(frontMatterOf('x'.repeat(900_000))).toHaveLength(LETRAS_DE_ARRANQUE);
    });

    it('no se persigue la marca más allá del tramo de búsqueda', () => {
        // Pasadas 60.000 letras ya es cuerpo del libro, y una editorial
        // nombrada en el cuerpo es la de otro libro citado.
        const lejos = `${'a'.repeat(70_000)}© 2011 by Kregel Publications`;
        expect(frontMatterOf(lejos)).toHaveLength(LETRAS_DE_ARRANQUE);
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

describe('creditsRegionOf', () => {
    it('devuelve vacío cuando el ejemplar no tiene página de créditos', () => {
        expect(creditsRegionOf('Lexicón Hebreo-Arameo-Español\nא Alef…')).toBe('');
    });

    it('trae lo de alrededor de la marca, que es donde vive el pie de imprenta', () => {
        const region = creditsRegionOf(CREDITOS);
        expect(region).toContain('Kregel Publications');
        expect(region).toContain('Grand Rapids');
    });
});

describe('la lista de campos del formulario', () => {
    it('cubre todos los campos de la ficha', () => {
        // `satisfies` comprueba que cada nombre exista, no que estén todos:
        // un campo nuevo en `BibliographicData` desaparecería del formulario
        // sin que nada se quejara.
        expectTypeOf<Exclude<keyof BibliographicData, BibliographyField>>().toEqualTypeOf<never>();
        expect(BIBLIOGRAPHY_FIELDS.length).toBeGreaterThan(0);
    });
});

/** Un libro de verdad, tal como lo deja el extractor: por hojas. */
const porHojas = (...hojas: string[]) => hojas.map((h, i) => `[PAGE ${i + 1}]\n${h}`).join('\n\n');

const HOJA_LEGAL = [
    '© 2011 by Allen P. Ross',
    'Published by Kregel Publications, Grand Rapids, Michigan 49501',
    'All rights reserved. Printed in the United States of America.',
    'Library of Congress Cataloging-in-Publication Data',
    'ISBN 978-0-8254-2562-2',
].join('\n');

const HOJA_DE_PREFACIO = [
    'PREFACIO',
    'Como bien dice Walter Brueggemann, The Message of the Psalms',
    '(Minneapolis: Augsburg, 1984), el salterio es el libro de oración.',
].join('\n');

describe('readableRegionsOf, recortando por hojas', () => {
    it('el prefacio NO entra, aunque venga pegado a la hoja legal', () => {
        // El defecto que sobrevivió al primer arreglo: con ventanas de
        // letras, un prefacio pegado a la página legal caía dentro de los
        // dos tramos y la ficha de Brueggemann salía aceptada entera.
        const libro = porHojas('A Commentary on the Psalms\nAllen P. Ross', HOJA_LEGAL, HOJA_DE_PREFACIO);
        const { cover, credits } = readableRegionsOf(libro);
        expect(cover).not.toContain('Brueggemann');
        expect(credits).not.toContain('Brueggemann');
        expect(credits).toContain('Kregel Publications');
    });

    it('y por eso la ficha de ese otro libro se descarta entera', () => {
        const libro = porHojas('A Commentary on the Psalms\nAllen P. Ross', HOJA_LEGAL, HOJA_DE_PREFACIO);
        const { data, discarded } = keepOnlyWhatIsWritten({
            author: 'Walter Brueggemann',
            title: 'The Message of the Psalms',
            city: 'Minneapolis',
            publisher: 'Augsburg',
            year: '1984',
        }, libro);
        expect(data).toEqual({});
        expect(discarded).toEqual(['author', 'title', 'city', 'publisher', 'year']);
    });

    it('un índice que nombra el copyright no se toma por la hoja legal', () => {
        // «Copyright and Permissions .... iv» trae UNA señal. Tomarla por
        // la página legal apagaba la lectura del libro entero.
        const libro = porHojas(
            'CONTENTS\nCopyright and Permissions .... iv\nPreface .... v',
            'A Commentary on the Psalms\nAllen P. Ross',
            HOJA_LEGAL,
        );
        expect(readableRegionsOf(libro).credits).toContain('Kregel Publications');
    });

    it('las páginas de elogios no empujan la portada fuera del tramo', () => {
        // Una sección de elogios de Kregel o Baker pasa de 2.500 letras y
        // dejaba al libro sin autor ni título.
        const elogios = 'Elogios para este libro. '.repeat(120);
        const libro = porHojas(elogios, 'A Commentary on the Psalms\nAllen P. Ross', HOJA_LEGAL);
        const { data } = keepOnlyWhatIsWritten(
            { author: 'Allen P. Ross', title: 'A Commentary on the Psalms' },
            libro,
        );
        expect(data.author).toBe('Allen P. Ross');
        expect(data.title).toBe('A Commentary on the Psalms');
    });

    it('el ISBN al final de una hoja legal larga sigue dentro del tramo', () => {
        // La maqueta corriente en EE. UU. pone permisos y catalogación
        // entre el copyright y el ISBN; recortar a 1.200 letras desde la
        // marca se llevaba puestos el ISBN y el pie de imprenta.
        const legalLarga = [
            '© 2011 by Allen P. Ross',
            'All rights reserved. '.repeat(60),
            'Scripture quotations are taken from… '.repeat(20),
            'Published by Kregel Publications, Grand Rapids, Michigan 49501',
            'ISBN 978-0-8254-2562-2',
        ].join('\n');
        const libro = porHojas('A Commentary on the Psalms', legalLarga, HOJA_DE_PREFACIO);
        const { credits } = readableRegionsOf(libro);
        expect(proposeIsbn(credits)).toBe('9780825425622');
        expect(credits).toContain('Grand Rapids');
    });

    it('la hoja legal viaja con la anterior: el dato se parte entre las dos', () => {
        // Waltke-O'Connor imprime editorial y ciudad en la portadilla y el
        // copyright en la hoja siguiente.
        const libro = porHojas(
            'An Introduction to Biblical Hebrew Syntax',
            'Eisenbrauns\nWinona Lake, Indiana\n1990',
            '©1990 by Eisenbrauns. All rights reserved.\nPrinted in the United States of America.\nLibrary of Congress Cataloging-in-Publication Data',
        );
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Winona Lake', publisher: 'Eisenbrauns', year: '1990' },
            libro,
        );
        expect(data).toEqual({ city: 'Winona Lake', publisher: 'Eisenbrauns', year: '1990' });
    });

    it('un ejemplar sin hoja legal no produce pie de imprenta', () => {
        const libro = porHojas('Lexicón Hebreo-Arameo-Español', 'א Alef…', 'ב Bet…');
        expect(readableRegionsOf(libro).credits).toBe('');
    });

    it('sin marcas de hoja se vuelve al recorte por letras', () => {
        // Medido: 13 de 68 recursos no las traen.
        const { cover } = readableRegionsOf(CREDITOS);
        expect(cover).toContain('Kregel Publications');
    });
});

describe('la colección y la edición valen en cualquiera de los dos tramos', () => {
    it('la colección impresa solo en el bloque de catalogación se acepta', () => {
        const libro = porHojas(
            'A Commentary on the Psalms',
            `${HOJA_LEGAL}\nKregel Exegetical Library`,
            HOJA_DE_PREFACIO,
        );
        const { data } = keepOnlyWhatIsWritten({ series: 'Kregel Exegetical Library' }, libro);
        expect(data.series).toBe('Kregel Exegetical Library');
    });

    it('la edición y el traductor impresos en la portadilla se aceptan', () => {
        const libro = porHojas(
            'Comentario a los Salmos\nSegunda edición\nTraducido por Pedro Vega',
            '© 1998 Editorial Herder\nBarcelona\nISBN 978-0-8254-2562-2\nAll rights reserved',
            HOJA_DE_PREFACIO,
        );
        const { data } = keepOnlyWhatIsWritten(
            { edition: 'Segunda edición', translator: 'Pedro Vega', city: 'Barcelona', publisher: 'Editorial Herder' },
            libro,
        );
        expect(data.edition).toBe('Segunda edición');
        expect(data.translator).toBe('Pedro Vega');
        expect(data.city).toBe('Barcelona');
    });
});

describe('cuál hoja es la legal', () => {
    const LEGAL_PROPIA = '© 2011 Kregel Publications, Grand Rapids, Michigan\nISBN 978-0-8254-2562-2';
    const OTROS_TITULOS = [
        'OTROS TÍTULOS DE ESTA COLECCIÓN',
        'The Message of the Psalms, © 1984 Augsburg, Minneapolis. Printed in the USA.',
    ].join('\n');

    it('la hoja de «otros títulos» no le gana a la página legal', () => {
        // Trae copyright, ciudad, editorial y año de OTROS libros, va
        // delante, y con el puntaje a secas empataba y ganaba por ser la
        // primera: volvía a salir la ficha ajena completa.
        const libro = porHojas('A Commentary on the Psalms', OTROS_TITULOS, LEGAL_PROPIA);
        const { credits } = readableRegionsOf(libro);
        expect(credits).toContain('Kregel');
        expect(credits).not.toContain('Augsburg');
    });

    it('y por eso la ficha de ese otro libro se descarta', () => {
        const libro = porHojas('A Commentary on the Psalms', OTROS_TITULOS, LEGAL_PROPIA);
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Minneapolis', publisher: 'Augsburg', year: '1984' },
            libro,
        );
        expect(data).toEqual({});
    });

    it('la hoja anterior no viaja cuando es un prefacio', () => {
        // Logos, Kindle y varias reimpresiones ponen el copyright DESPUÉS
        // del prefacio de serie. La hoja anterior entraba gratis y con
        // ella los libros que ese prefacio cita.
        const libro = porHojas('A Commentary on the Psalms', HOJA_DE_PREFACIO, LEGAL_PROPIA);
        expect(readableRegionsOf(libro).credits).not.toContain('Brueggemann');
    });

    it('la página legal escueta hispanoamericana vale con una sola seña', () => {
        // «© 2011 Editorial Portavoz / Grand Rapids» es una página legal
        // entera. Exigirle dos señas la dejaba fuera.
        const libro = porHojas('Comentario', '© 2011 Editorial Portavoz\nGrand Rapids, Michigan', HOJA_DE_PREFACIO);
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Grand Rapids', publisher: 'Editorial Portavoz', year: '2011' },
            libro,
        );
        expect(data.publisher).toBe('Editorial Portavoz');
        expect(data.year).toBe('2011');
    });

    it('el catálogo de la colección no gana por traer un ISBN ajeno', () => {
        // El ISBN parecía seña de página legal propia, y un catálogo de
        // colección lista ISBN: eso es lo que hace un catálogo. Le ganaba
        // a la página legal escueta y devolvía la ficha del otro libro.
        const catalogo = 'OTROS TÍTULOS DE LA COLECCIÓN\nBrueggemann, The Message of the Psalms. '
            + 'Augsburg, Minneapolis, 1984. ISBN 978-0-8066-2120-7';
        const libro = porHojas('Comentario', catalogo, '© 2011 Editorial Portavoz\nGrand Rapids, Michigan');
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Minneapolis', publisher: 'Augsburg', year: '1984' },
            libro,
        );
        expect(data).toEqual({});
        const propia = keepOnlyWhatIsWritten({ publisher: 'Editorial Portavoz', year: '2011' }, libro);
        expect(propia.data.publisher).toBe('Editorial Portavoz');
    });

    it('la nota de permisos de la versión bíblica no es la página legal', () => {
        // «Reservados todos los derechos» va en toda nota de permiso de
        // una versión bíblica, y es de Bíblica, no del ejemplar.
        const permisos = 'Las citas bíblicas son de la Nueva Versión Internacional NVI\n'
            + 'Copyright © 1999, 2015 por Biblica, Inc.\nUsada con permiso. Reservados todos los derechos.';
        const libro = porHojas('Comentario', permisos, '© 2011 Editorial Portavoz\nGrand Rapids, Michigan');
        const { data } = keepOnlyWhatIsWritten({ publisher: 'Biblica', year: '2015' }, libro);
        expect(data).toEqual({});
    });

    it('pero una hoja legal larga con permisos dentro sí es la página legal', () => {
        // Maqueta corriente en Estados Unidos: el bloque de permisos vive
        // DENTRO de la página legal.
        const legalConPermisos = [
            '© 2011 by Allen P. Ross',
            'Scripture quotations are taken from the New International Version.',
            'All rights reserved. '.repeat(60),
            'Published by Kregel Publications, Grand Rapids, Michigan',
            'ISBN 978-0-8254-2562-2',
        ].join('\n');
        const libro = porHojas('Comentario', legalConPermisos, HOJA_DE_PREFACIO);
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Grand Rapids', publisher: 'Kregel Publications', year: '2011' },
            libro,
        );
        expect(data.publisher).toBe('Kregel Publications');
    });

    it('la página legal encabezada «Nota del editor» no se pierde', () => {
        // Las ediciones españolas la encabezan así, y el guardia del
        // cuerpo la descartaba entera aunque trajera la catalogación.
        const libro = porHojas(
            'Comentario a los Salmos',
            'Nota del editor\n© 2011 Editorial Clie, Viladecavalls\nDepósito legal B-12345-2011\nISBN 978-0-8254-2562-2',
            HOJA_DE_PREFACIO,
        );
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Viladecavalls', publisher: 'Editorial Clie', year: '2011' },
            libro,
        );
        expect(data.publisher).toBe('Editorial Clie');
    });

    it('la página legal larga de una traducción no se pierde', () => {
        // Medido sobre la Gramática Griega de Wallace en español: lista
        // las dos imprentas, no usa ninguna fórmula de reserva de
        // derechos y es larga, así que no era ni «propia» ni «escueta» y
        // el libro se quedaba sin pie de imprenta.
        const legalLarga = [
            'GRAMÁTICA GRIEGA: SINTAXIS DEL NUEVO TESTAMENTO',
            'Daniel B. Wallace y Daniel S. Steffen',
            'Edición en español publicada por Editorial Vida – 2011, 2015',
            'Miami, Florida',
            '©2015 por Daniel Wallace y Daniel Steffen',
            'Originally published in the U.S.A. under the title: Greek Grammar Beyond the Basics',
            'Copyright ©1996 by Daniel B. Wallace. '.repeat(30),
        ].join('\n');
        const libro = porHojas('Gramática Griega', legalLarga, HOJA_DE_PREFACIO);
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Miami', publisher: 'Editorial Vida', year: '2015' },
            libro,
        );
        expect(data.publisher).toBe('Editorial Vida');
        expect(data.city).toBe('Miami');
    });

    it('la línea de índice que nombra el copyright sigue perdiendo', () => {
        const indiceLargo = `CONTENTS\nCopyright and Permissions .... iv\n${'Capítulo tal .... 12\n'.repeat(60)}`;
        const libro = porHojas(indiceLargo, 'Comentario', LEGAL_PROPIA);
        expect(readableRegionsOf(libro).credits).toContain('Kregel');
    });

    it('la página legal se encuentra aunque el cuerpo empiece en la hoja 2', () => {
        // El corte del cuerpo protegía la portada y de paso escondía el
        // pie de imprenta: costaba el libro entero.
        const libro = porHojas('Comentario a los Salmos', 'INTRODUCCIÓN\nEl salterio…', LEGAL_PROPIA);
        const { data } = keepOnlyWhatIsWritten(
            { city: 'Grand Rapids', publisher: 'Kregel Publications', year: '2011' },
            libro,
        );
        expect(data.publisher).toBe('Kregel Publications');
    });
});

describe('dónde empieza el cuerpo', () => {
    it.each([
        ['ix\n\nPREFACIO', 'un folio delante'],
        ['# Prefacio', 'una almohadilla de markdown'],
        ['PRESENTACIÓN', 'como lo titulan Sígueme y CLIE'],
        ['Nota del autor', 'sin la palabra prefacio'],
        ['Series Preface', 'en inglés y con prefijo'],
    ])('%s se reconoce como cuerpo (%s)', (encabezado) => {
        // La portada ocupa las dos primeras hojas —cubierta y portadilla—
        // porque el cuerpo de un libro no empieza ahí.
        const libro = porHojas(
            'A COMMENTARY ON THE PSALMS',
            'A Commentary on the Psalms\nAllen P. Ross',
            `${encabezado}\nComo bien dice Walter Brueggemann, The Message of the Psalms.`,
            '© 2011 Kregel\nAll rights reserved\nISBN 978-0-8254-2562-2',
        );
        expect(readableRegionsOf(libro).cover).not.toContain('Brueggemann');
    });

    it.each([
        ['Preface to the Second Edition'],
        ['Prefacio a la segunda edición española'],
        ['Introducción general a los profetas menores'],
    ])('«%s» también, aunque el encabezado sea largo', (encabezado) => {
        const libro = porHojas(
            'A COMMENTARY ON THE PSALMS',
            'A Commentary on the Psalms\nAllen P. Ross',
            `${encabezado}\nComo bien dice Walter Brueggemann, The Message of the Psalms.`,
            '© 2011 Kregel\nAll rights reserved\nISBN 978-0-8254-2562-2',
        );
        expect(readableRegionsOf(libro).cover).not.toContain('Brueggemann');
    });

    it('un título que lleva la palabra dentro no corta la portada a cero', () => {
        // Con el corte en la hoja 0 la portada salía VACÍA y el lector
        // respondía «este libro no tiene texto extraído».
        const libro = porHojas(
            'INTRODUCCIÓN AL ANTIGUO TESTAMENTO',
            'Introducción al Antiguo Testamento\nRaymond B. Dillard',
            '© 1994 Zondervan\nAll rights reserved\nGrand Rapids, Michigan',
        );
        const { cover } = readableRegionsOf(libro);
        expect(cover).toContain('Dillard');
    });
});

describe('un título que lleva la palabra dentro no abre el cuerpo', () => {
    it('«An Introduction to Biblical Hebrew Syntax» es el título, no la introducción', () => {
        // Medido sobre el ejemplar real de Waltke-O'Connor: el corte
        // falso dejaba la portada en 69 letras.
        const libro = porHojas(
            'AN INTRODUCTION TO BIBLICAL HEBREW SYNTAX',
            'An Introduction to Biblical Hebrew Syntax\nBruce K. Waltke and M. O\'Connor',
            'Eisenbrauns\nWinona Lake, Indiana\n1990',
        );
        expect(readableRegionsOf(libro).cover).toContain('Waltke');
    });
});

describe('por qué camino se recortó', () => {
    it('lo dice, para que un cambio del extractor no pase inadvertido', () => {
        expect(readableRegionsOf(porHojas('a', 'b', 'c')).origin).toBe('hojas');
        expect(readableRegionsOf(CREDITOS).origin).toBe('letras');
    });

    it('una marca mal formada cae al recorte por letras en vez de romper', () => {
        expect(readableRegionsOf('[Page 1] uno [PAGE] dos').origin).toBe('letras');
    });

    it('la marca es la que escribe el extractor', () => {
        // Hermana de la prueba de `pagesToMarkedText` en el paquete de
        // funciones, que no puede importar dominio. Si allá cambia el
        // formato, acá deja de haber hojas y nadie se entera.
        expect(MARCA_DE_HOJA.test('[PAGE 1]')).toBe(true);
        expect(MARCA_DE_HOJA.test('[PAGE 137]')).toBe(true);
    });
});

describe('la forma ordenable de un nombre', () => {
    it('rechaza el campo puesto al revés', () => {
        // Con la portada que ya imprime el nombre invertido, aceptar
        // «Allen P. Ross» como forma ordenada alfabetizaba por «Allen».
        const { data } = keepOnlyWhatIsWritten(
            { author: 'Ross, Allen P.', authorSorted: 'Allen P. Ross' },
            CREDITOS.replace('Allen P. Ross', 'Ross, Allen P.'),
        );
        expect(data.authorSorted).toBeUndefined();
    });

    it('rechaza el apellido que no cierra el nombre', () => {
        const { data } = keepOnlyWhatIsWritten(
            { author: 'Allen P. Ross', authorSorted: 'Allen, Ross P.' },
            CREDITOS,
        );
        expect(data.authorSorted).toBeUndefined();
    });

    it('acepta el apellido compuesto español', () => {
        const { data } = keepOnlyWhatIsWritten(
            { author: 'Ricardo Cerda Rojas', authorSorted: 'Cerda Rojas, Ricardo' },
            'Ricardo Cerda Rojas\n© 2026',
        );
        expect(data.authorSorted).toBe('Cerda Rojas, Ricardo');
    });
});
