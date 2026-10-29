import { describe, it, expect, vi } from 'vitest';
import type { CitationVerifierInput, IBookSearch, ICitationVerifier, VerifiedCitation } from '@dosfilos/domain';
import { BookSearchBeforeAlarmVerifier, MAX_ALARMAS_RELEIDAS, MAX_PAGINAS_RELEIDAS } from '../BookSearchBeforeAlarmVerifier';

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
            // El juez copia el tramo que lo respalda, tal cual.
            supportingSpan: { text: c.evidence, pageLabel: hallado.pageHint },
        }] };
    });
    return { verify };
}

const libro = (hojas: Record<number, string>, hitsPorTermino: Record<string, number[]> = {}, truncated = false) => ({
    sheetsWithTerm: vi.fn(async (_r: string, t: string) => ({ hits: (hitsPorTermino[t] ?? []).map(sheet => ({ sheet, count: 1 })), truncated })),
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

    it('una cita sin página hallada en el libro conserva el veredicto del juez (revisión de 8b)', async () => {
        const j = juez([alarma({ pages: null, evidencePage: null, raw: 'Mayor' })]);
        const original = j.verify.getMockImplementation()!;
        j.verify.mockImplementation(async (input: CitationVerifierInput) => {
            const out = await original(input) as { citations: VerifiedCitation[] };
            return { citations: out.citations.map(c => (c.status === 'page-mismatch' ? { ...c, status: 'verified' as const } : c)) };
        });
        const b = libro({ 400: 'the active may include the force of the middle' }, { 'the active may include the force': [400] });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).toMatchObject({ status: 'verified', bookSearch: 'book' });
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
            sheetsWithTerm: vi.fn(async (r: string) => ({ hits: r === 'r-mayor' ? [{ sheet: 411, count: 2 }] : [], truncated: false })),
            readSheets: vi.fn(async (r: string, sheets: ReadonlyArray<number>) =>
                r === 'r-mayor' ? sheets.map(sheet => ({ sheet, text: 'the active may include the force of the middle', section: null as string | null })) : []),
        } satisfies IBookSearch;
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify({ ...entrada(), sources: [kittel, FUENTE] });
        expect(citations[0]).toMatchObject({ status: 'not-found', bookSearch: 'not-in-book', foundInOtherSource: { sourceKey: 'Mayor', pageLabel: 'p. 133' } });
        expect(citations[0]!.note).toContain('lo dice Mayor (p. 133)');
    });

    it('«página no comprobable» que no se halla queda como estaba: nunca «no está en el libro» (revisión de 8b)', async () => {
        const j = juez([alarma({ status: 'page-unverifiable' })]);
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, libro({})).verify(entrada());
        expect(citations[0]).toMatchObject({ status: 'page-unverifiable', note: 'No aparece.' });
        expect(citations[0]).not.toHaveProperty('bookSearch');
    });

    it('una búsqueda cortada por el servidor no prueba ausencia (revisión de 8b)', async () => {
        const j = juez([alarma()]);
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, libro({}, {}, true)).verify(entrada());
        expect(citations[0]).not.toHaveProperty('bookSearch');
        expect(citations[0]!.note).toContain('vino incompleta');
    });

    it('«203, 206»: se leen los dos tramos y la hallada en la 206 vale (revisión de 8b)', async () => {
        const j = juez([alarma({ pages: '128, 133', raw: 'Mayor, pp. 128, 133' })]);
        const original = j.verify.getMockImplementation()!;
        // Un juez que acepta cualquier página citada del tramo.
        j.verify.mockImplementation(async (input: CitationVerifierInput) => {
            const out = await original(input) as { citations: VerifiedCitation[] };
            return { citations: out.citations.map(c => (c.matchedPage === '133' ? { ...c, status: 'verified' as const } : c)) };
        });
        const b = libro({ 411: 'the active may include the force of the middle' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(b.readSheets.mock.calls[0]![1]).toEqual(expect.arrayContaining([406, 411]));
        expect(citations[0]).toMatchObject({ status: 'verified', bookSearch: 'cited-page' });
    });

    it('la otra fuente no es una que la oración ya cita (revisión de 8b)', async () => {
        const j = juez([alarma({ author: 'Kittel', raw: 'Kittel, p. 32', matchedCorpusId: 'r-kittel', otherSources: ['Mayor'] })]);
        const kittel = { ...FUENTE, corpusId: 'r-kittel', citationKey: 'Kittel', displayLabel: 'Kittel' };
        const b = {
            sheetsWithTerm: vi.fn(async (r: string) => ({ hits: r === 'r-mayor' ? [{ sheet: 411, count: 2 }] : [], truncated: false })),
            readSheets: vi.fn(async () => [] as Array<{ sheet: number; text: string; section: string | null }>),
        } satisfies IBookSearch;
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify({ ...entrada(), sources: [kittel, FUENTE] });
        expect(citations[0]).not.toHaveProperty('foundInOtherSource');
        expect(b.sheetsWithTerm.mock.calls.every(c => c[0] !== 'r-mayor')).toBe(true);
    });

    it('cada búsqueda una sola vez, y como mucho doce alarmas releídas por pasada (revisión de 8b)', async () => {
        const muchas = Array.from({ length: 15 }, (_x, i) => alarma({ offset: i }));
        const j = juez(muchas);
        const b = libro({});
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations.filter(c => c.bookSearch === 'not-in-book')).toHaveLength(12);
        expect(citations.map(c => c.offset)).toEqual(muchas.map(c => c.offset));
        const terminos = b.sheetsWithTerm.mock.calls.map(c => c[1]);
        expect(new Set(terminos).size).toBe(terminos.length);
    });

    it('el segundo juicio no arrastra el tramo ni lo atribuido de la primera pasada, y lee la hoja entera', async () => {
        const j = juez([alarma({ supportingSpan: { text: 'otra hoja', pageLabel: 'p. 99' }, takenFromSource: 'viejo' })]);
        const b = libro({ 411: 'the active may include the force of the middle voice.' });
        await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        const segunda = j.verify.mock.calls[1]![0] as CitationVerifierInput;
        expect(segunda.citations![0]).not.toHaveProperty('supportingSpan');
        expect(segunda.citations![0]).not.toHaveProperty('takenFromSource');
        expect(segunda.maxCharsPerChunk).toBeGreaterThan(4000);
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

/**
 * TP #9 (B46): «Varner, 162» salió verde a las 19:46 y, con el mismo texto,
 * «el pasaje de apoyo está en 163» a las 22:03: la 163 lo repite con palabras
 * más parecidas y el juez no marcó que la 162 también lo decía. Una «página
 * no coincide» del juez se relee con la página citada SOLA.
 */
describe('BookSearchBeforeAlarmVerifier — «página no coincide» del juez (B46)', () => {
    const VARNER_162 = 'composed of a relative clause, a primary interrogative clause and a final complex clause';
    const vecina = (over: Partial<VerifiedCitation> = {}): VerifiedCitation => alarma({
        raw: '(Varner, 162)', author: 'Mayor', pages: '162', evidence: VARNER_162, evidenceIsQuoted: false,
        status: 'page-mismatch', matchedPage: '163', matchedPageLabel: 'p. 163',
        note: 'Citaste p. 162 pero el pasaje de apoyo está en 163.', ...over,
    });

    it('Varner 162 → 163: la 162 sola lo sostiene → verificada, leyendo SOLO la citada', async () => {
        const j = juez([vecina()]);
        // Hoja 440 = p. 162 (numeración −278).
        const b = libro({ 440: `I understand the verse to be ${VARNER_162}.`, 441: 'otra cosa' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify({ ...entrada(), passageRef: 'Santiago 4:14' });
        expect(b.readSheets).toHaveBeenCalledWith('r-mayor', [440]);
        expect(citations[0]).toMatchObject({ status: 'verified', matchedPage: '162', bookSearch: 'cited-page', offset: 7 });
        const segunda = j.verify.mock.calls[1]![0] as CitationVerifierInput;
        expect(segunda.sources[0]!.chunks.map(c => c.pageHint)).toEqual(['p. 162']);
        expect(segunda.passageRef).toBe('Santiago 4:14');
        expect(b.sheetsWithTerm).not.toHaveBeenCalled();
    });

    it('Kittel 230–231 → 229: se leen las dos citadas, sin la 229', async () => {
        const j = juez([vecina({ pages: '230–231', raw: '(Kittel y Friedrich, 230–231)', matchedPage: '229' })]);
        const original = j.verify.getMockImplementation()!;
        // Un juez que acepta cualquier página del tramo citado.
        j.verify.mockImplementation(async (input: CitationVerifierInput) => {
            const out = await original(input) as { citations: VerifiedCitation[] };
            return { citations: out.citations.map(c => (c.matchedPage === '230' || c.matchedPage === '231' ? { ...c, status: 'verified' as const } : c)) };
        });
        const b = libro({ 508: `Significa ${VARNER_162}`, 509: 'la vida indestructible' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(b.readSheets).toHaveBeenCalledWith('r-mayor', [508, 509]);
        expect(citations[0]).toMatchObject({ status: 'verified', bookSearch: 'cited-page' });
    });

    it('si la citada sola no lo sostiene, queda el veredicto del juez tal cual', async () => {
        const j = juez([vecina()]);
        const b = libro({ 440: 'nada que ver' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).toEqual(vecina());
    });

    it('el verde de la relectura exige que el tramo del juez esté TAL CUAL en la hoja citada', async () => {
        const j = juez([vecina()]);
        const original = j.verify.getMockImplementation()!;
        // Un juez indulgente: verifica, pero «copia» un tramo que la hoja no tiene.
        j.verify.mockImplementation(async (input: CitationVerifierInput) => {
            const out = await original(input) as { citations: VerifiedCitation[] };
            return { citations: out.citations.map(c => (input.citations && c.status === 'verified'
                ? { ...c, supportingSpan: { text: 'the verse has three clauses of which the last is causal', pageLabel: 'p. 162' } } : c)) };
        });
        const b = libro({ 440: `I understand the verse to be ${VARNER_162}.` });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations[0]).toEqual(vecina());
    });

    it('topes separados: doce «página no coincide» delante no dejan sin releer una «no encontrada»', async () => {
        const paginas = Array.from({ length: 12 }, (_, i) => vecina({ offset: 100 + i }));
        const j = juez([...paginas, alarma({ offset: 900 })]);
        const b = libro({ 411: 'the active may include the force of the middle voice.' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations.find(c => c.offset === 900)).toMatchObject({ status: 'verified', bookSearch: 'cited-page' });
        // Las de página, con su propio tope: se releen MAX_PAGINAS_RELEIDAS.
        const releidasDePagina = b.readSheets.mock.calls.filter(c => (c[1] as number[]).length === 1 && (c[1] as number[])[0] === 440).length;
        expect(releidasDePagina).toBe(MAX_PAGINAS_RELEIDAS);
    });

    it('las relecturas de página no gastan el tope de las alarmas: con seis delante, se releen las doce', async () => {
        const paginas = Array.from({ length: MAX_PAGINAS_RELEIDAS }, (_, i) => vecina({ offset: 100 + i }));
        const alarmas = Array.from({ length: MAX_ALARMAS_RELEIDAS }, (_, i) => alarma({ offset: 900 + i }));
        const j = juez([...paginas, ...alarmas]);
        const b = libro({ 411: 'the active may include the force of the middle voice.' });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(citations.filter(c => c.offset >= 900 && c.bookSearch === 'cited-page')).toHaveLength(MAX_ALARMAS_RELEIDAS);
    });

    it('una cita textual hallada en otra hoja está donde está: no se relee', async () => {
        const j = juez([vecina({ evidenceIsQuoted: true })]);
        const b = libro({ 440: VARNER_162 });
        const { citations } = await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(b.readSheets).not.toHaveBeenCalled();
        expect(citations[0]!.status).toBe('page-mismatch');
    });

    it('una página que ya salió de buscar en el libro no se relee', async () => {
        const j = juez([vecina({ bookSearch: 'book' })]);
        const b = libro({ 440: VARNER_162 });
        await new BookSearchBeforeAlarmVerifier(j, b).verify(entrada());
        expect(b.readSheets).not.toHaveBeenCalled();
    });
});
