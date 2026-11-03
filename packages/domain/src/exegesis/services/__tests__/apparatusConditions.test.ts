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

    it('también la traducción decidida, si cita la forma', () => {
        const a = conVariante('Otro criterio.', { finalTranslation: 'no saben τὸ τῆς αὔριον' } as never);
        expect(conditioningVariants(a)).toEqual([expect.objectContaining({ questionNumber: null })]);
    });

    it('sin acentos ni espíritus: «το της αυριον» es la misma forma', () => {
        expect(conditioningVariants(conVariante('Decide το της αυριον.'))).toHaveLength(1);
    });
});

describe('la marca para el compositor', () => {
    it('el compositor recibe la variante como algo que la prosa debe nombrar', () => {
        const texto = serializeAnalysis(CONDICIONADO, 'es');
        expect(texto).toContain('CONDITIONED BY THE TEXT: the criterion depends on "τὸ τῆς αὔριον", which the apparatus also gives as τὰ τῆς αὔριον, τῆς αὔριον');
        expect(serializeAnalysis(conVariante('Sin relación.'), 'es')).not.toContain('CONDITIONED BY THE TEXT');
    });
});
