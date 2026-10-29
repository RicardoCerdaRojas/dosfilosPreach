import { describe, expect, it } from 'vitest';
import {
    formatBibliographyEntry,
    formatFirstNote,
    formatShortNote,
    hasCompleteBibliography,
    missingBibliographyFields,
    proposeSortedAuthor,
    sortedAuthorOf,
    withFullTitle,
    type BibliographicData,
} from '../bibliography';

/** Ross, tal como se citó a mano en el trabajo de Salmo 23:1–3. */
const ROSS: BibliographicData = {
    author: 'Allen P. Ross',
    authorSorted: 'Ross, Allen P.',
    title: 'A Commentary on the Psalms',
    shortTitle: 'Commentary on the Psalms',
    volume: '1',
    volumeTitle: '1–41',
    series: 'Kregel Exegetical Library',
    city: 'Grand Rapids',
    publisher: 'Kregel',
    year: '2011',
};

describe('formatBibliographyEntry', () => {
    it('reproduce la entrada que se escribió a mano para el trabajo', () => {
        expect(formatBibliographyEntry(ROSS)).toBe(
            'Ross, Allen P. *A Commentary on the Psalms*. Vol. 1, *1–41*. Kregel Exegetical Library. Grand Rapids: Kregel, 2011.',
        );
    });

    it('lo que falta se omite: no se escribe «s.f.» ni se inventa la ciudad', () => {
        const entry = formatBibliographyEntry({ author: 'Juan Pérez', title: 'Estudios', year: '1999' });
        expect(entry).toBe('Pérez, Juan. *Estudios*. 1999.');
        expect(entry).not.toMatch(/s\.f\.|n\.p\.|\[/);
    });

    it('una inicial con punto no duplica el punto de la entrada', () => {
        expect(formatBibliographyEntry({ authorSorted: 'Ross, Allen P.', title: 'Salmos' }))
            .toBe('Ross, Allen P. *Salmos*.');
    });

    it('sin datos, no hay entrada', () => {
        expect(formatBibliographyEntry({})).toBe('');
    });
});

describe('formatFirstNote', () => {
    it('la primera nota va completa, con la página', () => {
        expect(formatFirstNote(ROSS, '561')).toBe(
            'Allen P. Ross, *A Commentary on the Psalms*, vol. 1, *1–41*, Kregel Exegetical Library (Grand Rapids: Kregel, 2011), 561',
        );
    });

    it('sin pie de imprenta no deja paréntesis vacíos', () => {
        expect(formatFirstNote({ author: 'Juan Pérez', title: 'Estudios' }, '12')).toBe('Juan Pérez, *Estudios*, 12');
    });
});

describe('formatShortNote', () => {
    it('las siguientes van abreviadas: apellido y título corto', () => {
        expect(formatShortNote(ROSS, '562')).toBe('Ross, *Commentary on the Psalms*, 562');
    });

    it('sin título corto usa el título entero', () => {
        expect(formatShortNote({ author: 'Allen P. Ross', title: 'A Commentary on the Psalms' }, '562'))
            .toBe('Ross, *A Commentary on the Psalms*, 562');
    });

    it('REGRESIÓN TI #2: con dos autores, los dos apellidos', () => {
        expect(formatShortNote({ author: 'Bruce K. Waltke y M. O’Connor', authorSorted: 'Waltke, Bruce K., y M. O’Connor', title: 'An Introduction to Biblical Hebrew Syntax', shortTitle: 'Introduction to Biblical Hebrew Syntax' }, '527'))
            .toBe('Waltke y O’Connor, *Introduction to Biblical Hebrew Syntax*, 527');
        // Editores: el «eds.» no va en la nota abreviada.
        expect(formatShortNote({ author: 'K. Elliger y W. Rudolph, eds.', title: 'Biblia Hebraica Stuttgartensia' }, '1106'))
            .toBe('Elliger y Rudolph, *Biblia Hebraica Stuttgartensia*, 1106');
        expect(formatShortNote({ author: 'Bill T. Arnold and John H. Choi', title: 'A Guide' }, '59')).toBe('Arnold and Choi, *A Guide*, 59');
        expect(formatShortNote({ author: 'Juan Pérez y Pedro Ortiz V.', title: 'X' }, '1')).toBe('Pérez y Ortiz V., *X*, 1');
    });

    it('un apellido compuesto con «y» sigue siendo UN autor', () => {
        expect(formatShortNote({ author: 'José Ortega y Gasset', authorSorted: 'Ortega y Gasset, José', title: 'Meditaciones' }, '3'))
            .toBe('Ortega y Gasset, *Meditaciones*, 3');
        // Revisión adversarial: con el nombre invertido daba «Ramón y Santiago».
        expect(formatShortNote({ author: 'Ramón y Cajal, Santiago', authorSorted: 'Ramón y Cajal, Santiago', title: 'Textura' }, '1'))
            .toBe('Ramón y Cajal, *Textura*, 1');
        // Sin forma ordenada, el nombre ya invertido se lee hasta la coma.
        expect(formatShortNote({ author: 'Ortega y Gasset, José', title: 'Meditaciones' }, '3')).toBe('Ortega y Gasset, *Meditaciones*, 3');
        expect(formatShortNote({ author: 'Walter C. Kaiser, Jr.', title: 'T' }, '1')).toBe('Kaiser, *T*, 1');
        // «Pedro» solo no es un autor: «Pedro e Inés Gómez» es una persona.
        expect(formatShortNote({ author: 'Pedro e Inés Gómez', title: 'X' }, '1')).toBe('Gómez, *X*, 1');
    });

    it('un autor ordenado sin coma (entidad o forma decidida) manda sobre el nombre', () => {
        expect(formatShortNote({ author: 'Sociedad Bíblica de Chile y Sociedades Bíblicas Unidas', authorSorted: 'Sociedad Bíblica de Chile y Sociedades Bíblicas Unidas', title: 'RVR' }, '1'))
            .toBe('Sociedad Bíblica de Chile y Sociedades Bíblicas Unidas, *RVR*, 1');
        expect(formatShortNote({ author: 'Eberhard Nestle y Kurt Aland', authorSorted: 'Nestle-Aland', title: 'NA28' }, '1'))
            .toBe('Nestle-Aland, *NA28*, 1');
    });

    it('Turabian: tres autores con sus tres apellidos; cuatro o más, el primero y «et al.»', () => {
        expect(formatShortNote({ author: 'A. B. Smith, C. D. Jones, and E. F. Brown', authorSorted: 'Smith, A. B., C. D. Jones, and E. F. Brown', title: 'T' }, '1'))
            .toBe('Smith, Jones, and Brown, *T*, 1');
        expect(formatShortNote({ author: 'A. B. Smith, C. D. Jones, and E. F. Brown', title: 'T' }, '1')).toBe('Smith, Jones, and Brown, *T*, 1');
        expect(formatShortNote({ author: 'A. Uno, B. Dos, C. Tres y D. Cuatro', title: 'T' }, '1')).toBe('Uno et al., *T*, 1');
    });

    it('el «Jr.» de un coautor no se lo come', () => {
        expect(formatShortNote({ author: 'Moisés Silva and Walter C. Kaiser Jr.', authorSorted: 'Silva, Moisés, and Walter C. Kaiser Jr.', title: 'T' }, '1'))
            .toBe('Silva and Kaiser, *T*, 1');
        expect(formatShortNote({ author: 'Mark D. Futato and David M. Howard, Jr.', title: 'T' }, '1')).toBe('Futato and Howard, *T*, 1');
        expect(formatShortNote({ author: 'R. Laird Harris, Gleason L. Archer Jr., y Bruce K. Waltke, eds.', title: 'TWOT' }, '1'))
            .toBe('Harris, Archer, y Waltke, *TWOT*, 1');
    });
});

describe('formatBibliographyEntry · edición', () => {
    it('REGRESIÓN TI #2: «5.ª ed.» no termina en «ed..»', () => {
        const e = formatBibliographyEntry({ author: 'K. Elliger y W. Rudolph, eds.', title: 'Biblia Hebraica Stuttgartensia', edition: '5.ª ed.', city: 'Stuttgart', publisher: 'Deutsche Bibelgesellschaft', year: '1997' });
        expect(e).toContain('5.ª ed. Stuttgart');
        expect(e).not.toContain('ed..');
        expect(formatBibliographyEntry({ author: 'A B', title: 'T', edition: '2nd ed' })).toContain('2nd ed.');
    });
});

describe('proposeSortedAuthor', () => {
    it('propone la forma ordenable de un nombre en inglés', () => {
        expect(proposeSortedAuthor('Allen P. Ross')).toBe('Ross, Allen P.');
    });

    it('un nombre ya invertido se deja como está', () => {
        expect(proposeSortedAuthor('Ross, Allen P.')).toBe('Ross, Allen P.');
    });

    it('con apellido compuesto propone lo que puede, y por eso se guarda lo que el autor corrija', () => {
        // «Cerda Rojas, Ricardo» es lo correcto; la propuesta se queda corta.
        expect(proposeSortedAuthor('Ricardo Cerda Rojas')).toBe('Rojas, Ricardo Cerda');
    });
});

describe('missingBibliographyFields', () => {
    it('dice exactamente qué falta', () => {
        expect(missingBibliographyFields({ author: 'Ross', title: 'Salmos' })).toEqual(['city', 'publisher', 'year']);
    });

    it('un recurso sin datos los pide todos', () => {
        expect(missingBibliographyFields(null)).toEqual(['author', 'title', 'city', 'publisher', 'year']);
    });

    it('con todo escrito, la bibliografía se puede imprimir', () => {
        expect(hasCompleteBibliography(ROSS)).toBe(true);
        expect(missingBibliographyFields(ROSS)).toEqual([]);
    });

    it('un campo con solo espacios no cuenta como escrito', () => {
        expect(missingBibliographyFields({ ...ROSS, city: '   ' })).toEqual(['city']);
    });
});

describe('proposeSortedAuthor — nombres que no se ordenan moviendo la última palabra', () => {
    it('invierte sólo el primer coautor (Turabian)', () => {
        // «Choi, Bill T. Arnold and John H.» llegaba impreso a la
        // bibliografía; después, NA28 salió sin invertir (TP #7).
        expect(proposeSortedAuthor('Bill T. Arnold and John H. Choi')).toBe('Arnold, Bill T., and John H. Choi');
        expect(proposeSortedAuthor('Gordon J. Wenham y John Walton')).toBe('Wenham, Gordon J., y John Walton');
        expect(proposeSortedAuthor('Eberhard Nestle y Kurt Aland')).toBe('Nestle, Eberhard, y Kurt Aland');
    });

    it('un «ordenado» igual al autor se vuelve a proponer; uno escrito a mano, no', () => {
        expect(sortedAuthorOf({ author: 'Eberhard Nestle y Kurt Aland', authorSorted: 'Eberhard Nestle y Kurt Aland' }))
            .toBe('Nestle, Eberhard, y Kurt Aland');
        expect(sortedAuthorOf({ author: 'Eberhard Nestle y Kurt Aland', authorSorted: 'Nestle-Aland' })).toBe('Nestle-Aland');
    });

    it('deja el sufijo de linaje tal cual', () => {
        expect(proposeSortedAuthor('Walter C. Kaiser Jr.')).toBe('Walter C. Kaiser Jr.');
    });

    it('no toma por apellido la inicial del segundo apellido', () => {
        // En Hispanoamérica se abrevia: «Plutarco Bonilla A.» daba
        // «A., Plutarco Bonilla».
        expect(proposeSortedAuthor('Plutarco Bonilla A.')).toBe('Plutarco Bonilla A.');
        expect(proposeSortedAuthor('Samuel Pérez H.')).toBe('Samuel Pérez H.');
    });

    it('sigue ordenando el nombre corriente', () => {
        expect(proposeSortedAuthor('Allen P. Ross')).toBe('Ross, Allen P.');
        expect(proposeSortedAuthor('Ricardo Cerda Rojas')).toBe('Rojas, Ricardo Cerda');
    });
});

/** TP #7: Varner salió *The Book of James* sin «: A New Perspective». */
describe('withFullTitle', () => {
    it('completa el subtítulo que la ficha perdió', () => {
        expect(withFullTitle({ title: 'The Book of James' }, 'The Book of James: A New Perspective').title)
            .toBe('The Book of James: A New Perspective');
    });
    it('si la ficha ya trae el subtítulo aparte, no lo duplica (TP #8, #45)', () => {
        const ficha = { title: 'Greek Grammar Beyond the Basics', subtitle: 'An Exegetical Syntax of the New Testament' };
        const completa = withFullTitle(ficha, 'Greek Grammar Beyond the Basics: An Exegetical Syntax of the New Testament');
        expect(completa).toBe(ficha);
        expect(formatBibliographyEntry({ ...completa, author: 'Daniel B. Wallace' })).not.toMatch(/New Testament: An Exegetical/);
    });
    it('una ficha ya guardada con el subtítulo dentro del título no lo repite al imprimir', () => {
        const guardada = {
            author: 'Daniel B. Wallace',
            title: 'Greek Grammar Beyond the Basics: An Exegetical Syntax of the New Testament',
            subtitle: 'An Exegetical Syntax of the New Testament',
        };
        expect(formatBibliographyEntry(guardada)).toMatch(/Basics: An Exegetical Syntax of the New Testament\*/);
        expect(formatBibliographyEntry(guardada)).not.toMatch(/New Testament: An Exegetical/);
    });
    it('un título que sólo contiene las palabras del subtítulo, sin «:», lo sigue sumando', () => {
        expect(formatBibliographyEntry({ author: 'A B', title: 'Grace', subtitle: 'Grace' })).toMatch(/Grace: Grace/);
    });
    it('otra diferencia no se toca: la decide la persona', () => {
        expect(withFullTitle({ title: 'James' }, 'James and the Jesus Tradition').title).toBe('James');
        expect(withFullTitle({ title: 'The Epistle of James' }, 'Commentary on James').title).toBe('The Epistle of James');
    });
});

/** Revisión adversarial de H. */
describe('autores que no son coautores', () => {
    it('un apellido compuesto con «y» no se parte', () => {
        expect(proposeSortedAuthor('José Ortega y Gasset')).toBe('José Ortega y Gasset');
        expect(proposeSortedAuthor('Santiago Ramón y Cajal')).toBe('Santiago Ramón y Cajal');
    });
    it('un autor institucional guardado tal cual se respeta', () => {
        expect(sortedAuthorOf({ author: 'United Bible Societies', authorSorted: 'United Bible Societies' })).toBe('United Bible Societies');
    });
    it('un guion no es un subtítulo (suele venir del nombre del archivo)', () => {
        expect(withFullTitle({ title: 'James' }, 'James - McCartney').title).toBe('James');
    });
});
