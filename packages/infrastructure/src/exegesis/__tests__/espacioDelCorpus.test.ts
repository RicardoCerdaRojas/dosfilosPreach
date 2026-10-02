import { describe, expect, it } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, type AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../canonicalAnalyzer/analyzerPrompts';
import { MAX_PROMPT_CHARS, PRIOR_ANALYSES_BUDGET_CHARS, VERSE_CORPUS_SPACE_CHARS, allocateSourceBudgets } from '../../llm/promptBudget';

/**
 * El medidor del corpus promete: «hasta VERSE_CORPUS_SPACE_CHARS, ninguna
 * fuente se recorta». Estas pruebas atan esa promesa al constructor REAL del
 * prompt, para que no dependa de que la cuenta de la constante siga siendo
 * cierta.
 *
 * En #730 el medidor y el envío real se separaron sin que nada fallara (Jonás
 * 4:5-11, 2026-10-02: 129% en pantalla con ~130.000 caracteres por versículo).
 */

const fuente = (key: string, chars: number) => ({
    sourceId: key,
    displayLabel: `Fuente ${key}`,
    citationKey: key,
    sourceType: 'commentary-expository' as const,
    priority: 'secondary' as const,
    textContent: 'x'.repeat(chars),
});

const versiculo = (sources: ReturnType<typeof fuente>[], extra: Partial<AnalyzeVerseInput> = {}) => ({
    verseRef: { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 6, verseEnd: 6 },
    paperPassage: { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 11 },
    language: 'es',
    sources,
    priorAcceptedAnalyses: [],
    styleGuideContent: '',
    // Van en las instrucciones de sistema, no en este mensaje; tamaños por
    // encima de los reales de Jonás 4:5-11 (encuadre: 599) por si eso cambia.
    assignmentBrief: 'e'.repeat(3_000),
    pericopeContext: 'c'.repeat(4_000),
    originalLanguageText: 'ה'.repeat(400),
    planNote: 'p'.repeat(500),
    missingSourceTypes: [],
    stepEmphasis: null,
    regenerationHint: null,
    ...extra,
}) as unknown as AnalyzeVerseInput;

describe('el espacio que promete el medidor entra sin recortes', () => {
    it('fuentes desparejas que suman el espacio entero: ninguna se recorta', () => {
        // La forma de Jonás 4:5-11: dos de fragmentos chicos y lo recuperado de las hojas, grande.
        const resto = VERSE_CORPUS_SPACE_CHARS - 8_741 - 21_775 - 60_000;
        const { userMessage } = buildAnalyzerPrompt(versiculo([
            fuente('Gelston', 8_741), fuente('Bruce', 21_775), fuente('Burt', 60_000), fuente('Calvino', resto),
        ]));
        expect(userMessage).not.toContain('contenido truncado');
        expect(userMessage.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    });

    it('en los últimos versículos, con los análisis previos al tope, entra el espacio menos su parte', () => {
        // Lo que el medidor avisa como «puede llegar recortado en los últimos versículos».
        const previos = Array.from({ length: 6 }, (_, i) => ({
            ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 5 + i, verseEnd: 5 + i }),
            finalTranslation: 't'.repeat(10_000),
        }));
        const resto = VERSE_CORPUS_SPACE_CHARS - PRIOR_ANALYSES_BUDGET_CHARS - 30_516;
        const { userMessage } = buildAnalyzerPrompt(versiculo(
            [fuente('Gelston', 8_741), fuente('Bruce', 21_775), fuente('Hojas', resto)],
            { priorAcceptedAnalyses: previos } as Partial<AnalyzeVerseInput>,
        ));
        expect(userMessage).toContain('t'.repeat(1_000));
        // Los análisis previos sí se recortan (60.000 > su tope); la fuente no.
        const textoDeLaFuente = userMessage.slice(userMessage.indexOf('### Fuente Hojas')).split('```')[1]!;
        expect(textoDeLaFuente.length).toBeGreaterThanOrEqual(resto);
        expect(textoDeLaFuente).not.toContain('contenido truncado');
        expect(userMessage.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    });

    it('si se pasa, recorta y el prompt sigue dentro del tope', () => {
        const { userMessage } = buildAnalyzerPrompt(versiculo([
            fuente('A', 8_741), fuente('B', VERSE_CORPUS_SPACE_CHARS),
        ]));
        expect(userMessage).toContain('contenido truncado');
        expect(userMessage.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    });
});

describe('allocateSourceBudgets', () => {
    it('si todo cabe, cada fuente recibe lo suyo', () => {
        expect(allocateSourceBudgets([8_741, 21_775, 90_000], [1, 1, 1], 180_000)).toEqual([8_741, 21_775, 90_000]);
    });

    it('lo que una fuente chica no usa pasa a la grande', () => {
        const [a, b] = allocateSourceBudgets([10_000, 500_000], [1, 1], 100_000);
        expect(a).toBe(10_000);
        expect(b).toBe(90_000);
    });

    it('respeta los pesos entre las que no caben', () => {
        const [a, b, c] = allocateSourceBudgets([1_000, 500_000, 500_000], [1, 3, 1], 101_000);
        expect(a).toBe(1_000);
        expect(b).toBe(75_000);
        expect(c).toBe(25_000);
    });

    it('nunca reparte más que el total ni más que lo que trae cada fuente', () => {
        const largos = [0, 5, 70_000, 3_000, 250_000, 12_345];
        const pesos = [1, 2, 4, 1, 3, 2];
        for (const total of [0, 1, 10_000, 100_000, 400_000]) {
            const r = allocateSourceBudgets(largos, pesos, total);
            expect(r.reduce((s, x) => s + x, 0)).toBeLessThanOrEqual(total);
            r.forEach((x, i) => expect(x).toBeLessThanOrEqual(largos[i]!));
        }
    });
});
