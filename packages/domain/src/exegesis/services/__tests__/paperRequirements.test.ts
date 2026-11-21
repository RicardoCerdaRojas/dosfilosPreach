import { describe, expect, it } from 'vitest';
import { cleanManualRequirements, cleanRequirementMarks, paperRequirements, requirementWarnings } from '../paperRequirements';
import { cleanIgnoredGrammarCategories, ignoredCategoriesIn, parseIgnoredGrammarCategories } from '../courseGrammarRules';
import { derivePaperUnits } from '../paperUnits';

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
