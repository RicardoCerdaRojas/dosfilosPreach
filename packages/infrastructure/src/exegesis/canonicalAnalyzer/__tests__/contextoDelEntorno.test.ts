import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../analyzerPrompts';

/**
 * El analizador veía SÓLO su propio versículo: `getChapterContent` traía el
 * capítulo entero y el caso de uso lo recortaba. Con el recorte se iba la
 * evidencia de toda construcción que cruce el corte. El caso testigo es
 * Santiago 2:2, una prótasis condicional cuya apódosis está en 2:4.
 */
const entrada = (pericopeContext: string | null, lang: 'es' | 'en' = 'es'): AnalyzeVerseInput => ({
    paperPassage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13 },
    verseRef: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 2, verseEnd: 2 },
    language: lang,
    originalLanguageText: '2:2 ἐὰν γὰρ εἰσέλθῃ εἰς συναγωγὴν ὑμῶν ἀνὴρ χρυσοδακτύλιος',
    pericopeContext,
    assignmentBrief: null,
    sources: [],
    styleGuideContent: '',
    missingSourceTypes: [],
    priorAcceptedAnalyses: [],
    regenerationHint: null,
    stepEmphasis: null,
} as unknown as AnalyzeVerseInput);

describe('el texto del entorno llega al analizador', () => {
    const CONTEXTO = '  2:1 μὴ ἐν προσωπολημψίαις\n► 2:2 ἐὰν γὰρ εἰσέλθῃ\n  2:4 οὐ διεκρίθητε ἐν ἑαυτοῖς';

    it('el entorno entra al prompt', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada(CONTEXTO));
        expect(systemInstruction).toContain('2:4 οὐ διεκρίθητε');
    });

    it('dice que es contexto y no tarea', () => {
        // Sin esta frase el modelo recibe seis versículos de griego y analiza
        // los seis: el contexto se vuelve tarea, que es el defecto contrario.
        const { systemInstruction } = buildAnalyzerPrompt(entrada(CONTEXTO));
        expect(systemInstruction).toContain('Contexto SOLAMENTE');
        expect(systemInstruction).toContain('no analices los otros');
    });

    it('el versículo a analizar sigue teniendo su propio bloque autoritativo', () => {
        // El entorno NO reemplaza al texto base: toda afirmación gramatical
        // tiene que seguir cuadrando con la redacción del versículo.
        const { systemInstruction } = buildAnalyzerPrompt(entrada(CONTEXTO));
        expect(systemInstruction).toContain('Texto base');
        expect(systemInstruction).toContain('Texto del entorno');
    });

    it('sin entorno el bloque no aparece', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada(null));
        expect(systemInstruction).not.toContain('Texto del entorno');
        expect(systemInstruction).toContain('Texto base');
    });

    it('en inglés también', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada(CONTEXTO, 'en'));
        expect(systemInstruction).toContain('Surrounding text');
        expect(systemInstruction).toContain('Context ONLY');
    });
});
