import { describe, it, expect } from 'vitest';
import { frameLeftOut } from '../assemblyContents';
import { pinnedSourcesInCorpus, stepPlanWithoutSource } from '../../entities/corpusUsagePlan';

/** TP #6 (Santiago 3:1-12): hallazgos 11 y 13 de la bitácora. */
describe('una fuente que sale del corpus sale también del plan', () => {
    it('REGRESIÓN: se quita de fijadas, suprimidas y roles en todos los pasos', () => {
        const plan = stepPlanWithoutSource({
            v6: { pinnedSources: ['wallace-es', 'na28'], suppressedSources: ['wallace-es'], pinnedSourceRoles: { 'wallace-es': 'technical', na28: 'technical' } },
            v7: { pinnedSources: ['mayor'], suppressedSources: [] },
        }, 'wallace-es');
        expect(plan.v6).toEqual({ pinnedSources: ['na28'], suppressedSources: [], pinnedSourceRoles: { na28: 'technical' } });
        expect(plan.v7).toEqual({ pinnedSources: ['mayor'], suppressedSources: [] });
    });

    it('los fantasmas que ya quedaron guardados no se muestran ni se reenvían', () => {
        expect(pinnedSourcesInCorpus(['64a71b9d', 'na28'], [{ id: 'na28' }])).toEqual(['na28']);
        expect(pinnedSourcesInCorpus(undefined, [{ id: 'na28' }])).toEqual([]);
    });
});

describe('el marco que el encuadre deja fuera', () => {
    const preguntas = '1. En 3:2, ¿qué tipo de condicional es?\n2. En 3:6, ¿cómo se puntúa?';

    it('REGRESIÓN: antes de sembrar, lo decide el encuadre (todas las preguntas nombran versículo)', () => {
        expect(frameLeftOut({ steps: [], assignmentBrief: preguntas }, 'introduction')).toBe(true);
        expect(frameLeftOut({ steps: [], assignmentBrief: preguntas + '\n3. ¿Qué enseña el pasaje sobre los maestros?' }, 'conclusion')).toBe(false);
        expect(frameLeftOut({ steps: [], assignmentBrief: null }, 'conclusion')).toBe(false);
    });

    it('con los pasos sembrados, mandan los pasos (el estudiante pudo volver a incluirlo)', () => {
        const intro = (includeInDocument?: boolean) => ({ kind: 'introduction', ...(includeInDocument === undefined ? {} : { includeInDocument }) }) as never;
        expect(frameLeftOut({ steps: [intro(true)], assignmentBrief: preguntas }, 'introduction')).toBe(false);
        expect(frameLeftOut({ steps: [intro(false)], assignmentBrief: null }, 'introduction')).toBe(true);
    });
});
