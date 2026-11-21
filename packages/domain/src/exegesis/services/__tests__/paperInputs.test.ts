import { describe, expect, it } from 'vitest';
import { cleanPaperInputMarks, courseInputsOf, missingRequiredInputs, paperInputStatuses, type PaperInputsContext } from '../paperInputs';

const base: PaperInputsContext = {
    profileKind: 'tp-por-pregunta',
    assignmentBrief: '1. ¿Cómo funciona ὀλολύζοντες (Stg. 5:1)?',
    rubric: { provenance: 'extracted-from-text' },
    styleGuide: { id: 'g1' },
    scheduleEntry: { dueDate: '2026-11-25' },
    previousEntry: { delivered: true, feedback: 'recorded', pendingPatterns: 0 },
    previousDeliveryFound: true,
    assignedReadings: 3,
    courseGrammar: { grammarSources: 1, ignoredCategories: 4 },
};
const estado = (ctx: PaperInputsContext, kind: string) => paperInputStatuses(ctx).find(s => s.kind === kind)!;

describe('paperInputStatuses', () => {
    it('el plazo va primero, y un TP completo no pide nada', () => {
        const s = paperInputStatuses(base);
        expect(s[0]).toMatchObject({ kind: 'plazo', state: 'listo', detail: '2026-11-25' });
        expect(missingRequiredInputs(s)).toEqual([]);
        // La clase no la exige un TP.
        expect(estado(base, 'clase')).toMatchObject({ state: 'no-aplica', required: false });
    });

    it('el plazo: fuera de un curso, sin entrada en el calendario, sin fecha', () => {
        expect(estado({ ...base, scheduleEntry: undefined }, 'plazo')).toMatchObject({ state: 'falta', reason: 'not-in-course' });
        expect(estado({ ...base, scheduleEntry: null }, 'plazo')).toMatchObject({ state: 'falta', reason: 'no-entry' });
        expect(estado({ ...base, scheduleEntry: { dueDate: null } }, 'plazo')).toMatchObject({ state: 'falta', reason: 'no-date' });
    });

    it('el enunciado con la plantilla sin llenar se revisa; vacío falta', () => {
        expect(estado({ ...base, assignmentBrief: 'Preguntas: [PEGAR LAS PREGUNTAS DEL PROFESOR]' }, 'enunciado').state).toBe('revisar');
        expect(estado({ ...base, assignmentBrief: '  ' }, 'enunciado').state).toBe('falta');
    });

    it('la rúbrica del sistema se revisa, salvo que el curso diga que no da rúbrica', () => {
        expect(estado({ ...base, rubric: { provenance: 'system-default' } }, 'rubrica')).toMatchObject({ state: 'revisar', reason: 'system-default' });
        expect(estado({ ...base, rubric: { provenance: 'system-default' }, rubricConfirmedByCourse: true }, 'rubrica').state).toBe('listo');
        expect(estado({ ...base, rubric: null }, 'rubrica').state).toBe('falta');
    });

    it('la devolución anterior: con patrones sin decidir se revisa; sin llegar, falta; la primera entrega no la tiene', () => {
        expect(estado({ ...base, previousEntry: { delivered: true, feedback: 'recorded', pendingPatterns: 2 } }, 'devolucion'))
            .toMatchObject({ state: 'revisar', reason: 'pending-patterns', count: 2 });
        expect(estado({ ...base, previousEntry: { delivered: true, feedback: 'awaiting', pendingPatterns: 0 } }, 'devolucion')).toMatchObject({ state: 'falta', reason: 'awaiting' });
        expect(estado({ ...base, previousEntry: { delivered: false, feedback: 'awaiting', pendingPatterns: 0 } }, 'devolucion').reason).toBe('not-delivered');
        expect(estado({ ...base, previousEntry: null }, 'devolucion').state).toBe('no-aplica');
        expect(estado({ ...base, scheduleEntry: null, previousEntry: undefined }, 'devolucion').reason).toBe('not-in-calendar');
        expect(estado({ ...base, scheduleEntry: undefined, previousEntry: undefined }, 'devolucion').reason).toBe('not-in-course');
        expect(estado({ ...base, previousEntry: null }, 'trabajo-anterior').state).toBe('no-aplica');
    });

    it('la gramática sin lista de categorías vetadas se revisa (TP #11, «genitivo de producción»)', () => {
        expect(estado({ ...base, courseGrammar: { grammarSources: 1, ignoredCategories: 0 } }, 'gramatica-del-curso').state).toBe('revisar');
        expect(estado({ ...base, courseGrammar: { grammarSources: 0, ignoredCategories: 0 } }, 'gramatica-del-curso').state).toBe('falta');
        // En una investigación la gramática no es exigida.
        expect(estado({ ...base, profileKind: 'investigacion-tematica', courseGrammar: { grammarSources: 0, ignoredCategories: 0 } }, 'gramatica-del-curso').state).toBe('no-aplica');
    });

    it('lo que marca el autor: «no aplica» tapa lo que falta, «leída» cierra lo que había que revisar; nada tapa lo que está listo', () => {
        const marks = { rubrica: { mark: 'no-aplica' as const, at: 'x' }, guia: { mark: 'leida' as const, at: 'x' }, plazo: { mark: 'no-aplica' as const, at: 'x' } };
        const s = paperInputStatuses({ ...base, rubric: null, styleGuide: { id: 'g', liveDiffers: true }, marks });
        expect(s.find(x => x.kind === 'rubrica')!.state).toBe('no-aplica');
        expect(s.find(x => x.kind === 'guia')).toMatchObject({ state: 'listo', reason: 'marked-read' });
        expect(s.find(x => x.kind === 'plazo')!.state).toBe('listo');
    });

    it('«leída» no convierte en presente lo que falta', () => {
        expect(estado({ ...base, rubric: null, marks: { rubrica: { mark: 'leida', at: 'x' } } }, 'rubrica').state).toBe('falta');
    });

    it('la clase: con su nota está; una investigación la exige', () => {
        const inv = { ...base, profileKind: 'investigacion-tematica' as const };
        expect(estado(inv, 'clase')).toMatchObject({ state: 'falta', required: true });
        expect(estado({ ...inv, marks: { clase: { mark: 'leida', note: 'El profesor pidió voces antiguas.', at: 'x' } } }, 'clase').state).toBe('listo');
    });
});

describe('courseInputsOf', () => {
    const entrada = (id: string, dueDate: string | null, extra: object = {}) => ({ id, workTypeId: 'tp', label: id, dueDate, ...extra });
    const proyecto = {
        courseSchedule: [
            entrada('tp11', '2026-11-11', { paperId: 'p11', deliveredAt: 'x', feedback: { receivedAt: 'x', text: '', corrections: [{ id: 'c1', patternId: 'gen' }, { id: 'c2', patternId: 'bien' }] } }),
            entrada('tp12', '2026-11-18', { paperId: 'p12' }),
            entrada('ensayo', '2026-11-15', { workTypeId: 'ensayo', paperId: 'e1' }),
        ],
        feedbackPatterns: [
            { id: 'gen', name: 'genitivo vetado', decision: 'pending' as const },
            { id: 'bien', name: 'buena síntesis', kind: 'strength' as const, decision: 'pending' as const },
        ],
    };
    it('la entrega anterior es la del mismo tipo, por fecha; cuenta los patrones sin decidir, no las fortalezas', () => {
        expect(courseInputsOf(proyecto as never, 'p12')).toEqual({
            scheduleEntry: { dueDate: '2026-11-18' },
            previousEntry: { delivered: true, feedback: 'recorded', pendingPatterns: 1 },
        });
        expect(courseInputsOf(proyecto as never, 'p11').previousEntry).toBeNull();
        expect(courseInputsOf(proyecto as never, 'e1').previousEntry).toBeNull();
    });
    it('una devolución marcada «sin devolución» no se espera', () => {
        const sinDevolucion = { ...proyecto, courseSchedule: proyecto.courseSchedule.map(e => (e.id === 'tp11' ? { ...e, feedback: { receivedAt: 'x', text: '', corrections: [], none: true } } : e)) };
        expect(courseInputsOf(sinDevolucion as never, 'p12').previousEntry).toEqual({ delivered: true, feedback: 'none', pendingPatterns: 0 });
    });

    it('fuera del calendario o sin curso', () => {
        expect(courseInputsOf(proyecto as never, 'otro')).toEqual({ scheduleEntry: null });
        expect(courseInputsOf(null, 'p12')).toEqual({});
    });
});

describe('cleanPaperInputMarks', () => {
    it('deja solo entradas conocidas y marcas válidas, con la nota recortada', () => {
        const m = cleanPaperInputMarks({ clase: { mark: 'leida', note: ` ${'x'.repeat(5000)} `, at: 'a' }, otra: { mark: 'leida' }, guia: { mark: 'quizas' } });
        expect(Object.keys(m)).toEqual(['clase']);
        expect(m.clase!.note).toHaveLength(4000);
        expect(cleanPaperInputMarks(null)).toEqual({});
    });
});
