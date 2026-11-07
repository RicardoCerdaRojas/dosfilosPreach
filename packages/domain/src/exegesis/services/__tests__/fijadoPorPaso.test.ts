import { describe, expect, it } from 'vitest';
import { effectiveScope, pinnedSheetsInAnyStep, retrievalScopeOf, stepPinnedSheets } from '../curatedScope';
import { corpusFootprint } from '../corpusFootprint';
import { stepPlanWithoutSource } from '../../entities/corpusUsagePlan';

/**
 * PR 2, unidad 4: lo fijado por paso. En el TP #8 lo fijado en la receta ocupaba
 * el 79 % de cada versículo aunque la hoja fuera de otra pregunta (medido).
 */
const r = (start: number, end = start) => ({ start, end });
const receta = (id: string, sheetRanges = [r(10, 20)], pinnedRanges = [r(12)]) =>
    ({ id, sourceType: 'commentary-critical', mode: 'curated-excerpts', excerpts: [], excerptRecipe: { sheetRanges, pinnedRanges, proposedRanges: [], passageFingerprint: '' } }) as never;
const sinNada = (id: string) => ({ id, sourceType: 'lexicon-technical', mode: 'curated-excerpts', excerpts: [], excerptRecipe: null }) as never;
const paso = (pinnedSheets: Record<string, Array<{ start: number; end: number }>>, suppressedSources: string[] = []) =>
    ({ pinnedSheets, suppressedSources }) as never;

describe('effectiveScope', () => {
    it('sin hojas del paso, es retrievalScopeOf tal cual: un trabajo sin marca no cambia', () => {
        expect(effectiveScope(receta('a'), null)).toEqual(retrievalScopeOf(receta('a')));
        expect(effectiveScope(receta('a'), paso({ otra: [r(1)] }))).toEqual(retrievalScopeOf(receta('a')));
    });

    it('suma las hojas del paso al alcance y a lo fijado', () => {
        expect(effectiveScope(receta('a'), paso({ a: [r(30, 31)] }))).toEqual({
            kind: 'recipe', sheetRanges: [r(10, 20), r(30, 31)], pinnedRanges: [r(12), r(30, 31)],
        });
    });

    it('un léxico sin páginas se busca entero, y las hojas del paso entran fijadas', () => {
        expect(effectiveScope(sinNada('k'), paso({ k: [r(137, 143)] }))).toMatchObject({ kind: 'whole-document', pinnedRanges: [r(137, 143)] });
    });

    it('una fuente sin nada que consultar, con hojas del paso, deja de quedar fuera', () => {
        const vacia = { id: 'v', sourceType: 'style-guide', mode: 'curated-excerpts', excerpts: [], excerptRecipe: null } as never;
        expect(retrievalScopeOf(vacia)).toBeNull();
        expect(effectiveScope(vacia, paso({ v: [r(3)] }))).toEqual({ kind: 'recipe', sheetRanges: [r(3)], pinnedRanges: [r(3)] });
    });

    it('la fuente suprimida en el paso manda: sus hojas no entran', () => {
        expect(stepPinnedSheets(paso({ a: [r(30)] }, ['a']), 'a')).toEqual([]);
        expect(effectiveScope(receta('a'), paso({ a: [r(30)] }, ['a']))).toEqual(retrievalScopeOf(receta('a')));
    });

    it('no escribe en la receta', () => {
        const fuente = receta('a');
        effectiveScope(fuente, paso({ a: [r(30)] }));
        expect((fuente as { excerptRecipe: { pinnedRanges: unknown[] } }).excerptRecipe.pinnedRanges).toEqual([r(12)]);
    });
});

describe('el verificador lee la unión de los pasos', () => {
    it('todas las hojas fijadas de una fuente en cualquier paso', () => {
        const plan = { perStep: { p1: paso({ a: [r(30)] }), p2: paso({ a: [r(31), r(40)] }), p3: paso({ b: [r(1)] }) } } as never;
        expect(pinnedSheetsInAnyStep(plan, 'a')).toEqual([r(30, 31), r(40)]);
    });
});

describe('quitar una fuente limpia sus hojas de cada paso', () => {
    it('stepPlanWithoutSource', () => {
        const limpio = stepPlanWithoutSource({ p1: { pinnedSheets: { a: [r(1)], b: [r(2)] } } } as never, 'a') as Record<string, { pinnedSheets: object }>;
        expect(limpio.p1!.pinnedSheets).toEqual({ b: [r(2)] });
    });
});

describe('el medidor cuenta el paso que más trae, no la suma', () => {
    const indice = Array.from({ length: 50 }, (_, i) => ({ sheet: i + 1, chunkIndices: [i], section: null, firstLine: '', charCount: 1000 })) as never;
    const fuentes = [receta('a', [r(1, 50)], [r(12)])];
    const idx = new Map([['a', indice]]);

    it('sin plan, como antes', () => {
        expect(corpusFootprint(fuentes, idx).stepPinnedChars).toBeUndefined();
    });

    it('dos pasos con 3 y 5 hojas propias: cuenta 5, y lo ya fijado en la receta no se cuenta dos veces', () => {
        const plan = { perStep: { p1: paso({ a: [r(20, 22)] }), p2: paso({ a: [r(30, 33), r(12)] }) } } as never;
        const f = corpusFootprint(fuentes, idx, plan);
        expect(f.stepPinnedChars).toBe(4000);
        expect(f.pinnedChars).toBe(1000);
    });
});

describe('la revisión por pregunta ve lo fijado en el paso de cada pregunta', () => {
    it('fijada en la pregunta de su paso, fuera en las demás', async () => {
        const { reviewCorpusByQuestion } = await import('../corpusQuestionReview');
        const review = reviewCorpusByQuestion({
            chapter: 5,
            questions: [{ number: 1, text: '¿5:1?', verses: [{ chapter: 5, verse: 1 }] }, { number: 2, text: '¿5:6?', verses: [{ chapter: 5, verse: 6 }] }] as never,
            sources: [{
                sourceId: 'k', sourceType: 'commentary-critical', selected: [r(1, 5)], pinned: [], printedPages: 'resolved',
                pinnedByQuestion: { 2: [r(40)] },
                verseHits: [{ sheet: 40, count: 1, verses: [1, 6] }],
            }],
        });
        const estado = (n: number) => review.rows.find(x => x.number === n)!.sources[0]!.sheets[0]!.state;
        expect(estado(2)).toBe('pinned');
        expect(estado(1)).toBe('outside');
    });
});

describe('stepCorpusQuery: la consulta lleva las preguntas del paso', async () => {
    const { stepCorpusQuery } = await import('../assignmentBriefWindows');
    it('versículo, griego y la pregunta del paso, no el encuadre entero', () => {
        expect(stepCorpusQuery({ label: 'Santiago 4:1', originalText: 'πόθεν πόλεμοι', stepQuestions: [{ text: '¿Qué es μέλος?' }], brief: '1. ¿Qué es μέλος? 2. ¿Quién mata?' }))
            .toBe('Santiago 4:1 — πόθεν πόλεμοι — ¿Qué es μέλος?');
    });
    it('sin preguntas propias, el encuadre como antes', () => {
        expect(stepCorpusQuery({ label: 'Santiago 4', stepQuestions: [], brief: '  Encuadre  ' })).toBe('Santiago 4 — Encuadre');
    });
});
