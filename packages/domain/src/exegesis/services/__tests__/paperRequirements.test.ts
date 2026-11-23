import { describe, expect, it } from 'vitest';
import { cleanManualRequirements, cleanRequirementMarks, paperRequirements, requirementPlacementControls, requirementWarnings, syllabusRequirementId } from '../paperRequirements';
import { cleanIgnoredGrammarCategories, ignoredCategoriesIn, parseIgnoredGrammarCategories } from '../courseGrammarRules';
import { answeredUnitIds, derivePaperUnits, framingInDocument } from '../paperUnits';

const pasaje = { chapterStart: 5, chapterEnd: 5, verseStart: 1, verseEnd: 6 };
const units = derivePaperUnits({ kind: 'tp-por-pregunta', passage: pasaje, assignmentBrief: '1. ¿Qué es ὀλολύζοντες (Stg. 5:1)?\n2. ¿Qué denota σέσηπεν (Stg. 5:2)?' });
const rubric = {
    expectedLength: { unit: 'pages' as const, min: 2, max: 3 },
    sourceRequirements: [
        { sourceType: 'lexicon-technical' as const, minimum: 1, maximum: null, justification: '' },
        { sourceType: 'commentary-critical' as const, minimum: 0, maximum: null, justification: '' },
    ],
    qualityCriteria: [{ id: 'q1', name: 'Interacción con las fuentes', levels: [] }],
    courseBibliography: [{ title: 'Wallace, Gramática', requirement: 'required' as const }, { title: 'Opcional', requirement: 'recommended' as const }],
};

describe('paperRequirements', () => {
    it('salen de la rúbrica, las preguntas y el tipo, sin el asistente', () => {
        const r = paperRequirements({ profileKind: 'tp-por-pregunta', rubric, units });
        expect(r.map(x => x.id)).toEqual([
            'rubrica:extension', 'rubrica:fuente:lexicon-technical', 'rubrica:criterio:q1', 'silabo:wallace-gramatica',
            'enunciado:pregunta:1', 'enunciado:pregunta:2', 'tipo:sin-marco',
        ]);
        // Cada pregunta se cumple en su sección; lo demás, en todo el trabajo; todo en el cuerpo por defecto.
        expect(r.find(x => x.id === 'enunciado:pregunta:2')!.unitId).toBe('pregunta-2');
        expect(r.every(x => x.inBody && !x.done)).toBe(true);
    });

    it('la investigación pide tesis; la síntesis + sermón, que la Parte 2 herede las glosas', () => {
        expect(paperRequirements({ profileKind: 'investigacion-tematica', rubric: null, units: [] }).map(x => x.id)).toEqual(['tipo:tesis']);
        const sermon = paperRequirements({ profileKind: 'sintesis-sermon', rubric: null, units: derivePaperUnits({ kind: 'sintesis-sermon', passage: pasaje }) });
        expect(sermon.find(x => x.id === 'tipo:herencia')!.unitId).toBe('parte-2');
    });

    it('las marcas del autor ganan; una unidad que ya no existe vuelve a «todo el trabajo»', () => {
        const r = paperRequirements({
            profileKind: 'tp-por-pregunta', rubric, units,
            marks: { 'rubrica:criterio:q1': { unitId: 'pregunta-1', inBody: false, done: true }, 'enunciado:pregunta:2': { unitId: 'pregunta-9' } },
            manual: [{ id: 'm1', text: 'Citar la NA28', unitId: 'pregunta-1', inBody: true, done: false }],
        });
        expect(r.find(x => x.id === 'rubrica:criterio:q1')).toMatchObject({ unitId: 'pregunta-1', inBody: false, done: true });
        expect(r.find(x => x.id === 'enunciado:pregunta:2')!.unitId).toBeNull();
        expect(r[r.length - 1]).toMatchObject({ id: 'manual:m1', origin: 'manual', text: { literal: 'Citar la NA28' }, unitId: 'pregunta-1' });
        expect(requirementWarnings(r)).toEqual([
            { kind: 'appendix-only', requirementId: 'rubrica:criterio:q1' },
            { kind: 'no-unit', requirementId: 'enunciado:pregunta:2' },
        ]);
    });

    it('lo medible se mide y una marca a mano no lo cambia; lo demás lo juzga el autor', () => {
        const r = paperRequirements({
            profileKind: 'tp-por-pregunta', rubric, units,
            marks: { 'rubrica:extension': { done: true }, 'rubrica:criterio:q1': { done: true } },
            measures: {
                length: { verdict: 'short', estimatedPages: 1.66, words: 700 },
                sources: [{ sourceType: 'lexicon-technical', have: 1, required: 1 }],
                answeredUnits: new Set(['pregunta-1']),
                framingInDocument: true,
                readingsInCorpus: new Map([[syllabusRequirementId('Wallace, Gramática'), true]]),
            },
        });
        const de = (id: string) => r.find(x => x.id === id)!;
        // Marcada a mano como hecha, pero mide 1,7 páginas: no está hecha.
        expect(de('rubrica:extension')).toMatchObject({ done: false, check: { mode: 'measured', value: { key: 'length.short', values: { pages: 1.7 } } } });
        expect(de('rubrica:fuente:lexicon-technical')).toMatchObject({ done: true, check: { value: { key: 'sources', values: { have: 1, required: 1 } } } });
        expect(de('enunciado:pregunta:1')).toMatchObject({ done: true, check: { value: { key: 'question.answered' } } });
        expect(de('enunciado:pregunta:2')).toMatchObject({ done: false, check: { value: { key: 'question.pending' } } });
        expect(de('tipo:sin-marco')).toMatchObject({ done: false, check: { value: { key: 'framing.included' } } });
        expect(de('silabo:wallace-gramatica')).toMatchObject({ done: true, check: { value: { key: 'reading.inCorpus' } } });
        expect(de('rubrica:criterio:q1')).toMatchObject({ done: true, check: { mode: 'self' } });
    });

    it('sin documento la extensión se mide como «sin documento»; una lectura sin enlazar la juzga el autor', () => {
        const r = paperRequirements({ profileKind: 'tp-por-pregunta', rubric, units, measures: { length: null, readingsInCorpus: new Map() } });
        expect(r.find(x => x.id === 'rubrica:extension')).toMatchObject({ done: false, check: { value: { key: 'length.none' } } });
        // Con documento, pero sin poder juzgarlo (la rúbrica no da rango útil): tampoco se da por cumplido.
        const sinJuicio = paperRequirements({ profileKind: 'tp-por-pregunta', rubric, units, measures: { length: { verdict: 'unknown', estimatedPages: 2.5, words: 900 } } });
        expect(sinJuicio.find(x => x.id === 'rubrica:extension')).toMatchObject({ done: false, check: { value: { key: 'length.none' } } });
        expect(r.find(x => x.id === 'silabo:wallace-gramatica')!.check.mode).toBe('self');
        // Sin medidas, todo lo juzga el autor (como antes).
        expect(paperRequirements({ profileKind: 'tp-por-pregunta', rubric, units }).every(x => x.check.mode === 'self')).toBe(true);
    });

    it('los controles de ubicación: ninguno en un TP; los dos en una investigación; solo la sección en síntesis + sermón', () => {
        expect(requirementPlacementControls('tp-por-pregunta')).toEqual({ unit: false, appendix: false });
        expect(requirementPlacementControls('investigacion-tematica')).toEqual({ unit: true, appendix: true });
        expect(requirementPlacementControls('sintesis-sermon')).toEqual({ unit: true, appendix: false });
    });

    it('qué unidades tienen texto y si el marco entra al documento', () => {
        const paso = (id: string, verse: number, markdown: string, includeInDocument?: boolean) => ({
            id, kind: 'verse' as const, order: verse, includeInDocument,
            verseRef: { bookId: 'JAS' as const, chapterStart: 5, chapterEnd: 5, verseStart: verse, verseEnd: verse },
            accepted: null, current: { markdown } as never,
        });
        expect([...answeredUnitIds(units, [paso('a', 1, 'Texto'), paso('b', 2, '  ')])]).toEqual(['pregunta-1']);
        expect([...answeredUnitIds(units, [paso('a', 1, 'Texto', false)])]).toEqual([]);
        expect(framingInDocument([{ kind: 'introduction', includeInDocument: false }, { kind: 'conclusion', includeInDocument: false }])).toBe(false);
        expect(framingInDocument([{ kind: 'introduction' }])).toBe(true);
    });

    it('limpia lo que se guarda', () => {
        expect(cleanRequirementMarks({ a: { unitId: 'x', inBody: 'si', done: true }, b: {}, '': { done: true } })).toEqual({ a: { unitId: 'x', done: true } });
        const largos = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, text: ` r${i} `, unitId: 3, inBody: undefined }));
        const m = cleanManualRequirements([{ id: 'a', text: '' }, ...largos, { id: 'm0', text: 'repetido' }]);
        expect(m).toHaveLength(40);
        expect(m[0]).toEqual({ id: 'm0', text: 'r0', unitId: null, inBody: true, done: false });
    });
});

describe('categorías que el curso no acepta («IGNORA»)', () => {
    it('se pegan una por línea o con punto y coma, sin repetir ni vacíos', () => {
        expect(parseIgnoredGrammarCategories('Genitivo de producción\n genitivo de produccion ; Genitivo de contenido\n\n')).toEqual(['Genitivo de producción', 'Genitivo de contenido']);
        expect(cleanIgnoredGrammarCategories('no es lista')).toEqual([]);
    });
    it('se detectan en una decisión como palabras completas, sin tildes ni mayúsculas', () => {
        const vetadas = ['Genitivo de producción', 'genitivo de contenido'];
        expect(ignoredCategoriesIn('Decisión: un GENITIVO DE PRODUCCION, como sostiene Wallace.', vetadas)).toEqual(['Genitivo de producción']);
        expect(ignoredCategoriesIn('genitivo de contenidos', vetadas)).toEqual([]);
        expect(ignoredCategoriesIn(null, vetadas)).toEqual([]);
    });
});

describe('requirementsOfPaper — cuenta las fuentes como «Qué conseguir» (revisión final de la fase A)', () => {
    it('un comentario a OTRO libro bíblico no suma al requisito de comentarios', async () => {
        const { requirementsOfPaper } = await import('../requirementsOfPaper');
        const fuente = (id: string) => ({ id, corpusId: id, sourceLibraryResourceId: id, sourceType: 'commentary-critical', mode: 'full-text', excerpts: [], excerptRecipe: null });
        const paper = {
            passage: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 1, verseEnd: 5 }, steps: [], assignmentBrief: '',
            rubric: { sourceRequirements: [{ sourceType: 'commentary-critical', minimum: 2, maximum: null, justification: '' }] },
            sources: [fuente('santiago'), fuente('jonas')],
        } as never;
        const libros: Record<string, { coversBibleBooks: string[] }> = { santiago: { coversBibleBooks: ['JAS'] }, jonas: { coversBibleBooks: ['JON'] } };
        const fuentes = (r: ReturnType<typeof requirementsOfPaper>) => r.requirements.find(x => x.id === 'rubrica:fuente:commentary-critical')!;
        expect(fuentes(requirementsOfPaper(paper, id => libros[id] as never)).done).toBe(false);
        // Sin saber de qué libro es cada uno, cuentan los dos (como antes).
        expect(fuentes(requirementsOfPaper(paper)).done).toBe(true);
    });

    it('extensión con un solo extremo: «al menos» o «hasta», nunca «de — a»', () => {
        const texto = (min: number | null, max: number | null) => paperRequirements({
            profileKind: 'tp-por-pregunta', units, rubric: { ...rubric, expectedLength: { unit: 'pages' as const, min, max } },
        }).find(x => x.id === 'rubrica:extension')?.text;
        expect(texto(2, 3)).toEqual({ key: 'length.pages', values: { min: 2, max: 3 } });
        expect(texto(8, null)).toEqual({ key: 'length.pagesMin', values: { min: 8, max: 0 } });
        expect(texto(null, 12)).toEqual({ key: 'length.pagesMax', values: { min: 0, max: 12 } });
        expect(texto(null, null)).toBeUndefined();
    });
});
