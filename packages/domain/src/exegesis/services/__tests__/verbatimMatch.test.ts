import { describe, it, expect } from 'vitest';
import { findVerbatim, normalizeForVerbatim } from '../verbatimMatch';

/**
 * Casos reales del comentario de Ross sobre Sal 23 tal como los devolvió la
 * extracción: comillas tipográficas, guiones de fin de línea partiendo
 * palabras y saltos de línea donde el libro tiene espacios.
 */
const ROSS_559 = {
    text: '“Shepherd” is an active participle used substan-\ntively, stressing the meaning of the word: “my shepherd” or even “my feeder”',
    pageHint: 'p. 559',
};
const ROSS_560 = {
    text: 'First, the verb should be taken as a habitual imperfect, translated “I lack nothing” or “I do not lack,” in view of the participle pre- ceding it as well as the nature of the meditation.',
    pageHint: 'p. 560',
};
const INTRO = { text: 'A close analysis of the text will show that it is a meditation on all that the LORD does for the one who trusts in him.', pageHint: null };

describe('normalizeForVerbatim', () => {
    it('une palabras partidas por guion de fin de línea y unifica comillas', () => {
        expect(normalizeForVerbatim('substan-\ntively, “my shepherd”')).toBe('substantively, "my shepherd"');
        expect(normalizeForVerbatim('pre- ceding')).toBe('preceding');
    });
});

describe('findVerbatim', () => {
    it('encuentra la oración aunque la extracción la haya partido con guion', () => {
        const m = findVerbatim('"Shepherd" is an active participle used substantively', [INTRO, ROSS_559]);
        expect(m).toEqual({ chunkIndex: 1, pageHint: 'p. 559', score: 1 });
    });

    it('encuentra una oración con una palabra cambiada por la extracción, con puntaje menor', () => {
        const m = findVerbatim('the verb should be taken as a habitual imperfect, translated "I lack nothing" or "I do not lack", in view of the participle preceding it', [ROSS_560]);
        expect(m?.chunkIndex).toBe(0);
        expect(m!.score).toBeGreaterThanOrEqual(0.85);
        expect(m!.score).toBeLessThan(1);
    });

    it('no da por encontrada una oración que no está', () => {
        // La cita que el analizador reconstruyó de memoria: Ezequiel no está en Ross.
        expect(findVerbatim('this motivation appears in Ezekiel 20:9 and 36:22 in covenant contexts', [ROSS_559, ROSS_560])).toBeNull();
    });

    it('una cita de tres palabras es demasiado corta para afirmar nada', () => {
        expect(findVerbatim('habitual imperfect translated', [ROSS_560])).toBeNull();
    });

    it('a igual puntaje prefiere el fragmento con página', () => {
        const sinPagina = { ...ROSS_559, pageHint: null };
        const m = findVerbatim('"Shepherd" is an active participle used substantively', [sinPagina, ROSS_559]);
        expect(m?.pageHint).toBe('p. 559');
    });
});
