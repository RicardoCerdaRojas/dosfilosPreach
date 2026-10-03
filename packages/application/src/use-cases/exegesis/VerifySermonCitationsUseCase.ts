import type {
    IAIChatRepository,
    IExegeticalPaperRepository,
    ISermonRepository,
} from '@dosfilos/domain';
import { parseSermonCitations, type ParsedSermonCitation } from './sermonCitationParser';

/**
 * Verifies author-attributed quotes in a generated sermon against the
 * sermon's source corpus (originating exegetical paper or Faculty
 * conversation). Output flags fabricated quotes that slipped past the
 * PR #217 prompt-level guard so the pastor sees the warning BEFORE
 * publishing to the pulpit.
 *
 * Why a deterministic substring/fuzzy check instead of the existing
 * `GeminiLlmCitationVerifier`:
 *   - The exegetical-paper verifier targets *paraphrase detection*
 *     across languages (a Spanish paper citing English commentary
 *     won't match on tokens but will match semantically). Useful for
 *     scholarly papers.
 *   - For sermons the failure mode is *fabrication*: the LLM invents
 *     "Spurgeon said X" when nothing in the source mentions Spurgeon.
 *     A literal substring + fuzzy-token check on the source corpus
 *     catches this cheaply, with no LLM call per quote, and produces
 *     deterministic + auditable verdicts.
 *   - Cost: zero LLM tokens. Latency: <50 ms even for 5 citations
 *     against a 10k-char source corpus.
 *
 * The verifier intentionally short-circuits when no source corpus is
 * available (standalone wizard sermons with no paper/Faculty origin):
 * those sermons have nothing to verify against, so the dialog tells
 * the pastor "verificación no disponible" rather than producing false
 * confidence with empty source checks.
 */

export type SermonCitationStatus = 'verified' | 'fuzzy-low' | 'not-found';

export interface VerifiedSermonCitation {
    /** The original parsed citation block. */
    citation: ParsedSermonCitation;
    /** Verdict of the verifier. */
    status: SermonCitationStatus;
    /**
     * Similarity score in [0,1] when applicable. Used by the UI for
     * a confidence indicator on `fuzzy-low` verdicts.
     */
    similarity: number;
    /**
     * Short human-readable explanation of the verdict (ES, surfaced
     * directly in the warning dialog).
     */
    note: string;
}

export interface VerifySermonCitationsInput {
    ownerId: string;
    sermonId: string;
}

export interface VerifySermonCitationsOutput {
    /**
     * `'paper' | 'faculty' | null`. Null means the sermon has no
     * verifiable source corpus (standalone wizard sermon). UI shows
     * an "unavailable" notice rather than treating zero citations as
     * a clean bill of health.
     */
    sourceKind: 'paper' | 'faculty' | 'library' | null;
    /** Number of source-corpus characters checked against. */
    sourceCorpusLength: number;
    /**
     * True when the sermon carries a library citation manifest (ADR-031
     * narrative anchors), regardless of whether it is also paper/Faculty
     * derived. The UI uses this to show "narrative citations anchored to your
     * library" instead of falsely claiming the sermon has no citations.
     */
    hasLibraryManifest: boolean;
    citations: VerifiedSermonCitation[];
}

/**
 * El texto de un libro de la biblioteca del pastor, buscado por el título con
 * que lo atribuye el sermón y su autor. `null` si no está.
 *
 * Las citas que eligió en el Taller («Buscar citas en mi biblioteca») y las
 * del borrador llevan el título EXACTO del recurso, porque la atribución la
 * ponemos nosotros. Sin esto el verificador cotejaba sólo contra el paper y el
 * manifiesto, y marcaba «probable cita inventada» a citas literales de su
 * propia biblioteca (sermón 6 de Jonás, 2026-10-03: Burt p. 89 ×2 y Calvino
 * p. 66, las tres verificadas a mano contra los fragmentos indexados).
 */
export type LibraryWorkText = (userId: string, workTitle: string, author: string) => Promise<{ author: string; text: string } | null>;

export class VerifySermonCitationsUseCase {
    constructor(
        private sermonRepository: ISermonRepository,
        private paperRepository: IExegeticalPaperRepository,
        private chatRepository: IAIChatRepository,
        private libraryWorkText?: LibraryWorkText,
    ) { }

    async execute(input: VerifySermonCitationsInput): Promise<VerifySermonCitationsOutput> {
        const sermon = await this.sermonRepository.findById(input.sermonId);
        if (!sermon) {
            throw new Error('Sermon not found');
        }
        if (sermon.userId !== input.ownerId) {
            throw new Error('Sermon does not belong to the actor');
        }

        // Resolve source corpus. Paper-derived sermons pull from the
        // paper's assembled markdown + each ProjectSource's excerpts.
        // Faculty-derived sermons pull from the conversation messages.
        // Standalone wizard sermons have no source to verify against.
        const sourceCorpus = await this.resolveSourceCorpus(sermon);
        const sermonMarkdown = this.resolveSermonMarkdown(sermon);

        const citations = parseSermonCitations(sermonMarkdown);
        const obras = await this.libraryWorksFor(sermon.userId, citations);
        // Normalizado UNA vez: con varios libros, hacerlo por cita costaba
        // medio segundo (revisión adversarial de R1).
        const general = { text: sourceCorpus.text, normalized: normalizeForSearch(sourceCorpus.text) };
        const verified = citations.map((citation) => {
            const obra = obras.get(obraKey(citation));
            // La obra citada, si su autor REAL es el citado: una frase de Burt
            // atribuida a otro no se verifica con el libro de Burt.
            if (obra && sameAuthor(obra.author, citation.author)) {
                const enLaObra = verifyInWork(citation, obra.normalized);
                if (enLaObra) return enLaObra;
            }
            return verifyOne(citation, general.text, general.normalized);
        });
        const largoObras = [...obras.values()].reduce((n, o) => n + o.normalized.length, 0);

        return {
            sourceKind: sourceCorpus.kind ?? (obras.size > 0 ? 'library' : null),
            sourceCorpusLength: sourceCorpus.text.length + largoObras,
            hasLibraryManifest: sourceCorpus.hasManifest,
            citations: verified,
        };
    }

    private async resolveSourceCorpus(sermon: {
        sourcePaperId?: string;
        sourceFacultySessionId?: string;
        userId: string;
        citationManifest?: { entries?: Array<{ excerpt?: string; author?: string; title?: string }> };
        wizardProgress?: { draft?: { citationManifest?: { entries?: Array<{ excerpt?: string; author?: string; title?: string }> } } };
    }): Promise<{ kind: 'paper' | 'faculty' | 'library' | null; text: string; hasManifest: boolean }> {
        const parts: string[] = [];
        let kind: 'paper' | 'faculty' | 'library' | null = null;

        if (sermon.sourcePaperId) {
            kind = 'paper';
            const paper = await this.paperRepository.getPaper(sermon.userId, sermon.sourcePaperId);
            if (paper) {
                if (paper.assembledMarkdown) parts.push(paper.assembledMarkdown);
                // Each project source contributes its curated excerpts + its
                // display label. The label catches "as Owen wrote in his
                // commentary on Hebrews" — if Owen's commentary is a source,
                // the author surname is present.
                for (const source of paper.sources ?? []) {
                    if (source.displayLabel) parts.push(source.displayLabel);
                    if (source.citationKey) parts.push(source.citationKey);
                    const excerpts = (source as any).excerpts;
                    if (Array.isArray(excerpts)) {
                        for (const ex of excerpts) {
                            if (ex?.text) parts.push(ex.text);
                        }
                    }
                }
            }
        } else if (sermon.sourceFacultySessionId) {
            kind = 'faculty';
            const session = await this.chatRepository.getSession(
                sermon.userId,
                sermon.sourceFacultySessionId,
            );
            if (session) {
                const messages = (session.messages ?? []) as Array<{ content?: string }>;
                for (const m of messages) {
                    if (m?.content) parts.push(m.content);
                }
            }
        }

        // ADR-031: library-backed citations live in the citation manifest. Their
        // verbatim excerpts + author + title ARE real source material, so add
        // them to the corpus. This lets standalone wizard sermons (no paper /
        // Faculty) verify against their actual library sources instead of falsely
        // flagging every citation as invented.
        // Published sermons carry the manifest at the top level; an
        // unpublished draft (verified pre-publish) carries it under
        // wizardProgress.draft — check both.
        const entries =
            sermon.citationManifest?.entries ??
            sermon.wizardProgress?.draft?.citationManifest?.entries ??
            [];
        if (entries.length > 0) {
            for (const e of entries) {
                if (e.excerpt) parts.push(e.excerpt);
                if (e.author) parts.push(e.author);
                if (e.title) parts.push(e.title);
            }
            if (!kind) kind = 'library';
        }

        return { kind, text: parts.join('\n\n'), hasManifest: entries.length > 0 };
    }

    /** Los libros citados (por obra y autor), cada uno por separado y ya normalizado. */
    private async libraryWorksFor(
        userId: string,
        citations: ParsedSermonCitation[],
    ): Promise<Map<string, { author: string; normalized: string }>> {
        const out = new Map<string, { author: string; normalized: string }>();
        if (!this.libraryWorkText) return out;
        const pedidos = new Map<string, { title: string; author: string }>();
        for (const c of citations) {
            const title = workTitleOf(c.source);
            if (title) pedidos.set(obraKey(c), { title, author: c.author });
        }
        await Promise.all([...pedidos.entries()].map(async ([clave, o]) => {
            try {
                const obra = await this.libraryWorkText!(userId, o.title, o.author);
                if (obra?.text) out.set(clave, { author: obra.author, normalized: normalizeForSearch(obra.text) });
            } catch {
                // Sin el libro se coteja como antes: contra el paper y el manifiesto.
            }
        }));
        return out;
    }

    private resolveSermonMarkdown(sermon: {
        content?: string;
        wizardProgress?: { draft?: any } | undefined;
    }): string {
        const draft = sermon.wizardProgress?.draft as
            | {
                introduction?: string;
                body?: Array<{ content?: string; authorityQuote?: string | null }>;
                conclusion?: string;
                callToAction?: string;
            }
            | undefined;
        if (draft) {
            const parts: string[] = [];
            if (draft.introduction) parts.push(draft.introduction);
            for (const b of draft.body ?? []) {
                if (b.content) parts.push(b.content);
                if (b.authorityQuote) parts.push(b.authorityQuote);
            }
            if (draft.conclusion) parts.push(draft.conclusion);
            if (draft.callToAction) parts.push(draft.callToAction);
            return parts.join('\n\n');
        }
        return sermon.content ?? '';
    }
}

// ── Verification ──────────────────────────────────────────────────────

/**
 * Returns a verdict for a single parsed citation. Three-stage check:
 *
 *   1. Author surname must appear in the source corpus. If the
 *      author's name is nowhere in the source material, the quote is
 *      almost certainly fabricated regardless of the quote text — the
 *      LLM made up both the quote AND the attribution.
 *   2. Quote text substring check against the source corpus
 *      (normalized). Catches direct quotes the paper transcribed.
 *   3. Quote text fuzzy-token check (Jaccard similarity on shingles)
 *      against any source chunk containing the author surname.
 *      Catches paraphrased quotes that are still grounded in the
 *      source.
 *
 * Note: this verifier is deterministic + cheap. It optimizes for
 * catching FABRICATION, not for catching paraphrase mismatch — the
 * latter is rare in sermon citation context (sermons either reuse
 * paper quotes verbatim or invent them wholesale).
 */
export function verifyOne(citation: ParsedSermonCitation, corpus: string, normalized?: string): VerifiedSermonCitation {
    if (!corpus.trim()) {
        return {
            citation,
            status: 'not-found',
            similarity: 0,
            note: 'No hay material fuente para verificar.',
        };
    }
    const corpusLower = corpus.toLowerCase();
    const surname = extractSurname(citation.author).toLowerCase();
    const quoteLower = citation.quote.toLowerCase();

    // Stage 1: author surname presence
    if (!surname || !corpusLower.includes(surname)) {
        return {
            citation,
            status: 'not-found',
            similarity: 0,
            note: `El autor "${citation.author}" no aparece en el material fuente. Probable cita inventada.`,
        };
    }

    // Stage 2: literal substring of the quote. A quote trimmed with «[…]»
    // is checked piece by piece, like the quote finder does: the whole quote
    // with the cut mark can never match the source.
    const normalizedCorpus = normalized ?? normalizeForSearch(corpus);
    if (literalInOrder(citation.quote, normalizedCorpus)) {
        return {
            citation,
            status: 'verified',
            similarity: 1,
            note: 'Cita encontrada literalmente en el material fuente.',
        };
    }

    // Stage 3: fuzzy token-set Jaccard against the corpus window
    // around the author's name.
    const sim = fuzzyTokenSimilarity(quoteLower, corpusLower, surname);
    if (sim >= 0.55) {
        return {
            citation,
            status: 'verified',
            similarity: sim,
            note: `Cita parafraseada del material fuente (similitud ${Math.round(sim * 100)}%).`,
        };
    }
    if (sim >= 0.25) {
        return {
            citation,
            status: 'fuzzy-low',
            similarity: sim,
            note: `Texto parcial vs ${citation.author}. Revisa que la cita refleje la fuente (similitud ${Math.round(sim * 100)}%).`,
        };
    }
    return {
        citation,
        status: 'not-found',
        similarity: sim,
        note: `El texto citado no aparece en lo que ${citation.author} expone en el material fuente. Probable cita inventada.`,
    };
}

function extractSurname(author: string): string {
    const cleaned = author.replace(/[*_"'.()]/g, '').trim();
    const parts = cleaned.split(/\s+/);
    return parts.length > 0 ? parts[parts.length - 1]! : '';
}

function normalizeForSearch(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')  // strip diacritics
        // Quotes of every style and markdown emphasis out: the sermon writes
        // «», “”, or "" and the extracted book whatever its edition had.
        .replace(/[“”«»"'’‘*_]/g, '')
        .replace(/[—–]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Token-set Jaccard similarity between the quote and the slice of the
 * corpus around the author surname (within ±2000 chars). Filters
 * stopwords + tokens < 4 chars so the score reflects substantive
 * word overlap rather than noise.
 */
function fuzzyTokenSimilarity(quote: string, corpus: string, surname: string): number {
    const surnameIdx = corpus.indexOf(surname);
    if (surnameIdx === -1) return 0;
    const start = Math.max(0, surnameIdx - 2000);
    const end = Math.min(corpus.length, surnameIdx + 2000);
    const window = corpus.slice(start, end);

    const quoteTokens = tokenize(quote);
    const windowTokens = tokenize(window);
    if (quoteTokens.size === 0 || windowTokens.size === 0) return 0;

    let intersection = 0;
    for (const token of quoteTokens) {
        if (windowTokens.has(token)) intersection++;
    }
    const union = quoteTokens.size + windowTokens.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

const STOPWORDS = new Set([
    'que', 'esta', 'este', 'para', 'como', 'pero', 'sino', 'sobre', 'cuando',
    'donde', 'porque', 'desde', 'hasta', 'entre', 'mientras', 'durante',
    'aunque', 'también', 'tambien', 'según', 'segun', 'aquí', 'aqui',
    'this', 'that', 'these', 'those', 'with', 'from', 'into', 'about',
    'which', 'where', 'when', 'while', 'because', 'although', 'between',
]);

function tokenize(text: string): Set<string> {
    return new Set(
        normalizeForSearch(text)
            .split(/\W+/)
            .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
    );
}

/** «Comentario Jonás, p. 89» → «Comentario Jonás». */
export function workTitleOf(source: string | null): string | null {
    const t = (source ?? '').replace(/,?\s*pp?\.\s*[\divxlc–\-]+\s*$/i, '').trim();
    return t || null;
}

/** Cuánto puede haber entre dos trozos de una cita recortada con «[…]». */
export const MAX_GAP_BETWEEN_CUTS = 3000;
/** Una cita más corta que esto no se da por literal: frases así aparecen en cualquier libro. */
export const MIN_LITERAL_CHARS = 25;

/**
 * La cita está, literal, en el texto: sus trozos (cortados SÓLO por «[…]» o
 * «[...]»), en ORDEN y CERCA uno del otro. Revisión adversarial de R1: trozos
 * sueltos de un libro de varios MB, en cualquier orden o separados por un
 * «…» suelto, aprobaban una frase inventada.
 */
export function literalInOrder(quote: string, normalizedText: string): boolean {
    const trozos = quote
        .split(/\[\s*(?:\.\.\.|…)\s*\]/)
        .map(normalizeForSearch)
        .filter(t => t.length > 0);
    if (trozos.length === 0 || trozos.join(' ').length < MIN_LITERAL_CHARS) return false;
    // Cada aparición del primer trozo es un comienzo posible.
    for (let inicio = normalizedText.indexOf(trozos[0]!); inicio >= 0; inicio = normalizedText.indexOf(trozos[0]!, inicio + 1)) {
        let fin = inicio + trozos[0]!.length;
        let ok = true;
        for (const t of trozos.slice(1)) {
            const at = normalizedText.indexOf(t, fin);
            if (at < 0 || at - fin > MAX_GAP_BETWEEN_CUTS) { ok = false; break; }
            fin = at + t.length;
        }
        if (ok) return true;
    }
    return false;
}

function verifyInWork(citation: ParsedSermonCitation, normalizedWork: string): VerifiedSermonCitation | null {
    if (!literalInOrder(citation.quote, normalizedWork)) return null;
    return { citation, status: 'verified', similarity: 1, note: 'Cita encontrada literalmente en el libro citado de tu biblioteca.' };
}

function obraKey(c: ParsedSermonCitation): string {
    return `${workTitleOf(c.source) ?? ''}|${c.author}`;
}

/** El apellido citado está en el autor real del libro. */
export function sameAuthor(realAuthor: string, citedAuthor: string): boolean {
    const apellido = normalizeForSearch(extractSurname(citedAuthor));
    return apellido.length > 1 && normalizeForSearch(realAuthor).split(/[^\p{L}]+/u).includes(apellido);
}

