import { citedLocation } from '../entities/CanonicalVerseAnalysis';
import { formatPassageReference } from '../../bible/canon/passage-reference';
import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { PassageReference } from '../../bible/canon/passage-reference';

/**
 * Deterministic markdown render of a `CanonicalVerseAnalysis`.
 *
 * Used by the assembly step as a fallback when a verse has been
 * analyzed canonically but the academic-prose composer hasn't run
 * yet (so `step.accepted.markdown` is empty). Renders the structured
 * payload as a readable verse section so the final assembly is never
 * a hollow shell of intro + conclusion.
 *
 * Quality is intentionally below the LLM-composed prose — this is a
 * rescue path, not the primary one. The user should still run "Componer
 * prosa académica" per verse for paper-grade output.
 */
export function renderCanonicalAnalysisAsMarkdown(
    analysis: CanonicalVerseAnalysis,
    options: {
        verseRef: PassageReference | null;
        lang: 'es' | 'en';
    },
): string {
    const sections: string[] = [];
    const heading = options.verseRef
        ? formatPassageReference(options.verseRef, options.lang)
        : null;
    if (heading) {
        sections.push(`## ${heading}`, '');
    }

    if (analysis.finalTranslation?.trim()) {
        sections.push(`> ${analysis.finalTranslation.trim()}`, '');
    } else if (analysis.initialTranslation?.trim()) {
        sections.push(`> ${analysis.initialTranslation.trim()}`, '');
    }

    if (analysis.argumentativeRole?.trim()) {
        sections.push(analysis.argumentativeRole.trim(), '');
    }

    if (analysis.verseThesis?.trim()) {
        sections.push(`**${T('thesis', options.lang)}:** ${analysis.verseThesis.trim()}`, '');
    }

    // Brief: surface the highest-signal structured fields as bulleted
    // paragraphs. We deliberately skip the deepest details (syntactic
    // function tags, lexicon page numbers) — the LLM prose composer
    // is the right tool for those. This is a rescue render.

    if (analysis.lexicalAnalyses.length > 0) {
        sections.push(`**${T('lexis', options.lang)}:**`);
        for (const lex of analysis.lexicalAnalyses) {
            const term = lex.lemma?.trim() || lex.term?.trim() || '';
            const loading = lex.verseSpecificLoading?.trim();
            if (term && loading) {
                sections.push(`- ${term}: ${loading}`);
            }
        }
        sections.push('');
    }

    if (analysis.commentatorEngagement.length > 0) {
        sections.push(`**${T('commentators', options.lang)}:**`);
        for (const c of analysis.commentatorEngagement) {
            const text = c.position?.trim() || '';
            if (c.sourceKey && text) {
                sections.push(`- ${c.sourceKey} (${citedLocation(c, (_k, p, kind) => (kind === 'printed' ? `p. ${p}` : `hoja ${p}`))}): ${text}`);
            }
        }
        sections.push('');
    }

    if (analysis.translationCruxes.length > 0) {
        sections.push(`**${T('cruxes', options.lang)}:**`);
        for (const crux of analysis.translationCruxes) {
            const phrase = crux.phrase?.trim() || crux.description?.trim() || '';
            const chosen = crux.commitment?.chosen?.trim() ?? '';
            if (phrase && chosen) {
                sections.push(`- "${phrase}" → ${chosen}`);
            }
        }
        sections.push('');
    }

    return sections.join('\n').trim();
}

const TRANSLATIONS = {
    thesis: { es: 'Tesis del verso', en: 'Verse thesis' },
    lexis: { es: 'Análisis léxico', en: 'Lexical analysis' },
    commentators: { es: 'Diálogo con comentaristas', en: 'Commentator engagement' },
    cruxes: { es: 'Decisiones de traducción', en: 'Translation cruxes' },
} as const;

function T(key: keyof typeof TRANSLATIONS, lang: 'es' | 'en'): string {
    return TRANSLATIONS[key][lang];
}
