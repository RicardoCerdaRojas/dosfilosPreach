import { describe, it, expect } from 'vitest';
import { censusOf } from '../scriptCensus';

/**
 * Lo que este censo tiene que poder distinguir es un caso real: cuatro obras
 * hebreas de la biblioteca habían extraído CERO caracteres hebreos —Sasson
 * entre ellas, con 205 citas en trabajos entregados— y el dato estaba a la
 * vista desde la extracción.
 */
describe('censusOf', () => {
    it('cuenta hebreo con vocalización y cantilación', () => {
        const c = censusOf('יְהוָה רֹעִי לֹא אֶחְסָר');
        expect(c.hebrew).toBeGreaterThan(15);
        expect(c.latin).toBe(0);
    });

    it('cuenta griego, incluido el extendido con espíritus y acentos', () => {
        const c = censusOf('Πᾶσαν χαρὰν ἡγήσασθε, ἀδελφοί μου');
        expect(c.greek).toBeGreaterThan(20);
        expect(c.hebrew).toBe(0);
    });

    it('reconoce el latino acentuado del español', () => {
        expect(censusOf('exégesis según la numeración').latin).toBeGreaterThan(20);
    });

    it('un comentario hebreo cuyo hebreo no sobrevivió da cero, que es la señal', () => {
        // Texto real de la extracción del BHQ: la prosa inglesa quedó y la
        // palabra hebrea que discute desapareció.
        const c = censusOf("Uncertainty as to the meaning of  is the root of the problem; T's  is itself obscure.");
        expect(c.hebrew).toBe(0);
        expect(c.latin).toBeGreaterThan(50);
    });

    it('mide sobre el texto completo, no sobre lo que entra en Firestore', () => {
        const largo = 'א'.repeat(900_000);
        expect(censusOf(largo).totalChars).toBe(900_000);
        expect(censusOf(largo).hebrew).toBe(900_000);
    });

    it('no explota con vacío', () => {
        expect(censusOf('')).toEqual({ totalChars: 0, hebrew: 0, greek: 0, latin: 0 });
    });
});
