import type {
    FormatterSourceMetadata,
    IStyleFormatter,
    PriorFootnoteAnchor,
    StyleFormatInput,
    StyleFormatOutput,
    StyleGuideManifest,
} from '@dosfilos/domain';

/**
 * Pure-TypeScript implementation of `IStyleFormatter`.
 *
 * Runs after the LLM finishes generating a step. The orchestrator
 * emits inline parenthetical citations like
 * `(Author, "Title", p. N)`; this formatter:
 *
 *   1. Parses every citation pattern.
 *   2. Matches each one against the paper's `citableSources`
 *      (by citation key, surname, or title).
 *   3. Decides whether the mention is FIRST, SUBSEQUENT, or IBID
 *      based on the prior-anchors list (citations from accepted
 *      earlier steps) plus the order within the current step.
 *   4. Substitutes the matched source's metadata into the
 *      manifest's first/subsequent/ibid templates.
 *   5. Records footnote counts and surfaces warnings for
 *      unmatched citations (most common cause: the LLM cited a
 *      name that doesn't appear in the corpus).
 *
 * v1 scope intentionally LIMITED:
 *   - Only inline parenthetical citations are touched. Markdown
 *     footnote syntax (`[^1]`) is out of scope; v1.5 export
 *     converts inline → footnotes for .docx output.
 *   - Quote-mark normalization is deferred — without robust
 *     pairing detection, a naive find-replace would break nested
 *     quotes more often than it fixes them.
 *   - Block-quote auto-conversion is deferred for the same reason.
 *
 * Idempotent: applying the formatter to already-formatted markdown
 * produces the same output. The use case relies on this so manual
 * edits → re-format → save doesn't drift.
 */
export class DeterministicStyleFormatter implements IStyleFormatter {
    format(input: StyleFormatInput): StyleFormatOutput {
        const { markdown, manifest, citableSources, priorFootnoteAnchors } = input;

        const lookup = new SourceLookup(citableSources);
        const state = new SequenceState(priorFootnoteAnchors);
        const warnings: string[] = [];

        // Match ANY parenthetical that LOOKS like a citation: starts
        // with a name token, may include a quoted title, may include
        // a page reference. The regex is permissive — false positives
        // are filtered by the `lookup.match` call.
        const citationPattern = /\(\s*([^,()]+?)\s*,\s*"([^"]+)"(?:\s*,\s*(?:pp?\.\s*)?([\d–\-—]+))?\s*\)/g;

        const rewritten = markdown.replace(citationPattern, (full, authorRaw, titleRaw, pagesRaw) => {
            const match = lookup.match(authorRaw, titleRaw);
            if (!match) {
                warnings.push(
                    `Citation "${full.trim()}" did not match any configured source. Left as-is.`,
                );
                return full;
            }
            const pages = typeof pagesRaw === 'string' ? pagesRaw.trim() : null;
            const decision = state.decide(match.corpusId, pages);
            state.record(match.corpusId, pages);

            return renderCitation({
                manifest,
                source: match,
                pages,
                decision,
            });
        });

        return {
            markdown: rewritten,
            footnoteCounts: state.counts(),
            warnings,
        };
    }
}

// ── Source lookup ───────────────────────────────────────────────────────

/**
 * Indexes citable sources by multiple keys (citationKey, surname,
 * title fragment) so the formatter can find the right one regardless
 * of how the LLM phrased the citation.
 */
class SourceLookup {
    private byKey: Map<string, FormatterSourceMetadata> = new Map();
    private bySurname: Map<string, FormatterSourceMetadata> = new Map();
    private byTitleFragment: Map<string, FormatterSourceMetadata> = new Map();
    private all: FormatterSourceMetadata[];

    constructor(sources: ReadonlyArray<FormatterSourceMetadata>) {
        this.all = [...sources];
        for (const s of sources) {
            if (s.citationKey) this.byKey.set(normalize(s.citationKey), s);
            const surname = extractSurname(s.fullAuthor) ?? extractSurname(s.authorSurnameFirst);
            if (surname) this.bySurname.set(normalize(surname), s);
            // Index a lowered version of the short title for fuzzy
            // title-only matches (the LLM may cite by title when the
            // author is implicit).
            if (s.shortTitle) this.byTitleFragment.set(normalize(s.shortTitle), s);
            if (s.fullTitle) this.byTitleFragment.set(normalize(s.fullTitle), s);
        }
    }

    /**
     * Finds the source the LLM was citing. Tries, in order:
     *   1. Exact citation-key match on the author token.
     *   2. Surname match on the author token.
     *   3. Title-fragment match on the title token (case-insensitive
     *      substring contains).
     *   4. As a final fallback, returns null — the formatter then
     *      surfaces a warning.
     */
    match(authorToken: string, titleToken: string): FormatterSourceMetadata | null {
        const authorNorm = normalize(authorToken);
        const direct = this.byKey.get(authorNorm) ?? this.bySurname.get(authorNorm);
        if (direct) return direct;

        // Authors like "Lane, William L." emit only the surname after
        // the comma in many citations; try the first word too.
        const firstWord = normalize(authorToken.split(/\s+/)[0] ?? '');
        if (firstWord) {
            const byFirstWord = this.byKey.get(firstWord) ?? this.bySurname.get(firstWord);
            if (byFirstWord) return byFirstWord;
        }

        // Title fallback: any source whose short or full title contains
        // the cited title token (or vice versa).
        const titleNorm = normalize(titleToken);
        if (titleNorm.length >= 4) {
            for (const candidate of this.all) {
                const candTitle = normalize(candidate.shortTitle || candidate.fullTitle || '');
                if (!candTitle) continue;
                if (candTitle === titleNorm
                    || candTitle.includes(titleNorm)
                    || titleNorm.includes(candTitle)) {
                    return candidate;
                }
            }
        }
        return null;
    }
}

function normalize(s: string): string {
    return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractSurname(fullAuthor: string | null | undefined): string | null {
    if (!fullAuthor) return null;
    const trimmed = fullAuthor.trim();
    if (!trimmed) return null;
    // "Lane, William L." → "Lane"
    if (trimmed.includes(',')) return trimmed.split(',')[0]!.trim();
    // "William L. Lane" → "Lane"
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1] ?? null;
}

// ── Sequence state ──────────────────────────────────────────────────────

type CitationDecision =
    | { kind: 'first' }
    | { kind: 'subsequent' }
    | { kind: 'ibid'; pageOverride: string | null };

/**
 * Tracks the sequence of cited sources across the current step so the
 * formatter can decide first vs subsequent vs ibid.
 */
class SequenceState {
    private seen: Set<string> = new Set();
    private lastCorpusId: string | null = null;
    private lastPages: string | null = null;
    private countsByCorpusId: Map<string, number> = new Map();

    constructor(priorAnchors: ReadonlyArray<PriorFootnoteAnchor>) {
        // Pre-populate `seen` with corpora cited in earlier steps so
        // their next mention here is treated as 'subsequent', not
        // 'first'. The last anchor sets the ibid baseline so a
        // continued citation across step boundaries still collapses.
        for (const anchor of priorAnchors) {
            this.seen.add(anchor.corpusId);
        }
        const last = priorAnchors[priorAnchors.length - 1];
        if (last) {
            this.lastCorpusId = last.corpusId;
            this.lastPages = last.pages;
        }
    }

    decide(corpusId: string, pages: string | null): CitationDecision {
        if (this.lastCorpusId === corpusId) {
            // Consecutive same-source: ibid candidate. Page override
            // is used when the page changed; otherwise plain ibid.
            return {
                kind: 'ibid',
                pageOverride: pages && pages !== this.lastPages ? pages : null,
            };
        }
        if (!this.seen.has(corpusId)) return { kind: 'first' };
        return { kind: 'subsequent' };
    }

    record(corpusId: string, pages: string | null): void {
        this.seen.add(corpusId);
        this.lastCorpusId = corpusId;
        this.lastPages = pages;
        this.countsByCorpusId.set(corpusId, (this.countsByCorpusId.get(corpusId) ?? 0) + 1);
    }

    counts(): ReadonlyMap<string, number> {
        return this.countsByCorpusId;
    }
}

// ── Citation renderer ───────────────────────────────────────────────────

interface RenderInput {
    manifest: StyleGuideManifest;
    source: FormatterSourceMetadata;
    pages: string | null;
    decision: CitationDecision;
}

/**
 * Builds the final inline citation string per the manifest's
 * templates and the decision (first / subsequent / ibid).
 */
function renderCitation(input: RenderInput): string {
    const { manifest, source, pages, decision } = input;

    if (decision.kind === 'ibid') {
        // En la prosa, «Ibid.» nunca: va la forma abreviada, con el autor.
        // Un «(Ibid., 567)» no lo resuelve el verificador (TI #2, 23:4–23:6:
        // una alarma «no encontrada» por cada uno) y depende de qué cita
        // quede antes al ensamblar. El «Ibid.» lo pone el exportador del
        // Word, sobre el orden final de las notas y con `footnotes.ibid` de
        // la guía del trabajo (`ExegesisPaperPage` → `exportPaperToDocx`).
        const tpl = manifest.footnotes.subsequentMentionTemplate;
        return wrap(substituteTemplate(tpl, source, pages));
    }

    const tpl = decision.kind === 'first'
        ? manifest.footnotes.firstMentionTemplate
        : manifest.footnotes.subsequentMentionTemplate;
    return wrap(substituteTemplate(tpl, source, pages));
}

function wrap(body: string): string {
    return `(${body.trim()})`;
}

/**
 * Replaces `{placeholder}` tokens in a template with values from the
 * source metadata. Empty/null values collapse the placeholder to an
 * empty string; subsequent comma cleanup removes orphan separators.
 */
function substituteTemplate(
    template: string,
    source: FormatterSourceMetadata,
    pages: string | null,
): string {
    const values: Record<string, string> = {
        author: source.fullAuthor ?? '',
        authorShort: source.citationKey || extractSurname(source.fullAuthor) || '',
        authorSurnameFirst: source.authorSurnameFirst ?? '',
        title: source.fullTitle ?? '',
        titleShort: source.shortTitle ?? source.fullTitle ?? '',
        publisher: source.publisher ?? '',
        city: source.city ?? '',
        year: source.year != null ? String(source.year) : '',
        volume: source.volume ?? '',
        pages: pages ?? '',
    };

    let out = template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');

    // Cleanup: collapse double-commas, "(:" / ":  ," / dangling
    // separators that result from missing fields. Conservative
    // regexes — only target patterns that are clearly artifacts.
    out = out
        .replace(/\(\s*:\s*,\s*/g, '(') // "(: ," → "("
        .replace(/\(\s*:\s*/g, '(')      // "(: " → "("
        .replace(/,\s*,/g, ',')          // ", ," → ","
        .replace(/,\s*\)/g, ')')        // ", )" → ")"
        .replace(/\(\s*,/g, '(')        // "( ," → "("
        .replace(/\(\s*\)/g, '')         // "()" → ""
        .replace(/\s{2,}/g, ' ')         // collapse double spaces
        .replace(/\s+\./g, '.')          // " ." → "."
        .replace(/\s+,/g, ',')           // " ," → ","
        .trim();

    // Remove a trailing period if present so the wrap layer can re-add
    // exactly one (templates often end with ".", but the wrap inside
    // parens makes the period awkward — Turabian footnotes end with
    // "." but inline parenthetical doesn't).
    if (out.endsWith('.')) out = out.slice(0, -1).trim();

    return out;
}

// ── Helper for the use case ─────────────────────────────────────────────

/**
 * Extracts the (corpusId, pages) anchors from already-formatted
 * markdown so a later step sees the cross-step sequence and applies
 * ibid correctly. Pure function — exposed here for the use case.
 *
 * Best-effort: parses the same patterns the formatter emits. Sources
 * the formatter previously couldn't match (warnings) won't appear
 * here either; that's acceptable since they were left unformatted.
 */
export function extractFootnoteAnchorsFromFormattedMarkdown(
    markdown: string,
    citableSources: ReadonlyArray<FormatterSourceMetadata>,
): PriorFootnoteAnchor[] {
    const lookup = new SourceLookup(citableSources);
    const anchors: PriorFootnoteAnchor[] = [];
    const pattern = /\(\s*([^,()]+?)\s*,\s*"([^"]+)"(?:\s*,\s*(?:pp?\.\s*)?([\d–\-—]+))?\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(markdown)) !== null) {
        const [, authorRaw, titleRaw, pagesRaw] = match;
        const found = lookup.match(authorRaw!, titleRaw!);
        if (found) {
            anchors.push({
                corpusId: found.corpusId,
                pages: typeof pagesRaw === 'string' ? pagesRaw.trim() : null,
            });
        }
    }
    return anchors;
}
