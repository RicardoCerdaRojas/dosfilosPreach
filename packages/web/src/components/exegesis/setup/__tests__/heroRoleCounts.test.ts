import { describe, it, expect } from 'vitest';
import { computeEffectiveRoleTargets, computeRoleExpectations } from '@dosfilos/domain';
import { heroRoleCounts, unirConY } from '../heroRoleCounts';

/**
 * TP #6: el texto de arranque sugería unas 13 fuentes (4-5 anclas, 4-5
 * contrastes, 3-4 técnicas) con una rúbrica que pedía 6.
 */
describe('cuántas fuentes sugiere el texto de arranque del corpus', () => {
    it('REGRESIÓN: con mínimos en la rúbrica, los de la rúbrica', () => {
        const r = heroRoleCounts({
            sourceRequirements: [
                { sourceType: 'commentary-expository', minimum: 2, maximum: null, justification: '' },
                { sourceType: 'commentary-critical', minimum: 2, maximum: null, justification: '' },
                { sourceType: 'grammar-syntax', minimum: 2, maximum: null, justification: '' },
            ],
        } as never);
        expect(r.kind).toBe('rubric');
        expect(r.kind === 'rubric' && r.counts.reduce((n, c) => n + c.count, 0)).toBe(6);
        expect(r.kind === 'rubric' && r.counts.every(c => c.count > 0)).toBe(true);
    });

    it('REGRESIÓN (revisión): dice lo mismo que la tarjeta de cobertura de roles', () => {
        // La rúbrica sólo pide anclas: los otros roles toman el mínimo de la
        // estrategia, como en la tarjeta. Antes el texto decía «2 anclas» y la
        // tarjeta pedía además contrastes y técnicas.
        const rubric = { sourceRequirements: [{ sourceType: 'commentary-expository', minimum: 2, maximum: null, justification: '' }] } as never;
        const r = heroRoleCounts(rubric);
        const tarjeta = computeEffectiveRoleTargets(computeRoleExpectations(rubric));
        expect(r.kind === 'rubric' && Object.fromEntries(r.counts.map(c => [c.role, c.count]))).toEqual(tarjeta);
    });

    it('sin rúbrica o sin mínimos, el rango de la estrategia', () => {
        expect(heroRoleCounts(null).kind).toBe('strategy');
        expect(heroRoleCounts({ sourceRequirements: [] } as never).kind).toBe('strategy');
    });
});

describe('unirConY', () => {
    it('«a, b y c»', () => {
        expect(unirConY(['2 anclas', '4 contrastes', '3 técnicas'], 'y')).toBe('2 anclas, 4 contrastes y 3 técnicas');
        expect(unirConY(['1 ancla'], 'y')).toBe('1 ancla');
        expect(unirConY([], 'y')).toBe('');
    });
});

