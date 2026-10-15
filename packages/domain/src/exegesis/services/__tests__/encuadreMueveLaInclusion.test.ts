import { describe, it, expect } from 'vitest';
import { briefOmitsFrame, frameLeftOut, inclusionAtBirth, inclusionChangesFromBriefEdit } from '../assemblyContents';

describe('briefOmitsFrame — el encuadre dice «sin introducción» (TP #7, #14)', () => {
    it.each([
        ['Sin introducción, sin conclusión.', true, true],
        ['Sin introducción ni conclusión.', true, true],
        ['No incluya introducción.', true, false],
        ['Con introducción y sin conclusión.', false, true],
        ['Sin introducción y con conclusión.', true, false],
        ['Without introduction or conclusion.', true, true],
        ['La introducción debe presentar la tesis.', false, false],
        // Revisión adversarial de D: no son omisiones.
        ['Sin introducción, conclusión de un párrafo.', true, false],
        ['No incluya una introducción extensa.', false, false],
        ['No introduction longer than 200 words.', false, false],
    ])('%s', (brief, intro, concl) => {
        expect(briefOmitsFrame(brief, 'introduction')).toBe(intro);
        expect(briefOmitsFrame(brief, 'conclusion')).toBe(concl);
    });

    it('saca el marco aunque el encuadre no venga en preguntas', () => {
        expect(inclusionAtBirth({ kind: 'introduction', verseRef: null }, [], 'Sin introducción, sin conclusión.')).toBe(false);
        expect(frameLeftOut({ steps: [], assignmentBrief: 'Sin introducción, sin conclusión.' }, 'conclusion')).toBe(true);
    });
});

/**
 * TP #7 (#16): agregar «(Stg. 3:15)» a una pregunta no metía 3:15 al
 * documento: la inclusión se decidía sólo al crear los pasos.
 */
describe('inclusionChangesFromBriefEdit', () => {
    const verso = (id: string, verse: number, includeInDocument?: boolean) => ({
        id, kind: 'verse' as const,
        verseRef: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: verse, verseEnd: verse },
        ...(includeInDocument === undefined ? {} : { includeInDocument }),
    });
    const passage = { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 13, verseEnd: 18 };
    const viejo = '1. ¿Qué modifica ἐν πραΰτητι (3:13)?\n2. ¿Qué denota τοῖς ποιοῦσιν (3:18)?\n3. ¿Cuál es el sujeto?';
    const nuevo = '1. ¿Qué modifica ἐν πραΰτητι (3:13)?\n2. ¿Qué denota τοῖς ποιοῦσιν (3:18)?\n3. ¿Cuál es el sujeto (Stg. 3:15)?';
    const paper = (steps: unknown[]) => ({ steps, assignmentBrief: viejo, passage }) as never;

    it('3:15 ahora tiene pregunta: se propone incluirlo', () => {
        const cambios = inclusionChangesFromBriefEdit(paper([verso('v13', 13, true), verso('v15', 15, false), verso('v18', 18, true)]), nuevo);
        expect(cambios).toEqual([expect.objectContaining({ stepId: 'v15', include: true })]);
    });

    it('si ya está incluido a mano, no hay nada que proponer', () => {
        expect(inclusionChangesFromBriefEdit(paper([verso('v15', 15, true)]), nuevo)).toEqual([]);
    });

    it('lo que la edición no mueve no se toca, aunque el estudiante lo haya cambiado a mano', () => {
        // 3:14 no tiene pregunta ni antes ni después; el estudiante lo incluyó.
        expect(inclusionChangesFromBriefEdit(paper([verso('v14', 14, true)]), nuevo)).toEqual([]);
    });

    it('agregar «Sin introducción» propone sacarla', () => {
        const cambios = inclusionChangesFromBriefEdit(
            paper([{ id: 'intro', kind: 'introduction', verseRef: null, includeInDocument: true }]),
            `${viejo}\nSin introducción.`,
        );
        expect(cambios).toEqual([expect.objectContaining({ stepId: 'intro', include: false })]);
    });
});

describe('quitar «Sin introducción» propone volver a incluirla (revisión adversarial de D)', () => {
    it('el encuadre nuevo ya no decide y el viejo la dejaba fuera', () => {
        const paper = { assignmentBrief: 'Trabajo en prosa. Sin introducción.', passage: { chapterStart: 3, chapterEnd: 3 },
            steps: [{ id: 'intro', kind: 'introduction', verseRef: null, includeInDocument: false }] } as never;
        expect(inclusionChangesFromBriefEdit(paper, 'Trabajo en prosa.'))
            .toEqual([expect.objectContaining({ stepId: 'intro', include: true })]);
    });
});
