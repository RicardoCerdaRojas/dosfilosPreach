import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../analyzerPrompts';

/**
 * Etapa 2, capa 3: el método del trabajo ordena el análisis en la MISMA
 * llamada. Sin método, el prompt de siempre: el que costó afinar.
 */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 11 } as const;
const fuentes = [
    { corpusId: 'w', sourceType: 'grammar-syntax', displayLabel: 'Wallace', citationKey: 'Wallace', textContent: 'gramática', priority: 'secondary' },
    { corpusId: 'b', sourceType: 'lexicon-technical', displayLabel: 'BDAG', citationKey: 'BDAG', textContent: 'léxico', priority: 'secondary' },
    { corpusId: 'm', sourceType: 'commentary-critical', displayLabel: 'Mayor', citationKey: 'Mayor', textContent: 'comentario', priority: 'primary' },
];
const entrada = (over: Partial<AnalyzeVerseInput> = {}): AnalyzeVerseInput => ({
    paperPassage: { ...REF, verseEnd: 17 }, verseRef: REF, language: 'es', originalLanguageText: null, pericopeContext: null,
    assignmentBrief: null, stepEmphasis: null, styleGuideContent: '', sources: fuentes, priorAcceptedAnalyses: [],
    regenerationHint: null, missingSourceTypes: [], ...over,
} as unknown as AnalyzeVerseInput);
const prompt = (over: Partial<AnalyzeVerseInput> = {}) => {
    const p = buildAnalyzerPrompt(entrada(over));
    return `${p.systemInstruction}\n${p.userMessage}`;
};

describe('el método del trabajo en el prompt del análisis', () => {
    it('sin método, o con investigación, el prompt es idéntico al de siempre', () => {
        const deSiempre = prompt();
        expect(prompt({ method: null })).toBe(deSiempre);
        expect(prompt({ method: 'research' })).toBe(deSiempre);
        expect(deSiempre).not.toContain('primero la observación');
    });

    it('exegético: la observación solo con las herramientas, el diálogo con la literatura', () => {
        const p = prompt({ method: 'exegetical' });
        expect(p).toContain('Método del trabajo: exegético');
        expect(p).toMatch(/SOLO con las herramientas: `Wallace`, `BDAG`/);
        expect(p).toMatch(/Literatura: `Mayor`/);
        expect(p).not.toContain('questionAnswers`: `directAnswer`');
        // Con preguntas pero método exegético, no se pide el orden por pregunta.
        const conPreguntas = prompt({ method: 'exegetical', sectionQuestions: [{ number: 1, text: '¿Qué función tiene καταλαλεῖτε?', kinds: ['syntax'] }] });
        expect(conPreguntas).not.toContain('vienen de los comentarios; el criterio decisivo');
    });

    it('mixto con preguntas: la respuesta gramatical, luego las lecturas con sus defensores', () => {
        const p = prompt({ method: 'mixed', sectionQuestions: [{ number: 1, text: '¿Qué función tiene καταλαλεῖτε?', kinds: ['syntax'] }] });
        expect(p).toContain('mixto (por pregunta)');
        expect(p).toContain('las lecturas (`options`) y sus defensores (`defenders`) vienen de los comentarios');
    });

    it('en inglés también', () => {
        expect(prompt({ method: 'exegetical', language: 'en' })).toContain('built ONLY with the tools: `Wallace`, `BDAG`');
    });

    it('«Mi lectura» entra al prompt y pide decir quién la confirma y quién la discute', () => {
        const p = prompt({ studentReading: '  El presente imperativo con μή prohíbe seguir murmurando.  ' });
        expect(p).toContain('«El presente imperativo con μή prohíbe seguir murmurando.»');
        expect(p).toContain('qué comentaristas la confirman y cuáles la discuten');
        expect(prompt({ studentReading: '   ' })).toBe(prompt());
        expect(prompt({ studentReading: 'My reading', language: 'en' })).toContain('"My reading"');
    });

    describe('revisión adversarial de la etapa 2', () => {
        it('la traducción final y la tesis no llevan citas; los vínculos con el AT pueden citar literatura', () => {
            const p = prompt({ method: 'exegetical' });
            expect(p).toContain('`finalTranslation` y `verseThesis` no llevan citas');
            expect(p).toContain('`oldTestamentLinks` puede citar literatura');
            expect(p).not.toMatch(/OBSERVACIÓN \([^)]*oldTestamentLinks/);
        });

        it('sin herramientas con material, la observación sale del texto base, sin citas', () => {
            const soloComentario = fuentes.filter(f => f.sourceType === 'commentary-critical');
            expect(prompt({ method: 'exegetical', sources: soloComentario as never })).toContain('ninguna herramienta trae material para este versículo');
        });

        it('la plantilla de estilo no se ofrece como literatura', () => {
            const conPlantilla = [...fuentes, { corpusId: 'x', sourceType: 'style-template-paper', displayLabel: 'Ejemplo', citationKey: 'Ejemplo', textContent: 'x', priority: 'secondary' }];
            expect(prompt({ method: 'exegetical', sources: conPlantilla as never })).toMatch(/Literatura: `Mayor`\./);
        });

        it('una asignada de literatura se cumple en el diálogo', () => {
            expect(prompt({ method: 'exegetical' })).toContain('Una fuente ASIGNADA de literatura se cumple en el diálogo');
        });

        it('«Mi lectura» se presenta como la del trabajo, nunca como «el estudiante»', () => {
            const p = prompt({ studentReading: 'Mi lectura' });
            expect(p).toContain('La lectura propia de este trabajo');
            expect(p).toContain('nunca escribas «el estudiante»');
        });
    });
});
