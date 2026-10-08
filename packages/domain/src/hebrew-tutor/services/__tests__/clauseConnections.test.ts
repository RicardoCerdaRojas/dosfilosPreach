import { describe, it, expect } from 'vitest';
import { checkClauseConnections } from '../clause-connections';
import { GrammaticalCategory, MorphemeRole, VerbForm } from '../../value-objects/grammar';

/** Bitácora del módulo de hebreo #2 (Rut 1:14) y #4 (Rut 1:16). */
const w = (hebrewText: string, category: GrammaticalCategory, roles: MorphemeRole[] = [], verbForm?: VerbForm) => ({
    hebrewText, category, morphemes: roles.map(role => ({ text: '', role, label: '' })),
    ...(verbForm ? { verbMorphology: { verbForm } } : {}),
}) as never;
const clausula = (firstWord: number, lastWord: number, connection: string, type = 'VERBAL') =>
    ({ firstWord, lastWord, connection, type, connector: null, value: 'x', explanation: 'y' }) as never;

describe('la conexión de cada cláusula', () => {
    it('REGRESIÓN (Rut 1:14): waw + sujeto es disyuntiva aunque el asistente diga «conjuntiva»', () => {
        const analysis = {
            words: [
                w('וַתִּשַּׁק', GrammaticalCategory.VERB, [MorphemeRole.WAW_CONSECUTIVE], VerbForm.WAYYIQTOL),
                w('עָרְפָּה', GrammaticalCategory.PROPER_NOUN),
                w('לַחֲמוֹתָהּ', GrammaticalCategory.NOUN),
                w('וְרוּת', GrammaticalCategory.PROPER_NOUN, [MorphemeRole.WAW_CONJUNCTIVE]),
                w('דָּבְקָה', GrammaticalCategory.VERB),
                w('בָּהּ', GrammaticalCategory.PREPOSITION),
            ],
            clauses: [clausula(0, 2, 'FIRST'), clausula(3, 5, 'WAW_CONJUNCTIVE')],
        } as never;
        const r = checkClauseConnections(analysis).clauses!;
        expect(r[0]!.connection).toBe('WAYYIQTOL_CHAIN');
        expect(r[1]).toMatchObject({ connection: 'WAW_DISJUNCTIVE', adjusted: true });
    });

    it('REGRESIÓN (Rut 1:16): sin conjunción no puede ser «waw» — asíndeton; la waw siguiente une otra cláusula', () => {
        const analysis = {
            words: [
                w('עַמֵּךְ', GrammaticalCategory.NOUN), w('עַמִּי', GrammaticalCategory.NOUN),
                w('וֵאלֹהַיִךְ', GrammaticalCategory.NOUN, [MorphemeRole.WAW_CONJUNCTIVE]), w('אֱלֹהָי', GrammaticalCategory.NOUN),
            ],
            clauses: [clausula(0, 1, 'WAW_CONJUNCTIVE', 'NOMINAL'), clausula(2, 3, 'ASYNDETIC', 'NOMINAL')],
        } as never;
        const r = checkClauseConnections(analysis).clauses!;
        expect(r[0]).toMatchObject({ connection: 'ASYNDETIC', type: 'NOMINAL', adjusted: true });
        expect(r[1]!.connection).toBe('WAW_DISJUNCTIVE');
    });

    it('waw + verbo es conjuntiva; subordinada y discurso directo los decide el asistente', () => {
        const analysis = {
            words: [w('וְהָלַכְתָּ', GrammaticalCategory.VERB, [MorphemeRole.WAW_CONJUNCTIVE]), w('כִּי', GrammaticalCategory.CONJUNCTION), w('אַל', GrammaticalCategory.NEGATIVE_PARTICLE)],
            clauses: [clausula(0, 0, 'WAW_DISJUNCTIVE'), clausula(1, 1, 'SUBORDINATE'), clausula(2, 2, 'QUOTATION')],
        } as never;
        const r = checkClauseConnections(analysis).clauses!;
        expect(r.map(c => c.connection)).toEqual(['WAW_CONJUNCTIVE', 'SUBORDINATE', 'QUOTATION']);
        expect(r[1]!.adjusted).toBeUndefined();
    });

    it('sin morfemas reconoce la waw por la letra (וְ, וּ)', () => {
        const analysis = { words: [w('וּשְׁמוֹ', GrammaticalCategory.NOUN), w('וְהָיָה', GrammaticalCategory.VERB)], clauses: [clausula(0, 0, 'ASYNDETIC'), clausula(1, 1, 'ASYNDETIC')] } as never;
        expect(checkClauseConnections(analysis).clauses!.map(c => c.connection)).toEqual(['WAW_DISJUNCTIVE', 'WAW_CONJUNCTIVE']);
    });

    it('una subordinada unida con waw sigue siendo subordinada (Rut 1:16 «וּבַאֲשֶׁר תָּלִינִי»)', () => {
        const analysis = { words: [w('וּבַאֲשֶׁר', GrammaticalCategory.RELATIVE_PRONOUN, [MorphemeRole.WAW_CONJUNCTIVE])], clauses: [clausula(0, 0, 'SUBORDINATE')] } as never;
        expect(checkClauseConnections(analysis).clauses![0]!.connection).toBe('SUBORDINATE');
    });

    it('descarta índices imposibles; un análisis viejo sin cláusulas queda con []', () => {
        const words = [w('א', GrammaticalCategory.NOUN)];
        expect(checkClauseConnections({ words, clauses: [clausula(0, 3, 'FIRST'), clausula(-1, 0, 'FIRST'), clausula(0, 0, 'RARO')] } as never).clauses)
            .toEqual([expect.objectContaining({ firstWord: 0, lastWord: 0, connection: 'ASYNDETIC' })]);
        expect(checkClauseConnections({ words } as never).clauses).toEqual([]);
    });

    it('REGRESIÓN (revisión): un weqatal no es cadena de wayyiqtol aunque su waw se llame «consecutiva»', () => {
        const analysis = { words: [w('וְהָלַכְתָּ', GrammaticalCategory.VERB, [MorphemeRole.WAW_CONSECUTIVE], VerbForm.WEQATAL)], clauses: [clausula(0, 0, 'WAW_CONJUNCTIVE')] } as never;
        const r = checkClauseConnections(analysis).clauses![0]!;
        expect(r.connection).toBe('WAW_CONJUNCTIVE');
        expect(r.adjusted).toBeUndefined();
    });

    it('REGRESIÓN (revisión): וְלֹא + verbo es continuación negada, no disyuntiva', () => {
        const analysis = { words: [w('וְלֹא', GrammaticalCategory.NEGATIVE_PARTICLE, [MorphemeRole.WAW_CONJUNCTIVE]), w('יָדַע', GrammaticalCategory.VERB)], clauses: [clausula(0, 1, 'WAW_CONJUNCTIVE'), ] } as never;
        expect(checkClauseConnections(analysis).clauses![0]!.connection).toBe('WAW_CONJUNCTIVE');
        const asindeton = { words: [w('וְלֹא', GrammaticalCategory.NEGATIVE_PARTICLE, [MorphemeRole.WAW_CONJUNCTIVE])], clauses: [clausula(0, 0, 'ASYNDETIC')] } as never;
        expect(checkClauseConnections(asindeton).clauses![0]!.connection).toBe('WAW_CONJUNCTIVE');
    });

    it('REGRESIÓN (revisión): la waw con ḥireq o segol también es waw (וִיהִי)', () => {
        const analysis = { words: [w('וִיהִי', GrammaticalCategory.VERB)], clauses: [clausula(0, 0, 'WAW_CONJUNCTIVE')] } as never;
        expect(checkClauseConnections(analysis).clauses![0]!.connection).toBe('WAW_CONJUNCTIVE');
    });

    it('REGRESIÓN (revisión): sin solapes ni repetidas, en orden; «inicial» sólo la primera', () => {
        const words = [w('א', GrammaticalCategory.NOUN), w('ב', GrammaticalCategory.NOUN), w('ג', GrammaticalCategory.NOUN)];
        const r = checkClauseConnections({ words, clauses: [clausula(2, 2, 'FIRST'), clausula(0, 1, 'FIRST'), clausula(0, 1, 'FIRST'), clausula(1, 2, 'ASYNDETIC')] } as never).clauses!;
        expect(r.map(c => [c.firstWord, c.lastWord, c.connection])).toEqual([[0, 1, 'FIRST'], [2, 2, 'ASYNDETIC']]);
    });
});

