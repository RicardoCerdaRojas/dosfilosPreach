import { describe, it, expect } from 'vitest';
import { recomendablePorPasaje } from '../recomendadoPorPasaje';

/**
 * TP #7 (#6): «Recomendado para este pasaje» (Santiago) traía a Kistemaker,
 * *1 y 2 Pedro y Judas*, y a Tripp (consejería) con uno o dos fragmentos.
 */
const JAS = 'JAS' as never;
const rk = (matchedChunkCount: number) => ({ resourceId: 'x', score: 1, matchedChunkCount }) as never;
const recurso = (extra: Record<string, unknown>) => ({ id: 'x', title: 'x', type: 'other', ...extra }) as never;

describe('recomendablePorPasaje', () => {
    it('un comentario de otro libro bíblico no se recomienda, aunque tenga fragmentos', () => {
        const kistemaker = recurso({ exegeticalType: 'commentary-expository', coversBibleBooks: ['1PE', '2PE', 'JUD'], scope: 'book' });
        expect(recomendablePorPasaje(kistemaker, rk(9), JAS)).toBe(false);
    });
    it('un libro de apoyo con uno o dos fragmentos, tampoco', () => {
        const tripp = recurso({ exegeticalType: 'theological-monograph' });
        expect(recomendablePorPasaje(tripp, rk(1), JAS)).toBe(false);
        expect(recomendablePorPasaje(tripp, rk(3), JAS)).toBe(true);
    });
    it('una obra de consulta con un fragmento sí: toca el versículo en una línea', () => {
        expect(recomendablePorPasaje(recurso({ exegeticalType: 'grammar-syntax' }), rk(1), JAS)).toBe(true);
    });
    it('un comentario de Santiago con pocos fragmentos depende de su peso, no de su libro', () => {
        const moo = recurso({ exegeticalType: 'commentary-critical', coversBibleBooks: ['JAS'], scope: 'book' });
        expect(recomendablePorPasaje(moo, rk(1), JAS)).toBe(true);
    });
});
