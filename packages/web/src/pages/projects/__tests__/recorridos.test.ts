import { describe, it, expect } from 'vitest';
import { computeRoadmapState, getProjectTypeMeta, PROJECT_TYPES } from '../projectRoadmaps';

/** ADR-046, etapa 1: recorridos de Curso, Investigación y Exegético, que cuentan estudios. */
const ctx = (over: Record<string, unknown> = {}) => ({
    project: { id: 'p', userId: 'u', title: 'T', color: 'amber' },
    studyCount: 0, deliveredCount: 0, workedStudyCount: 0, seriesCount: 0, sourceCount: 0, greekCount: 0, hebrewCount: 0, sessionCount: 0,
    outputs: [], sermons: [], sessions: [], ...over,
}) as never;

describe('recorridos por tipo', () => {
    it('Curso: encargo → estado del arte → estudios → entregas', () => {
        const meta = getProjectTypeMeta('course');
        expect(meta.roadmap.map(f => f.id)).toEqual(['charge', 'state-of-art', 'studies', 'deliveries']);
        expect(computeRoadmapState(meta, ctx()).activeIndex).toBe(0);
        // El nombre del curso solo no completa el encargo (etapa 1b).
        expect(computeRoadmapState(meta, ctx({ project: { id: 'p', courseInfo: { course: 'NT785' } } })).activeIndex).toBe(0);
        const conEncargo = ctx({ project: { id: 'p', workTypes: [{ id: 'tp', label: 'TP' }] }, sourceCount: 3 });
        const r = computeRoadmapState(meta, conEncargo);
        expect(r.phases[r.activeIndex]!.phase.cta.kind).toBe('study');
        expect(computeRoadmapState(meta, ctx({ project: { id: 'p', workTypes: [{ id: 'tp', label: 'TP' }] }, sourceCount: 3, studyCount: 2, deliveredCount: 1 })).allComplete).toBe(true);
    });

    it('Investigación cuenta sus estudios (ya no pide griego)', () => {
        const meta = getProjectTypeMeta('study');
        expect(meta.label).toBe('Investigación');
        expect(meta.roadmap.map(f => f.id)).toContain('studies');
        expect(meta.roadmap.map(f => f.id)).not.toContain('languages');
    });

    it('Exegético: los estudios por perícopa piden al menos dos trabajados', () => {
        const fase = getProjectTypeMeta('exegetical').roadmap.find(f => f.id === 'pericopes')!;
        expect(fase.isComplete(ctx({ studyCount: 2, workedStudyCount: 1 }))).toBe(false);
        expect(fase.isComplete(ctx({ studyCount: 2, workedStudyCount: 2 }))).toBe(true);
    });

    it('un tipo desconocido cae en General', () => {
        expect(getProjectTypeMeta('inventado' as never)).toBe(PROJECT_TYPES.general);
    });

    it('un Exegético viejo que completó el primer paso con una nota sigue completo (retrocompatible)', () => {
        const fase = getProjectTypeMeta('exegetical').roadmap[0]!;
        expect(fase.isComplete(ctx({ outputs: [{ kind: 'note' }] }))).toBe(true);
        expect(fase.isComplete(ctx({ project: { id: 'p', contextNote: 'Nehemías entero' } }))).toBe(true);
    });
});

/** Etapa 3 de ADR-046: el proyecto Exegético planifica su serie. */
describe('Exegético con «División en perícopas»', () => {
    const meta = getProjectTypeMeta('exegetical');
    const conNotaYFuentes = { project: { id: 'p', contextNote: 'Nehemías entero' }, sourceCount: 3 };
    const activa = (over: Record<string, unknown>) => {
        const r = computeRoadmapState(meta, ctx({ ...conNotaYFuentes, ...over }));
        return r.phases[r.activeIndex]!.phase;
    };

    it('la fase nueva va entre las fuentes y los estudios por perícopa', () => {
        expect(meta.roadmap.map(f => f.id)).toEqual(['passage', 'sources', 'division', 'pericopes', 'synthesis']);
    });

    it('con nota y fuentes y sin serie, el paso es planificar la serie', () => {
        const fase = activa({});
        expect(fase.id).toBe('division');
        expect(fase.cta.kind).toBe('planSeries');
    });

    it('con la serie creada, sigue trabajar los estudios', () => {
        expect(activa({ seriesCount: 1, workedStudyCount: 0 }).id).toBe('pericopes');
    });

    it('un proyecto que no predica no queda trabado: dos estudios trabajados llevan a la síntesis', () => {
        const r = computeRoadmapState(meta, ctx({ ...conNotaYFuentes, studyCount: 2, workedStudyCount: 2 }));
        expect(r.phases[r.activeIndex]!.phase.id).toBe('synthesis');
        expect(r.allComplete).toBe(false);
    });

    it('los estudios vacíos que la serie crea en lote no completan «Estudios por perícopa»', () => {
        const fase = meta.roadmap.find(f => f.id === 'pericopes')!;
        expect(fase.isComplete(ctx({ studyCount: 14, workedStudyCount: 0, seriesCount: 1 }))).toBe(false);
    });

    it('con la serie creada, el botón de «Estudios por perícopa» lleva a sus estudios, no a uno suelto (revisión F3)', () => {
        const fase = activa({ seriesCount: 1, studyCount: 13, workedStudyCount: 0 });
        expect(fase.id).toBe('pericopes');
        expect(fase.cta.kind).toBe('openSeries');
        expect(fase.i18nKey).toBe('exegetical.pericopesSeries');
        // La variante no cambia cuándo se cumple la fase.
        expect(computeRoadmapState(meta, ctx({ ...conNotaYFuentes, seriesCount: 1, studyCount: 13, workedStudyCount: 2 })).phases[3]!.complete).toBe(true);
    });

    it('sin serie, «Estudios por perícopa» sigue ofreciendo un estudio nuevo', () => {
        const r = computeRoadmapState(meta, ctx({ ...conNotaYFuentes, studyCount: 2, workedStudyCount: 1 }));
        const fase = r.phases[r.activeIndex]!.phase;
        expect(fase.id).toBe('pericopes');
        expect(fase.cta.kind).toBe('study');
        expect(fase.i18nKey).toBe('exegetical.pericopes');
    });

    it('cada fase del recorrido Exegético tiene su clave de textos', () => {
        expect(meta.roadmap.map(f => f.i18nKey)).toEqual([
            'exegetical.passage', 'exegetical.sources', 'exegetical.division', 'exegetical.pericopes', 'exegetical.synthesis',
        ]);
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

/** Fase «Encuadre de la serie»: la fase 1 del Exegético define el encuadre. */
describe('Exegético con encuadre', () => {
    const meta = getProjectTypeMeta('exegetical');
    const pasaje = meta.roadmap.find(f => f.id === 'passage')!;
    const sintesis = meta.roadmap.find(f => f.id === 'synthesis')!;
    const proyecto = (over: Record<string, unknown>) => ({ id: 'p', userId: 'u', title: 'Esdras', color: 'amber', type: 'exegetical', ...over });
    const fase1 = (project: Record<string, unknown>) => computeRoadmapState(meta, ctx({ project })).phases[0]!;

    it('el botón de la fase 1 abre el encuadre: «Definir» sin encuadre, «Editar» con encuadre', () => {
        const sin = fase1(proyecto({}));
        expect(sin.phase.cta.kind).toBe('frame');
        expect(sin.phase.i18nKey).toBe('exegetical.passage');
        const con = fase1(proyecto({ framing: { purpose: 'preach' } }));
        expect(con.phase.cta.kind).toBe('frame');
        expect(con.phase.i18nKey).toBe('exegetical.passageEdit');
    });

    it('se completa con un libro y la idea central; solo uno de los dos no basta', () => {
        expect(pasaje.isComplete(ctx({ project: proyecto({ bibliographyCriteria: { bibleBooks: ['EZR'] }, framing: { centralIdea: 'Dios restaura a su pueblo por su palabra.' } }) }))).toBe(true);
        expect(pasaje.isComplete(ctx({ project: proyecto({ bibliographyCriteria: { bibleBooks: ['EZR'] }, framing: { purpose: 'preach' } }) }))).toBe(false);
        expect(pasaje.isComplete(ctx({ project: proyecto({ framing: { centralIdea: 'Dios restaura.' } }) }))).toBe(false);
    });

    it('la síntesis se completa también con la idea consolidada y vigente, no con una desactualizada', () => {
        const revision = { centralIdea: 'Dios restaura a su pueblo por su palabra y su templo.', verdict: 'nuanced', why: 'Esd 6', ofIdea: 'Dios restaura.', revisedAt: '2026-10-25T12:00:00.000Z' };
        expect(sintesis.isComplete(ctx({ project: proyecto({ framing: { centralIdea: 'Dios restaura.', revision } }) }))).toBe(true);
        expect(sintesis.isComplete(ctx({ project: proyecto({ framing: { centralIdea: 'Otra idea.', revision } }) }))).toBe(false);
        expect(sintesis.isComplete(ctx({ project: proyecto({}) }))).toBe(false);
    });
});
