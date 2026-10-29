import { describe, it, expect } from 'vitest';
import { offersSermonStart } from '../paperSermonStart';

/** TP #9 (B24): en un trabajo del curso no se ofrece «Comenzar el sermón». */
const PROYECTOS = [
    { id: 'nt785', type: 'course' as const },
    { id: 'esdras', type: 'exegetical' as const },
];

describe('offersSermonStart', () => {
    it('un estudio suelto o de un Exegético lo ofrece', () => {
        expect(offersSermonStart({ projectId: null }, PROYECTOS)).toBe(true);
        expect(offersSermonStart({}, null)).toBe(true);
        expect(offersSermonStart({ projectId: 'esdras' }, PROYECTOS)).toBe(true);
    });

    it('un trabajo cuyo origen es un Curso, no', () => {
        expect(offersSermonStart({ projectId: 'nt785' }, PROYECTOS)).toBe(false);
    });

    it('mientras los proyectos cargan no se sabe: no se ofrece todavía', () => {
        expect(offersSermonStart({ projectId: 'esdras' }, null)).toBe(false);
    });

    it('un origen que ya no existe no define nada: se ofrece', () => {
        expect(offersSermonStart({ projectId: 'borrado' }, PROYECTOS)).toBe(true);
    });
});
