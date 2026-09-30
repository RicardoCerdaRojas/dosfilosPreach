import { describe, it, expect } from 'vitest';
import { coverOrigins, hasCover, nextAssignmentTitle } from '../coverSuggestion';

/**
 * El fundador reescribía la portada en cada trabajo práctico: el seminario, su
 * nombre y la ciudad no cambian, y el título sólo sube un número.
 */
const TP4 = {
    institution: "The Master's Seminary", assignmentTitle: 'Trabajo práctico #4',
    author: 'Ricardo Cerda', place: 'Concepción, Chile', date: 'Septiembre 2026',
};
const trabajo = (id: string, dia: number, cover: object | null) =>
    ({ id, title: id, updatedAt: new Date(2026, 8, dia), cover }) as never;

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
