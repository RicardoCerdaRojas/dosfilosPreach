import { describe, expect, it } from 'vitest';
import type { ExegesisGenerationInput, PassageReference, SeriesPlacement } from '@dosfilos/domain';
import { buildPrompt } from '../prompts';

/**
 * El lugar de la perícopa en la serie entra al prompt del estudio como
 * contexto literario, aparte del encargo, en el idioma del estudio
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, §2 paso 9). Antes iba como texto en
 * español dentro del encargo, que el prompt trata como «guía autoritativa».
 */
const ref = (c: number, v1: number, v2 = v1): PassageReference =>
    ({ bookId: 'EZR' as PassageReference['bookId'], chapterStart: c, chapterEnd: c, verseStart: v1, verseEnd: v2 });

const lugar: SeriesPlacement = {
    position: 3,
    total: 12,
    previous: { passage: 'Esdras 3:1-13', title: 'El altar y los cimientos' },
    next: { passage: 'Esdras 5:1-17', title: 'Hageo y Zacarías' },
};

const entrada = (lang: 'es' | 'en', seriesPlacement?: SeriesPlacement | null) => ({
    kind: 'verse',
    verseRef: ref(4, 1),
    paperPassage: ref(4, 1, 5),
    language: lang,
    sources: [],
    priorAcceptedSteps: [],
    styleGuideContent: '',
    assignmentBrief: 'La oposición nace de un rechazo.',
    missingSourceTypes: [],
    stepEmphasis: null,
    regenerationHint: null,
    ...(seriesPlacement !== undefined ? { seriesPlacement } : {}),
} as unknown as ExegesisGenerationInput);

describe('«Lugar en el libro» en el prompt del estudio', () => {
    it('en español: bloque propio, con las vecinas y la advertencia de que no fija la tesis', () => {
        const { systemInstruction } = buildPrompt(entrada('es', lugar));
        expect(systemInstruction).toContain('## Lugar en el libro (contexto literario, no tesis)');
        expect(systemInstruction).toContain(
            'Perícopa 3 de 12 de la serie. Antes: Esdras 3:1-13 («El altar y los cimientos»). Después: Esdras 5:1-17 («Hageo y Zacarías»).',
        );
        expect(systemInstruction).toContain('No fija la tesis');
        // Fuera del encuadre del trabajo: el bloque va DESPUÉS del encargo, no dentro.
        const encargo = systemInstruction.indexOf('La oposición nace de un rechazo.');
        const bloque = systemInstruction.indexOf('## Lugar en el libro');
        expect(encargo).toBeGreaterThan(-1);
        expect(bloque).toBeGreaterThan(encargo);
    });

    it('en inglés, en inglés', () => {
        const { systemInstruction } = buildPrompt(entrada('en', lugar));
        expect(systemInstruction).toContain('## Place in the book (literary context, not thesis)');
        expect(systemInstruction).toContain(
            'Pericope 3 of 12 in the series. Before: Esdras 3:1-13 ("El altar y los cimientos"). After: Esdras 5:1-17 ("Hageo y Zacarías").',
        );
        expect(systemInstruction).not.toContain('Perícopa');
    });

    it('en un extremo omite la vecina que no hay', () => {
        const { systemInstruction } = buildPrompt(entrada('es', { position: 1, total: 12, next: lugar.next! }));
        expect(systemInstruction).toContain('Perícopa 1 de 12 de la serie. Después: Esdras 5:1-17 («Hageo y Zacarías»).');
        expect(systemInstruction).not.toContain('Antes:');
    });

    it('sin lugar (estudio suelto): el prompt es byte a byte el de siempre', () => {
        for (const lang of ['es', 'en'] as const) {
            const sinCampo = buildPrompt(entrada(lang));
            expect(buildPrompt(entrada(lang, null))).toEqual(sinCampo);
            expect(sinCampo.systemInstruction).not.toMatch(/Lugar en el libro|Place in the book/);
        }
    });

    it('el mensaje del usuario no cambia: el lugar no es material del paso', () => {
        expect(buildPrompt(entrada('es', lugar)).userMessage).toBe(buildPrompt(entrada('es')).userMessage);
    });
});
