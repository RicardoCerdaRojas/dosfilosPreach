import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParsedCitation, VerifiedCitation, VerifierSource } from '@dosfilos/domain';
import { sourceFingerprint } from '@dosfilos/domain';
import { parseLlmResponse } from '../GeminiLlmCitationVerifier';
import { parseCitations } from '../citationParser';
import { buildLlmVerifierPrompt } from '../llmVerifierPrompts';
import { LLM_CITATION_VERIFIER_SCHEMA } from '../llmVerifierSchema';

/**
 * TP #9 (Santiago 4:11-17, 2026-10-28): 15 alarmas de citas en 4 versículos,
 * 8 falsas. Este archivo cubre las que quedaban después de B35 y B42:
 *   - B46: el mismo texto no daba el mismo veredicto (Varner 162, Kittel 230–231).
 *   - B35b: «sin él», «en este versículo» se juzgaban sin saber a qué se referían.
 *   - Diagnóstico: el juez dice qué parte de la oración la fuente no dice.
 */
const respuesta = vi.fn();
vi.mock('../../../llm/callableLlm', () => ({
    runLlmPromptWithUsage: (...args: unknown[]) => respuesta(...args),
}));
const { GeminiLlmCitationVerifier } = await import('../GeminiLlmCitationVerifier');

beforeEach(() => respuesta.mockReset());

// La prosa real de Stg 4:14 (versión 9c18865b del TP #9).
const PARRAFO_4_14 = 'La alternativa consiste en integrar la interrogación bajo «no saben»: «No saben cómo será su vida mañana». McCartney adopta esta lectura, entiende «mañana» adverbialmente, y objeta que la metáfora dice «ustedes son», no «su vida es» (McCartney, 226). Varner, en cambio, distingue la relativa, una interrogación principal, y la explicación final (Varner, 162). La construcción depende, en parte, del texto. NA28 imprime τὸ con ℵ, Ψ y la tradición bizantina, y marca el lugar como dudoso: A, P, 33, 81 y 1739 leen τὰ, y solo B omite el artículo (NA28, 693); Robertson cita el versículo sin él (Robertson, 961). McCartney prefiere τὸ, porque B tiende a omitir artículos y τὰ parece asimilarse a Pr 27:1 (McCartney, 230).';
const PARRAFO_TUGGY = 'El relativo οἵτινες tiene aquí valor concesivo (Wallace, 663; Robertson, 961): la ignorancia del mañana contradice los planes de 4:13. Tuggy clasifica ζωή en este versículo como vida física (Tuggy, 413), y la metáfora del vapor la caracteriza como pasajera.';

const VARNER: VerifierSource = {
    corpusId: 'res-varner', citationKey: 'Varner', fullAuthor: 'Varner', displayLabel: 'James (Varner)',
    chunks: [
        { text: 'I understand the verse to be composed of a relative clause, a primary interrogative clause and a final complex clause.', pageHint: 'p. 162' },
        { text: 'The anacoluthon in 4:14 consists of a secondary relative clause, then a question, and finally a causal statement.', pageHint: 'p. 163' },
    ],
    numbering: null,
};

const citaDe = (md: string, autor: string, pagina: string): ParsedCitation =>
    parseCitations(md).find(c => c.author === autor && c.pages === pagina)!;

describe('B35b · el contexto previo de la cita (parser)', () => {
    it('«Robertson cita el versículo sin él»: el contexto trae el artículo de la oración anterior', () => {
        const c = citaDe(PARRAFO_4_14, 'Robertson', '961');
        expect(c.evidence).toBe('Robertson cita el versículo sin él');
        expect(c.evidenceContext).toContain('solo B omite el artículo');
        expect(c.evidenceContext).toContain('La construcción depende, en parte, del texto.');
        // Las citas van tapadas: el contexto no se vuelve otra cita.
        expect(c.evidenceContext).not.toContain('NA28, 693');
        // Y no se mete en la afirmación.
        expect(c.evidence).not.toContain('artículo');
    });

    it('«Tuggy clasifica ζωή en este versículo»: el contexto es la oración anterior, sin la cita tapada', () => {
        const c = citaDe(PARRAFO_TUGGY, 'Tuggy', '413');
        expect(c.evidence).toBe('Tuggy clasifica ζωή en este versículo como vida física');
        expect(c.evidenceContext).toBe('El relativo οἵτινες tiene aquí valor concesivo: la ignorancia del mañana contradice los planes de 4:13.');
    });

    it('no cruza el párrafo: la primera oración del párrafo no trae contexto', () => {
        const md = `Párrafo anterior que habla de otra cosa.\n\n${PARRAFO_TUGGY}`;
        const wallace = citaDe(md, 'Wallace', '663');
        expect(wallace.evidenceContext).toBeUndefined();
        // Ni un título sin punto final antes del párrafo.
        expect(citaDe(`## Sintaxis de 4:14\n\n${PARRAFO_TUGGY}`, 'Wallace', '663').evidenceContext).toBeUndefined();
        expect(citaDe(md, 'Tuggy', '413').evidenceContext).toContain('El relativo οἵτινες');
    });

    it('con tope: un contexto largo se corta por delante, en palabra entera', () => {
        const larga = `${'palabra '.repeat(120).trim()}.`;
        const c = citaDe(`${larga} Varner distingue la relativa (Varner, 162).`, 'Varner', '162');
        expect(c.evidenceContext!.length).toBeLessThanOrEqual(401);
        expect(c.evidenceContext!.startsWith('…palabra')).toBe(true);
    });
});

describe('B35b · el contexto va al juez rotulado y aparte de la afirmación (prompt)', () => {
    const base = {
        rawCitation: '(Robertson, 961)', evidence: 'Robertson cita el versículo sin él', evidenceIsQuoted: false,
        citedPages: '961', matchedSourceLabel: 'Robertson', chunks: [{ text: 'Jas. 4:14 οἵτινες οὐκ ἐπίστασθε τῆς αὔριον', pageHint: 'p. 961' }],
        language: 'es' as const,
    };

    it('el contexto y el pasaje van ANTES de la afirmación, y la afirmación sigue siendo la oración', () => {
        const { userMessage, systemInstruction } = buildLlmVerifierPrompt({
            ...base, evidenceContext: 'y solo B omite el artículo ;', passageRef: 'Santiago 4:14',
        });
        const iContexto = userMessage.indexOf('Contexto previo');
        const iAfirmacion = userMessage.indexOf('Oración del paper que rodea la cita');
        expect(iContexto).toBeGreaterThan(0);
        expect(iContexto).toBeLessThan(iAfirmacion);
        expect(userMessage).toContain('NO es la afirmación y no se juzga');
        expect(userMessage).toContain('Pasaje que estudia el paper: Santiago 4:14');
        // Lo que se juzga es la oración, entre sus propias comillas.
        expect(userMessage.slice(iAfirmacion)).toContain('"""\nRobertson cita el versículo sin él\n"""');
        expect(systemInstruction).toContain('lo que el contexto afirma no se le atribuye a la fuente');
    });

    it('sin contexto ni pasaje, el mensaje no cambia', () => {
        const { userMessage } = buildLlmVerifierPrompt(base);
        expect(userMessage).not.toContain('Contexto previo');
        expect(userMessage).not.toContain('Pasaje que estudia');
    });

    it('en inglés, con paridad', () => {
        const { userMessage, systemInstruction } = buildLlmVerifierPrompt({
            ...base, language: 'en', evidenceContext: 'only B omits the article', passageRef: 'James 4:14',
        });
        expect(userMessage).toContain('Preceding context (ONLY to resolve');
        expect(userMessage).toContain('Passage the paper studies: James 4:14');
        expect(systemInstruction).toContain('what the context asserts is not attributed to the source');
    });

    it('el adaptador le pasa al juez el contexto de la cita y el pasaje del paso', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.9, bestPageHint: 'p. 961', reasoning: 'ok' }), finishReason: 'STOP' });
        const robertson: VerifierSource = { corpusId: 'res-r', citationKey: 'Robertson', fullAuthor: 'Robertson', displayLabel: 'Robertson', chunks: [{ text: 'Jas. 4:14 οἵτινες οὐκ ἐπίστασθε τῆς αὔριον', pageHint: 'p. 961' }], numbering: null };
        await new GeminiLlmCitationVerifier().verify({ markdown: PARRAFO_4_14, sources: [robertson], language: 'es', passageRef: 'Santiago 4:14' });
        const prompt = respuesta.mock.calls.map(c => (c[0] as { prompt: string }).prompt).find(p => p.includes('sin él'))!;
        expect(prompt).toContain('solo B omite el artículo');
        expect(prompt).toContain('Pasaje que estudia el paper: Santiago 4:14');
    });

    it('el veredicto guarda el contexto solo si la afirmación depende de él (hasta 300 viven en el documento)', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.9, bestPageHint: 'p. 162', reasoning: 'ok' }), finishReason: 'STOP' });
        const robertson: VerifierSource = { corpusId: 'res-r', citationKey: 'Robertson', fullAuthor: 'Robertson', displayLabel: 'Robertson', chunks: [{ text: 'x', pageHint: 'p. 961' }], numbering: null };
        const { citations } = await new GeminiLlmCitationVerifier().verify({ markdown: PARRAFO_4_14, sources: [VARNER, robertson], language: 'es' });
        expect(citations.find(c => c.author === 'Robertson')!.evidenceContext).toContain('solo B omite el artículo');
        expect(citations.find(c => c.author === 'Varner')).not.toHaveProperty('evidenceContext');
    });
});

describe('Diagnóstico · el juez dice qué parte de la oración la fuente no dice', () => {
    it('el esquema lo pide DESPUÉS del veredicto (no lo endurece) y es obligatorio', () => {
        const orden = LLM_CITATION_VERIFIER_SCHEMA.propertyOrdering as readonly string[];
        expect(orden.indexOf('notFromSource')).toBeGreaterThan(orden.indexOf('status'));
        expect(LLM_CITATION_VERIFIER_SCHEMA.required).toContain('notFromSource');
    });

    it('se lee de la respuesta; «nada» y «N/A» cuentan como vacío', () => {
        expect(parseLlmResponse(JSON.stringify({ status: 'verified', notFromSource: 'el pronombre funciona como sujeto acusativo' })).notFromSource)
            .toBe('el pronombre funciona como sujeto acusativo');
        expect(parseLlmResponse(JSON.stringify({ status: 'verified', notFromSource: 'Nada.' })).notFromSource).toBe('');
        expect(parseLlmResponse(JSON.stringify({ status: 'verified', notFromSource: 'N/A' })).notFromSource).toBe('');
        expect(parseLlmResponse(JSON.stringify({ status: 'verified' })).notFromSource).toBe('');
    });

    it('Robertson 1069–1070 → 1067: «página no coincide» conserva la razón del juez y lo que la fuente no dice', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({
            status: 'verified', confidence: 0.99, bestPageHint: 'p. 1067', citedPageSupports: false,
            takenFromSource: 'El infinitivo había perdido el valor de sus terminaciones de caso.',
            notFromSource: 'el pronombre funciona como sujeto acusativo de «decir», no como su objeto',
            reasoning: 'La p. 1067 habla de la pérdida de las terminaciones, no del sujeto acusativo.',
        }), finishReason: 'STOP' });
        const robertson: VerifierSource = {
            corpusId: 'res-r', citationKey: 'Robertson', fullAuthor: 'Robertson', displayLabel: 'Robertson',
            chunks: [
                { text: 'the inf. had already lost for the most part the significance of the dative ending', pageHint: 'p. 1067' },
                { text: 'As a rule the article was essential if a preposition occurred with an inf.', pageHint: 'p. 1069' },
            ],
            numbering: null,
        };
        const cita: ParsedCitation = {
            raw: '(Robertson, pp. 1069–1070)', author: 'Robertson', title: '', pages: '1069–1070', offset: 0,
            evidence: 'El genitivo se manifiesta en el artículo, no en una terminación del infinitivo; el pronombre funciona como sujeto acusativo de «decir», no como su objeto',
            evidenceIsQuoted: false,
        };
        const [v] = (await new GeminiLlmCitationVerifier().verify({ markdown: '', citations: [cita], sources: [robertson], language: 'es' })).citations;
        expect(v!.status).toBe('page-mismatch');
        expect(v!.note).toBe('Citaste p. 1069–1070 pero el pasaje de apoyo está en 1067. La p. 1067 habla de la pérdida de las terminaciones, no del sujeto acusativo.');
        expect(v!.notFromSource).toBe('el pronombre funciona como sujeto acusativo de «decir», no como su objeto');
    });

    it('la cobertura del apoyo se lee y se guarda: «partial» separa a Robertson de Adamson', async () => {
        expect(parseLlmResponse(JSON.stringify({ status: 'verified', claimCoverage: 'partial' })).claimCoverage).toBe('partial');
        expect(parseLlmResponse(JSON.stringify({ status: 'verified', claimCoverage: 'mucho' })).claimCoverage).toBeNull();
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.9, bestPageHint: 'p. 163', claimCoverage: 'partial', reasoning: 'x' }), finishReason: 'STOP' });
        const cita: ParsedCitation = { raw: '(Varner, 162)', author: 'Varner', title: '', pages: '162', offset: 0, evidence: 'Varner dice otra cosa.', evidenceIsQuoted: false };
        const [v] = (await new GeminiLlmCitationVerifier().verify({ markdown: '', citations: [cita], sources: [VARNER], language: 'es' })).citations;
        expect(v).toMatchObject({ status: 'page-mismatch', claimCoverage: 'partial' });
        const orden = LLM_CITATION_VERIFIER_SCHEMA.propertyOrdering as readonly string[];
        expect(orden.indexOf('claimCoverage')).toBeGreaterThan(orden.indexOf('status'));
        expect(LLM_CITATION_VERIFIER_SCHEMA.required).toContain('claimCoverage');
    });

    it('si no la halló, «lo que la fuente no dice» es todo y no se guarda', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'not-found', confidence: 0.9, bestPageHint: '', notFromSource: 'todo', claimCoverage: 'partial', reasoning: 'no' }), finishReason: 'STOP' });
        const cita: ParsedCitation = { raw: '(Varner, 162)', author: 'Varner', title: '', pages: '162', offset: 0, evidence: 'Varner dice otra cosa.', evidenceIsQuoted: false };
        const [v] = (await new GeminiLlmCitationVerifier().verify({ markdown: '', citations: [cita], sources: [VARNER], language: 'es' })).citations;
        expect(v).not.toHaveProperty('notFromSource');
        expect(v).not.toHaveProperty('claimCoverage');
    });
});

describe('B46 · una cita que no cambió no cambia de veredicto (adaptador)', () => {
    const varnerProsa = () => citaDe(PARRAFO_4_14, 'Varner', '162');
    const verdeDe = (c: ParsedCitation, over: Partial<VerifiedCitation> = {}): VerifiedCitation => ({
        ...c, offset: 1288, raw: '(Varner, 162)', origin: 'prose',
        status: 'verified', matchedCorpusId: 'res-varner', matchedSourceLabel: 'James (Varner)', similarityScore: 0.99,
        matchedPage: '162', matchedPageLabel: 'p. 162', sourceFingerprint: sourceFingerprint(VARNER),
        note: 'El fragmento de la página citada presenta explícitamente esa división sintáctica.',
        supportingSpan: { text: 'I understand the verse to be composed of a relative clause…', pageLabel: 'p. 162' },
        ...over,
    });

    it('Varner 162 verde a las 19:46: con el mismo texto, se conserva sin volver al juez', async () => {
        // A las 22:03 el juez dijo «163»: si se le preguntara, saldría alarma.
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.99, bestPageHint: 'p. 163', citedPageSupports: false, reasoning: 'x' }), finishReason: 'STOP' });
        const previo = verdeDe(varnerProsa());
        // Otra oración del párrafo cambió: el offset de Varner se corre.
        const editado = PARRAFO_4_14.replace('McCartney adopta esta lectura', 'McCartney, en su comentario, adopta esta lectura');
        const { citations } = await new GeminiLlmCitationVerifier().verify({
            markdown: editado, sources: [VARNER], language: 'es', reuseVerified: [previo],
        });
        const varner = citations.find(c => c.author === 'Varner')!;
        expect(varner).toMatchObject({ status: 'verified', matchedPage: '162', note: previo.note });
        // La cita es la NUEVA: su posición en el texto editado.
        expect(varner.offset).toBe(editado.indexOf('(Varner, 162)'));
        const juzgadas = respuesta.mock.calls.map(c => (c[0] as { prompt: string }).prompt);
        expect(juzgadas.some(p => p.includes('Varner, en cambio'))).toBe(false);
    });

    it('si cambió la afirmación, se juzga', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.99, bestPageHint: 'p. 162', reasoning: 'x' }), finishReason: 'STOP' });
        const previo = verdeDe(varnerProsa());
        const editado = PARRAFO_4_14.replace('la explicación final (Varner, 162)', 'la explicación causal final (Varner, 162)');
        await new GeminiLlmCitationVerifier().verify({ markdown: editado, sources: [VARNER], language: 'es', reuseVerified: [previo] });
        const juzgadas = respuesta.mock.calls.map(c => (c[0] as { prompt: string }).prompt);
        expect(juzgadas.some(p => p.includes('explicación causal final'))).toBe(true);
    });

    it('una alarma previa NO se reusa: volver a verificar puede rescatarla', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.99, bestPageHint: 'p. 162', reasoning: 'x' }), finishReason: 'STOP' });
        const previo = verdeDe(varnerProsa(), { status: 'page-mismatch', matchedPage: '163' });
        const { citations } = await new GeminiLlmCitationVerifier().verify({ markdown: PARRAFO_4_14, sources: [VARNER], language: 'es', reuseVerified: [previo] });
        expect(citations.find(c => c.author === 'Varner')!.status).toBe('verified');
        expect(respuesta.mock.calls.some(c => (c[0] as { prompt: string }).prompt.includes('Varner, en cambio'))).toBe(true);
    });

    it('si la fuente se re-extrajo (otra huella), se juzga', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.99, bestPageHint: 'p. 162', reasoning: 'x' }), finishReason: 'STOP' });
        const reextraida = { ...VARNER, chunks: [{ ...VARNER.chunks[0]!, text: `${VARNER.chunks[0]!.text} ` }, VARNER.chunks[1]!] };
        await new GeminiLlmCitationVerifier().verify({ markdown: PARRAFO_4_14, sources: [reextraida], language: 'es', reuseVerified: [verdeDe(varnerProsa())] });
        expect(respuesta.mock.calls.some(c => (c[0] as { prompt: string }).prompt.includes('Varner, en cambio'))).toBe(true);
    });

    it('si la fuente ya no está en el trabajo, se juzga', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.99, bestPageHint: 'p. 162', reasoning: 'x' }), finishReason: 'STOP' });
        const previo = verdeDe(varnerProsa(), { matchedCorpusId: 'res-otro' });
        await new GeminiLlmCitationVerifier().verify({ markdown: PARRAFO_4_14, sources: [VARNER], language: 'es', reuseVerified: [previo] });
        expect(respuesta.mock.calls.some(c => (c[0] as { prompt: string }).prompt.includes('Varner, en cambio'))).toBe(true);
    });
});

describe('el parser, tras la revisión adversarial', () => {
    it('«» anidadas: la cita textual es la de afuera, entera', () => {
        const md = 'Ropes lo dice así: «El texto «hoy o mañana» introduce la jactancia de los mercaderes» (Ropes, 276).';
        const [c] = parseCitations(md);
        expect(c).toMatchObject({ evidenceIsQuoted: true, evidence: 'El texto «hoy o mañana» introduce la jactancia de los mercaderes' });
    });

    it('pocas palabras en inglés entre comillas son textuales (copiadas de la fuente); en castellano, mención', () => {
        const ingles = parseCitations('McCartney lo llama «one lawgiver and judge» (McCartney, 221).')[0]!;
        expect(ingles).toMatchObject({ evidenceIsQuoted: true, evidence: 'one lawgiver and judge' });
        const castellano = parseCitations('McCartney lo llama «legislador y juez» (McCartney, 222).')[0]!;
        expect(castellano.evidenceIsQuoted).toBe(false);
        // Castellano que nombra una palabra inglesa sigue siendo mención.
        const mencion = parseCitations('McCartney traduce con «el artículo the» (McCartney, 221).')[0]!;
        expect(mencion.evidenceIsQuoted).toBe(false);
    });

    it('con las claves del trabajo reconoce la cuarta forma «(Robertson, Gramática, 1069–1070)»', () => {
        const md = 'El artículo es esencial con preposición (Robertson, Gramática, 1069–1070).';
        expect(parseCitations(md)).toHaveLength(0);
        expect(parseCitations(md, ['Robertson', null])).toMatchObject([{ author: 'Robertson', title: 'Gramática', pages: '1069–1070' }]);
    });

    it('el adaptador le pasa las claves de sus fuentes: la prosa que solo cita así ya no sale verde por vacío', async () => {
        respuesta.mockResolvedValue({ text: JSON.stringify({ status: 'verified', confidence: 0.9, bestPageHint: 'p. 1069', reasoning: 'ok' }), finishReason: 'STOP' });
        const robertson: VerifierSource = { corpusId: 'res-r', citationKey: 'Robertson', fullAuthor: 'Robertson', displayLabel: 'Robertson', chunks: [{ text: 'As a rule the article was essential', pageHint: 'p. 1069' }], numbering: null };
        const { citations } = await new GeminiLlmCitationVerifier().verify({
            markdown: 'El artículo es esencial con preposición (Robertson, Gramática, 1069–1070).', sources: [robertson], language: 'es',
        });
        expect(citations).toHaveLength(1);
    });
});
