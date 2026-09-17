import { describe, it, expect, vi } from 'vitest';
import type { CitationVerifierInput, ParsedCitation, VerifiedCitation, VerifierSource } from '@dosfilos/domain';
import { VerbatimFirstCitationVerifier } from '../VerbatimFirstCitationVerifier';

/**
 * Lo que el decorador le debe al llamador: una cita con oración textual que
 * está en la fuente no necesita al modelo; la que no está, sí; y el orden de
 * los veredictos es el de las citas, venga cada uno de donde venga.
 */
const ROSS: VerifierSource = {
    corpusId: 'lib-ross',
    citationKey: 'Ross',
    fullAuthor: 'Ross',
    displayLabel: 'Ross, Commentary on the Psalms',
    chunks: [
        { text: 'A close analysis of the text will show that it is a meditation on all that the LORD does.', pageHint: 'p. 555' },
        { text: '“Shepherd” is an active participle used substantively, stressing the meaning of the word.', pageHint: 'p. 559' },
    ],
    numbering: null,
};

const cita = (over: Partial<ParsedCitation>): ParsedCitation => ({
    raw: 'Ross, p. 559', author: 'Ross', title: '', pages: '559', offset: 0,
    evidence: '', evidenceIsQuoted: false, ...over,
});

function inner(status: VerifiedCitation['status'] = 'fuzzy-low') {
    return {
        verify: vi.fn(async (input: CitationVerifierInput) => ({
            citations: (input.citations ?? []).map(c => ({
                ...c, status, matchedCorpusId: 'lib-ross', matchedSourceLabel: 'Ross',
                similarityScore: 0.5, matchedPage: null, note: 'juzgado por el modelo',
            })),
        })),
    };
}

describe('VerbatimFirstCitationVerifier', () => {
    it('una oración textual presente en la fuente se verifica sin llamar al modelo', async () => {
        const llm = inner();
        const out = await new VerbatimFirstCitationVerifier(llm).verify({
            markdown: '', sources: [ROSS], language: 'es',
            citations: [cita({ evidence: '"Shepherd" is an active participle used substantively', evidenceIsQuoted: true })],
        });
        expect(llm.verify).not.toHaveBeenCalled();
        expect(out.citations[0]).toMatchObject({ status: 'verified', matchedPage: '559', matchedPageLabel: 'p. 559', similarityScore: 1 });
    });

    it('si la oración está en otra página que la citada, es «página no coincide»', async () => {
        const out = await new VerbatimFirstCitationVerifier(inner()).verify({
            markdown: '', sources: [ROSS], language: 'es',
            citations: [cita({ pages: '560', evidence: '"Shepherd" is an active participle used substantively', evidenceIsQuoted: true })],
        });
        expect(out.citations[0]!.status).toBe('page-mismatch');
        expect(out.citations[0]!.note).toContain('p. 559');
    });

    it('una oración textual que NO está pasa al modelo con la misma cita', async () => {
        // Es el caso que importa: el analizador dijo haber copiado una oración
        // que la fuente no tiene. No se da por buena ni se descarta: se juzga.
        const llm = inner('not-found');
        const inventada = cita({ evidence: 'this motivation appears in Ezekiel 20:9 in covenant contexts', evidenceIsQuoted: true });
        const out = await new VerbatimFirstCitationVerifier(llm).verify({ markdown: '', sources: [ROSS], citations: [inventada] });
        expect(llm.verify).toHaveBeenCalledTimes(1);
        expect(llm.verify.mock.calls[0]![0].citations).toEqual([inventada]);
        expect(out.citations[0]!.status).toBe('not-found');
    });

    it('una paráfrasis sin oración textual siempre la juzga el modelo', async () => {
        const llm = inner();
        await new VerbatimFirstCitationVerifier(llm).verify({
            markdown: '', sources: [ROSS],
            citations: [cita({ evidence: 'Ross lee un participio sustantivado que conserva la fuerza del verbo.' })],
        });
        expect(llm.verify).toHaveBeenCalledTimes(1);
    });

    it('devuelve los veredictos en el orden de las citas, mezclando los dos caminos', async () => {
        const llm = inner();
        const out = await new VerbatimFirstCitationVerifier(llm).verify({
            markdown: '', sources: [ROSS],
            citations: [
                cita({ offset: 0, evidence: 'paráfrasis uno' }),
                cita({ offset: 1, evidence: '"Shepherd" is an active participle used substantively', evidenceIsQuoted: true }),
                cita({ offset: 2, evidence: 'paráfrasis dos' }),
            ],
        });
        expect(out.citations.map(c => [c.offset, c.status])).toEqual([[0, 'fuzzy-low'], [1, 'verified'], [2, 'fuzzy-low']]);
    });

    it('sin citas provistas delega entero, como si no existiera', async () => {
        const llm = inner();
        const input = { markdown: 'prosa (Ross, p. 1)', sources: [ROSS] };
        await new VerbatimFirstCitationVerifier(llm).verify(input);
        expect(llm.verify).toHaveBeenCalledWith(input);
    });
});
