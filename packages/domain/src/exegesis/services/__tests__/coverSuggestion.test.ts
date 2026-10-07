import { describe, it, expect } from 'vitest';
import { coverOrigins, hasCover, nextAssignmentDate, nextAssignmentTitle } from '../coverSuggestion';

/**
 * El fundador reescribía la portada en cada trabajo práctico: el seminario, su
 * nombre y la ciudad no cambian, y el título sólo sube un número.
 */
const TP4 = {
    institution: "The Master's Seminary", assignmentTitle: 'Trabajo práctico #4',
    author: 'Ricardo Cerda', place: 'Concepción, Chile', date: 'Septiembre 2026',
};
const trabajo = (id: string, dia: number, cover: object | null) =>
    ({ id, title: id, createdAt: new Date(2026, 8, dia), updatedAt: new Date(2026, 8, 30), cover }) as never;

describe('nextAssignmentTitle', () => {
    it('avanza el número de la entrega', () => {
        expect(nextAssignmentTitle('Trabajo práctico #4')).toBe('Trabajo práctico #5');
        expect(nextAssignmentTitle('TP # 9')).toBe('TP # 10');
    });

    it('otro formato de título no se adivina', () => {
        expect(nextAssignmentTitle('Trabajo final')).toBe('Trabajo final');
        expect(nextAssignmentTitle('Tarea 4')).toBe('Tarea 4');
        expect(nextAssignmentTitle(undefined)).toBeUndefined();
    });
});

describe('nextAssignmentDate', () => {
    const octubre = new Date(2026, 9, 7);

    it('REGRESIÓN (TP #6): el mes en curso, con la forma de la anterior', () => {
        expect(nextAssignmentDate('SEPTIEMBRE 2026', octubre)).toBe('OCTUBRE 2026');
        expect(nextAssignmentDate('Septiembre 2026', octubre)).toBe('Octubre 2026');
        expect(nextAssignmentDate('septiembre de 2026', octubre)).toBe('octubre de 2026');
        expect(nextAssignmentDate('Setiembre 2026', octubre)).toBe('Octubre 2026');
        expect(nextAssignmentDate('September 2026', octubre)).toBe('October 2026');
        // Cambio de año.
        expect(nextAssignmentDate('Diciembre 2026', new Date(2027, 0, 5))).toBe('Enero 2027');
    });

    it('otra forma de fecha no se reescribe', () => {
        expect(nextAssignmentDate('30 de septiembre de 2026', octubre)).toBe('30 de septiembre de 2026');
        expect(nextAssignmentDate('2026-09-30', octubre)).toBe('2026-09-30');
        expect(nextAssignmentDate('Primavera 2025', octubre)).toBe('Primavera 2025');
        expect(nextAssignmentDate(undefined, octubre)).toBeUndefined();
    });

    it('la portada heredada de un trabajo o de un perfil trae el mes en curso', () => {
        const o = coverOrigins(
            [trabajo('tp4', 20, TP4)],
            [{ id: 'p1', displayName: 'TMS', cover: { institution: 'TMS', author: 'R', date: 'AGOSTO 2026' } }],
            'tp5',
            octubre,
        );
        expect(o.map(x => x.cover.date)).toEqual(['Octubre 2026', 'OCTUBRE 2026']);
    });
});

describe('coverOrigins', () => {
    it('propone primero la portada del trabajo más reciente, con el número avanzado', () => {
        const o = coverOrigins(
            [trabajo('tp3', 10, { ...TP4, assignmentTitle: 'Trabajo práctico #3' }), trabajo('tp4', 20, TP4), trabajo('tp5', 30, null)],
            [],
            'tp5',
        );
        expect(o[0]!.id).toBe('tp4');
        expect(o[0]!.cover.assignmentTitle).toBe('Trabajo práctico #5');
        expect(o[0]!.cover.institution).toBe("The Master's Seminary");
        expect(o).toHaveLength(2);
    });

    it('el trabajo actual no se propone a sí mismo, y uno sin portada tampoco', () => {
        expect(coverOrigins([trabajo('tp5', 30, TP4), trabajo('x', 1, { place: 'Lima' })], [], 'tp5')).toEqual([]);
    });

    it('los perfiles van después de los trabajos', () => {
        const o = coverOrigins(
            [trabajo('tp4', 20, TP4)],
            [{ id: 'p1', displayName: 'TMS', cover: { institution: 'TMS', author: 'R' } }],
            'tp5',
        );
        expect(o.map(x => x.kind)).toEqual(['paper', 'profile']);
    });
});

describe('hasCover', () => {
    it('sin seminario ni autor no hay portada', () => {
        expect(hasCover({ place: 'Concepción' })).toBe(false);
        expect(hasCover({ author: 'Ricardo' })).toBe(true);
        expect(hasCover(null)).toBe(false);
    });
});
