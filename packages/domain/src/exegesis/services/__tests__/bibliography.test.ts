import { describe, expect, it } from 'vitest';
import {
    formatBibliographyEntry,
    formatFirstNote,
    formatShortNote,
    hasCompleteBibliography,
    missingBibliographyFields,
    proposeSortedAuthor,
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
