import { describe, expect, it } from 'vitest';
import { grammarCategoryRegions, sectionNodesFromOutline } from '../grammarCategoryRegions';

// Forma real de Wallace (banco del corpus, 2026-11-21): la categoría vive en un ancestro.
const WALLACE = [
    { sheet: 120, sectionPath: ['Specific Uses', 'A. Adjectival Genitive', '1. Descriptive Genitive', 'a. Definition'] },
    { sheet: 121, sectionPath: ['Specific Uses', 'A. Adjectival Genitive', '1. Descriptive Genitive', 'b. Illustrations'] },
    { sheet: 140, sectionPath: ['Specific Uses', 'A. Adjectival Genitive', '14. Genitive of Production/Producer', 'a. Definition'] },
    { sheet: 141, sectionPath: ['Specific Uses', 'A. Adjectival Genitive', '14. Genitive of Production/Producer', 'c. Amplification'] },
    { sheet: 148, sectionPath: ['Specific Uses', 'C. Verbal Genitive', '1. Subjective Genitive', 'a. Definition'] },
    { sheet: 149, sectionPath: ['Specific Uses', 'C. Verbal Genitive', '1. Subjective Genitive', 'c. Semantics'] },
    { sheet: 150, sectionPath: ['Specific Uses', 'C. Verbal Genitive', '2. Objective Genitive', 'a. Definition'] },
    // Otro capítulo: la misma raíz «Specific Uses» vuelve, y es otra sección.
    { sheet: 200, sectionPath: ['Specific Uses', 'Instrumental Dative Uses', '9. Dative of Content'] },
    { sheet: 207, sectionPath: ['Specific Uses', 'The Uses of the Dative After Certain Words'] },
    // Un genitivo dentro de los participios, lejos: región aparte.
    { sheet: 690, sectionPath: ['II. Verbal Participles', 'B. Independent Verbal Participles', '6. Genitive Absolute'] },
    { sheet: 691, sectionPath: ['II. Verbal Participles', 'B. Independent Verbal Participles', '6. Genitive Absolute'] },
];

describe('sectionNodesFromOutline', () => {
    it('arma tramos continuos y separa una ruta que reaparece', () => {
        const nodos = sectionNodesFromOutline(WALLACE);
        const specific = nodos.filter(n => n.title === 'Specific Uses');
        expect(specific.map(n => [n.startSheet, n.endSheet])).toEqual([[120, 207]]);
        const verbal = nodos.find(n => n.title === 'C. Verbal Genitive')!;
        expect([verbal.startSheet, verbal.endSheet, verbal.depth]).toEqual([148, 150, 1]);
    });

    it('una raíz que vuelve después de otra rama es otra sección', () => {
        const nodos = sectionNodesFromOutline([
            { sheet: 1, sectionPath: ['Specific Uses', 'A'] },
            { sheet: 2, sectionPath: ['Other', 'B'] },
            { sheet: 3, sectionPath: ['Specific Uses', 'C'] },
        ]);
        expect(nodos.filter(n => n.title === 'Specific Uses').map(n => [n.startSheet, n.endSheet])).toEqual([[1, 1], [3, 3]]);
    });
});

describe('grammarCategoryRegions', () => {
    it('lleva «genitivo» a las secciones del genitivo aunque el último título no lo diga', () => {
        const r = grammarCategoryRegions(WALLACE, { originalForms: [], categories: ['genitiv'] });
        expect(r.map(x => [x.startSheet, x.endSheet])).toEqual([[120, 150], [690, 691]]);
        expect(r[0]!.sections.map(s => s.title)).toEqual(['A. Adjectival Genitive', 'C. Verbal Genitive']);
        expect(r[0]!.subcategories.map(s => s.title)).toContain('1. Subjective Genitive');
        expect(r[0]!.subcategories.map(s => s.title)).toContain('14. Genitive of Production/Producer');
    });

    it('no repite una subsección de una sección ya elegida', () => {
        const r = grammarCategoryRegions(WALLACE, { originalForms: [], categories: ['genitiv'] });
        const titulos = r.flatMap(x => x.sections.map(s => s.title));
        expect(titulos).not.toContain('1. Subjective Genitive');
    });

    it('sin claves no propone nada', () => {
        expect(grammarCategoryRegions(WALLACE, { originalForms: [], categories: [] })).toEqual([]);
    });

    it('«con el genitivo» no trae la región de la preposición', () => {
        const r = grammarCategoryRegions(
            [{ sheet: 5, sectionPath: ['Prepositions', 'With the Genitive'] }],
            { originalForms: [], categories: ['genitiv'] },
        );
        expect(r).toEqual([]);
    });
});
