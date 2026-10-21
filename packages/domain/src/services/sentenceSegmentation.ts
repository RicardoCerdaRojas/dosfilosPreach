/**
 * Sentence segmentation — the single ruler for "what counts as one sentence"
 * in sermon prose.
 *
 * Two features depend on this boundary and MUST agree on it:
 *   - The fidelity pass (ADR-029 Q2) judges "the sentence before `[N]`".
 *   - The pulpit reader (Púlpito F1) highlights "the sentence under the
 *     long press" and anchors that highlight for the web (M-05).
 *
 * If the two drifted, the pastor would highlight a span the evaluator never
 * judged, and the anchor written from the tablet would not line up with the
 * claim the web shows. One task, one builder.
 *
 * The rule is deliberately cheap (regex, no NLP): sermon prose is
 * well-punctuated Spanish/English, and the failure mode of a missed split is
 * a slightly longer highlight, not a wrong one.
 */

/**
 * Sentence terminators. Period, question mark, exclamation mark followed by
 * whitespace or end of text.
 *
 * NOTE: `…` is not listed on purpose — a written ellipsis reaches us as
 * `...`, whose last period already terminates.
 */
export const SENTENCE_TERMINATOR = /[.!?](?=\s|$)/g;

/**
 * Closing punctuation that belongs to the sentence it follows, so the split
 * happens after it: `dijo «basta».` keeps the quote mark with the sentence.
 */
const TRAILING_CLOSERS = new Set(['"', "'", '»', '”', '’', ')', ']', '…']);

/**
 * Abbreviations whose period is not a sentence end. Lowercased, without the
 * trailing period. Kept short on purpose: every entry is a real form seen in
 * pastoral prose, and a missing one only produces an extra split.
 */
const ABBREVIATIONS: ReadonlySet<string> = new Set([
    'sr', 'sra', 'srta', 'dr', 'dra', 'lic', 'prof', 'pbro', 'rvdo',
    'cap', 'vol', 'pág', 'pag', 'pp', 'ed', 'trad', 'cf', 'vs', 'etc',
    'ej', 'aprox', 'núm', 'num', 'a.c', 'd.c', 'mr', 'mrs', 'ms', 'st',
]);

/**
 * La misma lista, para quien corta oraciones con otra regla: el verificador de
 * citas (`citationParser.ts`) la extiende con las abreviaturas de las citas
 * académicas (s., ss., v., vv., n., p.). Antes tenía su propia lista, y las
 * dos ya no coincidían (TP #8, revisión adversarial).
 */
export const SENTENCE_ABBREVIATIONS: ReadonlySet<string> = ABBREVIATIONS;

/** A sentence and its half-open range `[start, end)` in the source text. */
export interface SentenceSpan {
    text: string;
    start: number;
    end: number;
}

/**
 * Below this length a trailing fragment is merged into the previous sentence
 * instead of standing alone. Keeps a stray "Sí." or an unlisted abbreviation
 * from becoming its own highlightable unit.
 */
const MIN_SPAN_CHARS = 12;

/** True when the period at `index` is part of an abbreviation or a number. */
function isFalseBoundary(text: string, index: number): boolean {
    if (text[index] !== '.') return false;

    // 3.16, 1.500 — a period between digits never ends a sentence. Reading a
    // character past either edge of the string yields `undefined`, which is
    // exactly "no digit there": the empty string keeps the comparisons honest.
    const prev = text[index - 1] ?? '';
    const next = text[index + 1] ?? '';
    if (prev >= '0' && prev <= '9' && next >= '0' && next <= '9') return true;

    // Walk back over the word that owns the period.
    let start = index;
    while (start > 0 && !/[\s(«"']/.test(text[start - 1] ?? '')) start -= 1;
    const word = text.slice(start, index).toLowerCase();
    return ABBREVIATIONS.has(word);
}

/**
 * Split `text` into sentences, keeping the offsets of each one. Whitespace
 * between sentences belongs to neither span. Pure.
 *
 * Returns a single span covering the trimmed text when it has no terminator
 * — a heading or a one-line fragment is still highlightable.
 */
export function splitSentences(text: string): SentenceSpan[] {
    if (!text) return [];

    const spans: SentenceSpan[] = [];
    let cursor = 0;

    const push = (start: number, end: number) => {
        // Trim the span without losing the mapping to the source offsets.
        let s = start;
        let e = end;
        while (s < e && /\s/.test(text[s] ?? '')) s += 1;
        while (e > s && /\s/.test(text[e - 1] ?? '')) e -= 1;
        if (e <= s) return;

        const previous = spans[spans.length - 1];
        if (previous && e - s < MIN_SPAN_CHARS) {
            // Absorb the runt into the sentence before it.
            previous.end = e;
            previous.text = text.slice(previous.start, e);
            return;
        }
        spans.push({ text: text.slice(s, e), start: s, end: e });
    };

    SENTENCE_TERMINATOR.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SENTENCE_TERMINATOR.exec(text)) !== null) {
        if (isFalseBoundary(text, match.index)) continue;

        // Swallow repeated terminators (`¿…?!`) and closing punctuation.
        let end = match.index + 1;
        while (
            end < text.length &&
            (TRAILING_CLOSERS.has(text[end] ?? '') || /[.!?]/.test(text[end] ?? ''))
        ) {
            end += 1;
        }
        push(cursor, end);
        cursor = end;
        SENTENCE_TERMINATOR.lastIndex = end;
    }

    if (cursor < text.length) push(cursor, text.length);
    return spans;
}
