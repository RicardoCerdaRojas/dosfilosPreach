import { describe, expect, it } from 'vitest';
import { buildUnitStudyMap, corpusReviewQuestions, derivePaperUnits, passageVerses, unitsAsQuestions } from '../paperUnits';

const pasaje = { bookId: 'JAS' as const, chapterStart: 5, chapterEnd: 5, verseStart: 1, verseEnd: 6 };
const ENCUADRE = `1. ¿Cómo está funcionando el participio ὀλολύζοντες (Stg. 5:1)?
2. ¿Qué denotan los verbos σέσηπεν y γέγονεν (Stg. 5:2), y qué relación tienen con el versículo 3?
3. Comentario general sin versículo.`;

function paso(id: string, verse: number, analysis?: object, order = verse) {
    return {
        id, kind: 'verse' as const, order,
        verseRef: { ...pasaje, verseStart: verse, verseEnd: verse },
        accepted: null,
        current: analysis ? { canonicalAnalysis: analysis } as never : null,
    };
}

const respuesta = (questionNumber: number, decision: string) => ({
    questionNumber, directAnswer: '', options: [], decision,
    decisiveCriterion: { text: '', whyThisOverThat: '', sources: [] },
});
const crux = (phrase: string) => ({ phrase, description: '', options: [], commentatorPositions: [], commitment: { chosen: '', rationale: '' } });

describe('derivePaperUnits', () => {
    it('TP: una unidad por pregunta con versículo; la que no nombra ninguno no es sección', () => {
        const u = derivePaperUnits({ kind: 'tp-por-pregunta', assignmentBrief: ENCUADRE, passage: pasaje });
        expect(u.map(x => x.id)).toEqual(['pregunta-1', 'pregunta-2']);
        expect(u[1]!.verses).toEqual([{ chapter: 5, verse: 2 }, { chapter: 5, verse: 3 }]);
        expect(u[1]!.kind).toBe('pregunta');
    });

    it('TP sin preguntas: un versículo por sección (el profesor lo encargó en prosa)', () => {
        const u = derivePaperUnits({ kind: 'tp-por-pregunta', assignmentBrief: 'Analice el pasaje.', passage: pasaje });
        expect(u).toHaveLength(6);
        expect(u[0]).toMatchObject({ kind: 'tema', number: 1, verses: [{ chapter: 5, verse: 1 }] });
    });

    it('investigación: un tema por versículo, con el título temático del paso', () => {
        const steps = [paso('s3', 3, undefined, 2), paso('s1', 1, undefined, 0), paso('s2', 2, undefined, 1)];
        const u = derivePaperUnits({ kind: 'investigacion-tematica', passage: pasaje, steps, sectionTitles: { s2: ' La lengua como fuego ' } });
        expect(u.map(x => x.verses[0]!.verse)).toEqual([1, 2, 3]);
        expect(u[1]!.text).toBe('La lengua como fuego');
        expect(u[0]!.text).toBeNull();
        // Las preguntas del encuadre no se vuelven temas en una investigación.
        expect(derivePaperUnits({ kind: 'investigacion-tematica', assignmentBrief: ENCUADRE, passage: pasaje, steps })).toHaveLength(3);
    });

    it('síntesis + sermón: dos partes sobre todo el pasaje', () => {
        const u = derivePaperUnits({ kind: 'sintesis-sermon', passage: pasaje });
        expect(u.map(x => x.part)).toEqual(['sintesis', 'sermon']);
        expect(u[0]!.verses).toHaveLength(6);
    });

    it('unitsAsQuestions conserva número y versículos para los servicios de preguntas', () => {
        const u = derivePaperUnits({ kind: 'investigacion-tematica', passage: pasaje });
        expect(unitsAsQuestions(u)[2]).toEqual({ number: 3, text: '', verses: [{ chapter: 5, verse: 3 }] });
    });
});

describe('passageVerses', () => {
    it('sin pasos, recorre un pasaje de un capítulo; de varios, no inventa', () => {
        expect(passageVerses([], { chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 3 })).toHaveLength(3);
        // 2:1–3:5: «del 1 al 5» serían cinco versículos de un capítulo, y no lo son.
        expect(passageVerses([], { chapterStart: 2, chapterEnd: 3, verseStart: 1, verseEnd: 5 })).toEqual([]);
        expect(passageVerses([], { chapterStart: 2, chapterEnd: 2, verseStart: undefined as never, verseEnd: undefined as never })).toEqual([]);
    });
    it('con pasos, los de versículo en su orden y sin repetir', () => {
        const steps = [paso('b', 2, undefined, 1), paso('a', 1, undefined, 0), paso('a2', 1, undefined, 3), { id: 'c', kind: 'conclusion' as const, order: 9, verseRef: null }];
        expect(passageVerses(steps, pasaje)).toEqual([{ chapter: 5, verse: 1 }, { chapter: 5, verse: 2 }]);
    });
    it('cada versículo de un paso de varios, no solo el primero (revisión final de la fase A)', () => {
        const r = (vs: number, ve: number, ce = 3) => ({ bookId: 'JAS', chapterStart: 3, chapterEnd: ce, verseStart: vs, verseEnd: ve });
        const steps = [
            { id: 'a', kind: 'verse' as const, order: 0, verseRef: r(1, 2) },
            { id: 'b', kind: 'verse' as const, order: 1, verseRef: r(3, 5) },
            // Cruza capítulos: solo su primer versículo.
            { id: 'c', kind: 'verse' as const, order: 2, verseRef: r(18, 20, 4) },
        ];
        expect(passageVerses(steps as never, null).map(v => `${v.chapter}:${v.verse}`)).toEqual(['3:1', '3:2', '3:3', '3:4', '3:5', '3:18']);
    });
});

describe('buildUnitStudyMap', () => {
    const units = derivePaperUnits({ kind: 'tp-por-pregunta', assignmentBrief: ENCUADRE, passage: pasaje });

    it('junta lo que propone el análisis de cada versículo de la unidad', () => {
        const steps = [
            paso('s1', 1, { translationCruxes: [crux('ὀλολύζοντες')], questionAnswers: [respuesta(1, 'Participio de manera.')] }),
            paso('s2', 2, { translationCruxes: [crux('σέσηπεν')], questionAnswers: [respuesta(2, 'Perfecto proléptico')] }),
            paso('s3', 3, { translationCruxes: [crux('ὡς πῦρ')], questionAnswers: [respuesta(2, 'perfecto proléptico.')] }),
        ];
        const [p1, p2] = buildUnitStudyMap(units, steps);
        expect(p1!.answers.map(a => a.answer.decision)).toEqual(['Participio de manera.']);
        expect(p1!.cruxes.map(c => c.crux.phrase)).toEqual(['ὀλολύζοντες']);
        expect(p2!.stepIds).toEqual(['s2', 's3']);
        expect(p2!.cruxes.map(c => c.crux.phrase)).toEqual(['σέσηπεν', 'ὡς πῦρ']);
        // Misma decisión escrita distinto: no es un conflicto.
        expect(p2!.proposedDecisions).toEqual(['Perfecto proléptico']);
        expect(p2!.conflict).toBe(false);
    });

    it('dos versículos que contestan distinto la misma pregunta: se muestran juntas', () => {
        const steps = [
            paso('s2', 2, { translationCruxes: [], questionAnswers: [respuesta(2, 'Perfecto proléptico')] }),
            paso('s3', 3, { translationCruxes: [], questionAnswers: [respuesta(2, 'Perfecto gnómico')] }),
        ];
        const p2 = buildUnitStudyMap(units, steps)[1]!;
        expect(p2.conflict).toBe(true);
        expect(p2.proposedDecisions).toEqual(['Perfecto proléptico', 'Perfecto gnómico']);
    });

    it('solo las respuestas de SU pregunta, y la versión aceptada antes que la actual', () => {
        const aceptado = { ...paso('s2', 2), accepted: { canonicalAnalysis: { translationCruxes: [], questionAnswers: [respuesta(2, 'Aceptada'), respuesta(1, 'De otra pregunta')] } } as never, current: { canonicalAnalysis: { translationCruxes: [], questionAnswers: [respuesta(2, 'Borrador')] } } as never };
        const p2 = buildUnitStudyMap(units, [aceptado])[1]!;
        expect(p2.answers.map(a => a.answer.decision)).toEqual(['Aceptada']);
    });

    it('dice qué versículos no tienen paso o no tienen análisis', () => {
        const p2 = buildUnitStudyMap(units, [paso('s2', 2)])[1]!;
        expect(p2.versesWithoutAnalysis).toEqual([{ chapter: 5, verse: 2 }]);
        expect(p2.versesWithoutStep).toEqual([{ chapter: 5, verse: 3 }]);
        expect(p2.answers).toEqual([]);
        expect(p2.conflict).toBe(false);
    });

    it('un paso de varios versículos se lee una vez aunque la unidad nombre dos de ellos', () => {
        const rango = { ...paso('r', 2, { translationCruxes: [], questionAnswers: [respuesta(2, 'Una')] }), verseRef: { ...pasaje, verseStart: 2, verseEnd: 3 } };
        const p2 = buildUnitStudyMap(units, [rango])[1]!;
        expect(p2.stepIds).toEqual(['r']);
        expect(p2.answers).toHaveLength(1);
    });

    it('en un tema no hay respuestas a preguntas, solo los puntos discutibles', () => {
        const temas = derivePaperUnits({ kind: 'investigacion-tematica', passage: pasaje });
        const e = buildUnitStudyMap(temas, [paso('s1', 1, { translationCruxes: [crux('x')], questionAnswers: [respuesta(1, 'No es de un tema')] })])[0]!;
        expect(e.answers).toEqual([]);
        expect(e.cruxes).toHaveLength(1);
    });
});

describe('corpusReviewQuestions', () => {
    it('con preguntas en el encuadre, por pregunta y sin filtrar (lo de siempre)', () => {
        const r = corpusReviewQuestions({ assignmentBrief: ENCUADRE, passage: pasaje });
        expect(r.unitKind).toBe('pregunta');
        // La pregunta 3 no nombra versículo y se conserva, como antes.
        expect(r.questions.map(q => q.number)).toEqual([1, 2, 3]);
    });
    it('sin preguntas, por versículo con su título: la tarjeta funciona sin preguntas', () => {
        const steps = [paso('s1', 1), paso('s2', 2)];
        const r = corpusReviewQuestions({ assignmentBrief: 'Investigue el uso de la lengua.', passage: pasaje, steps, sectionTitles: { s2: 'La lengua' } });
        expect(r.unitKind).toBe('tema');
        expect(r.questions).toEqual([
            { number: 1, text: '', verses: [{ chapter: 5, verse: 1 }] },
            { number: 2, text: 'La lengua', verses: [{ chapter: 5, verse: 2 }] },
        ]);
    });
    it('preguntas sin ningún versículo no alcanzan: por versículo', () => {
        expect(corpusReviewQuestions({ assignmentBrief: '1. ¿Qué enseña el pasaje?', passage: pasaje }).unitKind).toBe('tema');
    });
});
