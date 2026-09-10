import { describe, it, expect } from 'vitest';
import { assessExtraction, requiredScriptsFor } from '../extractionHealth';

/**
 * Los casos de acá son obras REALES de una biblioteca de 59 recursos, con sus
 * cifras medidas. Cuatro libros hebreos habían extraído cero caracteres
 * hebreos y dos estaban citados en trabajos entregados —Sasson 205 veces—.
 *
 * El contraejemplo importa tanto como los defectos: «Gramática Hebreo» de
 * Farfán extrajo 65.188 caracteres hebreos siendo el mismo tipo de libro que
 * Barrick, que extrajo cero. No es un límite del sistema.
 */
const censo = (o: Partial<{ totalChars: number; hebrew: number; greek: number; latin: number }>) =>
    ({ totalChars: 0, hebrew: 0, greek: 0, latin: 0, ...o });

describe('assessExtraction', () => {
    it('marca el comentario hebreo que extrajo cero hebreo', () => {
        // Sasson, «Jonah» (Anchor Bible): 790.779 chars, 0 hebreo, 205 citas.
        const r = assessExtraction(censo({ totalChars: 790_779, latin: 600_000 }), ['hebrew']);
        expect(r).toEqual({ status: 'missing-script', script: 'hebrew', found: 0 });
    });

    it('deja pasar la gramática hebrea que sí extrajo hebreo', () => {
        // Farfán: 493.028 chars, 65.188 hebreo. Mismo tipo que Barrick.
        expect(assessExtraction(censo({ totalChars: 493_028, hebrew: 65_188 }), ['hebrew']))
            .toEqual({ status: 'ok' });
    });

    it('marca el aparato hebreo aunque traiga mucho griego', () => {
        // BHQ de los Doce: 676.994 chars, 0 hebreo, 19.643 GRIEGO. Exigir
        // «algún alfabeto no latino» lo dejaría pasar, y su aparato está roto:
        // la prosa inglesa quedó y la palabra hebrea que discute, no.
        expect(assessExtraction(censo({ totalChars: 676_994, greek: 19_643 }), ['hebrew']))
            .toMatchObject({ status: 'missing-script', script: 'hebrew' });
    });

    it('deja pasar el NT griego, que legítimamente no trae hebreo', () => {
        // NA28: 592.496 chars, 0 hebreo, 163.605 griego.
        expect(assessExtraction(censo({ totalChars: 592_496, greek: 163_605 }), ['greek']))
            .toEqual({ status: 'ok' });
    });

    it('un puñado de letras sueltas no alcanza: puede ser el OCR acertando por azar', () => {
        expect(assessExtraction(censo({ totalChars: 779_385, hebrew: 8 }), ['hebrew']))
            .toMatchObject({ status: 'missing-script', found: 8 });
    });

    it('sin exigencia declarada no opina', () => {
        expect(assessExtraction(censo({ totalChars: 500_000 }), [])).toEqual({ status: 'ok' });
    });

    it('sin censo no opina: extraído antes de que esto existiera', () => {
        expect(assessExtraction(null, ['hebrew'])).toEqual({ status: 'unknown' });
        expect(assessExtraction(undefined, ['hebrew'])).toEqual({ status: 'unknown' });
    });

    it('un texto vacío es otro problema, y lo reporta el estado del recurso', () => {
        expect(assessExtraction(censo({ totalChars: 0 }), ['hebrew'])).toEqual({ status: 'unknown' });
    });
});

describe('requiredScriptsFor — conservador ante la duda', () => {
    it('los libros que cubre mandan sobre el título', () => {
        expect(requiredScriptsFor({ type: 'critical-text', title: 'Novum Testamentum Graece', coversTestament: 'OT' }))
            .toEqual(['hebrew']);
    });

    it('lee el título cuando no hay libros declarados', () => {
        expect(requiredScriptsFor({ type: 'critical-text', title: 'The Twelve Minor Prophets - Biblia Hebraica Quinta (BHQ)' }))
            .toEqual(['hebrew']);
        expect(requiredScriptsFor({ type: 'critical-text', title: 'Novum Testamentum Graece - Nestle-Aland (NA28)' }))
            .toEqual(['greek']);
    });

    it('exige hebreo a un comentario EXEGÉTICO del AT', () => {
        // Sasson, «Jonah» (Anchor Bible): 790.779 chars, 0 hebreo, 205 citas en
        // trabajos entregados. Su razón de ser es trabajar sobre el texto
        // hebreo, así que un cero ahí no es un libro sin hebreo: está roto.
        expect(requiredScriptsFor({
            type: 'exegetical-commentary',
            title: 'Jonah — A New Translation with Introduction and Commentary',
            coversTestament: 'OT',
        })).toEqual(['hebrew']);
    });

    it('no exige nada a un comentario expositivo, aunque comente el AT', () => {
        // Un comentario en español sobre Jonás puede no traer una letra hebrea
        // y estar perfecto. Marcarlo enseñaría a ignorar la advertencia.
        expect(requiredScriptsFor({ type: 'commentary', title: 'Comentario Jonás', coversTestament: 'OT' }))
            .toEqual([]);
    });

    it('no exige nada cuando el título nombra los dos idiomas', () => {
        expect(requiredScriptsFor({ type: 'grammar', title: 'Léxico hebreo y griego del AT y NT' })).toEqual([]);
    });

    it('no exige nada cuando la obra cruza los dos testamentos', () => {
        expect(requiredScriptsFor({ type: 'critical-text', title: 'Biblia Hebraica', coversTestament: 'both' })).toEqual([]);
    });

    it('no exige nada cuando el título no dice nada', () => {
        expect(requiredScriptsFor({ type: 'grammar', title: 'Gramática' })).toEqual([]);
    });
});
