import { describe, it, expect } from 'vitest';
import { briefWithExclusions, excludedLast, exclusionFor, proposeExclusions } from '../excludedSources';

/**
 * TP #6 (Santiago 3, 2026-10-07): el encuadre prohibía McCartney, Varner,
 * Ropes y Robertson, y «Extraer de mi biblioteca» recomendó esos cuatro.
 */
const tp5 = [
    { key: 'McCartney', previousPaperTitle: 'TP #5' },
    { key: 'Varner', previousPaperTitle: 'TP #5' },
    { key: 'Carson y Moo', previousPaperTitle: null },
];

describe('qué libro alcanza una exclusión', () => {
    it('REGRESIÓN: el libro de la biblioteca trae el autor completo y se reconoce', () => {
        expect(exclusionFor({ author: 'Dan G. McCartney' }, tp5)?.key).toBe('McCartney');
        expect(exclusionFor({ author: 'Varner, William' }, tp5)?.key).toBe('Varner');
    });

    it('por la clave de cita, sin acentos ni mayúsculas', () => {
        expect(exclusionFor({ citationKey: 'mccartney' }, tp5)?.key).toBe('McCartney');
        expect(exclusionFor({ citationKey: 'Martín' }, [{ key: 'Martin', previousPaperTitle: null }])?.key).toBe('Martin');
    });

    it('cualquier coautor; una clave de varios autores sólo alcanza a la obra de todos', () => {
        expect(exclusionFor({ author: 'Mark Dubis y William Varner' }, tp5)?.key).toBe('Varner');
        expect(exclusionFor({ author: 'D. A. Carson & Douglas J. Moo' }, tp5)?.key).toBe('Carson y Moo');
        expect(exclusionFor({ author: 'D. A. Carson' }, tp5)).toBeNull();
    });

    it('REGRESIÓN (revisión): sólo apellidos — un nombre de pila o un apellido sin su partícula no alcanzan', () => {
        const martin = [{ key: 'Martin', previousPaperTitle: null }];
        expect(exclusionFor({ author: 'Martin Dibelius' }, martin)).toBeNull();
        expect(exclusionFor({ author: 'Ralph P. Martin' }, martin)?.key).toBe('Martin');
        expect(exclusionFor({ author: 'Wallace M. Alston' }, [{ key: 'Wallace', previousPaperTitle: null }])).toBeNull();
        expect(exclusionFor({ author: 'David A. de Silva' }, [{ key: 'Silva', previousPaperTitle: null }])).toBeNull();
    });

    it('REGRESIÓN (revisión): la clave escrita de otra forma igual alcanza', () => {
        const de = (key: string) => [{ key, previousPaperTitle: null }];
        expect(exclusionFor({ author: 'Varner, William' }, de('William Varner'))).not.toBeNull();
        expect(exclusionFor({ author: 'Dan G. McCartney' }, de('McCartney, Dan'))).not.toBeNull();
        expect(exclusionFor({ author: 'deSilva' }, de('de Silva'))).not.toBeNull();
        expect(exclusionFor({ author: 'David A. de Silva' }, de('deSilva'))).not.toBeNull();
        expect(exclusionFor({ author: 'William Varner' }, de('Varner.'))).not.toBeNull();
        expect(exclusionFor({ author: 'Aland, Barbara; Aland, Kurt; Metzger, Bruce M. (eds.)' }, de('Metzger'))).not.toBeNull();
    });

    it('no confunde un apellido con parte de otro', () => {
        expect(exclusionFor({ author: 'Douglas J. Moo' }, [{ key: 'Mo', previousPaperTitle: null }])).toBeNull();
        expect(exclusionFor({ author: 'Peter H. Davids' }, tp5)).toBeNull();
        expect(exclusionFor({ author: 'Dan McCartney' }, [])).toBeNull();
        expect(exclusionFor({ author: 'Dan McCartney' }, null)).toBeNull();
    });
});

describe('las excluidas van al final, sin desordenar el resto', () => {
    it('conserva el orden relativo de cada grupo', () => {
        expect(excludedLast(['a', 'X1', 'b', 'X2', 'c'], s => s.startsWith('X'))).toEqual(['a', 'b', 'c', 'X1', 'X2']);
    });
});

describe('lo que se propone y lo que leen los pasos que redactan', () => {
    it('propone lo citado en la entrega anterior, con su título', () => {
        expect(proposeExclusions({
            paperId: 'p5', title: 'TP #5', passage: {} as never, createdAt: new Date(), citedSourceKeys: ['Ropes', 'Varner'],
        })).toEqual([
            { key: 'Ropes', previousPaperTitle: 'TP #5' },
            { key: 'Varner', previousPaperTitle: 'TP #5' },
        ]);
        expect(proposeExclusions(null)).toEqual([]);
    });

    it('el encuadre lleva las exclusiones al final, en el idioma del trabajo', () => {
        const es = briefWithExclusions({ assignmentBrief: 'Cuatro preguntas.', excludedSources: tp5, displayLanguage: 'es' });
        // Adelante: un encuadre largo se recorta por el final.
        expect(es).toBe('Fuentes excluidas de este trabajo (no las cites ni te apoyes en ellas): McCartney, Varner, Carson y Moo.\n\nCuatro preguntas.');
        expect(briefWithExclusions({ assignmentBrief: null, excludedSources: tp5, displayLanguage: 'en' }))
            .toMatch(/^Sources excluded from this paper .*McCartney/);
    });

    it('sin exclusiones, el encuadre queda como estaba', () => {
        expect(briefWithExclusions({ assignmentBrief: 'X', excludedSources: [], displayLanguage: 'es' })).toBe('X');
        expect(briefWithExclusions({ assignmentBrief: null, excludedSources: null, displayLanguage: 'es' })).toBeNull();
    });
});

describe('una clave «et al.» (G)', () => {
    it('alcanza al primer autor, no a un apellido «al»', () => {
        const aland = [{ key: 'Aland et al.', previousPaperTitle: null }];
        expect(exclusionFor({ author: 'Aland, Barbara; Aland, Kurt' }, aland)).not.toBeNull();
        expect(exclusionFor({ author: 'Ahmad Al' }, aland)).toBeNull();
    });
});
