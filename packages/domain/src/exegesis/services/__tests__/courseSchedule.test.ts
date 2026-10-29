import { describe, expect, it } from 'vitest';
import {
    COURSE_FEEDBACK_MAX_CORRECTIONS,
    COURSE_FEEDBACK_TEXT_MAX,
    COURSE_SCHEDULE_MAX_ENTRIES,
    FEEDBACK_DISCARD_REASON_MAX,
    FEEDBACK_PATTERNS_MAX,
    isRecurringPattern,
    applyCourseOps,
    cleanCourseSchedule,
    cleanCourseScheduleMode,
    cleanFeedbackPatterns,
    clearFeedback,
    courseGuideCandidates,
    decidePattern,
    isCalendarDate,
    linkEntryToPaper,
    markDelivered,
    markNoFeedback,
    nextLabelFor,
    normalizePatternName,
    patternRecurrence,
    recordFeedback,
    removeEntry,
    unmarkDelivered,
    upsertEntry,
    upsertPattern,
    type CourseScheduleEntry,
    type FeedbackPattern,
} from '../courseSchedule';

/** Como Firestore sin `ignoreUndefinedProperties`: un undefined en cualquier nivel tumba la escritura. */
function rechazaUndefined(v: unknown, ruta = 'raíz'): void {
    if (v === undefined) throw new Error(`undefined en ${ruta}`);
    if (Array.isArray(v)) v.forEach((x, i) => rechazaUndefined(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) rechazaUndefined(x, `${ruta}.${k}`);
}

const STG = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 };
const AT = '2026-10-26T15:00:00.000Z';
const ids = (prefijo: string) => { let n = 0; return () => `${prefijo}${++n}`; };

const tp = (n: number, extra: Partial<CourseScheduleEntry> = {}): CourseScheduleEntry =>
    ({ id: `e${n}`, workTypeId: 'wt_tp', label: `TP #${n}`, ...extra });

describe('isCalendarDate', () => {
    it('acepta fechas reales YYYY-MM-DD y rechaza las que no existen', () => {
        expect(isCalendarDate('2026-10-31')).toBe(true);
        expect(isCalendarDate('2028-02-29')).toBe(true);
        expect(isCalendarDate('2026-02-29')).toBe(false);
        expect(isCalendarDate('2026-13-01')).toBe(false);
        expect(isCalendarDate('2026-10-31T00:00:00Z')).toBe(false);
        expect(isCalendarDate(20261031)).toBe(false);
    });
});

describe('cleanCourseSchedule — limpieza profunda', () => {
    it('quita undefined anidados, nulls, fechas inválidas y pasajes rotos', () => {
        const out = cleanCourseSchedule([
            {
                id: ' e1 ', workTypeId: 'wt_tp', label: '  TP #9  ', passage: { ...STG, extra: undefined },
                dueDate: '2026-10-31', paperId: undefined, deliveredAt: 'no es fecha', imported: undefined,
                feedback: {
                    receivedAt: '2026-11-03T12:00:00Z', text: ' Bien ', grade: undefined,
                    corrections: [{ id: 'c1', patternId: 'p1', note: undefined }, { id: 'c2' }, undefined],
                },
            },
            { id: 'e2', workTypeId: 'wt_tp', label: 'TP #10', dueDate: '2026-02-30', passage: { bookId: 'XXX', chapterStart: 1 } },
        ]);
        rechazaUndefined(out);
        expect(out).toEqual([
            {
                id: 'e1', workTypeId: 'wt_tp', label: 'TP #9', passage: STG, dueDate: '2026-10-31',
                feedback: { receivedAt: '2026-11-03T12:00:00.000Z', text: 'Bien', corrections: [{ id: 'c1', patternId: 'p1' }] },
            },
            { id: 'e2', workTypeId: 'wt_tp', label: 'TP #10' },
        ]);
    });

    it('descarta entradas sin id, duplicadas o vacías; guarda sin tipo como \'\'', () => {
        const out = cleanCourseSchedule([
            { workTypeId: 'wt', label: 'x' },
            { id: 'a', workTypeId: '', label: '' },
            { id: 'b', label: 'Ensayo' },
            { id: 'b', label: 'Otro' },
            'basura', null,
        ]);
        expect(out).toEqual([{ id: 'b', workTypeId: '', label: 'Ensayo' }]);
    });

    it('un trabajo cumple una sola entrada: la repetida pierde el paperId', () => {
        const out = cleanCourseSchedule([tp(1, { paperId: 'x' }), tp(2, { paperId: 'x' })]);
        expect(out[0]!.paperId).toBe('x');
        expect(out[1]).not.toHaveProperty('paperId');
    });

    it('«sin devolución» no lleva texto ni correcciones; sin receivedAt no hay devolución', () => {
        const out = cleanCourseSchedule([
            tp(1, { feedback: { receivedAt: AT, text: 'algo', corrections: [{ id: 'c', patternId: 'p' }], none: true } }),
            tp(2, { feedback: { text: 'sin fecha', corrections: [] } as never }),
        ]);
        expect(out[0]!.feedback).toEqual({ receivedAt: AT, text: '', corrections: [], none: true });
        expect(out[1]).not.toHaveProperty('feedback');
    });

    it('aplica los topes: entradas, texto de la devolución, correcciones', () => {
        const muchas = Array.from({ length: COURSE_SCHEDULE_MAX_ENTRIES + 5 }, (_, i) => tp(i));
        expect(cleanCourseSchedule(muchas)).toHaveLength(COURSE_SCHEDULE_MAX_ENTRIES);
        const [e] = cleanCourseSchedule([tp(1, {
            feedback: {
                receivedAt: AT, text: 'x'.repeat(COURSE_FEEDBACK_TEXT_MAX + 50),
                corrections: Array.from({ length: COURSE_FEEDBACK_MAX_CORRECTIONS + 5 }, (_, i) => ({ id: `c${i}`, patternId: 'p' })),
            },
        })]);
        expect(e!.feedback!.text).toHaveLength(COURSE_FEEDBACK_TEXT_MAX);
        expect(e!.feedback!.corrections).toHaveLength(COURSE_FEEDBACK_MAX_CORRECTIONS);
    });

    it('imported solo cuando es true', () => {
        expect(cleanCourseSchedule([tp(1, { imported: true })])[0]!.imported).toBe(true);
        expect(cleanCourseSchedule([{ ...tp(1), imported: 'sí' }])[0]).not.toHaveProperty('imported');
    });
});

describe('cleanFeedbackPatterns', () => {
    it('nombres únicos normalizados: «Cierre doble» y «cierre  doble.» son uno', () => {
        const out = cleanFeedbackPatterns([
            { id: 'p1', name: 'Cierre doble', decision: 'pending' },
            { id: 'p2', name: 'cierre  doble.', decision: 'pending' },
            { id: 'p1', name: 'Otro', decision: 'pending' },
            { id: 'p3', name: '   ', decision: 'pending' },
            { id: 'p4', name: 'Categoría ≠ traducción', decision: 'raro', description: undefined },
        ]);
        rechazaUndefined(out);
        expect(out).toEqual([
            { id: 'p1', name: 'Cierre doble', decision: 'pending' },
            { id: 'p4', name: 'Categoría ≠ traducción', decision: 'pending' },
        ]);
    });

    it('«guide» sin guía o sin texto y «discarded» sin razón vuelven a pendiente; pending no lleva fecha', () => {
        const out = cleanFeedbackPatterns([
            { id: 'a', name: 'A', decision: 'guide', guideId: 'g1', decidedAt: AT },
            { id: 'b', name: 'B', decision: 'pending', decidedAt: AT, guideId: 'g1', ruleText: 'r', discardReason: 'x' },
            { id: 'c', name: 'C', decision: 'guide', guideId: 'g1', ruleText: ' Regla ', decidedAt: AT, discardReason: 'x' },
            { id: 'd', name: 'D', decision: 'discarded', decidedAt: AT, guideId: 'g', ruleText: 'r', discardReason: ' No aplica a este curso ' },
            { id: 'e', name: 'E', decision: 'discarded', decidedAt: AT },
            { id: 'f', name: 'F', decision: 'discarded', decidedAt: AT, discardReason: '   ' },
            { id: 'g', name: 'G', decision: 'discarded', decidedAt: AT, discardReason: 'x'.repeat(FEEDBACK_DISCARD_REASON_MAX + 50) },
        ]);
        rechazaUndefined(out);
        expect(out).toEqual([
            { id: 'a', name: 'A', decision: 'pending' },
            { id: 'b', name: 'B', decision: 'pending' },
            { id: 'c', name: 'C', decision: 'guide', guideId: 'g1', ruleText: 'Regla', decidedAt: AT },
            { id: 'd', name: 'D', decision: 'discarded', discardReason: 'No aplica a este curso', decidedAt: AT },
            { id: 'e', name: 'E', decision: 'pending' },
            { id: 'f', name: 'F', decision: 'pending' },
            { id: 'g', name: 'G', decision: 'discarded', discardReason: 'x'.repeat(FEEDBACK_DISCARD_REASON_MAX), decidedAt: AT },
        ]);
    });

    it('tope de patrones', () => {
        const muchos = Array.from({ length: FEEDBACK_PATTERNS_MAX + 3 }, (_, i) => ({ id: `p${i}`, name: `Patrón ${i}`, decision: 'pending' }));
        expect(cleanFeedbackPatterns(muchos)).toHaveLength(FEEDBACK_PATTERNS_MAX);
    });

    it('normalizePatternName quita tildes, comillas y puntuación final', () => {
        expect(normalizePatternName('  «Categoría»  ≠ traducción. ')).toBe('categoria ≠ traduccion');
        expect(normalizePatternName('FDA')).toBe('fda');
    });

    it('cleanCourseScheduleMode', () => {
        expect(cleanCourseScheduleMode('free')).toBe('free');
        expect(cleanCourseScheduleMode('calendar')).toBe('calendar');
        expect(cleanCourseScheduleMode('otro')).toBeNull();
    });
});

describe('operaciones del calendario', () => {
    it('upsertEntry crea con id nuevo y edita sin borrar lo que no viene; null borra', () => {
        let s = upsertEntry([], { workTypeId: 'wt_tp', label: 'TP #9', dueDate: '2026-10-31', passage: STG as never }, ids('n'));
        expect(s).toEqual([{ id: 'n1', workTypeId: 'wt_tp', label: 'TP #9', dueDate: '2026-10-31', passage: STG }]);
        s = markDelivered(s, 'n1', AT);
        s = upsertEntry(s, { id: 'n1', label: 'TP #9 bis', dueDate: null });
        expect(s).toEqual([{ id: 'n1', workTypeId: 'wt_tp', label: 'TP #9 bis', passage: STG, deliveredAt: AT }]);
        rechazaUndefined(s);
    });

    it('upsertEntry descarta una fecha inválida', () => {
        const s = upsertEntry([], { id: 'x', workTypeId: 'wt', label: 'L', dueDate: '31/10/2026' });
        expect(s[0]).not.toHaveProperty('dueDate');
    });

    it('removeEntry', () => {
        expect(removeEntry([tp(1), tp(2)], 'e1').map(e => e.id)).toEqual(['e2']);
    });

    it('linkEntryToPaper mueve el trabajo de la entrada que lo tenía y null lo suelta', () => {
        let s = linkEntryToPaper([tp(1, { paperId: 'pa' }), tp(2)], 'e2', 'pa');
        expect(s[0]).not.toHaveProperty('paperId');
        expect(s[1]!.paperId).toBe('pa');
        s = linkEntryToPaper(s, 'e2', null);
        expect(s[1]).not.toHaveProperty('paperId');
        // Una entrada que ya no existe no hace nada.
        expect(linkEntryToPaper(s, 'nada', 'pb')).toEqual(s);
    });

    it('markDelivered / unmarkDelivered no tocan la devolución', () => {
        const fb = { receivedAt: AT, text: 'ok', corrections: [] };
        let s = markDelivered([tp(1, { feedback: fb })], 'e1', new Date(AT));
        expect(s[0]!.deliveredAt).toBe(AT);
        expect(s[0]!.feedback).toEqual(fb);
        s = unmarkDelivered(s, 'e1');
        expect(s[0]).not.toHaveProperty('deliveredAt');
        expect(s[0]!.feedback).toEqual(fb);
        expect(markDelivered(s, 'e1', 'basura')).toEqual(s);
    });

    it('markNoFeedback marca, pero no pisa una devolución con contenido', () => {
        const s = markNoFeedback([tp(1), tp(2, { feedback: { receivedAt: AT, text: 'Bien', corrections: [] } })], 'e1', AT);
        expect(s[0]!.feedback).toEqual({ receivedAt: AT, text: '', corrections: [], none: true });
        expect(markNoFeedback(s, 'e2', AT)[1]!.feedback!.text).toBe('Bien');
        expect(clearFeedback(s, 'e2')[1]).not.toHaveProperty('feedback');
    });
});

describe('recordFeedback — patrones por nombre', () => {
    it('reutiliza el patrón con el mismo nombre normalizado y crea los nuevos pendientes', () => {
        const patterns: FeedbackPattern[] = [{ id: 'p1', name: 'Cierre doble', decision: 'guide', guideId: 'g', ruleText: 'r', decidedAt: AT }];
        const r = recordFeedback({ schedule: [tp(8)], patterns }, 'e8', {
            text: ' Revisar conclusión ', grade: '6,5', receivedAt: AT,
            corrections: [
                { patternName: 'cierre doble', note: 'v. 14' },
                { patternName: 'Categoría ≠ traducción' },
                { patternName: 'categoria ≠ traduccion.' },
                { patternId: 'p1' },
                { patternName: '  ' },
            ],
        }, { newPatternId: ids('np'), newCorrectionId: ids('c') });
        rechazaUndefined(r);
        expect(r.patterns).toEqual([
            patterns[0],
            { id: 'np1', name: 'Categoría ≠ traducción', decision: 'pending' },
        ]);
        expect(r.schedule[0]!.feedback).toEqual({
            receivedAt: AT, text: 'Revisar conclusión', grade: '6,5',
            corrections: [
                { id: 'c1', patternId: 'p1', note: 'v. 14' },
                { id: 'c2', patternId: 'np1' },
                { id: 'c3', patternId: 'np1' },
                { id: 'c4', patternId: 'p1' },
            ],
        });
        // No marca la entrega: entregar es otra acción.
        expect(r.schedule[0]).not.toHaveProperty('deliveredAt');
    });

    it('sobre una entrada que no existe no crea patrones', () => {
        const r = recordFeedback({ schedule: [], patterns: [] }, 'x', { text: 't', corrections: [{ patternName: 'Nuevo' }] });
        expect(r.patterns).toEqual([]);
    });
});

describe('patrones', () => {
    const base: FeedbackPattern[] = [{ id: 'p1', name: 'Cierre doble', decision: 'pending' }, { id: 'p2', name: 'FDA', decision: 'pending' }];

    it('upsertPattern crea, renombra y no duplica nombres', () => {
        let p = upsertPattern(base, { name: 'cierre DOBLE' });
        expect(p).toEqual(base);
        p = upsertPattern(base, { name: 'SPC', description: 'Sin punto de comparación' }, ids('n'));
        expect(p[2]).toEqual({ id: 'n1', name: 'SPC', description: 'Sin punto de comparación', decision: 'pending' });
        p = upsertPattern(p, { id: 'p2', name: 'Falta de análisis' });
        expect(p[1]!.name).toBe('Falta de análisis');
        // Renombrar a un nombre ajeno no hace nada.
        expect(upsertPattern(p, { id: 'p2', name: 'Cierre doble' })).toEqual(p);
    });

    it('decidePattern: guide pide guía y texto; discarded pide razón; pending limpia', () => {
        expect(decidePattern(base, 'p1', 'guide', { guideId: 'g1' }, AT)).toEqual(base);
        let p = decidePattern(base, 'p1', 'guide', { guideId: 'g1', ruleText: ' No cerrar dos veces. ' }, AT);
        expect(p[0]).toEqual({ id: 'p1', name: 'Cierre doble', decision: 'guide', guideId: 'g1', ruleText: 'No cerrar dos veces.', decidedAt: AT });
        // Descartar sin razón no hace nada: queda la decisión anterior.
        expect(decidePattern(p, 'p1', 'discarded', {}, AT)).toEqual(p);
        expect(decidePattern(p, 'p1', 'discarded', { reason: '  ' }, AT)).toEqual(p);
        p = decidePattern(p, 'p1', 'discarded', { reason: ' El profesor cambió de criterio ' }, AT);
        expect(p[0]).toEqual({ id: 'p1', name: 'Cierre doble', decision: 'discarded', discardReason: 'El profesor cambió de criterio', decidedAt: AT });
        p = decidePattern(p, 'p1', 'pending');
        expect(p[0]).toEqual({ id: 'p1', name: 'Cierre doble', decision: 'pending' });
        expect(decidePattern(p, 'nada', 'discarded', { reason: 'x' })).toEqual(p);
        // «guide» incompleto no borra la decisión anterior; el completo borra la razón del descarte.
        const descartado = decidePattern(base, 'p2', 'discarded', { reason: 'No aplica a este curso' }, AT);
        expect(decidePattern(descartado, 'p2', 'guide', { guideId: 'g1', ruleText: '  ' }, AT)).toEqual(descartado);
        expect(decidePattern(descartado, 'p2', 'guide', { guideId: 'g1', ruleText: 'Regla' }, AT)[1]).toEqual({ id: 'p2', name: 'FDA', decision: 'guide', guideId: 'g1', ruleText: 'Regla', decidedAt: AT });
        // La razón tiene tope.
        expect(decidePattern(base, 'p1', 'discarded', { reason: 'y'.repeat(400) }, AT)[0]!.discardReason).toHaveLength(FEEDBACK_DISCARD_REASON_MAX);
    });

    it('isRecurringPattern: la única regla, dos entregas distintas o más', () => {
        expect(isRecurringPattern({ entries: 1 })).toBe(false);
        expect(isRecurringPattern({ entries: 2 })).toBe(true);
        expect(isRecurringPattern({ entries: [{ entryId: 'e7' }] })).toBe(false);
        expect(isRecurringPattern({ entries: ['e7', 'e8', 'e9'] })).toBe(true);
    });

    it('patternRecurrence cuenta correcciones y entregas, y ordena por repetición', () => {
        const schedule = [
            tp(7, { feedback: { receivedAt: AT, text: '', corrections: [{ id: 'a', patternId: 'p1' }, { id: 'b', patternId: 'p1' }] } }),
            tp(8, { feedback: { receivedAt: AT, text: '', corrections: [{ id: 'c', patternId: 'p1' }, { id: 'd', patternId: 'p2' }, { id: 'e', patternId: 'fantasma' }] } }),
            { id: 'en', workTypeId: 'wt_ensayo', label: 'Ensayo', feedback: { receivedAt: AT, text: '', corrections: [{ id: 'f', patternId: 'p2' }] } },
            tp(9, { feedback: { receivedAt: AT, text: '', corrections: [], none: true } }),
        ];
        const r = patternRecurrence(schedule, [...base, { id: 'p3', name: 'Nunca', decision: 'pending' }, { id: 'p4', name: 'Dos en una', decision: 'pending' }]);
        expect(r.map(x => [x.patternId, x.corrections, x.entries, x.recurring])).toEqual([
            ['p1', 3, 2, true],
            ['p2', 2, 2, true],
            // Sin entregas, por nombre.
            ['p4', 0, 0, false],
            ['p3', 0, 0, false],
        ]);
        // Dos correcciones en UNA entrega no son repetición.
        const una = patternRecurrence([tp(7, { feedback: { receivedAt: AT, text: '', corrections: [{ id: 'a', patternId: 'p1' }, { id: 'b', patternId: 'p1' }] } })], base);
        expect(una.find(x => x.patternId === 'p1')).toMatchObject({ corrections: 2, entries: 1, recurring: false });
        expect(r[0]!.entryIds).toEqual(['e7', 'e8']);
        expect(r[1]!.workTypeIds).toEqual(['wt_tp', 'wt_ensayo']);
    });
});

describe('nextLabelFor', () => {
    it('suma uno al número más alto del tipo, conservando el formato', () => {
        const s = [tp(8), tp(9), { id: 'x', workTypeId: 'wt_tp', label: 'TP #3' }, { id: 'y', workTypeId: 'otro', label: 'TP #40' }];
        expect(nextLabelFor('wt_tp', s)).toBe('TP #10');
        expect(nextLabelFor('otro', s)).toBe('TP #41');
    });
    it('sin «#» toma el último número; sin número, null', () => {
        expect(nextLabelFor('e', [{ id: 'a', workTypeId: 'e', label: 'Ensayo 2' }])).toBe('Ensayo 3');
        expect(nextLabelFor('e', [{ id: 'a', workTypeId: 'e', label: 'Paper final' }])).toBeNull();
        expect(nextLabelFor('e', [])).toBeNull();
    });
});

describe('courseGuideCandidates', () => {
    const project = {
        courseInfo: { course: 'NT785', styleGuideId: 'g_curso' },
        workTypes: [
            { id: 'wt_tp', label: 'TP Semanal', styleGuideId: 'g_tp' },
            { id: 'wt_ens', label: 'Ensayo' },
            { id: 'wt_fin', label: 'Final', styleGuideId: 'g_tp' },
        ],
    };
    it('las de los tipos primero y la del curso para los que no tienen propia', () => {
        expect(courseGuideCandidates(project)).toEqual([
            { guideId: 'g_tp', source: 'workType', workTypeIds: ['wt_tp', 'wt_fin'] },
            { guideId: 'g_curso', source: 'course', workTypeIds: ['wt_ens'] },
        ]);
    });
    it('filtrado por los tipos del patrón', () => {
        expect(courseGuideCandidates(project, ['wt_tp'])).toEqual([{ guideId: 'g_tp', source: 'workType', workTypeIds: ['wt_tp'] }]);
        expect(courseGuideCandidates(project, ['wt_ens'])).toEqual([{ guideId: 'g_curso', source: 'course', workTypeIds: ['wt_ens'] }]);
    });
});

describe('applyCourseOps', () => {
    it('aplica en orden sobre lo guardado y devuelve todo limpio', () => {
        const guardado = { schedule: [tp(8, { paperId: 'pa8' })], patterns: [] };
        const r = applyCourseOps(guardado, [
            { op: 'upsertEntry', entry: { id: 'e9', workTypeId: 'wt_tp', label: 'TP #9', dueDate: '2026-10-31' } },
            { op: 'linkPaper', entryId: 'e9', paperId: 'pa9' },
            { op: 'markDelivered', entryId: 'e8' },
            { op: 'recordFeedback', entryId: 'e8', feedback: { text: 'ok', corrections: [{ patternName: 'Cierre doble' }] } },
            { op: 'decidePattern', patternId: 'fp1', decision: 'discarded' },
            { op: 'decidePattern', patternId: 'fp1', decision: 'discarded', reason: 'No aplica a este curso' },
            { op: 'markNoFeedback', entryId: 'e9' },
            { op: 'removeEntry', entryId: 'nada' },
        ], { now: () => new Date(AT), newPatternId: ids('fp'), newCorrectionId: ids('c') });
        rechazaUndefined(r);
        expect(r.schedule).toEqual([
            { ...tp(8, { paperId: 'pa8' }), deliveredAt: AT, feedback: { receivedAt: AT, text: 'ok', corrections: [{ id: 'c1', patternId: 'fp1' }] } },
            { id: 'e9', workTypeId: 'wt_tp', label: 'TP #9', dueDate: '2026-10-31', paperId: 'pa9', feedback: { receivedAt: AT, text: '', corrections: [], none: true } },
        ]);
        expect(r.patterns).toEqual([{ id: 'fp1', name: 'Cierre doble', decision: 'discarded', discardReason: 'No aplica a este curso', decidedAt: AT }]);
    });

    it('un tipo que ya no existe en el proyecto deja la entrada sin tipo', () => {
        const r = applyCourseOps(null, [{ op: 'upsertEntry', entry: { id: 'x', workTypeId: 'borrado', label: 'TP' } }], { workTypeIds: ['wt_tp'] });
        expect(r.schedule).toEqual([{ id: 'x', workTypeId: '', label: 'TP' }]);
    });
});
