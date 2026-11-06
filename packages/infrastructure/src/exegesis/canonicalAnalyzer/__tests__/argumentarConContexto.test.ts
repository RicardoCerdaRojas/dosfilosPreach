import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput, ConcordanceEntry } from '@dosfilos/domain';
import { buildAnalyzerPrompt, CONCORDANCE_BUDGET_CHARS, formatBookConcordance } from '../analyzerPrompts';

/**
 * TP #10 (Santiago 5:1–6, devolución 2026-11-05): las tres correcciones de
 * fondo fueron de argumentación —la rival sin responder, un criterio que valía
 * para las dos lecturas y 5:6 sin el apoyo de 5:4–5 y 2:6—. La compuerta R
 * pasó con estas tres comprobaciones y la concordancia calculada.
 */
const REF = { bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 6, verseEnd: 6 } as const;

const entrada = (over: Partial<AnalyzeVerseInput> = {}): AnalyzeVerseInput => ({
    paperPassage: { ...REF, verseStart: 1, verseEnd: 6 },
    verseRef: REF,
    language: 'es',
    originalLanguageText: null,
    pericopeContext: null,
    assignmentBrief: null,
    stepEmphasis: null,
    styleGuideContent: '',
    sources: [],
    priorAcceptedAnalyses: [],
    regenerationHint: null,
    missingSourceTypes: [],
    ...over,
} as unknown as AnalyzeVerseInput);

const preguntas = [{ number: 6, text: '¿Quién es «el justo» de 5:6?', kinds: ['identify' as const] }];

const CONCORDANCIA: ConcordanceEntry[] = [
    { lemma: 'καταδικάζω', inVerse: true, occurrences: [{ chapter: 2, verse: 6, text: 'ὑμεῖς δὲ ἠτιμάσατε τὸν πτωχόν.' }] },
    { lemma: 'θησαυρίζω', inVerse: false, occurrences: [{ chapter: 5, verse: 7, text: 'texto de 5:7' }] },
];

describe('argumentar: las tres comprobaciones', () => {
    it('con preguntas, el analizador recibe las tres', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas }));
        expect(systemInstruction).toContain('1. RESPONDE A LA RIVAL: en `whyThisOverThat`');
        expect(systemInstruction).toContain('2. PRUEBA TU CRITERIO');
        expect(systemInstruction).toContain('3. APOYA CON EL CONTEXTO');
    });

    it('en inglés, también', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas, language: 'en' }));
        expect(systemInstruction).toContain('1. ANSWER THE RIVAL: in `whyThisOverThat`');
    });

    it('la tercera nombra la concordancia solo si la hay: sin ella invitaría a citar de memoria', () => {
        const sin = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas })).systemInstruction;
        expect(sin).toContain('3. APOYA CON EL CONTEXTO: usa los versículos de la perícopa que recibiste.');
        expect(sin).not.toContain('concordancia calculada');
        const con = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas, bookConcordance: CONCORDANCIA })).systemInstruction;
        expect(con).toContain('y los pasajes del mismo libro de la concordancia calculada');
    });

    it('van junto al método, antes de la guía de estilo: el servidor corta la instrucción por el final', () => {
        const s = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas, styleGuideContent: 'GUÍA' })).systemInstruction;
        expect(s.indexOf('RESPONDE A LA RIVAL')).toBeGreaterThan(s.indexOf('Cómo responder las preguntas'));
        expect(s.indexOf('RESPONDE A LA RIVAL')).toBeLessThan(s.indexOf('GUÍA'));
    });

    it('sin preguntas no aparecen: `whyThisOverThat` no existe en ese esquema', () => {
        expect(buildAnalyzerPrompt(entrada()).systemInstruction).not.toContain('RESPONDE A LA RIVAL');
    });
});

describe('la concordancia del libro llega al analizador', () => {
    it('va en el mensaje, con el versículo griego de cada aparición', () => {
        const { userMessage } = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas, bookConcordance: CONCORDANCIA }));
        expect(userMessage).toContain('## Concordancia interna del libro');
        expect(userMessage).toContain('- καταδικάζω: 2:6 ὑμεῖς δὲ ἠτιμάσατε τὸν πτωχόν.');
        expect(userMessage).toContain('- θησαυρίζω: 5:7 texto de 5:7');
    });

    it('sin concordancia, no hay bloque', () => {
        expect(buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas })).userMessage).not.toContain('Concordancia interna');
    });

    it('respeta el tope cortando líneas enteras, y los lemas del versículo van primero', () => {
        const largo = 'λ'.repeat(400);
        const muchas: ConcordanceEntry[] = [
            ...Array.from({ length: 4 }, (_, i) => ({ lemma: `verso${i}`, inVerse: true, occurrences: [{ chapter: 1, verse: i + 1, text: largo }] })),
            ...Array.from({ length: 6 }, (_, i) => ({ lemma: `pasaje${i}`, inVerse: false, occurrences: [{ chapter: 2, verse: i + 1, text: largo }] })),
        ];
        const bloque = formatBookConcordance(muchas, 'es');
        expect(bloque.length).toBeLessThanOrEqual(CONCORDANCE_BUDGET_CHARS + 60);
        for (let i = 0; i < 4; i++) expect(bloque).toContain(`- verso${i}:`);
        expect(bloque).toMatch(/\[\d+ lemas fuera por extensión\]/);
        // Ninguna línea queda cortada a la mitad.
        expect(bloque.split('\n').filter(l => l.startsWith('- ') && l !== '- ninguno').every(l => l.endsWith(largo))).toBe(true);
    });

    it('sin lemas del pasaje, lo dice', () => {
        expect(formatBookConcordance([CONCORDANCIA[0]!], 'es')).toContain('Lemas del resto de la perícopa:\n- ninguno');
    });
});
