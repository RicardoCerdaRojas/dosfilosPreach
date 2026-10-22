import { describe, it, expect } from 'vitest';
import { computeRoadmapState, getProjectTypeMeta, PROJECT_TYPES } from '../projectRoadmaps';

/** ADR-046, etapa 1: recorridos de Curso, Investigación y Exegético, que cuentan estudios. */
const ctx = (over: Record<string, unknown> = {}) => ({
    project: { id: 'p', userId: 'u', title: 'T', color: 'amber' },
    studyCount: 0, deliveredCount: 0, sourceCount: 0, greekCount: 0, hebrewCount: 0, sessionCount: 0,
    outputs: [], sermons: [], sessions: [], ...over,
}) as never;

describe('recorridos por tipo', () => {
    it('Curso: encargo → estado del arte → estudios → entregas', () => {
        const meta = getProjectTypeMeta('course');
        expect(meta.roadmap.map(f => f.id)).toEqual(['charge', 'state-of-art', 'studies', 'deliveries']);
        expect(computeRoadmapState(meta, ctx()).activeIndex).toBe(0);
        const conEncargo = ctx({ project: { id: 'p', charge: { styleGuideId: 'g' } }, sourceCount: 3 });
        const r = computeRoadmapState(meta, conEncargo);
        expect(r.phases[r.activeIndex]!.phase.cta.kind).toBe('study');
        expect(computeRoadmapState(meta, ctx({ project: { id: 'p', charge: { styleGuideId: 'g' } }, sourceCount: 3, studyCount: 2, deliveredCount: 1 })).allComplete).toBe(true);
    });

    it('Investigación cuenta sus estudios (ya no pide griego)', () => {
        const meta = getProjectTypeMeta('study');
        expect(meta.label).toBe('Investigación');
        expect(meta.roadmap.map(f => f.id)).toContain('studies');
        expect(meta.roadmap.map(f => f.id)).not.toContain('languages');
    });

    it('Exegético: los estudios por perícopa piden al menos dos', () => {
        const fase = getProjectTypeMeta('exegetical').roadmap.find(f => f.id === 'pericopes')!;
        expect(fase.isComplete(ctx({ studyCount: 1 }))).toBe(false);
        expect(fase.isComplete(ctx({ studyCount: 2 }))).toBe(true);
    });

    it('un tipo desconocido cae en General', () => {
        expect(getProjectTypeMeta('inventado' as never)).toBe(PROJECT_TYPES.general);
    });

    it('el primer paso se completa también con la nota que escribe su botón (revisión de la etapa 1)', () => {
        const fase = getProjectTypeMeta('exegetical').roadmap[0]!;
        expect(fase.cta.kind).toBe('output');
        expect(fase.isComplete(ctx({ outputs: [{ kind: 'note' }] }))).toBe(true);
    });
});
