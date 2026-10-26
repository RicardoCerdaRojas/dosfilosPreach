import { describe, expect, it } from 'vitest';
import {
    DESK_TEXT_KEYS,
    buildProjectDesk,
    deskSourcesSummary,
    isManualApproval,
    workTypeRubric,
    type DeskPhase,
    type ProjectDeskInput,
    type ProjectDeskModel,
} from '../projectDesk';
import {
    NOW,
    NOW_CURSO,
    anotacion,
    ensamblado,
    esdrasAMedias,
    esdrasEnSintesis,
    esdrasRecienCreado,
    ficha,
    jonasLegacy,
    nt785,
    paraEnsenar,
    passage,
    proyecto,
    serieEsdras,
    study,
} from './projectDesk.fixtures';

/** El escritorio del proyecto (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`, §4 y §9.1). */

const fase = (m: ProjectDeskModel, id: string): DeskPhase => {
    const f = m.phases.find(p => p.id === id);
    if (!f) throw new Error(`sin fase ${id}`);
    return f;
};
const estados = (m: ProjectDeskModel) => Object.fromEntries(m.phases.map(p => [p.id, p.status]));

describe('Exegético · Esdras recién creado con nota vieja', () => {
    const m = buildProjectDesk(esdrasRecienCreado(), NOW);

    it('la nota vieja ya no completa la fase 1: queda en curso', () => {
        expect(fase(m, 'passage')).toMatchObject({ status: 'doing', evidence: { key: 'desk.exegetical.passage.oldNote' } });
        expect(m.exegetical!.framing.oldNote).toEqual({ source: 'contextNote' });
    });

    it('nada más está empezado', () => {
        expect(estados(m)).toEqual({ passage: 'doing', sources: 'todo', division: 'todo', pericopes: 'todo', synthesis: 'todo' });
        expect(fase(m, 'pericopes').evidence.key).toBe('desk.exegetical.pericopes.empty');
        expect(m.activePhaseId).toBe('passage');
    });

    it('«Ahora» es pasar la nota al encuadre, y la nota no lo repite', () => {
        expect(m.now).toMatchObject({ kind: 'phase', text: { key: 'desk.now.passageOldNote' }, target: { type: 'framing' } });
        expect(m.notes.some(n => n.text.key === 'desk.notes.oldNote')).toBe(false);
    });

    it('las herramientas salen de los libros: Esdras, hebreo y arameo, sin griego', () => {
        expect(m.languages).toEqual(['hebrew', 'aramaic']);
    });

    it('una nota de material también es nota vieja; la más reciente', () => {
        const input = esdrasRecienCreado();
        input.project = proyecto();
        input.outputs = [
            { id: 'o1', kind: 'note', title: 'Vieja', updatedAt: '2026-09-01T10:00:00.000Z' },
            { id: 'o2', kind: 'note', title: 'Nueva', updatedAt: '2026-09-05T10:00:00.000Z' },
            { id: 'o3', kind: 'draft', title: 'Borrador', updatedAt: '2026-09-09T10:00:00.000Z' },
        ];
        const x = buildProjectDesk(input, NOW);
        expect(x.exegetical!.framing.oldNote).toEqual({ source: 'output', outputId: 'o2' });
        // Un borrador cuenta como trabajo de síntesis; la nota que se pasa al encuadre, no.
        expect(fase(x, 'synthesis').status).toBe('doing');
        input.outputs = input.outputs.filter(o => o.kind === 'note');
        expect(fase(buildProjectDesk(input, NOW), 'synthesis').status).toBe('doing');
        input.outputs = [input.outputs[1]!];
        expect(fase(buildProjectDesk(input, NOW), 'synthesis').status).toBe('todo');
    });

    it('sin libro ni nota, por empezar; con encuadre completo, la nota ya no se ofrece', () => {
        const vacio = buildProjectDesk({ project: proyecto({ bibliographyCriteria: null }), studies: [] }, NOW);
        expect(fase(vacio, 'passage')).toMatchObject({ status: 'todo', evidence: { key: 'desk.exegetical.passage.todo' } });
        expect(vacio.now?.text.key).toBe('desk.now.passage');
        const completo = buildProjectDesk({ project: proyecto({ contextNote: 'nota', framing: { centralIdea: 'Idea' } }), studies: [] }, NOW);
        expect(fase(completo, 'passage')).toMatchObject({ status: 'ready', evidence: { key: 'desk.exegetical.passage.ready', params: { movements: 0 } } });
        expect(completo.exegetical!.framing.oldNote).toBeNull();
    });

    it('encuadre a medias sin nota: en curso con lo que falta', () => {
        const x = buildProjectDesk({ project: proyecto({ framing: { purpose: 'preach' } }), studies: [] }, NOW);
        expect(fase(x, 'passage').evidence.key).toBe('desk.exegetical.passage.partial');
        expect(x.now?.text.key).toBe('desk.now.passagePartial');
    });
});

describe('Exegético · Esdras con la serie a medias', () => {
    const m = buildProjectDesk(esdrasAMedias(), NOW);
    const filas = m.exegetical!.series[0]!.rows;

    it('fase 4 en proporción: solo cuentan los ensamblados', () => {
        expect(fase(m, 'pericopes')).toMatchObject({
            status: 'doing',
            evidence: { key: 'desk.exegetical.pericopes.progress', params: { done: 4, total: 12, annotated: 2 } },
            progress: { done: 4, total: 12 },
        });
    });

    it('la anotación no cuenta como estudiado', () => {
        const input = esdrasAMedias();
        input.project.framing!.hypothesisLog!.push(anotacion('h9', 's5', 'confirms', '2026-10-25T10:00:00.000Z'));
        expect(fase(buildProjectDesk(input, NOW), 'pericopes').progress).toEqual({ done: 4, total: 12 });
    });

    it('cada fila: estudio, tu lectura y sermón', () => {
        expect(filas).toHaveLength(12);
        expect(filas[0]).toMatchObject({ plannedId: 'pl1', position: 1, label: 'Esd 1:1-13', date: '2026-11-01', study: { id: 's1', state: 'assembled' }, reading: 'annotated', sermon: 'published', sermonId: 'd1' });
        // El marcador vacío no es sermón.
        expect(filas[1]).toMatchObject({ reading: 'annotated', sermon: 'none' });
        // Ensamblado sin anotación: por anotar; sermón nacido del estudio.
        expect(filas[2]).toMatchObject({ reading: 'pending', sermon: 'draft', sermonId: 'x3' });
        expect(filas[4]).toMatchObject({ study: { id: 's5', state: 'inProgress', accepted: 3, total: 8 }, reading: 'none' });
        expect(filas[6]).toMatchObject({ study: { state: 'notStarted', accepted: 0 } });
        expect(m.exegetical!.counts).toMatchObject({ units: 12, assembled: 4, annotated: 2, pendingReading: 2, inProgress: 1, withSermon: 2 });
    });

    it('fuentes: requisitos sin cumplir dejan la fase en curso', () => {
        expect(fase(m, 'sources')).toMatchObject({
            status: 'doing',
            evidence: { key: 'desk.sources.requirementsPending', params: { approved: 3, met: 1, total: 2 } },
            progress: { done: 1, total: 2 },
        });
        expect(m.exegetical!.sources).toMatchObject({ approved: 3, toAcquire: 1, candidates: 1, manual: 0 });
    });

    it('la serie creada deja lista la fase 3', () => {
        expect(fase(m, 'division')).toMatchObject({ status: 'ready', evidence: { key: 'desk.exegetical.division.readySeries', params: { series: 1, units: 12 } } });
    });

    it('la síntesis se abre desde la primera anotación', () => {
        expect(fase(m, 'synthesis')).toMatchObject({ status: 'doing', evidence: { key: 'desk.exegetical.synthesis.progress', params: { annotations: 2 } } });
        expect(m.exegetical!.synthesis).toMatchObject({ open: true, annotations: 2, counts: { confirms: 1, nuances: 1, contradicts: 0 }, canRevise: true, revision: 'none' });
        expect(m.exegetical!.synthesis.latest.map(e => e.id)).toEqual(['h2', 'h1']);
    });

    it('la continuidad gana sobre el método; lo que falta va como nota', () => {
        expect(m.activePhaseId).toBe('sources');
        expect(m.now).toMatchObject({ kind: 'continuity', text: { key: 'desk.now.continuePericope', params: { position: 5, label: 'Esd 5:1-13', done: 3, total: 8 } }, target: { type: 'study', id: 's5' } });
        const claves = m.notes.map(n => n.text.key);
        expect(claves).toContain('desk.notes.phase.sources');
        expect(m.notes.find(n => n.text.key === 'desk.notes.phase.sources')!.target.type).toBe('stateOfArt');
        expect(m.notes.find(n => n.text.key === 'desk.notes.readingPending')).toMatchObject({ text: { params: { count: 2 } }, target: { type: 'study', id: 's3' } });
    });

    it('una unidad en varios domingos cuenta una vez', () => {
        const input = esdrasAMedias();
        const plan = input.series![0]!.metadata!.plannedSermons!;
        plan[1]!.paperId = 's1';
        plan[1]!.passage = 'Esd 1:1-13';
        const x = buildProjectDesk(input, NOW);
        expect(x.exegetical!.series[0]!.rows[1]!.position).toBe(1);
        expect(x.exegetical!.series[0]!.rows[2]!.position).toBe(2);
        // s2 queda fuera del plan: es un estudio suelto.
        expect(x.exegetical!.looseStudies.map(s => s.id)).toEqual(['s2']);
        expect(x.exegetical!.counts.units).toBe(12);
    });

    it('una serie de otro proyecto no entra', () => {
        const input = esdrasAMedias();
        input.series = [...input.series!, serieEsdras(3, { id: 'otra', projectId: 'p2' })];
        expect(buildProjectDesk(input, NOW).exegetical!.series).toHaveLength(1);
    });

    it('un estudio archivado no cuenta', () => {
        const input = esdrasAMedias();
        input.studies = input.studies.map(s => (s.id === 's12' ? { ...s, archivedAt: '2026-10-20T10:00:00.000Z' } : s));
        const x = buildProjectDesk(input, NOW);
        expect(x.studies.some(s => s.id === 's12')).toBe(false);
        expect(x.exegetical!.series[0]!.rows[11]!.study.state).toBe('none');
    });
});

describe('Exegético · Esdras en síntesis', () => {
    it('con la idea revisada vigente y todo listo, no hay fase activa ni botón', () => {
        const m = buildProjectDesk(esdrasEnSintesis(), NOW);
        expect(estados(m)).toEqual({ passage: 'ready', sources: 'ready', division: 'ready', pericopes: 'ready', synthesis: 'ready' });
        expect(fase(m, 'sources').evidence).toEqual({ key: 'desk.sources.readyRequirements', params: { approved: 4, toAcquire: 0, met: 2, total: 2 } });
        expect(m.activePhaseId).toBeNull();
        expect(m.now).toBeNull();
        expect(m.exegetical!.framing).toMatchObject({ ideaSource: 'revised', idea: 'Dios reconstruye a su pueblo cuando vuelve a su palabra.', revision: 'current' });
        expect(m.exegetical!.synthesis.counts).toEqual({ confirms: 2, nuances: 1, contradicts: 1 });
        // Ensamblados sin anotación: siguen como nota.
        expect(m.notes.map(n => n.text.key)).toEqual(['desk.notes.readingPending']);
    });

    it('sin revisión, la fase 5 está en curso y «Ahora» es revisar la idea', () => {
        const input = esdrasEnSintesis();
        delete input.project.framing!.revision;
        const m = buildProjectDesk(input, NOW);
        expect(fase(m, 'synthesis').status).toBe('doing');
        expect(m.now).toMatchObject({ kind: 'phase', text: { key: 'desk.now.reviseIdea' }, target: { type: 'reviseIdea' } });
        expect(m.exegetical!.framing.ideaSource).toBe('original');
    });

    it('la revisión desactualizada no completa: en curso, y la nota no repite el botón', () => {
        const input = esdrasEnSintesis();
        input.project.framing!.centralIdea = 'Otra idea original.';
        const m = buildProjectDesk(input, NOW);
        expect(fase(m, 'synthesis')).toMatchObject({ status: 'doing', evidence: { key: 'desk.exegetical.synthesis.stale' } });
        expect(m.exegetical!.framing).toMatchObject({ revision: 'stale', idea: 'Otra idea original.', revisedIdea: null });
        expect(m.now?.target.type).toBe('reviseIdea');
        expect(m.notes.some(n => n.text.key === 'desk.notes.revisionStale')).toBe(false);
    });

    it('sin anotaciones y todo ensamblado, «Ahora» es anotar el primero', () => {
        const input = esdrasEnSintesis();
        input.project.framing = { centralIdea: 'Idea' };
        const m = buildProjectDesk(input, NOW);
        expect(fase(m, 'synthesis').status).toBe('todo');
        expect(m.exegetical!.synthesis.open).toBe(false);
        expect(m.now?.text.key).toBe('desk.now.annotate');
        expect(m.now?.target.type).toBe('study');
    });
});

describe('Exegético · para enseñar, sin serie', () => {
    it('«di por hecha la división» deja lista la fase 3', () => {
        const m = buildProjectDesk(paraEnsenar(), NOW);
        expect(fase(m, 'division')).toMatchObject({ status: 'ready', evidence: { key: 'desk.exegetical.division.readyWithoutSeries' } });
        expect(fase(m, 'pericopes')).toMatchObject({ status: 'doing', progress: { done: 1, total: 2 } });
        expect(m.exegetical!.looseStudies.map(s => s.id).sort()).toEqual(['t1', 't2']);
        expect(m.languages).toEqual(['greek']);
    });

    it('para predicar, la marca no basta: hace falta la serie', () => {
        const input = paraEnsenar();
        input.project.framing!.purpose = 'preach';
        expect(fase(buildProjectDesk(input, NOW), 'division').status).toBe('todo');
        input.project.framing!.purpose = 'personal';
        expect(fase(buildProjectDesk(input, NOW), 'division').status).toBe('ready');
    });

    it('dos estudios sin la marca no hacen la división', () => {
        const input = paraEnsenar();
        delete input.project.framing!.divisionWithoutSeries;
        const m = buildProjectDesk(input, NOW);
        expect(fase(m, 'division').status).toBe('todo');
        expect(m.now).toMatchObject({ text: { key: 'desk.now.division' }, target: { type: 'planSeries' } });
    });

    it('para enseñar sin la marca: dos estudios ENSAMBLADOS hacen la división; dos vacíos no', () => {
        const input = paraEnsenar();
        delete input.project.framing!.divisionWithoutSeries;
        input.studies = [...input.studies, ensamblado('t3', { passage: passage('JAS', 4) })];
        expect(fase(buildProjectDesk(input, NOW), 'division')).toMatchObject({ status: 'ready', evidence: { key: 'desk.exegetical.division.readyStudies', params: { count: 2 } } });
        input.project.framing!.purpose = 'personal';
        expect(fase(buildProjectDesk(input, NOW), 'division').status).toBe('ready');
        // Para predicar hace falta la serie.
        input.project.framing!.purpose = 'preach';
        expect(fase(buildProjectDesk(input, NOW), 'division').status).toBe('todo');
        // Dos sin empezar (y uno en curso) no premian nada.
        input.project.framing!.purpose = 'teach';
        input.studies = [study('v1'), study('v2'), study('v3', { phase: 'in-progress' })];
        expect(fase(buildProjectDesk(input, NOW), 'division').status).toBe('todo');
    });

    it('con el análisis del planificador a medias, en curso', () => {
        const input = paraEnsenar();
        delete input.project.framing!.divisionWithoutSeries;
        input.plannerDraft = true;
        expect(fase(buildProjectDesk(input, NOW), 'division')).toMatchObject({ status: 'doing', evidence: { key: 'desk.exegetical.division.draft' } });
    });
});

describe('Exegético · Jonás de antes', () => {
    const m = buildProjectDesk(jonasLegacy(), NOW);

    it('las fuentes de antes no retroceden: «N agregadas a mano»', () => {
        expect(fase(m, 'sources')).toMatchObject({ status: 'ready', evidence: { key: 'desk.sources.readyManual', params: { count: 2 } } });
        expect(m.exegetical!.sources).toMatchObject({ approved: 2, manual: 2 });
    });

    it('la nota de contexto ya no completa la fase 1', () => {
        expect(fase(m, 'passage').status).toBe('doing');
        expect(m.activePhaseId).toBe('passage');
    });

    it('el sermón vinculado por el estudio cuenta, publicado gana', () => {
        const filas = m.exegetical!.series[0]!.rows;
        expect(filas[0]).toMatchObject({ sermon: 'published', sermonId: 'js1pub' });
        expect(filas[1]).toMatchObject({ sermon: 'published', sermonId: 'jd2' });
        expect(filas[2]!.sermon).toBe('none');
        expect(fase(m, 'pericopes').status).toBe('ready');
    });

    it('con una ficha del estado del arte, ya no todo es «a mano»: mandan los requisitos', () => {
        const input = jonasLegacy();
        input.project.bibliography = [
            ficha('l1', { origins: ['legacy'] }), ficha('c1', { origins: ['catalog'] }),
        ];
        input.project.bibliographyCriteria = { bibleBooks: ['JON'], requirementItems: [{ id: 'q', kind: 'minimum-type', text: 'tres', origin: 'manual', sourceType: 'commentary-critical', minimum: 3 }] };
        expect(fase(buildProjectDesk(input, NOW), 'sources').status).toBe('doing');
    });
});

describe('fuentes · resumen', () => {
    it('sin fichas, por empezar; solo candidatas, en curso', () => {
        expect(deskSourcesSummary({}).total).toBe(0);
        const m = buildProjectDesk({ project: proyecto({ bibliography: [ficha('x', { decision: 'candidate' })] }), studies: [] }, NOW);
        expect(fase(m, 'sources')).toMatchObject({ status: 'doing', evidence: { key: 'desk.sources.candidatesOnly', params: { candidates: 1 } } });
        expect(fase(buildProjectDesk({ project: proyecto(), studies: [] }, NOW), 'sources').evidence.key).toBe('desk.sources.todo');
    });

    it('«a mano»: el selector y las de antes sí; una candidata de la biblioteca aprobada en el estado del arte, no', () => {
        const s = deskSourcesSummary({
            bibliography: [
                ficha('sel', { origins: ['selector'] }),
                ficha('leg', { origins: ['legacy'] }),
                // Una candidata del estado del arte que el selector aprobó después: atajo.
                ficha('lsel', { origins: ['library', 'selector'], weight: 'complementary' }),
                // Del estado del arte: la biblioteca la trae «complementaria».
                ficha('lib', { origins: ['library'], weight: 'complementary' }),
                // El selector de antes: solo `library`, «recomendada».
                ficha('viejo', { origins: ['library'], weight: 'recommended' }),
                // Un sílabo ligado a su libro con el selector sigue siendo del método.
                ficha('sil', { origins: ['syllabus', 'selector'] }),
                ficha('cand', { origins: ['selector'], decision: 'candidate' }),
            ],
        });
        expect(s).toMatchObject({ approved: 6, manual: 4 });
        expect(isManualApproval(ficha('x', { origins: [] }))).toBe(false);
    });

    it('con una candidata de la biblioteca aprobada en el estado del arte, mandan los requisitos', () => {
        const input = jonasLegacy();
        input.project.bibliography = [ficha('l1', { origins: ['legacy'] }), ficha('lib', { origins: ['library'], weight: 'complementary' })];
        input.project.bibliographyCriteria = { bibleBooks: ['JON'], requirementItems: [{ id: 'q', kind: 'minimum-type', text: 'tres', origin: 'manual', sourceType: 'commentary-critical', minimum: 3 }] };
        expect(fase(buildProjectDesk(input, NOW), 'sources').status).toBe('doing');
        // Las dos del selector: lista como «a mano».
        input.project.bibliography = [ficha('l1', { origins: ['legacy'] }), ficha('sel', { origins: ['selector'], weight: 'complementary' })];
        expect(fase(buildProjectDesk(input, NOW), 'sources')).toMatchObject({ status: 'ready', evidence: { key: 'desk.sources.readyManual', params: { count: 2 } } });
    });

    it('un requisito aceptado a propósito cuenta como cumplido; uno sin cifra, no', () => {
        const s = deskSourcesSummary({
            bibliography: [ficha('a')],
            bibliographyCriteria: {
                requirementItems: [
                    { id: 'r1', kind: 'minimum-type', text: 'tres', origin: 'manual', sourceType: 'commentary-critical', minimum: 3, done: true },
                    { id: 'r2', kind: 'perspectives', text: 'opuestos', origin: 'manual' },
                    { id: 'r3', kind: 'rule', text: 'no repetir', origin: 'syllabus' },
                ],
            },
        });
        expect(s.requirements).toEqual({ met: 1, total: 2, accepted: 1, incomplete: 1 });
    });

    it('una aprobada sin requisitos: lista con sus números', () => {
        const m = buildProjectDesk({ project: proyecto({ bibliography: [ficha('a'), ficha('b', { resourceId: null })] }), studies: [] }, NOW);
        expect(fase(m, 'sources').evidence).toEqual({ key: 'desk.sources.ready', params: { approved: 2, toAcquire: 1 } });
        expect(fase(m, 'sources').progress).toBeUndefined();
    });

    it('la cobertura sale solo si la web pasa lo que piden las rúbricas', () => {
        const p = { bibliography: [ficha('a')] };
        expect(deskSourcesSummary(p).coverage).toBeNull();
        const c = deskSourcesSummary(p, undefined, [{ sourceType: 'commentary-critical', minimum: 2, workType: 'TP' }]).coverage!;
        expect(c.rows[0]).toMatchObject({ sourceType: 'commentary-critical', minimum: 2, approved: 1 });
    });
});

describe('Curso · NT785 con calendario', () => {
    const m = buildProjectDesk(nt785(), NOW_CURSO);
    const co = m.course!;

    it('las fases del curso', () => {
        expect(estados(m)).toEqual({ charge: 'ready', sources: 'doing', calendar: 'ready', works: 'doing', feedback: 'doing' });
        expect(fase(m, 'sources').evidence).toEqual({ key: 'desk.sources.requiredToAcquire', params: { approved: 4, count: 1 } });
        expect(fase(m, 'works')).toMatchObject({ evidence: { params: { done: 3, total: 5, delivered: 3 } }, progress: { done: 3, total: 5 } });
        // «Con devolución» y «sin devolución» por separado.
        expect(fase(m, 'feedback').evidence).toEqual({ key: 'desk.course.feedback.progress', params: { returned: 2, none: 0, delivered: 3, pendingPatterns: 1 } });
    });

    it('el plazo gobierna: el TP #9 vence en 48 h', () => {
        expect(m.now).toMatchObject({
            kind: 'deadline', text: { key: 'desk.now.deadline.continue', params: { label: 'TP #9', done: 5, total: 8 } },
            target: { type: 'study', id: 's9' }, dueDate: '2026-10-28', hoursLeft: 48,
        });
    });

    it('lo que falta va como notas: Moo por conseguir, TP #8 sin devolución, el patrón sin decidir', () => {
        const claves = m.notes.map(n => n.text.key);
        expect(claves).toEqual(['desk.notes.requiredToAcquire', 'desk.notes.noFeedback', 'desk.notes.pendingPatterns']);
        expect(m.notes[0]!.text.params).toEqual({ title: 'James (PNTC)' });
        expect(m.notes[1]).toMatchObject({ text: { params: { label: 'TP #8' } }, target: { type: 'recordFeedback', id: 'e8' } });
        // Ya hay una nota de fuentes: la fase activa no se repite como nota genérica.
        expect(claves).not.toContain('desk.notes.phase.sources');
    });

    it('el calendario en su orden, con «no repetir» contra la entrega anterior del mismo tipo', () => {
        expect(co.schedule.rows.map(r => r.label)).toEqual(['TP #6', 'TP #7', 'TP #8', 'TP #9', 'TP #10']);
        const [tp6, tp7, tp8, tp9, tp10] = co.schedule.rows;
        expect(tp6).toMatchObject({ sources: 'noRepeat', comparedWith: null, delivery: 'returned' });
        expect(tp7).toMatchObject({ sources: 'noRepeat', comparedWith: 'TP #6', delivery: 'returned' });
        expect(tp8).toMatchObject({ sources: 'repeats', repeated: ['moo'], comparedWith: 'TP #7', delivery: 'delivered' });
        expect(tp9).toMatchObject({ sources: 'noRepeat', comparedWith: 'TP #8', delivery: 'notDelivered', overdue: false, hoursLeft: 48 });
        expect(tp10).toMatchObject({ sources: 'n/a', study: { id: null, state: 'none' }, dueDate: '2026-11-06' });
        expect(co.schedule.groups).toHaveLength(1);
        expect(co.schedule.groups[0]!.label).toBe('TP Semanal');
    });

    it('«no repetir» compara solo dentro del mismo tipo de trabajo', () => {
        const input = nt785();
        input.project.workTypes = [...input.project.workTypes!, { id: 'ens', label: 'Ensayo', rubricTemplateId: 'rub1' }];
        input.project.courseSchedule = input.project.courseSchedule!.map(e => (e.id === 'e8' ? { ...e, workTypeId: 'ens' } : e));
        const [tp6, tp7, ens, tp9] = buildProjectDesk(input, NOW_CURSO).course!.schedule.rows;
        expect(ens).toMatchObject({ sources: 'noRepeat', comparedWith: null });
        expect(tp9).toMatchObject({ comparedWith: 'TP #7' });
        expect(tp7!.comparedWith).toBe('TP #6');
        expect(tp6!.comparedWith).toBeNull();
    });

    it('«no repetir» sigue el nacimiento del estudio, no el calendario: un TP traído sin fecha no compara contra uno posterior', () => {
        const input = nt785();
        // TP #7 y TP #8 traídos de antes, sin fecha: el calendario los pone al final.
        input.project.courseSchedule = input.project.courseSchedule!
            .filter(e => e.id !== 'e6')
            .map(e => (e.id === 'e7' || e.id === 'e8' ? { ...e, dueDate: null, imported: true } : e));
        const rows = buildProjectDesk(input, NOW_CURSO).course!.schedule.rows;
        // Las sin fecha, al final en el orden guardado (TP #8 antes que TP #7).
        expect(rows.map(r => r.label)).toEqual(['TP #9', 'TP #10', 'TP #8', 'TP #7']);
        const por = Object.fromEntries(rows.map(r => [r.label, r]));
        // TP #7 nació primero: nunca «repite» contra TP #9.
        expect(por['TP #7']).toMatchObject({ sources: 'noRepeat', comparedWith: null, repeated: [] });
        expect(por['TP #8']).toMatchObject({ sources: 'repeats', repeated: ['moo'], comparedWith: 'TP #7' });
        expect(por['TP #9']).toMatchObject({ sources: 'noRepeat', comparedWith: 'TP #8' });
    });

    it('«no repetir» elige la anterior con la misma regla que el analizador: la última que citó algo', () => {
        const input = nt785();
        input.studies = input.studies.map(s => (s.id === 's8' ? { ...s, citedSourceKeys: [] } : s));
        const por = Object.fromEntries(buildProjectDesk(input, NOW_CURSO).course!.schedule.rows.map(r => [r.label, r]));
        // TP #8 no citó nada: «sin datos» (no «sin repetir»).
        expect(por['TP #8']).toMatchObject({ sources: 'unknown', comparedWith: 'TP #7', repeated: [] });
        // TP #9 se compara con TP #7, como `previousDelivery` en el analizador.
        expect(por['TP #9']).toMatchObject({ sources: 'noRepeat', comparedWith: 'TP #7' });
    });

    it('sin claves citadas de un lado, la celda es «sin datos»', () => {
        const input = nt785();
        // Ninguna anterior citó nada: no hay con qué comparar, pero sí había anteriores.
        input.studies = input.studies.map(s => (s.id === 's6' || s.id === 's7' || s.id === 's8' ? { ...s, citedSourceKeys: undefined } : s));
        const por = Object.fromEntries(buildProjectDesk(input, NOW_CURSO).course!.schedule.rows.map(r => [r.label, r]));
        expect(por['TP #6']).toMatchObject({ sources: 'noRepeat' });
        expect(por['TP #7']).toMatchObject({ sources: 'unknown', comparedWith: null });
        expect(por['TP #9']).toMatchObject({ sources: 'unknown', comparedWith: null });
    });

    it('sin la regla «no repetir», las fuentes no se comparan', () => {
        const input = nt785();
        input.project.bibliographyCriteria!.noRepeatSources = false;
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(x.course!.noRepeat).toBe(false);
        expect(x.course!.schedule.rows.every(r => r.sources === 'n/a')).toBe(true);
    });

    it('los tipos de trabajo, las entregas fuera de calendario y la lectura dirigida', () => {
        expect(co.workTypes).toEqual([{ id: 'tp', label: 'TP Semanal', rubric: 'template', rubricResolved: true, rubricConfirmed: false, rubricLoading: false, method: 'mixed', guideId: 'g1', entries: 5 }]);
        expect(co.offCalendar.map(s => s.id)).toEqual(['s1']);
        expect(co.directedReading).toEqual([{ requirementId: 'pag', text: 'Cien páginas de artículos', pages: 64, target: 100, pending: 1 }]);
        expect(co.sources.requirements).toEqual({ met: 1, total: 1, accepted: 1, incomplete: 0 });
    });

    it('el registro de devoluciones: pendientes primero, con conteo y entregas', () => {
        expect(co.feedback.patterns).toEqual([
            { patternId: 'cd', name: 'Cierre doble', decision: 'pending', corrections: 3, entries: [{ entryId: 'e6', label: 'TP #6' }, { entryId: 'e7', label: 'TP #7' }], recurring: true, discardReason: null },
            { patternId: 'cat', name: 'Categoría ≠ traducción', decision: 'guide', corrections: 1, entries: [{ entryId: 'e7', label: 'TP #7' }], recurring: false, discardReason: null },
        ]);
        expect(co.feedback).toMatchObject({ delivered: 3, returned: 2, noFeedback: 0, awaiting: 1, repeatedPending: 1 });
    });

    it('fase 5 lista: cada entrega con devolución (o «sin devolución») y el patrón decidido', () => {
        const input = nt785();
        input.project.courseSchedule = input.project.courseSchedule!.map(e => (e.id === 'e8'
            ? { ...e, feedback: { receivedAt: '2026-10-25T10:00:00.000Z', text: '', corrections: [], none: true } }
            : e));
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'feedback').status).toBe('doing');
        input.project.feedbackPatterns = input.project.feedbackPatterns!.map(p => ({ ...p, decision: 'discarded' as const, discardReason: 'No aplica a este curso' }));
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(fase(x, 'feedback')).toMatchObject({ status: 'ready', evidence: { key: 'desk.course.feedback.ready', params: { returned: 2, none: 1 } } });
        expect(x.course!.schedule.rows[2]!.delivery).toBe('noFeedback');
        expect(x.course!.feedback.patterns[0]).toMatchObject({ decision: 'discarded', discardReason: 'No aplica a este curso' });
    });

    it('un descarte sin razón no cuenta: el patrón sigue pendiente y frena la fase 5', () => {
        const input = nt785();
        input.project.courseSchedule = input.project.courseSchedule!.map(e => (e.id === 'e8'
            ? { ...e, feedback: { receivedAt: '2026-10-25T10:00:00.000Z', text: '', corrections: [], none: true } }
            : e));
        input.project.feedbackPatterns = input.project.feedbackPatterns!.map(p => ({ ...p, decision: 'discarded' as const }));
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(fase(x, 'feedback')).toMatchObject({ status: 'doing', evidence: { params: { returned: 2, none: 1, delivered: 3, pendingPatterns: 1 } } });
        expect(x.course!.feedback.patterns.find(p => p.patternId === 'cd')).toMatchObject({ decision: 'pending', discardReason: null });
    });

    it('una entrega entregada sin devolución frena la fase 5 aunque los patrones estén decididos', () => {
        const input = nt785();
        input.project.feedbackPatterns = input.project.feedbackPatterns!.map(p => ({ ...p, decision: 'guide' as const }));
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'feedback').status).toBe('doing');
    });

    it('un patrón en una sola entrega no se repite (aunque tenga dos correcciones) y no frena la fase 5', () => {
        const input = nt785();
        // Sin TP #6: «cierre doble» queda con dos correcciones, las dos en TP #7.
        input.project.courseSchedule = input.project.courseSchedule!.filter(e => e.id !== 'e8' && e.id !== 'e6');
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(x.course!.feedback.patterns.find(p => p.patternId === 'cd')).toMatchObject({ corrections: 2, recurring: false });
        expect(x.course!.feedback.repeatedPending).toBe(0);
        expect(fase(x, 'feedback').status).toBe('ready');
        expect(x.notes.map(n => n.text.key)).not.toContain('desk.notes.pendingPatterns');
    });

    it('dos o más entregas sin devolución: UNA nota con el conteo', () => {
        const input = nt785();
        input.project.courseSchedule = input.project.courseSchedule!.map(e => (e.id === 'e7' ? { ...e, feedback: null } : e));
        const x = buildProjectDesk(input, NOW_CURSO);
        const sin = x.notes.filter(n => n.text.key.startsWith('desk.notes.noFeedback'));
        expect(sin).toEqual([{ text: { key: 'desk.notes.noFeedbackMany', params: { count: 2 } }, target: { type: 'phase', phaseId: 'feedback' }, phaseId: 'feedback' }]);
    });

    it('sin devoluciones, por empezar', () => {
        const input = nt785();
        input.project.courseSchedule = input.project.courseSchedule!.map(e => ({ ...e, feedback: null }));
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'feedback').status).toBe('todo');
    });

    it('una entrega vencida sin entregar: nota', () => {
        const input = nt785();
        input.project.courseSchedule = input.project.courseSchedule!.map(e => (e.id === 'e8' ? { ...e, deliveredAt: null } : e));
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(x.course!.schedule.rows[2]!.overdue).toBe(true);
        expect(x.notes.find(n => n.text.key === 'desk.notes.overdue')).toMatchObject({ text: { params: { label: 'TP #8', dueDate: '2026-10-21' } }, target: { type: 'study', id: 's8' } });
    });

    it('calendario incompleto: una entrega sin fecha o con un tipo que no existe', () => {
        const input = nt785();
        input.project.courseSchedule = [...input.project.courseSchedule!, { id: 'e11', workTypeId: 'borrado', label: 'Ensayo' }];
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(fase(x, 'calendar')).toMatchObject({ status: 'doing', evidence: { params: { entries: 6, missing: 1 } }, progress: { done: 5, total: 6 } });
        // N son las entradas del calendario, con o sin estudio.
        expect(fase(x, 'works').progress).toEqual({ done: 3, total: 6 });
        // La entrada sin fecha va al final; su tipo desconocido, en su grupo.
        expect(x.course!.schedule.rows.at(-1)!.label).toBe('Ensayo');
        expect(x.course!.schedule.groups.map(g => g.workTypeId)).toEqual(['tp', 'borrado']);
    });

    it('una entrada traída de antes o ya entregada no pide fecha', () => {
        const input = nt785();
        input.project.courseSchedule = input.project.courseSchedule!.map(e => (e.id === 'e6' ? { ...e, dueDate: null } : e.id === 'e7' ? { ...e, dueDate: null, deliveredAt: null, feedback: null, imported: true } : e));
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'calendar')).toMatchObject({ status: 'ready', evidence: { key: 'desk.course.calendar.ready', params: { entries: 5 } } });
        // Sin fecha, sin entregar y no traída: sí la pide.
        input.project.courseSchedule = input.project.courseSchedule!.map(e => (e.id === 'e10' ? { ...e, dueDate: null } : e));
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'calendar')).toMatchObject({ status: 'doing', evidence: { params: { missing: 1 } } });
    });

    it('las herramientas: griego para Santiago', () => {
        expect(m.languages).toEqual(['greek']);
    });
});

describe('Curso · rúbrica resuelta', () => {
    const cat = { ids: ['rub1'], defaultId: null };
    const conDefecto = { ids: ['rub1'], defaultId: 'rub1' };
    const si = { rubricConfirmed: true };
    it.each([
        ['una plantilla que existe (la del profesor)', { rubricTemplateId: 'rub1' }, cat, 'template', true, false, false],
        ['una plantilla borrada, aunque confirme', { rubricTemplateId: 'rub9', ...si }, cat, 'missing', false, true, false],
        ['la del sistema sin confirmar', { rubricTemplateId: null }, cat, 'system', false, false, false],
        ['la del sistema confirmada', { rubricTemplateId: null, ...si }, cat, 'system', true, true, false],
        ['solo estrategia sin confirmar', { rubricTemplateId: '__strategy-only' }, cat, 'system', false, false, false],
        ['solo estrategia confirmada', { rubricTemplateId: '__strategy-only', ...si }, cat, 'system', true, true, false],
        ['ausente con plantilla por defecto, sin confirmar', {}, conDefecto, 'default', false, false, false],
        ['ausente con plantilla por defecto, confirmada', si, conDefecto, 'default', true, true, false],
        ['ausente sin plantilla por defecto', {}, cat, 'unset', false, false, false],
        ['ausente sin plantilla por defecto, confirmada (la del sistema)', si, cat, 'unset', true, true, false],
        ['sin catálogo (cargando): no se inventa un faltante ni se da por resuelta', { rubricTemplateId: 'rub9' }, null, 'template', false, false, true],
        ['sin catálogo y ausente: la resolución no depende del catálogo', {}, null, 'default', false, false, false],
        ['sin catálogo y ausente, confirmada', si, null, 'default', true, true, false],
        ['sin catálogo y la del sistema confirmada', { rubricTemplateId: null, ...si }, null, 'system', true, true, false],
    ] as const)('%s', (_n, wt, catalogo, source, resolved, confirmed, loading) => {
        expect(workTypeRubric(wt, catalogo)).toEqual({ source, resolved, confirmed, loading });
    });

    it('la del sistema o la por defecto sin confirmar: fase 1 en curso, «sin la rúbrica del profesor»', () => {
        const input = nt785();
        input.project.workTypes = [...input.project.workTypes!, { id: 'ens', label: 'Ensayo' }, { id: 'pf', label: 'Paper final', rubricTemplateId: null }];
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(fase(x, 'charge')).toEqual({ id: 'charge', status: 'doing', evidence: { key: 'desk.course.charge.noProfessorRubric', params: { types: 3, count: 2 } } });
        // «El curso no da rúbrica»: con la confirmación, lista.
        input.project.workTypes = input.project.workTypes!.map(t => ({ ...t, rubricConfirmed: true }));
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'charge')).toMatchObject({ status: 'ready', evidence: { key: 'desk.course.charge.ready', params: { types: 3 } } });
        expect(buildProjectDesk(input, NOW_CURSO).course!.workTypes.map(w => w.rubricConfirmed)).toEqual([true, true, true]);
        input.project.workTypes = [];
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'charge').status).toBe('todo');
    });

    it('una plantilla borrada: «sin resolver», con cuántas faltan', () => {
        const input = nt785();
        input.project.workTypes = [...input.project.workTypes!, { id: 'ens', label: 'Ensayo', rubricTemplateId: 'borrada' }, { id: 'pf', label: 'Paper final' }];
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'charge')).toMatchObject({
            status: 'doing', evidence: { key: 'desk.course.charge.unresolved', params: { types: 3, unresolved: 2, missing: 1 } },
        });
    });

    it('con el catálogo cargando, la fase 1 no se decide: en curso con `loading`, nunca lista', () => {
        const input = nt785();
        input.rubricCatalog = null;
        const x = buildProjectDesk(input, NOW_CURSO);
        expect(fase(x, 'charge')).toEqual({ id: 'charge', status: 'doing', evidence: { key: 'desk.course.charge.loading', params: { types: 1 } }, loading: true });
        expect(x.course!.workTypes[0]).toMatchObject({ rubric: 'template', rubricResolved: false, rubricLoading: true });
        // Sin plantilla elegida, no hace falta el catálogo para decidir.
        input.project.workTypes = [{ id: 'tp', label: 'TP', rubricTemplateId: null, rubricConfirmed: true }];
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'charge')).toMatchObject({ status: 'ready' });
        expect(fase(buildProjectDesk(input, NOW_CURSO), 'charge').loading).toBeUndefined();
    });

    it('la guía del curso cuando el tipo no tiene', () => {
        const input = nt785();
        input.project.workTypes = [{ id: 'tp', label: 'TP', rubricTemplateId: 'rub1' }];
        expect(buildProjectDesk(input, NOW_CURSO).course!.workTypes[0]!.guideId).toBe('gcurso');
    });
});

describe('Curso · semana a semana, sin calendario', () => {
    const input = (): ProjectDeskInput => ({
        project: { id: 'c2', type: 'course', courseScheduleMode: 'free', workTypes: [{ id: 'tp', label: 'TP', rubricTemplateId: null, rubricConfirmed: true }] },
        studies: [ensamblado('a1'), study('a2')],
    });

    it('la salida explícita deja lista la fase 3; la 4 cuenta los estudios', () => {
        const m = buildProjectDesk(input(), NOW);
        expect(fase(m, 'calendar')).toMatchObject({ status: 'ready', evidence: { key: 'desk.course.calendar.free' } });
        expect(fase(m, 'works')).toMatchObject({ status: 'doing', progress: { done: 1, total: 2 } });
        expect(m.course!.offCalendar).toHaveLength(2);
    });

    it('sin calendario ni modo, la fase 3 está por empezar', () => {
        const i = input();
        delete i.project.courseScheduleMode;
        const m = buildProjectDesk(i, NOW);
        expect(fase(m, 'calendar').status).toBe('todo');
        expect(m.course!.schedule.mode).toBeNull();
    });
});

describe('General y los otros tipos', () => {
    it('General: sin fases; «Ahora» es lo último que se tocó', () => {
        const m = buildProjectDesk({
            project: { id: 'g', type: 'general' },
            studies: [study('g1', { updatedAt: '2026-10-20T10:00:00.000Z' })],
            outputs: [{ id: 'o1', kind: 'note', title: 'Apuntes', updatedAt: '2026-10-22T10:00:00.000Z' }],
        }, NOW);
        expect(m).toMatchObject({ type: 'general', phases: [], activePhaseId: null, notes: [] });
        expect(m.now).toMatchObject({ kind: 'recent', text: { key: 'desk.now.recentOutput', params: { label: 'Apuntes' } }, target: { type: 'output', id: 'o1' } });
    });

    it('General: lastTouched gana si es más reciente, y toma el rótulo de la lista', () => {
        const m = buildProjectDesk({
            project: { id: 'g', type: 'general' },
            studies: [study('g1', { title: 'Romanos 8', updatedAt: '2026-10-20T10:00:00.000Z' })],
            lastTouched: { kind: 'study', id: 'g1', at: '2026-10-25T10:00:00.000Z' },
        }, NOW);
        expect(m.now).toMatchObject({ text: { key: 'desk.now.recentStudy', params: { label: 'Romanos 8' } }, target: { type: 'study', id: 'g1' } });
    });

    it('General vacío, o sin tipo: nada que hacer', () => {
        expect(buildProjectDesk({ project: { id: 'g' }, studies: [] }, NOW)).toMatchObject({ type: 'general', now: null, phases: [] });
    });

    it.each(['study', 'counseling', 'sermon', 'series'] as const)('%s: «other», sin recalcular fases', type => {
        const m = buildProjectDesk({ project: { id: 'x', type, contextNote: 'nota', sourceIds: ['r1'] }, studies: [study('z')] }, NOW);
        expect(m).toMatchObject({ type: 'other', phases: [], activePhaseId: null, now: null, notes: [] });
        expect(m.exegetical).toBeUndefined();
        expect(m.course).toBeUndefined();
    });
});

describe('claves de texto', () => {
    it('todo lo que produce el escritorio está en DESK_TEXT_KEYS, y las claves no se repiten', () => {
        expect(new Set(DESK_TEXT_KEYS).size).toBe(DESK_TEXT_KEYS.length);
        const conocidas = new Set<string>(DESK_TEXT_KEYS);
        const escenarios: Array<[ProjectDeskInput, Date]> = [
            [esdrasRecienCreado(), NOW], [esdrasAMedias(), NOW], [esdrasEnSintesis(), NOW], [paraEnsenar(), NOW],
            [jonasLegacy(), NOW], [nt785(), NOW_CURSO], [nt785(), new Date(2026, 10, 20)],
        ];
        // Los que producen las claves de la ronda de arreglos.
        const sinDevoluciones = nt785();
        sinDevoluciones.project.courseSchedule = sinDevoluciones.project.courseSchedule!.map(e => ({ ...e, feedback: null }));
        const cargando = nt785();
        cargando.rubricCatalog = null;
        const delSistema = nt785();
        delSistema.project.workTypes = [{ id: 'tp', label: 'TP', rubricTemplateId: null }];
        const borrada = nt785();
        borrada.project.workTypes = [{ id: 'tp', label: 'TP', rubricTemplateId: 'borrada' }];
        const ensenar = paraEnsenar();
        delete ensenar.project.framing!.divisionWithoutSeries;
        ensenar.studies = [...ensenar.studies, ensamblado('t3')];
        escenarios.push([sinDevoluciones, NOW_CURSO], [cargando, NOW_CURSO], [delSistema, NOW_CURSO], [borrada, NOW_CURSO], [ensenar, NOW]);
        const vistas = new Set<string>();
        for (const [input, now] of escenarios) {
            const m = buildProjectDesk(input, now);
            const claves = [...m.phases.map(p => p.evidence.key), ...m.notes.map(n => n.text.key), ...(m.now ? [m.now.text.key] : [])];
            for (const k of claves) { expect(conocidas.has(k), k).toBe(true); vistas.add(k); }
        }
        for (const k of ['desk.notes.noFeedbackMany', 'desk.course.charge.loading', 'desk.course.charge.noProfessorRubric', 'desk.course.charge.unresolved', 'desk.exegetical.division.readyStudies']) {
            expect(vistas.has(k), k).toBe(true);
        }
    });
});
