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

describe('registro de fuentes', () => {
    const conDatos = {
        ...promptInput(),
        sources: [{
            citationKey: 'Ross', author: 'Allen P. Ross', title: 'A Commentary on the Psalms',
            seriesVolume: 'Kregel Exegetical Library 1', city: 'Grand Rapids', publisher: 'Kregel', year: 2011,
        }],
    };

    it('la ficha llega completa, para que el compositor copie en vez de deducir', () => {
        const { userMessage } = buildVerseProsePrompt(conDatos as never);
        expect(userMessage).toContain('Allen P. Ross, "A Commentary on the Psalms"');
        expect(userMessage).toContain('Grand Rapids: Kregel: 2011');
    });

    it('sin datos de portada se escribe lo que hay, y se prohíbe deducir el resto', () => {
        const sinDatos = { ...promptInput(), sources: [{ citationKey: 'Ortiz', author: 'Ortiz', title: 'Lexicón' }] };
        const { userMessage } = buildVerseProsePrompt(sinDatos as never);
        expect(userMessage).toContain('Ortiz: Ortiz, "Lexicón"');
        expect(userMessage).not.toMatch(/\(\s*\)/);
        expect(userMessage).toMatch(/no lo escribas ni lo deduzcas/);
    });
});

describe('glosario del autor', () => {
    const conGlosario = {
        ...promptInput(),
        glossary: [
            { avoid: 'tronco', prefer: 'conjugación', note: 'nadie llama «tronco» a un binyan' },
            { avoid: 'anclada' },
        ],
    };

    it('las palabras prohibidas van en la instrucción, con su reemplazo', () => {
        const { systemInstruction } = buildVerseProsePrompt(conGlosario as never);
        expect(systemInstruction).toMatch(/PALABRAS QUE ESTE AUTOR NO USA/);
        expect(systemInstruction).toContain('"tronco" → escribe «conjugación»');
        expect(systemInstruction).toContain('nadie llama «tronco» a un binyan');
    });

    it('sin reemplazo, se pide reformular en vez de sustituir por nada', () => {
        const { systemInstruction } = buildVerseProsePrompt(conGlosario as never);
        expect(systemInstruction).toContain('"anclada" → reformula sin ella');
    });

    it('sin glosario, la instrucción queda como estaba', () => {
        expect(buildVerseProsePrompt(promptInput()).systemInstruction).not.toMatch(/NO USA/);
    });

    it('un término de menos de tres letras no entra: sería ruido en cada frase', () => {
        const corto = { ...promptInput(), glossary: [{ avoid: 'de' }] };
        expect(buildVerseProsePrompt(corto as never).systemInstruction).not.toMatch(/NO USA/);
    });
});

describe('voz del autor', () => {
    const conVoz = {
        ...promptInput(),
        voiceSamples: [
            { excerpt: 'La cláusula nominal que abre el salmo no afirma una posesión cualquiera.', position: 0.2 },
        ],
    };

    it('las muestras van en la instrucción, con la regla de imitar el registro', () => {
        const { systemInstruction } = buildVerseProsePrompt(conVoz as never);
        expect(systemInstruction).toMatch(/ASÍ ESCRIBE ESTE AUTOR/);
        expect(systemInstruction).toContain('cláusula nominal');
    });

    it('prohíbe expresamente tomar contenido y citas de las muestras', () => {
        // Son de OTRO trabajo: reusar sus fuentes sería citar lo que este
        // trabajo no estudió.
        const { systemInstruction } = buildVerseProsePrompt(conVoz as never);
        expect(systemInstruction).toMatch(/NUNCA tomes contenido, fuentes, páginas ni ejemplos/);
    });

    it('sin muestras la instrucción queda como estaba', () => {
        expect(buildVerseProsePrompt(promptInput()).systemInstruction).not.toMatch(/ASÍ ESCRIBE/);
    });
});
