import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';

/**
 * Strips supporting quotes that are not present in the source text the
 * analyzer was given — and keeps the attribution.
 *
 * What changed and why: this began by deleting the whole attribution.
 * Over a real paper that turned out to destroy far more true work than
 * false: every drop it produced was a quote the model had transcribed
 * faithfully and this matcher failed to recognise — a PDF hyphenating
 * across a line, our own page labels sitting between two fragments, a
 * sentence spanning the seam where two retrieved fragments meet. Not
 * one fabrication.
 *
 * The danger was never the attribution. It was a fabricated sentence
 * presented as the author's own words. Removing the quote removes that
 * danger; removing the position also removes the student's engagement
 * with a source that did contribute text, which is theirs and which
 * nothing else can reconstruct. So an unverifiable quote is dropped,
 * the position stays, and the caller is told which — visible, and
 * reversible by a human.
 *
 * Matching is sentence by sentence. A quote reaches us as continuous
 * prose, but the source arrives as separately retrieved fragments, so a
 * true quote can straddle a seam that exists only in our packaging. Per
 * sentence, each side of the seam is checked against the material it
 * really came from. A fabricated sentence still matches nothing.
 *
 * Quotes carrying no text are left alone, as are sources whose text was
 * not handed to this check: refusing to judge beats judging blind.
 */
export interface AttributedQuoteReport {
    analysis: CanonicalVerseAnalysis;
    /** Attributions whose quote was removed for not being in the source. */
    dropped: Array<{
        sourceKey: string;
        page: number;
        /** 'crux' | 'commentator' — which surface the attribution sat on. */
        surface: 'crux' | 'commentator';
        quote: string;
    }>;
}

/**
 * Shortest run of letters worth checking on its own. Below this a
 * fragment matches almost any prose and proves nothing.
 */
const MIN_SENTENCE_CHARS = 25;

export function verifyAttributedQuotes(
    analysis: CanonicalVerseAnalysis,
    /** Source body per citation key — exactly what was sent to the model. */
    textBySourceKey: ReadonlyMap<string, string>,
): AttributedQuoteReport {
    const dropped: AttributedQuoteReport['dropped'] = [];
    const normalizedCache = new Map<string, string>();

    const sourceTextFor = (key: string): string | null => {
        if (normalizedCache.has(key)) return normalizedCache.get(key)!;
        const raw = textBySourceKey.get(key);
        if (raw === undefined) return null;
        const norm = normalize(raw);
        normalizedCache.set(key, norm);
        return norm;
    };

    /**
     * A quote holds when we can check it and it is there. When the
     * source text is unavailable we cannot judge, and refuse to drop
     * on a guess.
     */
    const quoteHolds = (sourceKey: string, quote: string | undefined): boolean => {
        if (!quote?.trim()) return true;
        const haystack = sourceTextFor(sourceKey);
        if (haystack === null) return true;
        if (haystack.includes(normalize(quote))) return true;

        // Sentence by sentence, for the quote that straddles the seam
        // between two separately retrieved fragments. Every sentence
        // long enough to mean something must be in the source; one
        // invented sentence among true ones still fails.
        const sentences = quote
            .split(/(?<=[.;:!?])\s+/)
            .map(normalize)
            .filter(x => x.length >= MIN_SENTENCE_CHARS);
        if (sentences.length === 0) return false;
        return sentences.every(x => haystack.includes(x));
    };

    const commentatorEngagement = analysis.commentatorEngagement.map(c => {
        if (quoteHolds(c.sourceKey, c.verbatimQuote)) return c;
        dropped.push({
            sourceKey: c.sourceKey,
            page: c.page,
            surface: 'commentator',
            quote: c.verbatimQuote ?? '',
        });
        return { ...c, verbatimQuote: '', unverifiedQuote: (c.verbatimQuote ?? '').trim() };
    });

    const translationCruxes = analysis.translationCruxes.map(crux => ({
        ...crux,
        commentatorPositions: crux.commentatorPositions.map(p => {
            if (quoteHolds(p.sourceKey, p.verbatimQuote)) return p;
            dropped.push({
                sourceKey: p.sourceKey,
                page: p.page,
                surface: 'crux',
                quote: p.verbatimQuote ?? '',
            });
            return { ...p, verbatimQuote: '', unverifiedQuote: (p.verbatimQuote ?? '').trim() };
        }),
    }));

    return {
        analysis: { ...analysis, commentatorEngagement, translationCruxes },
        dropped,
    };
}

/**
 * Folds away the differences a faithful copy still picks up, without
 * folding away a changed word.
 *
 * Applied to BOTH the source text and the quote, so it can afford to
 * be blunt: whatever it mangles, it mangles identically on each side.
 * What must survive is the sequence of letters, because that is what
 * separates a real quote from a reworded one.
 *
 * Whitespace and hyphens go entirely. A PDF breaks words across lines
 * — "comple-\ntamente", "pala-\nbra" — and a model reading that
 * quotes the whole word back. Keeping the hyphen made those quotes
 * fail and deleted true citations from a theological dictionary: a
 * worse failure than the one this file exists to prevent, because it
 * destroys the student's own sourced work and says nothing.
 */
function normalize(text: string): string {
    return text
        .normalize('NFC')
        .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
        .replace(/[\u201C\u201D\u201F\u2033\u00AB\u00BB]/g, '"')
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .replace(/[\s\u00A0-]+/g, '')
        .toLowerCase();
}
