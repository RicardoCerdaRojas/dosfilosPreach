import { describe, expect, it } from 'vitest';
import { glossaryTermsIn, grammarSheetsForCategoryLabels } from '../grammarSheetsForCategoryLabels';

// Forma real de Wallace (banco del corpus, 2026-11-21).
const WALLACE = [
    { sheet: 200, sectionPath: ['Specific Uses', 'Instrumental Dative Uses', '5. Dative of Means/Instrument', 'a. Definition'] },
    { sheet: 201, sectionPath: ['Specific Uses', 'Instrumental Dative Uses', '5. Dative of Means/Instrument', 'b. Illustrations'] },
    { sheet: 617, sectionPath: ['I. The Perfect Tense', 'F. Proleptic (Futuristic) Perfect', '1. Definition'] },
    { sheet: 662, sectionPath: ['II. Verbal Participles', 'A. Dependent Verbal Participles', '1. Adverbial (or Circumstantial)', 'd. Specific Nuances of the Adverbial Participle', '1) Temporal'] },
    { sheet: 663, sectionPath: ['II. Verbal Participles', 'A. Dependent Verbal Participles', '1. Adverbial (or Circumstantial)', 'd. Specific Nuances of the Adverbial Participle', '2) Manner [*by* + participle of emotion or attitude]'] },
    { sheet: 664, sectionPath: ['II. Verbal Participles', 'A. Dependent Verbal Participles', '1. Adverbial (or Circumstantial)', 'd. Specific Nuances of the Adverbial Participle', '➜ 3) Means [*by means of*]'] },
    { sheet: 665, sectionPath: ['II. Verbal Participles', 'A. Dependent Verbal Participles', '1. Adverbial (or Circumstantial)', 'd. Specific Nuances of the Adverbial Participle', '➜ 3) Means [*by means of*]', 'c) Amplification'] },
    { sheet: 678, sectionPath: ['II. Verbal Participles', 'A. Dependent Verbal Participles', '➜ 2. Attendant Circumstance', 'd. Structure and Semantics'] },
];

const hojas = (labels: string[]) => [...new Set(grammarSheetsForCategoryLabels(WALLACE, labels)
    .flatMap(m => Array.from({ length: m.node.endSheet - m.node.startSheet + 1 }, (_, i) => m.node.startSheet + i)))].sort((a, b) => a - b);

describe('glossaryTermsIn', () => {
    it('separa lo específico de lo general', () => {
        expect(glossaryTermsIn('Participio de medio: llorar mediante alaridos.')).toEqual({ specific: ['means'], general: ['particip'] });
        expect(glossaryTermsIn('Circunstancia concomitante: lloren y griten.').specific).toEqual(['attendant circumstance']);
    });
    it('«final» no entra por «finalmente», pero sí como palabra', () => {
        expect(glossaryTermsIn('finalmente, el autor').specific).toEqual([]);
        expect(glossaryTermsIn('cláusula final').specific).toEqual(['purpose']);
    });
});

describe('grammarSheetsForCategoryLabels', () => {
    it('TP #10, P1: cada opción lleva a su subsección', () => {
        expect(hojas(['Participio de medio: llorar mediante alaridos.'])).toEqual([664, 665]);
        expect(hojas(['Participio de manera: llorar con una expresión de dolor intenso.'])).toEqual([663]);
        expect(hojas(['Circunstancia concomitante: lloren y griten.'])).toEqual([678]);
    });

    it('«medio» de un participio no trae el dativo de medio (desempata la ruta)', () => {
        expect(hojas(['Participio de medio'])).not.toContain(200);
    });

    it('TP #10, P2: la anticipación profética lleva al perfecto proléptico', () => {
        expect(hojas(['Anticipación profética: la ruina venidera se presenta como consumada.'])).toEqual([617]);
    });

    it('elige la subsección que NOMBRA la categoría, no sus hijas', () => {
        const m = grammarSheetsForCategoryLabels(WALLACE, ['Participio de medio']);
        expect(m.map(x => x.node.title)).toEqual(['➜ 3) Means [*by means of*]']);
    });

    it('«perfecto proléptico» por su nombre', () => {
        expect(hojas(['Perfecto proléptico'])).toEqual([617]);
    });

    it('una etiqueta solo general (participio) no propone subsección', () => {
        expect(grammarSheetsForCategoryLabels(WALLACE, ['Participio presente activo'])).toEqual([]);
    });

    it('sin etiquetas no propone nada', () => {
        expect(grammarSheetsForCategoryLabels(WALLACE, [])).toEqual([]);
    });
});
