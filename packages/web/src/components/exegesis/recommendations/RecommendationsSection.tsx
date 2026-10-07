import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useTranslation } from '@/i18n';
import {
    excludedLast,
    exclusionFor,
    getSourceRecommendations,
    type BibleBookId,
    type ExcludedSource,
    type SourceType,
} from '@dosfilos/domain';
import { useTrackActivity } from '@/hooks/useTrackActivity';
import { RecommendationCard } from './RecommendationCard';

interface RecommendationsSectionProps {
    bookId: BibleBookId;
    sourceType: SourceType;
    paperLanguage: 'es' | 'en';
    paperId: string;
    /** Adjunta al corpus una obra ya presente en la biblioteca. */
    onAttachMatch?: (libraryResourceId: string, title: string) => Promise<void>;
    /** Las excluidas del trabajo van al final y marcadas (TP #6). */
    excludedSources?: ReadonlyArray<ExcludedSource> | null;
}

/**
 * Collapsible section under each rubric requirement row that shows
 * curated recommendations for the (book × sourceType). Renders:
 *   - A toggle button "Ver N sugerencias" / "Ocultar sugerencias"
 *   - A list of `RecommendationCard`s when expanded
 *   - A "no curation yet" hint + telemetry event when the catalog has
 *     nothing for this combination
 *
 * Telemetry:
 *   - On expand → `recommendation_viewed` (count, sourceType, passage)
 *   - On render with empty results → `recommendation_gap_no_suggestions`
 *     (the most important event — drives "what to curate next")
 *
 * Stateless beyond the expand/collapse local state. The catalog itself
 * is static + synchronous (compiled into the bundle), so no loading
 * state is needed.
 */
export function RecommendationsSection({
    bookId,
    sourceType,
    paperLanguage,
    paperId,
    onAttachMatch,
    excludedSources = null,
}: RecommendationsSectionProps) {
    const { t } = useTranslation('exegesis');
    const { trackActivity } = useTrackActivity();
    const [expanded, setExpanded] = useState(false);

    // Pure synchronous lookup against the in-bundle catalog. Memoized
    // so we don't re-sort on every parent render.
    const recommendations = useMemo(
        () => excludedLast(
            getSourceRecommendations(bookId, sourceType, paperLanguage),
            rec => exclusionFor({ author: rec.author }, excludedSources) !== null,
        ),
        [bookId, sourceType, paperLanguage, excludedSources],
    );

    // Telemetry: fire `recommendation_gap_no_suggestions` once per
    // mount when the catalog has nothing. This is the "what to curate
    // next" signal — without it the catalog stagnates.
    const noSuggestionsEverFired = useNoSuggestionsTelemetry({
        empty: recommendations.length === 0,
        bookId,
        sourceType,
        paperId,
        track: trackActivity,
    });

    if (recommendations.length === 0) {
        return (
            <p className="text-[10.5px] text-muted-foreground/80 italic mt-1 pl-0.5">
                {t('paperSetup.subSteps.corpus.recommendations.empty')}
                {/* Read the unused flag so the hook isn't tree-shaken
                    in case someone wraps this in a memoization layer. */}
                <span className="sr-only">{noSuggestionsEverFired ? '·' : ''}</span>
            </p>
        );
    }

    const handleToggle = () => {
        const next = !expanded;
        setExpanded(next);
        if (next) {
            void trackActivity('feature_used', {
                feature: 'corpus_recommendations',
                action: 'recommendation_viewed',
                bookId,
                sourceType,
                paperId,
                suggestionCount: recommendations.length,
            });
        }
    };

    return (
        <div className="mt-1.5 space-y-1.5">
            <button
                type="button"
                onClick={handleToggle}
                className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={expanded}
            >
                {expanded ? (
                    <ChevronDown className="h-3 w-3" aria-hidden />
                ) : (
                    <ChevronRight className="h-3 w-3" aria-hidden />
                )}
                <Sparkles className="h-2.5 w-2.5 text-info" aria-hidden />
                {expanded
                    ? t('paperSetup.subSteps.corpus.recommendations.toggleHide')
                    : t('paperSetup.subSteps.corpus.recommendations.toggleShow', { count: recommendations.length })
                }
            </button>
            {expanded && (
                <div className="space-y-1.5">
                    {recommendations.map(rec => (
                        <RecommendationCard
                            key={`${rec.author}__${rec.title}`}
                            recommendation={rec}
                            sourceType={sourceType}
                            paperId={paperId}
                            onAttachMatch={onAttachMatch}
                            exclusion={exclusionFor({ author: rec.author }, excludedSources)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Fires the `recommendation_gap_no_suggestions` telemetry event ONCE
 * when this section mounts with an empty result. Tracked per session
 * via a Set to avoid re-firing on every re-render of the same gap
 * (the user hasn't done anything new — no need to spam the table).
 */
const sessionFiredEmpty = new Set<string>();

function useNoSuggestionsTelemetry({
    empty,
    bookId,
    sourceType,
    paperId,
    track,
}: {
    empty: boolean;
    bookId: BibleBookId;
    sourceType: SourceType;
    paperId: string;
    track: (event: 'feature_used', metadata: Record<string, unknown>) => Promise<void>;
}): boolean {
    if (!empty) return false;
    const key = `${paperId}__${bookId}__${sourceType}`;
    if (sessionFiredEmpty.has(key)) return true;
    sessionFiredEmpty.add(key);
    void track('feature_used', {
        feature: 'corpus_recommendations',
        action: 'recommendation_gap_no_suggestions',
        bookId,
        sourceType,
        paperId,
    });
    return true;
}
