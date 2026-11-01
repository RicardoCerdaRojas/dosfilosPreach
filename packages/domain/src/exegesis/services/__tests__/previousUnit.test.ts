import { describe, expect, it } from 'vitest';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { previousUnitOf, previousUnitStatement } from '../previousUnit';

/** El criterio «se conecta con la unidad anterior»: para el TI #2 (Sal 23:4–6), el TI #1 (Sal 23:1–3). */
const PSA = (vs: number, ve: number) => ({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: vs, verseEnd: ve });
const trabajo = (id: string, passage: object, over: Partial<ExegeticalPaper> = {}) =>
    ({ id, passage, projectId: 'ot603', linkedProjectIds: [], archivedAt: null, steps: [], ...over }) as unknown as ExegeticalPaper;
const TI1 = trabajo('ti1', PSA(1, 3));
const TI2 = trabajo('ti2', PSA(4, 6));

describe('previousUnitOf', () => {
    it('el del mismo proyecto y libro que termina justo antes', () => {
        expect(previousUnitOf(TI2, [TI1, TI2])?.id).toBe('ti1');
    });
    it('entre varios anteriores, el más cercano', () => {
        const ti0 = trabajo('ti0', { bookId: 'PSA', chapterStart: 22, chapterEnd: 22, verseStart: 1, verseEnd: 31 });
        expect(previousUnitOf(TI2, [ti0, TI1])?.id).toBe('ti1');
    });
    it('no cuenta otro proyecto, otro libro, uno archivado ni uno posterior', () => {
        expect(previousUnitOf(TI2, [{ ...TI1, projectId: 'otro' } as ExegeticalPaper])).toBeNull();
        expect(previousUnitOf(TI2, [{ ...TI1, passage: { ...PSA(1, 3), bookId: 'JAS' } } as ExegeticalPaper])).toBeNull();
        expect(previousUnitOf(TI2, [{ ...TI1, archivedAt: new Date() } as ExegeticalPaper])).toBeNull();
        expect(previousUnitOf(TI1, [TI2])).toBeNull();
    });
    it('sin proyecto no hay unidad anterior; un proyecto vinculado sí cuenta', () => {
        expect(previousUnitOf({ ...TI2, projectId: null } as ExegeticalPaper, [TI1])).toBeNull();
        expect(previousUnitOf({ ...TI2, projectId: null, linkedProjectIds: ['ot603'] } as ExegeticalPaper, [TI1])?.id).toBe('ti1');
    });
});

describe('previousUnitStatement', () => {
    it('la tesis aprobada de la unidad anterior', () => {
        const conTesis = { ...TI1, thesis: { text: 'La suficiencia es consecuencia de quién es el SEÑOR.', origin: 'student', approvedAt: new Date(), updatedAt: new Date() } } as ExegeticalPaper;
        expect(previousUnitStatement(conTesis)).toBe('La suficiencia es consecuencia de quién es el SEÑOR.');
    });
    it('sin tesis guardada, el primer párrafo de su conclusión aceptada', () => {
        const conConclusion = { ...TI1, steps: [{ kind: 'conclusion', accepted: { markdown: '## Conclusión\n\nEl análisis muestra X.\n\nOtro párrafo.' } }] } as unknown as ExegeticalPaper;
        expect(previousUnitStatement(conConclusion)).toBe('El análisis muestra X.');
        expect(previousUnitStatement(null)).toBeNull();
        expect(previousUnitStatement(TI1)).toBeNull();
    });
});
