import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParsedCitation, VerifierSource } from '@dosfilos/domain';
import { citedPageSettlesIt, lostOriginalScript, parseLlmResponse, printedPageOfHint } from '../GeminiLlmCitationVerifier';
import { buildLlmVerifierPrompt } from '../llmVerifierPrompts';
import { LLM_CITATION_VERIFIER_SCHEMA } from '../llmVerifierSchema';

/**
 * Falsas alarmas del verificador en el TP #6 (Santiago 3, 2026-10-07): de 5
 * citas que el fundador revisó a mano, las 5 estaban bien.
 *   - «Página no coincide» tres veces con la página citada correcta (140→141,
 *     111→109, 144→145): el verificador sólo miraba el MEJOR fragmento.
 *   - «No encontrada» en frases que nombran a otros autores o cierran con la
 *     conclusión propia del trabajo («Adamson y Mayor difieren…»).
 */
const respuesta = vi.fn();
vi.mock('../../../llm/callableLlm', () => ({
    runLlmPromptWithUsage: (...args: unknown[]) => respuesta(...args),
}));
const { GeminiLlmCitationVerifier } = await import('../GeminiLlmCitationVerifier');

const cita: ParsedCitation = {
    raw: 'Adamson, p. 140',
    author: 'Adamson',
    title: '',
    pages: '140',
    offset: 0,
    evidence: 'Adamson subraya un hombre ideal.',
    evidenceIsQuoted: false,
};
const fuente: VerifierSource = {
    corpusId: 'res-a',
    citationKey: 'Adamson',
    fullAuthor: 'Adamson',
    displayLabel: 'The Epistle of James (NICNT)',
    chunks: [
        { text: 'only an ideal man would never sin with his tongue', pageHint: 'p. 140' },
        { text: 'the ideal man, the perfect man, as in 1:4', pageHint: 'p. 141' },
    ],
    numbering: null,
};
const verificar = async () =>
    (await new GeminiLlmCitationVerifier().verify({ markdown: '', citations: [cita], sources: [fuente], language: 'es' } as never)).citations[0]!;
const modeloDice = (r: object) =>
    respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.9, reasoning: 'ok', ...r }), finishReason: 'STOP' });

beforeEach(() => respuesta.mockReset());

describe('la página citada se respeta si también lo dice', () => {
    it('REGRESIÓN: el mejor apoyo en la 141 pero la 140 también lo sostiene → verificada en la 140', async () => {
        modeloDice({ bestPageHint: 'p. 141', citedPageSupports: true });
        const v = await verificar();
        expect(v.status).toBe('verified');
        expect(v.matchedPage).toBe('140');
        expect(v.matchedPageLabel).toBe('p. 140');
    });

    it('si la 140 NO lo sostiene, sigue siendo «página no coincide»', async () => {
        modeloDice({ bestPageHint: 'p. 141', citedPageSupports: false });
        expect((await verificar()).status).toBe('page-mismatch');
    });

    it('no se le cree al modelo sobre una página que no vio', () => {
        // Le dice que la 140 lo sostiene, pero no le llegó ningún fragmento de la 140.
        expect(citedPageSettlesIt('140', true, [{ pageHint: 'p. 141' }])).toBe(false);
        expect(citedPageSettlesIt('140', true, [{ pageHint: 'p. 140' }])).toBe(true);
        expect(citedPageSettlesIt('144-145', true, [{ pageHint: 'p. 145' }])).toBe(true);
        expect(citedPageSettlesIt(null, true, [{ pageHint: 'p. 140' }])).toBe(false);
    });

    it('una HOJA o una sección con el mismo número no es la página citada', () => {
        // «hoja 140» es otra página del libro; «§ 140» no es página.
        expect(citedPageSettlesIt('140', true, [{ pageHint: 'hoja 140' }])).toBe(false);
        expect(citedPageSettlesIt('140', true, [{ pageHint: '§ 140' }])).toBe(false);
        expect(citedPageSettlesIt('140', true, [{ pageHint: 'p. 140, § 3.1' }])).toBe(true);
        expect(printedPageOfHint('pp. 140-141')).toBe('140-141');
        expect(printedPageOfHint('hoja 87')).toBeNull();
        expect(printedPageOfHint(null)).toBeNull();
    });

    it('el veredicto trae el campo, y si falta vale «no»', () => {
        expect(parseLlmResponse('{"status":"verified","confidence":1,"bestPageHint":"","citedPageSupports":true,"reasoning":"x"}').citedPageSupports).toBe(true);
        expect(parseLlmResponse('{"status":"verified","confidence":1,"bestPageHint":"","reasoning":"x"}').citedPageSupports).toBe(false);
        expect(LLM_CITATION_VERIFIER_SCHEMA.required).toContain('citedPageSupports');
    });
});

describe('se juzga sólo lo que la frase le atribuye a la fuente', () => {
    it('REGRESIÓN (prod, 3:2): el análisis del autor no se le exige a la fuente; lo que se le atribuye explícitamente, sí', () => {
        // Con la regla anterior («todo lo demás, COMPLETO») 7 de 18 citas de
        // 3:2 bajaron a «coincidencia baja» con notas como «Mayor sí sostiene
        // … pero no trata la decisión sintáctica».
        for (const language of ['es', 'en'] as const) {
            const { systemInstruction } = buildLlmVerifierPrompt({
                rawCitation: 'Adamson, p. 140',
                evidence: 'Adamson y Mayor difieren…',
                evidenceIsQuoted: false,
                citedPages: '140',
                matchedSourceLabel: 'Adamson',
                chunks: [],
                language,
            });
            expect(systemInstruction).toMatch(language === 'es' ? /Es del AUTOR y NO se le exige a la fuente/ : /It is the AUTHOR's and is NOT required of the source/);
            expect(systemInstruction).toMatch(language === 'es' ? /decisión sintáctica/ : /syntactic decision/);
            expect(systemInstruction).toMatch(language === 'es' ? /SÍ se exige, y entero/ : /It IS required, in full/);
            expect(systemInstruction).not.toMatch(/Ante la duda, una parte NO está excluida|When in doubt, a part is NOT excluded/);
            expect(systemInstruction).toContain('citedPageSupports');
        }
    });
});

describe('una fuente cuya copia perdió el griego', () => {
    const sinGriego = [{ text: 'We think, pace Cranfield (p. 15), that 6€§a00¢e is not emphatic… mankind is unable to govern the tongue. '.repeat(25) }];

    it('REGRESIÓN (Adamson, p. 145, n. 28): se detecta y se le avisa al modelo', () => {
        expect(lostOriginalScript('Adamson relaciona τῇ φύσει τῇ ἀνθρωπίνῃ con 3:8', sinGriego)).toBe(true);
        const { userMessage } = buildLlmVerifierPrompt({
            rawCitation: 'Adamson, p. 145', evidence: 'x', evidenceIsQuoted: false, citedPages: '145',
            matchedSourceLabel: 'Adamson', chunks: [], language: 'es', sourceLostOriginalScript: true,
        });
        expect(userMessage).toContain('PERDIÓ sus caracteres griegos');
    });

    it('una fuente con griego, o una afirmación sin griego, no lleva la advertencia', () => {
        expect(lostOriginalScript('Adamson relaciona τῇ φύσει', [{ text: 'ἀνθρώπων '.repeat(300) }])).toBe(false);
        expect(lostOriginalScript('Adamson habla de los maestros', sinGriego)).toBe(false);
        // Poco texto no basta para afirmar que el libro perdió el griego.
        expect(lostOriginalScript('τῇ φύσει', [{ text: 'corto' }])).toBe(false);
        // Un comentario que translitera no perdió el hebreo: lo escribe así.
        expect(lostOriginalScript('Mayor sobre חֶסֶד', [{ text: 'the word ḥesed and ʾĕlōhîm, šālôm in ṭôb usage. '.repeat(60) }])).toBe(false);
        const { userMessage } = buildLlmVerifierPrompt({
            rawCitation: 'x', evidence: 'x', evidenceIsQuoted: false, citedPages: null,
            matchedSourceLabel: 'X', chunks: [], language: 'es',
        });
        expect(userMessage).not.toContain('PERDIÓ');
    });
});
