import { describe, expect, it } from 'vitest';
import type { CoherenceReviewInput } from '@dosfilos/domain';
import { buildReviewerPrompt } from '../reviewerPrompts';

/** Etapa 4.2: la coherencia marca el vocabulario que cambia entre secciones (TI #2: «hablante» y «salmista», qatal y perfecto). */
describe('la revisión de coherencia', () => {
    const entrada = (language: 'es' | 'en') =>
        ({ sections: [], passageDisplay: 'Salmo 23:4–6', assignmentBrief: null, language }) as unknown as CoherenceReviewInput;
    it('trata como tone-drift la nomenclatura y la voz que cambian entre secciones', () => {
        const { systemInstruction } = buildReviewerPrompt(entrada('es'));
        expect(systemInstruction).toContain('qatal/yiqtol sin glosa');
        expect(systemInstruction).toContain('«el hablante» o «el creyente»');
        expect(buildReviewerPrompt(entrada('en')).systemInstruction).toContain('"Yahweh"');
    });
});
