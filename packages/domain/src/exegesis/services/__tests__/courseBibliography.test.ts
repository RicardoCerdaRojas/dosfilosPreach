import { describe, expect, it } from 'vitest';
import {
    courseBibliographyCoverage,
    matchCourseBibliography,
    type CourseBibliographyEntry,
} from '../courseBibliography';

/** La bibliografía real del curso OT603, tal como la lista el sílabo. */
const SILABO: CourseBibliographyEntry[] = [
    { title: 'An Introduction to Biblical Hebrew Syntax', author: "Bruce K. Waltke and M. O'Connor", series: 'IBHS', requirement: 'required' },
    { title: 'A Commentary on the Psalms', author: 'Allen P. Ross', requirement: 'required' },
    { title: 'Psalms 1-50', author: 'Peter C. Craigie', series: 'WBC 19', requirement: 'required' },
    { title: 'The Hebrew Verbless Clause in the Pentateuch', author: 'Francis I. Andersen', requirement: 'recommended' },
];

/** La biblioteca del estudiante, con los títulos como los subió. */
const BIBLIOTECA = [
    { id: 'r1', title: 'An introduction to biblical Hebrew syntax', author: "Waltke, Bruce K." },
    { id: 'r2', title: 'A Commentary on the Psalms 1-41 (Kregel Exegetical Library)', author: 'Allen P. Ross' },
    { id: 'r3', title: 'Word Biblical Commentary Vol_ 19, Psalms 1-50', author: 'Craigie' },
];

describe('matchCourseBibliography', () => {
    it('reconoce las obras del curso aunque el título de la biblioteca no sea idéntico', () => {
        const m = matchCourseBibliography(SILABO, BIBLIOTECA, new Set(['r1']));
        expect(m[0]!.resource?.id).toBe('r1');
        expect(m[1]!.resource?.id).toBe('r2');
    });

    it('dice cuál ya está en el corpus de este trabajo', () => {
        const m = matchCourseBibliography(SILABO, BIBLIOTECA, new Set(['r1']));
        expect(m[0]!.inCorpus).toBe(true);
        expect(m[1]!.inCorpus).toBe(false);
    });

    it('una obra que no está en la biblioteca se reporta como ausente, no se inventa', () => {
        const m = matchCourseBibliography(SILABO, BIBLIOTECA, new Set());
        const andersen = m.find(x => x.entry.title.includes('Verbless'));
        expect(andersen!.resource).toBeNull();
        expect(andersen!.inCorpus).toBe(false);
    });

    it('sin listado no hay nada que cotejar', () => {
        expect(matchCourseBibliography([], BIBLIOTECA, new Set())).toEqual([]);
    });
});

describe('enlace manual', () => {
    it('lo que el usuario enlazó manda sobre el emparejador', () => {
        const conEnlace = SILABO.map(e => e.series === 'WBC 19' ? { ...e, resourceId: 'r3' } : e);
        const m = matchCourseBibliography(conEnlace, BIBLIOTECA, new Set(['r3']));
        const craigie = m.find(x => x.entry.series === 'WBC 19')!;
        expect(craigie.resource?.id).toBe('r3');
        expect(craigie.inCorpus).toBe(true);
    });

    it('un enlace a un recurso borrado no se rellena con una adivinanza', () => {
        const roto = SILABO.map(e => e.series === 'WBC 19' ? { ...e, resourceId: 'ya-no-existe' } : e);
        const craigie = matchCourseBibliography(roto, BIBLIOTECA, new Set()).find(x => x.entry.series === 'WBC 19')!;
        expect(craigie.resource).toBeNull();
    });

    it('con el enlace puesto, el curso queda cubierto', () => {
        const conEnlace = SILABO.map(e => e.series === 'WBC 19' ? { ...e, resourceId: 'r3' } : e);
        const c = courseBibliographyCoverage(matchCourseBibliography(conEnlace, BIBLIOTECA, new Set(['r1', 'r2', 'r3'])));
        expect(c).toEqual({ required: 3, requiredInCorpus: 3, missing: 0 });
    });
});

describe('courseBibliographyCoverage', () => {
    it('cuenta sólo las obligatorias: lo recomendado no reprueba', () => {
        const c = courseBibliographyCoverage(matchCourseBibliography(SILABO, BIBLIOTECA, new Set(['r1', 'r2'])));
        // Craigie no se empareja solo: «Psalms 1-50» tiene una sola palabra
        // larga y el emparejador es conservador a propósito. Se enlaza a mano.
        expect(c).toEqual({ required: 3, requiredInCorpus: 2, missing: 1 });
    });

    it('lo que falta es lo que ni siquiera está en la biblioteca', () => {
        const c = courseBibliographyCoverage(matchCourseBibliography(SILABO, [BIBLIOTECA[0]!], new Set(['r1'])));
        expect(c).toEqual({ required: 3, requiredInCorpus: 1, missing: 2 });
    });
});
