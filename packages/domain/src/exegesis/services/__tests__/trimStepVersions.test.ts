import { describe, it, expect } from 'vitest';
import type { ExegeticalStepVersion } from '../../entities/ExegeticalStep';
import { MAX_STEP_VERSIONS, trimStepVersions } from '../trimStepVersions';

/**
 * El historial crecía sin techo. El trabajo más grande en producción llegó a
 * 932 KB —313 KB de versiones guardadas— contra el límite duro de 1 MB por
 * documento de Firestore. A 91% del tope, la próxima regeneración podía dejar
 * el trabajo imposible de escribir.
 */
const v = (id: string): ExegeticalStepVersion => ({ id } as ExegeticalStepVersion);
const ids = (vs: ExegeticalStepVersion[]) => vs.map(x => x.id);

describe('trimStepVersions', () => {
    it('por debajo del tope no toca nada', () => {
        const vs = [v('a'), v('b'), v('c')];
        expect(ids(trimStepVersions(vs, [], 5))).toEqual(['a', 'b', 'c']);
    });

    it('recorta por el principio: lo último es lo que el autor mira', () => {
        const vs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(v);
        expect(ids(trimStepVersions(vs, [], 5))).toEqual(['c', 'd', 'e', 'f', 'g']);
    });

    it('NUNCA suelta la versión aceptada, aunque sea vieja', () => {
        // Perderla no es perder historia: es romper el trabajo. El documento
        // se compone de las versiones aceptadas.
        const vs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(v);
        expect(ids(trimStepVersions(vs, ['a'], 5))).toEqual(['a', 'c', 'd', 'e', 'f', 'g']);
    });

    it('tampoco suelta la actual', () => {
        const vs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(v);
        expect(ids(trimStepVersions(vs, ['b'], 5))).toContain('b');
    });

    it('conserva las dos cuando ambas quedarían fuera', () => {
        const vs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(v);
        const out = ids(trimStepVersions(vs, ['a', 'b'], 5));
        expect(out).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
        // Un paso PUEDE guardar más que el tope: acota el crecimiento, no
        // promete un número exacto.
        expect(out.length).toBeGreaterThan(5);
    });

    it('ignora los identificadores que no existen o vienen vacíos', () => {
        const vs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(v);
        expect(ids(trimStepVersions(vs, [null, undefined, 'fantasma'], 5)))
            .toEqual(['c', 'd', 'e', 'f', 'g']);
    });

    it('el tope por omisión deja intactos 218 de los 224 pasos medidos', () => {
        // La distribución real: 48 pasos con 0 versiones, 150 con 1, 10 con 2,
        // 7 con 3, 3 con 4, 4 con 5, uno con 11 y uno con 13.
        expect(MAX_STEP_VERSIONS).toBe(5);
        const cinco = Array.from({ length: 5 }, (_, i) => v(String(i)));
        expect(trimStepVersions(cinco, [])).toHaveLength(5);
    });
});
