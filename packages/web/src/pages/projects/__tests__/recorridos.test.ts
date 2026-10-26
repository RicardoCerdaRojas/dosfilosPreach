import { describe, it, expect } from 'vitest';
import { computeRoadmapState, getProjectTypeMeta, PROJECT_TYPES } from '../projectRoadmaps';

/**
 * Los recorridos que quedan en la web: los de los tipos que todavía no
 * tienen escritorio propio. Exegético y Curso salen del dominio
 * (`buildProjectDesk`, con sus pruebas en domain); aquí solo se prueba que
 * ya no tienen recorrido propio y lo que muestra cada tipo (capabilities).
 */
const ctx = (over: Record<string, unknown> = {}) => ({
    project: { id: 'p', userId: 'u', title: 'T', color: 'amber' },
    studyCount: 0, sourceCount: 0, greekCount: 0, hebrewCount: 0, sessionCount: 0,
    outputs: [], sermons: [], ...over,
}) as never;

describe('recorridos por tipo', () => {
    it('Exegético y Curso no tienen recorrido en la web: un solo lugar decide sus fases (el dominio)', () => {
        expect(getProjectTypeMeta('exegetical').roadmap).toEqual([]);
        expect(getProjectTypeMeta('course').roadmap).toEqual([]);
    });

    it('Investigación cuenta sus estudios (ya no pide griego)', () => {
        const meta = getProjectTypeMeta('study');
        expect(meta.label).toBe('Investigación');
        expect(meta.roadmap.map(f => f.id)).toContain('studies');
        expect(meta.roadmap.map(f => f.id)).not.toContain('languages');
        expect(computeRoadmapState(meta, ctx()).activeIndex).toBe(0);
    });

    it('Consejería: cinco fases, la primera se completa con la nota de la situación', () => {
        const meta = getProjectTypeMeta('counseling');
        expect(meta.roadmap.map(f => f.id)).toEqual(['situation', 'biblical', 'pastoral', 'plan', 'followup']);
        expect(computeRoadmapState(meta, ctx({ outputs: [{ kind: 'note' }] })).activeIndex).toBe(1);
    });

    it('un tipo desconocido cae en General', () => {
        expect(getProjectTypeMeta('inventado' as never)).toBe(PROJECT_TYPES.general);
    });

    it('el recorrido de Serie sigue contando todos los sermones, sin agrupar', () => {
        const serie = getProjectTypeMeta('series');
        const completo = ctx({
            project: { id: 'p', contextNote: 'Jonás' }, sourceCount: 1, sessionCount: 1,
            outputs: [{ kind: 'outline' }, { kind: 'outline' }],
            sermons: [{ id: 'borrador' }, { id: 'copia', sourceSermonId: 'borrador' }],
        });
        expect(computeRoadmapState(serie, completo).allComplete).toBe(true);
    });
});

/** Deuda 6: lo que muestra cada tipo, en un solo lugar. */
describe('capacidades por tipo', () => {
    const caps = (t: string) => getProjectTypeMeta(t as never).capabilities;

    it('Exegético y Curso: escritorio propio, fuentes solo por el estado del arte, sin lista simple de estudios ni tarjetas de curso', () => {
        for (const t of ['exegetical', 'course']) {
            expect(caps(t).desk).toBe(t);
            expect(caps(t).sources).toBe('stateOfArt');
            expect(caps(t).studies).toBe(false);
            expect(caps(t).courseSetup).toBe('none');
            expect(caps(t).languages).toBe(true);
        }
    });

    it('Consejería: sin estudios ni lenguas (antes mostraba los dos)', () => {
        expect(caps('counseling')).toMatchObject({ desk: 'legacy', studies: false, languages: false, sources: 'picker' });
    });

    it('General: sin fases, con su lista de estudios y el selector; las tarjetas de curso plegadas', () => {
        expect(caps('general')).toMatchObject({ desk: 'general', studies: true, sources: 'picker', courseSetup: 'collapsible' });
    });

    it('Investigación conserva el selector y el estado del arte, y sus tarjetas de curso', () => {
        expect(caps('study')).toMatchObject({ desk: 'legacy', sources: 'both', courseSetup: 'open' });
    });

    it('Sermón y Serie heredados siempre muestran su tarjeta de series', () => {
        expect(caps('sermon').seriesCard).toBe('always');
        expect(caps('series').seriesCard).toBe('always');
    });

    it('todos los tipos declaran sus capacidades', () => {
        for (const meta of Object.values(PROJECT_TYPES)) expect(meta.capabilities).toBeDefined();
    });
});
