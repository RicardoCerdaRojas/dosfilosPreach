/**
 * Sermon-format quote extractor. Pulls author-attributed quote blocks
 * out of sermon markdown so the citation verifier can check whether
 * each quote is verifiable against the sermon's source corpus
 * (originating paper or Faculty conversation).
 *
 * The sermon prompt generates citation blocks in this shape:
 *
 *   > "Quote text here, possibly multi-line."
 *   > — *Author Name, Source Title*
 *
 * Or sometimes:
 *
 *   "Quote text here" — *Author Name, Source*
 *
 * Different from the exegetical-paper citation format
 * `(Author, "Title", p. N)` which `citationVerifier/citationParser.ts`
 * already handles — that parser is regex-locked to the inline academic
 * style. Sermon manuscript style uses pull-quote attribution which
 * needs its own pattern.
 *
 * Post-PR #217 the LLM is forbidden from fabricating quotes when no
 * verified source exists (it returns `authorityQuote: null`), but the
 * verifier runs as a defense-in-depth layer to catch quotes that did
 * slip through the prompt rule.
 */

export interface ParsedSermonCitation {
    /** Exact substring matched (for UI highlighting + manual edit). */
    raw: string;
    /** Quote text inside the quotation marks. */
    quote: string;
    /** Author name as written by the LLM. */
    author: string;
    /** Optional source title/work — everything after the comma in the attribution line. */
    source: string | null;
    /** Character offset in the input markdown (for jump-to-edit). */
    offset: number;
}

/**
 * Block-style attribution: pull-quote followed by attribution line.
 *
 *   > "Quote text…"
 *   > — *Author, Source*
 *
 * The em-dash can be `—` (U+2014), `–` (U+2013) or a plain `--`. The
 * attribution italics wrapper (`*…*` / `_…_`) is optional — strip
 * markdown emphasis if present. Multi-line quotes are joined.
 */
const BLOCK_CITATION_REGEX =
    /^>\s*[""]([\s\S]+?)["""](?:\s*\n>\s*)?\s*\n?>\s*(?:[—–]|--)\s*[*_]?([^*_\n]+?)[*_]?\s*$/gm;

export function parseSermonCitations(markdown: string): ParsedSermonCitation[] {
    if (!markdown) return [];

    const found: ParsedSermonCitation[] = [];
    const seenOffsets = new Set<number>();
    // Tramos ya leídos: una cita con comillas internas no puede volver a
    // entrar, partida, por la regla en línea (salía «David F» como otra cita).
    const cubiertos: Array<[number, number]> = [];
    const cubierto = (desde: number, largo: number) =>
        cubiertos.some(([a, b]) => desde < b && desde + largo > a);

    // Block style first (more specific shape, wins on overlap).
    const blockRe = new RegExp(BLOCK_CITATION_REGEX.source, 'gm');
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(markdown)) !== null) {
        const [raw, quoteRaw, attributionRaw] = m;
        if (!quoteRaw || !attributionRaw) continue;
        const quote = normalizeQuote(quoteRaw);
        const { author, source } = splitAttribution(attributionRaw);
        if (!quote || !author) continue;
        found.push({
            raw,
            quote,
            author,
            source,
            offset: m.index,
        });
        seenOffsets.add(m.index);
        cubiertos.push([m.index, m.index + raw.length]);
    }

    // En línea: por marcas «comilla de cierre + guion» (`inlineCitations`).
    for (const c of inlineCitations(markdown)) {
        if (cubierto(c.offset, c.raw.length)) continue;
        if (looksLikeScriptureReference(c.author)) continue;
        found.push(c);
        cubiertos.push([c.offset, c.offset + c.raw.length]);
    }

    // Sort by offset so the dialog renders citations in document order.
    found.sort((a, b) => a.offset - b.offset);
    return found;
}

/**
 * Collapses multi-line markdown blockquote text into a single line +
 * normalizes whitespace. Strips the leading `> ` marker that
 * blockquote continuation lines carry.
 */
function normalizeQuote(text: string): string {
    return text
        .replace(/\n\s*>\s*/g, ' ')  // blockquote continuation → space
        .replace(/\\([\[\]*_()])/g, '$1')  // escapes de markdown: «\[…]» → «[…]»
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Parses the attribution line into `author` + optional `source` (title
 * of work). The comma is the separator the prompt template uses:
 * `*John Owen, "On the Patience of God"*`.
 *
 * When no comma present, the whole string is treated as the author.
 */
function splitAttribution(text: string): { author: string; source: string | null } {
    const cleaned = text
        .replace(/^[*_]+|[*_]+$/g, '')  // strip leading/trailing emphasis
        .trim();
    const commaIdx = cleaned.indexOf(',');
    if (commaIdx === -1) {
        return { author: cleaned, source: null };
    }
    const author = cleaned.slice(0, commaIdx).trim();
    const source = cleaned.slice(commaIdx + 1).trim().replace(/^["""']|["""']$/g, '') || null;
    return { author, source };
}

const SCRIPTURE_REF_REGEX = /^(\d?\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]+)\s+\d+(:\d+([\-–]\d+)?)?$/;

/**
 * Heuristic scripture-reference detector: matches strings like
 * "Juan 3:16", "1 Corintios 13:4-7", "Génesis 1", "2 Timoteo 3:16-17".
 * Used to skip biblical quotes from citation verification (they need
 * no human-authority verification).
 */
function looksLikeScriptureReference(text: string): boolean {
    return SCRIPTURE_REF_REGEX.test(text.trim());
}

const COMILLA = /["“”«»]/;
/** Una comilla de cierre seguida de guion largo: donde termina una cita atribuida. */
const MARCA_CIERRE = /["”»]\s*(?:—|–|--)\s*/g;

/**
 * Las citas atribuidas EN LÍNEA: «"Texto…" — Autor, Obra, p. 89».
 *
 * Reemplaza dos reglas que fallaban con lo que escribe nuestro motor
 * (sermón 6 de Jonás, 2026-10-03, y su revisión adversarial):
 *   - una cortaba el autor en el primer punto: «David F. Burt» → «David F»;
 *   - la que la corrigió se tragaba la línea: dos citas en una línea salían
 *     como una, y el autor de una cita a mitad de párrafo era el resto del
 *     párrafo.
 *
 * Se parte de cada marca de cierre. La comilla de apertura es la más cercana
 * hacia atrás que abre (precedida por inicio, espacio o puntuación) con un
 * número PAR de comillas en medio: así una cita con «la muerte "injusta" de
 * la planta» adentro no se parte. La atribución termina en el salto de línea,
 * en la próxima comilla o en el fin de una oración que no sea una inicial
 * («F.») ni la página («p.»).
 */
export function inlineCitations(markdown: string): ParsedSermonCitation[] {
    const out: ParsedSermonCitation[] = [];
    let limite = 0;
    for (const m of markdown.matchAll(MARCA_CIERRE)) {
        const cierre = m.index!;
        const inicioDeLinea = markdown.lastIndexOf('\n', cierre) + 1;
        const desde = Math.max(inicioDeLinea, limite);
        let apertura = -1;
        let entre = 0;
        for (let i = cierre - 1; i >= desde; i--) {
            if (!COMILLA.test(markdown[i]!)) continue;
            const antes = i === 0 ? ' ' : markdown[i - 1]!;
            const despues = markdown[i + 1] ?? ' ';
            const abre = /[\s(\[:—–>*_¡¿]/.test(antes) || i === inicioDeLinea;
            if (abre && !/\s/.test(despues) && entre % 2 === 0) { apertura = i; break; }
            entre++;
        }
        if (apertura < 0) continue;
        const quoteRaw = markdown.slice(apertura + 1, cierre);
        const resto = markdown.slice(cierre + m[0].length).split('\n')[0]!;
        const atribucion = finDeAtribucion(resto);
        if (quoteRaw.trim().length < 15 || !atribucion) continue;
        const quote = normalizeQuote(quoteRaw);
        const { author, source } = splitAttribution(atribucion);
        if (!quote || !author) continue;
        const raw = markdown.slice(apertura, cierre + m[0].length + atribucion.length);
        out.push({ raw, quote, author, source, offset: apertura });
        limite = cierre + m[0].length + atribucion.length;
    }
    return out;
}

/** Hasta dónde llega la atribución dentro del resto de la línea. */
function finDeAtribucion(resto: string): string {
    let fin = resto.length;
    const comilla = resto.search(COMILLA);
    if (comilla >= 0) fin = comilla;
    for (const m of resto.slice(0, fin).matchAll(/\.\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/g)) {
        const palabra = resto.slice(0, m.index).split(/[\s,]+/).pop() ?? '';
        // «F.» (inicial) y «p.»/«pp.» (página) no cierran la atribución.
        if (palabra.length <= 2 || /^pp?$/i.test(palabra)) continue;
        fin = Math.min(fin, m.index!);
        break;
    }
    return resto.slice(0, fin).replace(/[\s.;,]+$/, '').replace(/^[*_]+|[*_]+$/g, '').trim();
}

