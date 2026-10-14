import { describe, it, expect } from 'vitest';
import { mapToAllocations, parsePlannerJson, plannerOutputCap, plannerResponseSchema } from '../GeminiStepCorpusPlanner';

/**
 * TP #7: el planificador (Luna, JSON libre, tope de 32k) entró en bucle 181 s
 * hasta el tope con 4 pasos. Ahora va con esquema estricto (ids reales, roles
 * cerrados) y un tope proporcional a los pasos.
 */
describe('planificador — esquema y tope', () => {
    const entrada = {
        steps: [{ id: 's13', kind: 'verse', label: 'Santiago 3:13' }, { id: 's15', kind: 'verse', label: 'Santiago 3:15' }],
        sources: [{ id: 'mcc', sourceType: 'commentary-critical', displayLabel: 'James', citationKey: 'McCartney' }, { id: 'rob', sourceType: 'grammar-syntax', displayLabel: 'Grammar', citationKey: 'Robertson' }],
    } as never;

    it('el esquema enumera los ids reales de pasos y fuentes y los tres roles', () => {
        const esquema = plannerResponseSchema(entrada) as { properties: { allocations: { items: { properties: Record<string, { enum?: string[]; items?: { enum?: string[]; properties?: Record<string, { enum?: string[] }> } }> } } } };
        const props = esquema.properties.allocations.items.properties;
        expect(props.stepId!.enum).toEqual(['s13', 's15']);
        expect(props.pinnedSources!.items!.enum).toEqual(['mcc', 'rob']);
        expect(props.pinnedSourceRoles!.items!.properties!.role!.enum).toEqual(['anchor', 'contrast', 'technical']);
    });

    it('sin fuentes o sin pasos no hay esquema (no hay qué enumerar)', () => {
        expect(plannerResponseSchema({ steps: [], sources: [{ id: 'x' }] } as never)).toBeNull();
        expect(plannerResponseSchema({ steps: [{ id: 's' }], sources: [] } as never)).toBeNull();
    });

    it('el tope crece con los pasos, entre 4k y 32k', () => {
        expect(plannerOutputCap(4)).toBe(4_096);
        expect(plannerOutputCap(15)).toBe(8_048);
        expect(plannerOutputCap(200)).toBe(32_768);
    });

    it('lee la respuesta nueva (arreglo) y la vieja (objeto por id) igual', () => {
        const nueva = parsePlannerJson(JSON.stringify({ allocations: [
            { stepId: 's13', pinnedSources: ['mcc', 'rob'], pinnedSourceRoles: [{ sourceId: 'mcc', role: 'anchor' }, { sourceId: 'rob', role: 'technical' }, { sourceId: 'zzz', role: 'anchor' }], rationale: ' r ' },
        ] }));
        const vieja = parsePlannerJson(JSON.stringify({ allocations: {
            s13: { pinnedSources: ['mcc', 'rob'], pinnedSourceRoles: { mcc: 'anchor', rob: 'technical' }, rationale: 'r' },
        } }));
        const esperado = { s13: { pinnedSources: ['mcc', 'rob'], pinnedSourceRoles: { mcc: 'anchor', rob: 'technical' }, rationale: 'r' } };
        expect(mapToAllocations(nueva)).toEqual(esperado);
        expect(mapToAllocations(vieja)).toEqual(esperado);
    });
});
