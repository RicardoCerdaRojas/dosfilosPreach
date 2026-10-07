import { computeEffectiveRoleTargets, computeRoleExpectations, STRATEGY_SUGGESTED_RANGES, type PaperRubric, type SourceRole } from '@dosfilos/domain';

/**
 * Cuántas fuentes de cada rol sugiere el texto de arranque del corpus.
 *
 * Decía siempre «4-5 anclas, 4-5 contrastes y 3-4 técnicas» —unas 13— y en
 * el TP #6 la rúbrica pedía 6. Si la rúbrica pide mínimos, el texto dice los
 * mismos que la tarjeta de cobertura de roles (`computeEffectiveRoleTargets`:
 * los de la rúbrica, y el mínimo de la estrategia para el rol que calla), para
 * que no se contradigan; si la rúbrica calla del todo, el rango de la
 * estrategia.
 */
export type HeroRoleCounts =
    | { kind: 'rubric'; counts: ReadonlyArray<{ role: SourceRole; count: number }> }
    | { kind: 'strategy'; ranges: typeof STRATEGY_SUGGESTED_RANGES };

const ORDEN: ReadonlyArray<SourceRole> = ['anchor', 'contrast', 'technical'];

export function heroRoleCounts(rubric: Pick<PaperRubric, 'sourceRequirements'> | null): HeroRoleCounts {
    const pide = computeRoleExpectations(rubric);
    if (ORDEN.every(role => pide[role] === 0)) return { kind: 'strategy', ranges: STRATEGY_SUGGESTED_RANGES };
    const efectivos = computeEffectiveRoleTargets(pide);
    return { kind: 'rubric', counts: ORDEN.map(role => ({ role, count: efectivos[role] })) };
}
