/**
 * StickyVerseHeader
 *
 * Compact floating bar that appears when the main verse header scrolls out of
 * view. Uses IntersectionObserver on a sentinel element.
 *
 * Features:
 *  - Per-word transliteration below each Hebrew token
 *  - Bidirectional highlighting (activeWordIndex ↔ WordCard grid)
 *  - Rich tooltip on hover: gloss + grammatical category
 *  - Proportional text scale (shared with main header via textScale prop)
 */

import React, { useEffect, useState } from 'react';
import { MorphemeSpan } from './MorphemeSpan';
import { WordTooltipContent } from './WordTooltipContent';
import {
  Tooltip,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { VerseAnalysis } from '@dosfilos/domain';
import { versePunctuationOf } from '@dosfilos/domain';
import { getSyntacticMark, SYNTACTIC_BORDER, SYNTACTIC_DOT } from '../utils/syntacticMark';

interface StickyVerseHeaderProps {
  analysis: VerseAnalysis;
  showColors: boolean;
  showVerbMarkers: boolean;
  showSyntaxMarkers: boolean;
  /** When true, renders hebrewText as a single unbroken string so the browser
   *  can correctly shape all diacritics (niqqud + cantillation). When false,
   *  renders via MorphemeSpan with morphological color coding. */
  fullMarks: boolean;
  sentinelRef: React.RefObject<HTMLDivElement>;
  activeWordIndex: number | null;
  onWordHover: (index: number | null) => void;
  onWordClick: (index: number) => void;
  /** Proportional scale factor shared with the main header. Default 1.0 */
  textScale?: number;
}


export const StickyVerseHeader: React.FC<StickyVerseHeaderProps> = ({
  analysis,
  showColors,
  showVerbMarkers,
  showSyntaxMarkers,
  fullMarks,
  sentinelRef,
  activeWordIndex,
  onWordHover,
  onWordClick,
  textScale = 1.0,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  return (
    <div
      aria-hidden={!visible}
      className={`
        fixed top-0 left-0 right-0 z-50
        bg-background/95 backdrop-blur-md
        border-b border-border/60 shadow-md
        transition-all duration-300 ease-in-out
        print:hidden
        ${visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-5">
        {/* Reference */}
        <span className="text-sm font-bold text-primary whitespace-nowrap shrink-0">
          {analysis.reference}
        </span>

        {/* Divider */}
        <span className="w-px self-stretch min-h-[3rem] bg-border shrink-0 my-1" />

        {/* Hebrew word strip */}
        <div className="flex-1 py-1">
          <div
            dir="rtl"
            lang="he"
            className="font-hebrew text-foreground flex flex-wrap justify-center gap-x-5 gap-y-4 items-start pb-1"
            style={{
              fontSize: `${1.75 * textScale}rem`,
              lineHeight: 1.6,
              fontFeatureSettings: '"mark" 1, "mkmk" 1',
            }}
          >
            {analysis.words.map((w, i) => {
              const isVerb = !!w.verbMorphology && showVerbMarkers;
              const syntacticMark = showSyntaxMarkers ? getSyntacticMark(w) : null;
              const isActive = activeWordIndex === i;
              // Maqaf (U+05BE ־): collapse flex gap when the previous word ends with maqaf
              const prevHasMaqaf = i > 0 && analysis.words[i - 1].hebrewText.endsWith('\u05BE');

              // Border priority: active > verb > syntactic > none
              const borderClass = isActive
                ? 'bg-primary/15 ring-1 ring-primary/40 border-b-2 border-primary scale-105 shadow-sm'
                : isVerb
                  ? 'border-b-2 border-emerald-500/60 hover:bg-primary/8 hover:border-primary/60 hover:shadow-sm'
                  : syntacticMark
                    ? `${SYNTACTIC_BORDER[syntacticMark]} hover:shadow-sm`
                    : 'border-b-2 border-transparent hover:bg-muted hover:border-primary/30 hover:shadow-sm';

              return (
                <Tooltip key={i} delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span
                      onClick={() => onWordClick(i)}
                      onMouseEnter={() => onWordHover(i)}
                      onMouseLeave={() => onWordHover(null)}
                      style={prevHasMaqaf ? { marginInlineStart: '-0.75rem' } : undefined}
                      className={`
                        inline-flex flex-col items-center shrink-0 relative
                        cursor-pointer rounded-md px-1 pt-0.5
                        transition-all duration-150
                        ${borderClass}
                      `}
                    >
                      {/* Syntactic pip dot — shown when verb underline is already in use */}
                      {isVerb && syntacticMark && (
                        <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${SYNTACTIC_DOT[syntacticMark]}`} />
                      )}
                      {/* Hebrew text — dual rendering strategy:
                          fullMarks=true  → single string, perfect diacritic shaping (Masoretic mode)
                          fullMarks=false → MorphemeSpan with color coding (Morphological mode) */}
                      <span>
                        {fullMarks ? (
                          // Single unbroken string: browser shapes all grapheme clusters correctly
                          <span className="font-hebrew" style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}>
                            {w.hebrewText}
                          </span>
                        ) : w.morphemes && w.morphemes.length > 0 ? (
                          <>
                            <MorphemeSpan
                              segments={w.morphemes}
                              variant="text"
                              disableColors={!showColors}
                              disableNativeTooltip
                            />
                            {/* Sof pasuq: los morfemas no lo llevan, la línea sí. */}
                            <span className="font-hebrew">{versePunctuationOf(w.hebrewText)}</span>
                          </>
                        ) : (
                          w.hebrewText
                        )}
                      </span>

                      {/* Per-word transliteration */}
                      {w.transliteration && (
                        <span
                          dir="ltr"
                          lang="la"
                          style={{ fontSize: `${9 * textScale}px` }}
                          className="font-normal italic text-muted-foreground leading-none mt-2.5 pb-2.5 tracking-tight block"
                        >
                          {w.transliteration}
                        </span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <WordTooltipContent word={w} side="bottom" />
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
