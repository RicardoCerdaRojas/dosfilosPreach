import { describe, it, expect } from 'vitest';
import { proseReviewCriteria } from '@dosfilos/domain';
import { buildProseReviewPrompt, parseProseReview } from '../proseReviewPrompt';

/** TP #8 (8b, E3): el revisor con modelo, sin Firebase. */
const PROSA = 'La distinción de voces se resuelve por κακῶς (Adamson, 169). Así, la petición es mala.';
const entrada = {
    prose: PROSA,
    verseLabel: 'Santiago 4:3',
    language: 'es' as const,
    questions: [{ number: 2, text: '¿Por qué αἰτεῖτε en voz activa?' }],
    decisiveCriteria: [{ questionNumber: 2, text: 'Mayor concede que la activa puede incluir la media', whyThisOverThat: 'concesión del defensor', decision: 'sin distinción' }],
    grammarCitations: ['Wallace, p. 597'],
    criteria: proseReviewCriteria('es', ['Tercera persona.']),
};

describe('el prompt del revisor', () => {
    it('numera los criterios, con los del curso al final', () => {
        const { systemInstruction } = buildProseReviewPrompt(entrada);
        expect(systemInstruction).toContain('1. La prosa decide con el criterio decisivo del análisis');
        expect(systemInstruction).toContain(`${entrada.criteria.length}. Tercera persona.`);
    });

    it('lleva lo que el análisis decidió y la gramática citada', () => {
        const { userMessage } = buildProseReviewPrompt(entrada);
        expect(userMessage).toContain('Pregunta 2: criterio «Mayor concede que la activa puede incluir la media»');
        expect(userMessage).toContain('GRAMÁTICA DEL CURSO CITADA EN EL ANÁLISIS: Wallace, p. 597');
        expect(userMessage).toContain(PROSA);
    });
});

describe('la lectura de la respuesta', () => {
    const n = entrada.criteria.length;
    it('conserva la frase que está en la prosa y descarta la que no', () => {
        const raw = JSON.stringify({ findings: [
            { criterion: 6, quote: 'se resuelve por κακῶς', problem: 'No discrimina.', fix: 'Usar la concesión.' },
            { criterion: 2, quote: 'una frase que no está', problem: 'Cierre doble.', fix: '' },
        ] });
        expect(parseProseReview(raw, PROSA, n)).toEqual([
            { criterion: 6, quote: 'se resuelve por κακῶς', problem: 'No discrimina.', fix: 'Usar la concesión.' },
            { criterion: 2, quote: '', problem: 'Cierre doble.', fix: '' },
        ]);
    });

    it('descarta un criterio fuera de la lista y un hallazgo sin problema', () => {
        const raw = JSON.stringify({ findings: [{ criterion: 99, quote: '', problem: 'x', fix: '' }, { criterion: 1, quote: '', problem: ' ', fix: '' }] });
        expect(parseProseReview(raw, PROSA, n)).toEqual([]);
    });

    it('una respuesta que no es JSON es un error, no una prosa sin hallazgos', () => {
        expect(() => parseProseReview('no sé', PROSA, n)).toThrow(/no es JSON/);
    });
});

/** TP #9 (Santiago 4:14): el revisor tomó el análisis como verdad e inventó Wallace 961. */
describe('el prompt del revisor — las notas del estudiante y las citas disponibles (B39, B40)', () => {
    const NOTA = 'Robertson p. 767 no dice que τό permita reconocer un objeto completo: esa inferencia es del análisis. El criterio no decide; se corrige en la prosa.';
    const con = {
        ...entrada,
        decisiveCriteria: [{ ...entrada.decisiveCriteria[0]!, reviewNotes: [`Robertson, p. 767 (pregunta 2, criterio decisivo): ${NOTA}`] }],
        reviewNotes: [{ citation: 'Robertson, p. 767 (pregunta 2, criterio decisivo)', note: NOTA }],
        availableCitations: ['Wallace, p. 236', 'Robertson, p. 767', 'Robertson, p. 961'],
    };

    it('la nota va pegada al criterio que corrige y en su propio bloque', () => {
        const { userMessage } = buildProseReviewPrompt(con);
        expect(userMessage).toContain(`· Nota de revisión del estudiante: Robertson, p. 767 (pregunta 2, criterio decisivo): ${NOTA}`);
        expect(userMessage).toContain('NOTAS DE REVISIÓN DEL ESTUDIANTE (pesan más que el análisis):\n- Robertson, p. 767');
        expect(userMessage).toContain('CITAS DISPONIBLES: Wallace, p. 236; Robertson, p. 767; Robertson, p. 961');
    });

    it('enseña a preguntar, no a ordenar restituir, y a no nombrar citas que no están', () => {
        const { systemInstruction } = buildProseReviewPrompt(con);
        expect(systemInstruction).toContain('¿es a propósito?');
        expect(systemInstruction).toContain('nunca como orden de restituir');
        expect(systemInstruction).toContain('Nunca nombres una cita (autor y página) que no esté en CITAS DISPONIBLES');
        expect(buildProseReviewPrompt({ ...con, language: 'en' }).systemInstruction).toContain('is this on purpose?');
    });

    it('sin notas ni citas, los bloques no aparecen', () => {
        const { userMessage } = buildProseReviewPrompt(entrada);
        expect(userMessage).not.toContain('NOTAS DE REVISIÓN');
        expect(userMessage).not.toContain('CITAS DISPONIBLES');
    });
});
