import { describe, expect, it } from 'vitest';
import { buildProjectDesk, deskNow, type DeskNowKind, type DeskTargetType, type ProjectDeskInput } from '../projectDesk';
import {
    NOW,
    NOW_CURSO,
    ensamblado,
    esdrasAMedias,
    esdrasEnSintesis,
    esdrasRecienCreado,
    ficha,
    nt785,
    paraEnsenar,
    proyecto,
    serieEsdras,
    study,
} from './projectDesk.fixtures';

/**
 * La tabla de «Ahora» (`deskNow`). Exegético: la continuidad antes que el
 * método. Curso: el plazo gobierna > continuidad > siguiente del
 * calendario > fase activa.
 */

interface Esperado {
    kind: DeskNowKind | null;
    key?: string;
    target?: DeskTargetType;
    id?: string;
    extra?: Record<string, unknown>;
}

const con = (f: (i: ProjectDeskInput) => void, base: () => ProjectDeskInput) => () => {
    const i = base();
    f(i);
    return i;
};

/** Un Esdras con fuentes listas y la serie creada, sin nada en curso: manda la fase activa. */
const esdrasQuieto = con(i => {
    i.studies = i.studies.map(s => (s.id === 's5' ? { ...s, phase: 'configuring' as const, acceptedStepCount: 0, updatedAt: s.createdAt } : s));
    i.project.bibliography = [ficha('b1'), ficha('b2'), ficha('b5', { sourceType: 'journal-article' }), ficha('b6', { sourceType: 'journal-article' })];
}, esdrasAMedias);

const sinEstudiosCurso = (i: ProjectDeskInput) => {
    i.studies = i.studies.map(s => (s.id === 's9' ? { ...s, phase: 'configuring' as const, updatedAt: s.createdAt } : s));
};

const TABLA: Array<[string, () => ProjectDeskInput, Date, Esperado]> = [
    // ── Exegético ──
    ['Ex · el estudio en curso más reciente gana a la fase activa', esdrasAMedias, NOW,
        { kind: 'continuity', key: 'desk.now.continuePericope', target: 'study', id: 's5' }],
    ['Ex · de dos en curso, el tocado más recientemente', con(i => {
        i.studies = i.studies.map(s => (s.id === 's7' ? { ...s, phase: 'in-progress' as const, updatedAt: '2026-10-26T08:00:00.000Z' } : s));
    }, esdrasAMedias), NOW, { kind: 'continuity', target: 'study', id: 's7' }],
    ['Ex · en configuración pero editado después de nacer cuenta como tocado', con(i => {
        i.studies = i.studies.map(s => (s.id === 's8' ? { ...s, updatedAt: '2026-10-01T10:05:00.000Z' } : s));
    }, esdrasQuieto), NOW, { kind: 'continuity', target: 'study', id: 's8' }],
    ['Ex · los que la serie crea en lote no son continuidad', con(i => {
        i.studies = i.studies.map(s => (s.id === 's8' ? { ...s, updatedAt: '2026-10-01T10:01:00.000Z' } : s));
    }, esdrasQuieto), NOW, { kind: 'phase', key: 'desk.now.pericope', target: 'study', id: 's5' }],
    ['Ex · un estudio suelto en curso usa su título', con(i => {
        i.studies = [...i.studies, study('suelto', { phase: 'in-progress', title: 'Esdras 9 aparte', updatedAt: '2026-10-26T09:00:00.000Z' })];
    }, esdrasAMedias), NOW, { kind: 'continuity', key: 'desk.now.continue', id: 'suelto', extra: { label: 'Esdras 9 aparte' } }],
    ['Ex · sin nada en curso, la perícopa con fecha en los próximos 7 días', con(i => {
        // La perícopa 1 cae el domingo 1 de noviembre: dentro de la semana.
        i.studies = i.studies.map(s => (s.id === 's1' ? { ...s, phase: 'configuring' as const, acceptedStepCount: 0, updatedAt: s.createdAt } : s));
    }, esdrasQuieto), NOW, { kind: 'upcoming', key: 'desk.now.upcomingPericope', target: 'study', id: 's1', extra: { dueDate: '2026-11-01' } }],
    ['Ex · la continuidad gana a la perícopa con fecha cercana', con(i => {
        i.studies = i.studies.map(s => (s.id === 's1' ? { ...s, phase: 'configuring' as const, acceptedStepCount: 0, updatedAt: s.createdAt } : s));
    }, esdrasAMedias), NOW, { kind: 'continuity', id: 's5' }],
    ['Ex · una perícopa a 8 días no es «próxima»', con(i => {
        i.studies = i.studies.map(s => (s.id === 's1' ? { ...s, phase: 'configuring' as const, acceptedStepCount: 0, updatedAt: s.createdAt } : s));
    }, esdrasQuieto), new Date(2026, 9, 24, 10), { kind: 'phase', key: 'desk.now.pericope', id: 's1' }],
    ['Ex · una perícopa con fecha ya ensamblada no se ofrece', esdrasQuieto, new Date(2026, 9, 30, 10),
        { kind: 'phase', key: 'desk.now.pericope', id: 's5' }],
    ['Ex · fase 1 → el encuadre', esdrasRecienCreado, NOW, { kind: 'phase', key: 'desk.now.passageOldNote', target: 'framing' }],
    ['Ex · fase 2 → el estado del arte', con(i => { i.project.framing = { centralIdea: 'Idea' }; }, esdrasRecienCreado), NOW,
        { kind: 'phase', key: 'desk.now.sources', target: 'stateOfArt' }],
    ['Ex · fase 3 → planificar la serie', con(i => {
        i.project.framing = { centralIdea: 'Idea' };
        i.project.bibliography = [ficha('a')];
    }, esdrasRecienCreado), NOW, { kind: 'phase', key: 'desk.now.division', target: 'planSeries' }],
    ['Ex · fase 4 → el siguiente sin ensamblar en el orden del plan', esdrasQuieto, NOW,
        { kind: 'phase', key: 'desk.now.pericope', target: 'study', id: 's5', extra: { params: { position: 5, label: 'Esd 5:1-13' } } }],
    ['Ex · fase 4 sin serie → el estudio suelto sin ensamblar', paraEnsenar, NOW, { kind: 'phase', key: 'desk.now.study', target: 'study', id: 't2' }],
    ['Ex · fase 4 sin estudios → crear uno', con(i => { i.studies = []; }, paraEnsenar), NOW, { kind: 'phase', key: 'desk.now.newStudy', target: 'phase' }],
    ['Ex · fase 5 con anotaciones → revisar la idea', con(i => { delete i.project.framing!.revision; }, esdrasEnSintesis), NOW,
        { kind: 'phase', key: 'desk.now.reviseIdea', target: 'reviseIdea' }],
    ['Ex · todo listo → nada', esdrasEnSintesis, NOW, { kind: null }],
    ['Ex · la continuidad gana aun con todo listo', con(i => {
        i.studies = [...i.studies, study('extra', { phase: 'in-progress', updatedAt: '2026-10-26T09:00:00.000Z' })];
    }, esdrasEnSintesis), NOW, { kind: 'continuity', id: 'extra' }],

    // ── Curso ──
    ['Cu · vence en 48 h, en curso → continuar', nt785, NOW_CURSO,
        { kind: 'deadline', key: 'desk.now.deadline.continue', target: 'study', id: 's9', extra: { hoursLeft: 48, dueDate: '2026-10-28' } }],
    ['Cu · vence en 48 h, ensamblado → revisar antes de entregar', con(i => {
        i.studies = i.studies.map(s => (s.id === 's9' ? { ...s, phase: 'assembled' as const } : s));
    }, nt785), NOW_CURSO, { kind: 'deadline', key: 'desk.now.deadline.review', id: 's9' }],
    ['Cu · vence en 48 h, sin estudio → crearlo con su tipo', con(i => {
        i.project.courseSchedule = i.project.courseSchedule!.map(e => (e.id === 'e9' ? { ...e, paperId: null } : e));
    }, nt785), NOW_CURSO, { kind: 'deadline', key: 'desk.now.deadline.create', target: 'createScheduled', id: 'e9', extra: { workTypeId: 'tp', label: 'TP #9' } }],
    ['Cu · el plazo gana a la continuidad', con(i => {
        i.studies = [...i.studies, study('otro', { phase: 'in-progress', updatedAt: '2026-10-26T22:00:00.000Z' })];
    }, nt785), NOW_CURSO, { kind: 'deadline', id: 's9' }],
    ['Cu · a 73 h no es plazo: gana la continuidad', nt785, new Date(2026, 9, 25, 22, 59),
        { kind: 'continuity', key: 'desk.now.continue', id: 's9', extra: { label: 'TP #9' } }],
    ['Cu · el día de la entrega todavía es plazo', nt785, new Date(2026, 9, 28, 20, 0),
        { kind: 'deadline', id: 's9', extra: { hoursLeft: 3 } }],
    ['Cu · entregado no es plazo', con(i => {
        i.project.courseSchedule = i.project.courseSchedule!.map(e => (e.id === 'e9' ? { ...e, deliveredAt: '2026-10-26T20:00:00.000Z' } : e));
        sinEstudiosCurso(i);
    }, nt785), NOW_CURSO, { kind: 'scheduled', key: 'desk.now.createScheduled', target: 'createScheduled', id: 'e10', extra: { dueDate: '2026-11-06', workTypeId: 'tp', label: 'TP #10' } }],
    ['Cu · vencido no es plazo ni «lo que sigue» (va como nota)', con(i => {
        sinEstudiosCurso(i);
        i.project.courseSchedule = i.project.courseSchedule!.map(e => (e.id === 'e9' ? { ...e, paperId: null } : e));
    }, nt785), new Date(2026, 9, 29, 10),
        { kind: 'scheduled', id: 'e10' }],
    ['Cu · de dos plazos, el más próximo', con(i => {
        i.project.courseSchedule = i.project.courseSchedule!.map(e => (e.id === 'e10' ? { ...e, dueDate: '2026-10-27' } : e));
    }, nt785), NOW_CURSO, { kind: 'deadline', key: 'desk.now.deadline.create', id: 'e10' }],
    ['Cu · sin plazo ni continuidad ni siguiente → la fase activa (fuentes)', con(i => {
        sinEstudiosCurso(i);
        i.project.courseSchedule = i.project.courseSchedule!.filter(e => e.id !== 'e10').map(e => (e.id === 'e9' ? { ...e, deliveredAt: '2026-10-26T20:00:00.000Z' } : e));
    }, nt785), NOW_CURSO, { kind: 'phase', key: 'desk.now.sources', target: 'stateOfArt' }],
    ['Cu · fase 1 activa → lo que pide el curso', con(i => { i.project.workTypes = []; i.project.courseSchedule = []; i.studies = []; }, nt785), NOW_CURSO,
        { kind: 'phase', key: 'desk.now.charge', target: 'phase' }],
    ['Cu · fase 3 activa → el calendario', con(i => {
        i.project.courseSchedule = [];
        i.project.courseScheduleMode = null;
        i.project.bibliography = [ficha('a')];
        i.studies = [];
    }, nt785), NOW_CURSO, { kind: 'phase', key: 'desk.now.calendar', target: 'phase' }],
    ['Cu · fase 4 activa con entrada sin estudio y vencida → crearla', con(i => {
        i.project.bibliography = [ficha('a')];
        i.project.courseSchedule = [{ id: 'e1', workTypeId: 'tp', label: 'TP #1', dueDate: '2026-10-01' }];
        i.studies = [];
    }, nt785), NOW_CURSO, { kind: 'phase', key: 'desk.now.workCreate', target: 'createScheduled', id: 'e1' }],
    ['Cu · fase 5 activa → registrar la devolución', con(i => {
        i.project.bibliography = [ficha('a')];
        i.project.courseSchedule = [{ id: 'e1', workTypeId: 'tp', label: 'TP #1', dueDate: '2026-10-01', paperId: 's1', deliveredAt: '2026-10-01T20:00:00.000Z' }];
        i.studies = [ensamblado('s1')];
    }, nt785), NOW_CURSO, { kind: 'phase', key: 'desk.now.recordFeedback', target: 'recordFeedback', id: 'e1' }],
    ['Cu · fase 5 con un patrón repetido sin decidir → decidirlo', con(i => {
        i.project.bibliography = [ficha('a')];
        i.project.courseSchedule = [{
            id: 'e1', workTypeId: 'tp', label: 'TP #1', dueDate: '2026-10-01', paperId: 's1', deliveredAt: '2026-10-01T20:00:00.000Z',
            feedback: { receivedAt: '2026-10-05T10:00:00.000Z', text: 'x', corrections: [{ id: 'a', patternId: 'cd' }, { id: 'b', patternId: 'cd' }] },
        }];
        i.studies = [ensamblado('s1')];
    }, nt785), NOW_CURSO, { kind: 'phase', key: 'desk.now.decidePatterns', target: 'phase', extra: { params: { count: 1 } } }],
    ['Cu · sin calendario: la fase 4 lleva al estudio sin ensamblar', () => ({
        project: { id: 'c', type: 'course', courseScheduleMode: 'free', workTypes: [{ id: 'tp', label: 'TP', rubricTemplateId: null }], bibliography: [ficha('a')] },
        studies: [ensamblado('a1'), study('a2', { title: 'Ensayo' })],
    }), NOW, { kind: 'phase', key: 'desk.now.work', target: 'study', id: 'a2' }],

    // ── General ──
    ['Ge · lo último que se tocó', () => ({ project: { id: 'g', type: 'general' }, studies: [study('g1', { updatedAt: '2026-10-25T10:00:00.000Z' })] }), NOW,
        { kind: 'recent', key: 'desk.now.recentStudy', target: 'study', id: 'g1' }],
    ['Ge · nada tocado → nada', () => ({ project: { id: 'g', type: 'general' }, studies: [] }), NOW, { kind: null }],
    ['Otro · Investigación → nada', () => ({ project: { id: 'i', type: 'study' }, studies: [study('i1', { phase: 'in-progress' })] }), NOW, { kind: null }],
];

describe('deskNow · tabla', () => {
    it.each(TABLA)('%s', (_nombre, armar, now, esperado) => {
        const m = buildProjectDesk(armar(), now);
        if (esperado.kind === null) {
            expect(m.now).toBeNull();
            return;
        }
        expect(m.now?.kind).toBe(esperado.kind);
        if (esperado.key) expect(m.now?.text.key).toBe(esperado.key);
        if (esperado.target) expect(m.now?.target.type).toBe(esperado.target);
        if (esperado.id) expect(m.now?.target.id).toBe(esperado.id);
        const { params, ...resto } = esperado.extra ?? {};
        if (params) expect(m.now?.text.params).toMatchObject(params as object);
        for (const [k, v] of Object.entries(resto)) {
            const real = k in (m.now ?? {}) ? (m.now as unknown as Record<string, unknown>)[k] : (m.now?.target as unknown as Record<string, unknown>)[k] ?? m.now?.text.params?.[k];
            expect(real, k).toEqual(v);
        }
    });
});

describe('deskNow · directo sobre el modelo', () => {
    it('es la misma regla que usa el constructor', () => {
        const m = buildProjectDesk(nt785(), NOW_CURSO);
        expect(deskNow(m, NOW_CURSO)).toEqual(m.now);
    });

    it('una serie de 12 recién creada no tiene continuidad: los estudios nacen vacíos', () => {
        const m = buildProjectDesk({
            project: proyecto({ framing: { centralIdea: 'Idea' }, bibliography: [ficha('a')] }),
            studies: Array.from({ length: 12 }, (_, i) => study(`s${i + 1}`)),
            series: [serieEsdras(12)],
        }, new Date(2026, 9, 20, 10));
        expect(m.now).toMatchObject({ kind: 'phase', text: { key: 'desk.now.pericope', params: { position: 1 } }, target: { id: 's1' } });
    });
});
