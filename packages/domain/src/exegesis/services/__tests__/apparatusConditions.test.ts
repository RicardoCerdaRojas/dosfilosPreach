import { describe, expect, it } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, type CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { conditioningVariants } from '../apparatusConditions';
import { serializeAnalysis } from '../serializeAnalysis';

/**
 * P1 (etapa 4): lo que dice el aparato llega al criterio y a la prosa. Casos
 * del TP #9 (Santiago 4:11-17) leídos en producción: el criterio de 4:14
 * decide «por la presencia de τὸ», y el aparato da τὰ y la omisión.
 */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 14, verseEnd: 14 };
const conVariante = (criterio: string, over: Partial<CanonicalVerseAnalysis> = {}): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis(REF as never),
    textualCriticism: {
        note: '',
        variants: [{
            lemma: 'τὸ τῆς αὔριον',
            readings: [
                { text: 'τὸ τῆς αὔριον', witnesses: ['ℵ', 'Ψ'] },
                { text: 'τὰ τῆς αὔριον', witnesses: ['A', 'P', '33'] },
                { text: 'τῆς αὔριον', witnesses: ['B'] },
            ],
            adoptedReading: 'τὸ τῆς αὔριον',
            rationale: '',
        }],
    },
    questionAnswers: [{ questionNumber: 2, directAnswer: '', options: [], decision: '', decisiveCriterion: { text: criterio, whyThisOverThat: '', sources: [] } }],
    ...over,
} as CanonicalVerseAnalysis);
const CONDICIONADO = conVariante('La presencia de τὸ permite reconocer τὸ τῆς αὔριον como objeto sustantivado completo.');

describe('la decisión condicionada por el texto', () => {
    it('el criterio que menciona la forma con variantes la condiciona; sin mencionarla, no', () => {
        expect(conditioningVariants(CONDICIONADO)).toEqual([expect.objectContaining({
            questionNumber: 2, lemma: 'τὸ τῆς αὔριον', rivals: ['τὰ τῆς αὔριον', 'τῆς αὔριον'], witnesses: 'τὰ τῆς αὔριον A P 33; τῆς αὔριον B',
        })]);
        expect(conditioningVariants(conVariante('La repetición de λέγω da dos predicaciones comparables.'))).toEqual([]);
        expect(conditioningVariants(null)).toEqual([]);
    });

    it('con premisas (P2): la forma puede estar en una premisa y no en la inferencia', () => {
        const a = conVariante('Otro criterio.');
        (a.questionAnswers![0]!.decisiveCriterion as { inference?: string; premises?: unknown }).inference = 'El objeto es completo antes de la pregunta.';
        (a.questionAnswers![0]!.decisiveCriterion as { premises?: unknown }).premises = [{ text: 'McCartney prefiere τὸ τῆς αὔριον.', sources: [{ sourceKey: 'McCartney', page: 230 }] }];
        expect(conditioningVariants(a)).toEqual([expect.objectContaining({ questionNumber: 2, lemma: 'τὸ τῆς αὔριον' })]);
    });

    it('la traducción decidida sola no condiciona: no hay pregunta a la que responder', () => {
        const a = conVariante('Otro criterio.', { finalTranslation: 'no saben τὸ τῆς αὔριον' } as never);
        expect(conditioningVariants(a)).toEqual([]);
    });

    it('una forma corta suelta no condiciona: «ὁ» aparece en cualquier criterio', () => {
        const a = conVariante('El artículo de ὁ δυνάμενος decide.');
        (a.textualCriticism.variants as unknown as Array<Record<string, unknown>>)[0] = { lemma: 'ὁ', readings: [{ text: 'ὁ', witnesses: ['ℵ'] }, { text: '', witnesses: ['K'] }], adoptedReading: 'ὁ', rationale: '' };
        expect(conditioningVariants(a)).toEqual([]);
    });

    it('una lectura vacía es la omisión, no una rival sin nombre', () => {
        const a = conVariante('Decide τὸ τῆς αὔριον.');
        (a.textualCriticism.variants as unknown as Array<Record<string, unknown>>)[0] = { lemma: 'τὸ τῆς αὔριον', readings: [{ text: 'τὸ τῆς αὔριον', witnesses: ['ℵ'] }, { text: '', witnesses: ['K', 'L'] }], adoptedReading: 'τὸ τῆς αὔριον', rationale: '' };
        expect(conditioningVariants(a)).toEqual([expect.objectContaining({ rivals: [], omission: true })]);
    });

    it('sin acentos ni espíritus: «το της αυριον» es la misma forma', () => {
        expect(conditioningVariants(conVariante('Decide το της αυριον.'))).toHaveLength(1);
    });
});

describe('la marca para el compositor', () => {
    it('el compositor recibe la variante como algo que la prosa debe nombrar', () => {
        const texto = serializeAnalysis(CONDICIONADO, 'es', { forComposingProse: true });
        expect(texto).toContain('CONDITIONED BY THE TEXT: the criterion depends on "τὸ τῆς αὔριον", which the apparatus also gives as τὰ τῆς αὔριον, τῆς αὔριον');
        expect(serializeAnalysis(conVariante('Sin relación.'), 'es', { forComposingProse: true })).not.toContain('CONDITIONED BY THE TEXT');
    });

    it('solo quien redacta el versículo o el trabajo recibe la orden', () => {
        expect(serializeAnalysis(CONDICIONADO, 'es')).not.toContain('CONDITIONED BY THE TEXT');
        expect(serializeAnalysis(CONDICIONADO, 'es', { forComposingProse: true })).toContain('CONDITIONED BY THE TEXT');
    });

    it('sin lectura adoptada, no imprime «null»', () => {
        const a = conVariante('Decide τὸ τῆς αὔριον.');
        (a.textualCriticism.variants as unknown as Array<Record<string, unknown>>)[0]!.adoptedReading = null;
        expect(serializeAnalysis(a, 'es', { forComposingProse: true })).not.toContain('null');
        expect(serializeAnalysis(a, 'es', { forComposingProse: true })).not.toContain('("")');
    });
});
