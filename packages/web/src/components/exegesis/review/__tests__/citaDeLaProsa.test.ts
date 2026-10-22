import { describe, it, expect } from 'vitest';
import { citaDeLaProsa } from '../citaDeLaProsa';

/** TP #8 (8b, D5): una cita de la prosa se abre desde su veredicto. */
describe('citaDeLaProsa', () => {
    const v = (raw: string, pages: string | null) => ({ raw, author: 'Mayor', pages } as never);
    it('la primera página del rango, impresa u hoja según la cita', () => {
        expect(citaDeLaProsa(v('(Mayor, 133–134)', '133–134'))).toEqual({ sourceKey: 'Mayor', page: 133, pageKind: 'printed' });
        expect(citaDeLaProsa(v('(Mayor, hoja 411)', '411'))).toEqual({ sourceKey: 'Mayor', page: 411, pageKind: 'sheet' });
    });
    it('sin página, no hay dónde abrir', () => {
        expect(citaDeLaProsa(v('(Mayor)', null))).toBeNull();
    });
});
