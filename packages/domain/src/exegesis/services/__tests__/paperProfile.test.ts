import { describe, expect, it } from 'vitest';
import { PAPER_PROFILES, readPaperProfileKind, resolvePaperProfileKind } from '../paperProfile';
import { cleanProjectWorkTypes, resolveProjectCharge, workTypeFromProfile } from '../../../entities/AIProject';

const ENCUADRE_TP = `1. ¿Cómo está funcionando el participio ὀλολύζοντες (Stg. 5:1)?
2. ¿Qué denotan los verbos σέσηπεν y γέγονεν (Stg. 5:2)?`;

const ENCUADRE_TI3 = `Parte 1: Síntesis exegética breve (5–6 págs.) de los trabajos anteriores.
Parte 2: Parte homilética (14–15 págs.): un sermón con introducción, proposición, desarrollo y aplicación.`;

describe('readPaperProfileKind', () => {
    it('lo guardado manda, aunque el encuadre diga otra cosa', () => {
        expect(readPaperProfileKind({ profileKind: 'investigacion-tematica', assignmentBrief: ENCUADRE_TP }))
            .toEqual({ kind: 'investigacion-tematica', inferred: false, reason: 'stored' });
    });

    it('preguntas numeradas: TP por pregunta (TP #10)', () => {
        expect(readPaperProfileKind({ assignmentBrief: ENCUADRE_TP })).toMatchObject({ kind: 'tp-por-pregunta', inferred: true, reason: 'questions' });
    });

    it('síntesis y sermón: TI #3, aunque el método sea investigación', () => {
        expect(readPaperProfileKind({ assignmentBrief: ENCUADRE_TI3, exegeticalMethod: 'research' }))
            .toMatchObject({ kind: 'sintesis-sermon', reason: 'sermon' });
    });

    it('un TP que pregunta por la implicancia homilética no es un sermón', () => {
        const encuadre = `${ENCUADRE_TP}\n3. ¿Qué implicancia homilética tiene el sermón de Jacobo (Stg. 5:3)?`;
        expect(readPaperProfileKind({ assignmentBrief: encuadre }).kind).toBe('tp-por-pregunta');
    });

    it('la plantilla del TP semanal trae las preguntas como hueco: el encuadre dice que es un trabajo práctico', () => {
        const plantilla = 'Trabajo práctico semanal de exégesis del NT sobre [PASAJE]. NO es un paper exegético completo.\n\nPreguntas, en este orden:\n[PEGAR LAS PREGUNTAS DEL PROFESOR]';
        expect(readPaperProfileKind({ assignmentBrief: plantilla, exegeticalMethod: 'research' })).toMatchObject({ kind: 'tp-por-pregunta', reason: 'brief-tp' });
        expect(readPaperProfileKind({ assignmentBrief: 'Trabajo de investigación sobre Santiago 3:1–5a.', exegeticalMethod: 'mixed' }))
            .toMatchObject({ kind: 'investigacion-tematica', reason: 'brief-research' });
        // «TP» suelto como palabra, no dentro de otra.
        expect(readPaperProfileKind({ assignmentBrief: 'Entregar el TP #11.' }).reason).toBe('brief-tp');
        expect(readPaperProfileKind({ assignmentBrief: 'Analizar el texto (HTTP).' }).reason).toBe('default');
    });

    it('sin encuadre, el método decide; sin método, investigación', () => {
        expect(readPaperProfileKind({ exegeticalMethod: 'research' })).toMatchObject({ kind: 'investigacion-tematica', reason: 'method-research' });
        expect(readPaperProfileKind({ exegeticalMethod: 'mixed' })).toMatchObject({ kind: 'tp-por-pregunta', reason: 'method-mixed' });
        expect(readPaperProfileKind({ exegeticalMethod: 'exegetical' })).toMatchObject({ kind: 'investigacion-tematica', reason: 'default' });
        expect(readPaperProfileKind({})).toMatchObject({ kind: 'investigacion-tematica', reason: 'default' });
    });

    it('un valor guardado desconocido no cuenta como elegido', () => {
        expect(resolvePaperProfileKind('sermon')).toBeNull();
        expect(readPaperProfileKind({ profileKind: 'sermon', assignmentBrief: ENCUADRE_TP })).toMatchObject({ inferred: true, kind: 'tp-por-pregunta' });
    });
});

describe('PAPER_PROFILES (procedimiento §4d)', () => {
    it('el TP no tiene introducción ni conclusión, y cita entre paréntesis', () => {
        const tp = PAPER_PROFILES['tp-por-pregunta'];
        expect(tp.layers.conclusion).toBe(false);
        expect(tp.layers.introThesis).toBe(false);
        expect(tp.framingSections).toBe(false);
        expect(tp.citationStyle).toBe('parentesis');
        expect(tp.sourcePolicy.excludePreviousDelivery).toBe(true);
    });
    it('cada tipo termina con el documento final aprobado por el autor', () => {
        for (const p of Object.values(PAPER_PROFILES)) expect(p.checkpoints[p.checkpoints.length - 1]).toBe('documento-final');
    });
});

describe('tipo de trabajo en el proyecto', () => {
    it('se guarda solo si es válido', () => {
        const [a, b] = cleanProjectWorkTypes([
            { id: 'a', label: 'TP semanal', profileKind: 'tp-por-pregunta' },
            { id: 'b', label: 'Otro', profileKind: 'cualquiera' as never },
        ]);
        expect(a!.profileKind).toBe('tp-por-pregunta');
        expect(b).not.toHaveProperty('profileKind');
    });
    it('lo hereda el trabajo que nace del tipo', () => {
        const charge = resolveProjectCharge({ workTypes: [{ id: 'a', label: 'TI', profileKind: 'sintesis-sermon' }] }, 'a');
        expect(charge?.profileKind).toBe('sintesis-sermon');
    });
    it('lo copia el tipo que sale de un perfil guardado', () => {
        const base = { id: 'p', displayName: 'NT785 · TP', rubricTemplateId: null, briefTemplateId: null, styleGuideId: null, exegeticalStrategy: 'free' as const };
        expect(workTypeFromProfile({ ...base, profileKind: 'tp-por-pregunta' }, 'x').profileKind).toBe('tp-por-pregunta');
        expect(workTypeFromProfile(base, 'x')).not.toHaveProperty('profileKind');
    });
});
