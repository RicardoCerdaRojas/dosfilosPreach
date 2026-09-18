import { describe, expect, it } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { ComposeVerseInput } from '@dosfilos/domain';
import { buildVerseProsePrompt } from '../verseProsePrompt';

/** El mínimo que el compositor necesita para armar un prompt. */
function promptInput(): ComposeVerseInput {
    const reference = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 3, verseEnd: 3 } as const;
    return {
        verseAnalysis: {
            ...buildEmptyCanonicalVerseAnalysis(reference),
            commentatorEngagement: [
                { sourceKey: "Waltke-O'Connor", page: 436, pageKind: 'printed', role: 'technical', position: 'El polel funciona como piel' },
            ],
        } as never,
        paperPassage: reference,
        language: 'es',
        assignmentBrief: null,
        styleGuideContent: '',
        styleGuideManifest: null,
        sources: [],
    };
}

describe('recomposición dirigida', () => {
    const base = promptInput();

    it('sin indicación, el prompt queda como estaba', () => {
        const { userMessage } = buildVerseProsePrompt(base);
        expect(userMessage).not.toMatch(/QUÉ CORREGIR/);
        expect(userMessage).not.toMatch(/EXTENSIÓN OBJETIVO/);
    });

    it('la indicación del autor va al final, después del análisis', () => {
        const { userMessage } = buildVerseProsePrompt({ ...base, guidance: 'Desarrolla la morfología de שׁוב' });
        expect(userMessage).toContain('Desarrolla la morfología de שׁוב');
        // Después del análisis: es lo último que debe tener presente.
        expect(userMessage.indexOf('Desarrolla la morfología'))
            .toBeGreaterThan(userMessage.indexOf('ANÁLISIS CANÓNICO'));
    });

    it('la indicación se enmarca como exigencia de esta pasada, no como contenido nuevo', () => {
        const { userMessage } = buildVerseProsePrompt({ ...base, guidance: 'más largo' });
        expect(userMessage).toMatch(/no es contenido nuevo/i);
    });

    it('la extensión objetivo dice que rellenar es peor que un párrafo corto', () => {
        const { userMessage } = buildVerseProsePrompt({ ...base, targetWords: 800 });
        expect(userMessage).toContain('800 palabras');
        expect(userMessage).toMatch(/rellenar, repetir o inventar es peor/);
    });

    it('un objetivo de cero o negativo se ignora', () => {
        expect(buildVerseProsePrompt({ ...base, targetWords: 0 }).userMessage).not.toMatch(/EXTENSIÓN OBJETIVO/);
    });
});
