import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { serializeAnalysis } from '../serializeAnalysis';

/** TP #8 (8b, C1): la prosa recibe el criterio decisivo como algo que conservar. */
describe('serializeAnalysis — respuestas a las preguntas', () => {
    it('lista respuesta, lecturas con defensor, criterio y decisión', () => {
        const a = {
            ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 3, verseEnd: 3 }),
            questionAnswers: [{
                questionNumber: 3, directAnswer: 'Piden mal', decision: 'la media marca el interés propio',
                options: [
                    { reading: 'media = para sí', argument: 'Mayor', defenders: [{ sourceKey: 'Mayor', page: 133, pageKind: 'printed' as const }] },
                    { reading: 'sin diferencia', argument: '1 Jn 5:15', defenders: [] },
                ],
                decisiveCriterion: { text: 'la concesión de Mayor', whyThisOverThat: 'κακῶς vale para las dos', sources: [] },
            }],
        };
        const s = serializeAnalysis(a, 'es');
        expect(s).toContain('Answers to the brief questions (KEEP the decisive criterion and the decision):');
        expect(s).toContain('- Question 3: Piden mal');
        expect(s).toContain('reading: media = para sí — Mayor (defended by: Mayor p. 133)');
        expect(s).toContain('reading: sin diferencia — 1 Jn 5:15 (no defender in the corpus)');
        expect(s).toContain('decisive criterion: la concesión de Mayor — why this and not the other: κακῶς vale para las dos');
        expect(s).toContain('decision: la media marca el interés propio');
    });
});

/** TP #8 (8b, C3): la conclusión propia llega aparte y sin cita. */
describe('serializeAnalysis — inferencia propia', () => {
    it('va en su propia línea, marcada sin cita', () => {
        const a = {
            ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 3, verseEnd: 3 }),
            commentatorEngagement: [{
                sourceKey: 'Mayor', page: 133, pageKind: 'printed' as const, role: 'contrast' as const,
                position: 'Mayor lee la activa como pedir para sí.', verbatimQuote: '', ownInference: 'El contraste es de motivo.',
            }],
        };
        const s = serializeAnalysis(a, 'es');
        expect(s).toContain('Mayor (p. 133): Mayor lee la activa como pedir para sí.');
        expect(s).toContain('own inference (NO citation, separate sentence): El contraste es de motivo.');
    });
});
