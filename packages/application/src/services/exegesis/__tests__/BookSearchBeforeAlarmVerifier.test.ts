import { describe, it, expect, vi } from 'vitest';
import type { CitationVerifierInput, IBookSearch, ICitationVerifier, VerifiedCitation } from '@dosfilos/domain';
import { BookSearchBeforeAlarmVerifier } from '../BookSearchBeforeAlarmVerifier';

/**
 * TP #8 (2026-10-21, fase 8b, D1): Adamson 171 → 170 y McCartney 203 (TP #7)
 * salieron «no encontrada» con el texto a una página. Antes de alarmar se lee
 * la página citada, sus vecinas y el libro entero.
 */
const NUMERACION = { origin: 'confirmed' as const, segments: [{ fromSheet: 1, toSheet: 999, offset: -278 }] };
const FUENTE = { corpusId: 'r-mayor', citationKey: 'Mayor', fullAuthor: 'Mayor', displayLabel: 'Mayor', chunks: [], numbering: NUMERACION };

const alarma = (over: Partial<VerifiedCitation> = {}): VerifiedCitation => ({
    raw: 'Mayor, p. 133', author: 'Mayor', title: '', pages: '133', offset: 7,
    evidence: 'the active may include the force of the middle', evidenceIsQuoted: true,
    status: 'not-found', matchedCorpusId: 'r-mayor', matchedSourceLabel: 'Mayor', similarityScore: 0.2,
    matchedPage: null, note: 'No aparece.', ...over,
});

/** Un juez que «halla» la evidencia sólo si está en los fragmentos que recibe. */
function juez(primera: VerifiedCitation[]): ICitationVerifier & { verify: ReturnType<typeof vi.fn> } {
    const verify = vi.fn(async (input: CitationVerifierInput) => {
        if (!input.citations || input.sources[0]?.chunks.length === 0) return { citations: primera };
        const c = input.citations[0]!;
        const hallado = input.sources[0]!.chunks.find(ch => ch.text.includes(c.evidence));
        if (!hallado) return { citations: [{ ...(c as VerifiedCitation), status: 'not-found' as const, note: 'otra vez no' }] };
        const pagina = hallado.pageHint!.replace(/^p\. /, '');
        return { citations: [{
            ...(c as VerifiedCitation),
            status: pagina === c.pages ? 'verified' as const : 'page-mismatch' as const,
            matchedPage: pagina, matchedPageLabel: hallado.pageHint, note: 'juez',
        }] };
    });
    return { verify };
}

const libro = (hojas: Record<number, string>, hitsPorTermino: Record<string, number[]> = {}) => ({
    sheetsWithTerm: vi.fn(async (_r: string, t: string) => (hitsPorTermino[t] ?? []).map(sheet => ({ sheet, count: 1 }))),
    readSheets: vi.fn(async (_r: string, sheets: ReadonlyArray<number>) =>
        sheets.filter(s => hojas[s] !== undefined).map(sheet => ({ sheet, text: hojas[sheet]!, section: null as string | null }))),
}) satisfies IBookSearch;

const entrada = (): CitationVerifierInput => ({ markdown: '', citations: [], sources: [FUENTE], userId: 'u1', language: 'es' });

describe('BookSearchBeforeAlarmVerifier', () => {
    it('halla la cita al leer la página citada entera: verificada, y el juez no recupera por su cuenta', async () => {
        const j = juez([alarma()]);
        const b = libro({ 411: 'Mayor: the active may include the force of the middle voice.' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(b.readSheets).toHaveBeenCalledWith('r-mayor', [409, 410, 411, 412, 413]);
        expect(citations[0]).toMatchObject({ status: 'verified', bookSearch: 'cited-page', offset: 7 });
        const segunda = j.verify.mock.calls[1]![0] as CitationVerifierInput;
        expect(segunda.userId).toBeUndefined();
        expect(segunda.sources[0]!.chunks.map(c => c.pageHint)).toEqual(['p. 133']);
        expect(b.sheetsWithTerm).not.toHaveBeenCalled();
    });

    it('halla la cita en otra parte del libro: página no coincide, con la página hallada', async () => {
        const j = juez([alarma({ pages: '134', raw: 'Mayor, p. 134' })]);
        // Ni en 410-414 (p. 132-136 → hojas 410..414); sí en la hoja 400 (p. 122).
        const b = libro(
            { 400: 'the active may include the force of the middle' },
            { 'the active may include the force': [400], 'include the force of the middle': [400] },
        );
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).toMatchObject({ status: 'page-mismatch', bookSearch: 'book', matchedPage: '122' });
        expect(citations[0]!.note).toContain('No está en la página citada: se halló en p. 122');
    });

    it('hallada lejos aunque el juez la dé por buena, es «página no coincide»', async () => {
        // Un juez que verifica todo lo que halla, sin mirar la página.
        const j = juez([alarma({ pages: '134', raw: 'Mayor, p. 134' })]);
        const original = j.verify.getMockImplementation()!;
        j.verify.mockImplementation(async (input: CitationVerifierInput) => {
            const out = await original(input) as { citations: VerifiedCitation[] };
            return { citations: out.citations.map(c => (c.status === 'page-mismatch' ? { ...c, status: 'verified' as const } : c)) };
        });
        const b = libro({ 400: 'the active may include the force of the middle' }, { 'the active may include the force': [400] });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).toMatchObject({ status: 'page-mismatch', bookSearch: 'book' });
    });

    it('sin hallarla en ninguna parte, el veredicto queda y la nota dice qué se leyó', async () => {
        const j = juez([alarma()]);
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, libro({})).verify(entrada());
        expect(citations[0]).toMatchObject({ status: 'not-found', bookSearch: 'not-in-book' });
        expect(citations[0]!.note).toBe('Se buscó en la página citada, sus vecinas y el libro entero sin hallarla. No aparece.');
    });

    it('«página no comprobable» también se resuelve leyendo la página citada', async () => {
        const j = juez([alarma({ status: 'page-unverifiable' })]);
        const b = libro({ 411: 'the active may include the force of the middle' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).toMatchObject({ status: 'verified', bookSearch: 'cited-page' });
    });

    it('no está en su libro pero sí en otra fuente del corpus (D4, causa 3)', async () => {
        const j = juez([alarma({ author: 'Kittel', raw: 'Kittel, p. 32', matchedCorpusId: 'r-kittel' })]);
        const kittel = { ...FUENTE, corpusId: 'r-kittel', citationKey: 'Kittel', displayLabel: 'Kittel' };
        const b = {
            sheetsWithTerm: vi.fn(async (r: string) => (r === 'r-mayor' ? [{ sheet: 411, count: 2 }] : [])),
            readSheets: vi.fn(async (r: string, sheets: ReadonlyArray<number>) =>
                r === 'r-mayor' ? sheets.map(sheet => ({ sheet, text: 'the active may include the force of the middle', section: null as string | null })) : []),
        } satisfies IBookSearch;
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify({ ...entrada(), sources: [kittel, FUENTE] });
        expect(citations[0]).toMatchObject({ status: 'not-found', bookSearch: 'not-in-book', foundInOtherSource: { sourceKey: 'Mayor', pageLabel: 'p. 133' } });
        expect(citations[0]!.note).toContain('lo dice Mayor (p. 133)');
    });

    it('una cita verificada en la primera pasada no se toca', async () => {
        const j = juez([alarma({ status: 'verified' })]);
        const b = libro({});
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]!.status).toBe('verified');
        expect(b.readSheets).not.toHaveBeenCalled();
    });

    it('sin fuente reconocida (clave que no existe) no hay libro que leer', async () => {
        const j = juez([alarma({ matchedCorpusId: null })]);
        const b = libro({});
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).not.toHaveProperty('bookSearch');
        expect(b.readSheets).not.toHaveBeenCalled();
        // Ni siquiera lo intenta: no es un fallo de búsqueda.
        expect(aviso).not.toHaveBeenCalled();
        aviso.mockRestore();
    });

    it('si buscar falla, queda el veredicto de la primera pasada', async () => {
        const j = juez([alarma()]);
        const b = libro({});
        b.readSheets.mockRejectedValue(new Error('callable caída'));
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).toMatchObject({ status: 'not-found', note: 'No aparece.' });
        expect(citations[0]).not.toHaveProperty('bookSearch');
    });
});
