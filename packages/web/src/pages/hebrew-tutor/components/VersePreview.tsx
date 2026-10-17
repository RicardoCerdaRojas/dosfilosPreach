/**
 * VersePreview
 *
 * Shown when the student navigates (◀/▶) to a verse that has no cached
 * analysis. Displays the raw Hebrew text and basic word tokens from MorphHB
 * (lemma + OSHB morph code), giving the student information to start
 * reading the verse before triggering the full AI analysis.
 */

import React from 'react';
import type { HebrewVerse } from '@dosfilos/domain';
import { SparklesIcon, LoaderIcon } from 'lucide-react';

interface VersePreviewProps {
  verse: HebrewVerse;
  isLoading: boolean;
  onAnalyze: () => void;
}

export const VersePreview: React.FC<VersePreviewProps> = ({ verse, isLoading, onAnalyze }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <LoaderIcon className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando versículo...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* ── Hebrew text ── */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
          {verse.displayReference}
        </p>
        <p
          dir="rtl"
          lang="he"
          className="text-3xl leading-loose font-hebrew text-foreground"
          style={{ fontFamily: "'SBL Hebrew', 'Ezra SIL', serif" }}
        >
          {verse.hebrewText}
        </p>
        <p className="text-xs text-muted-foreground mt-4 italic">
          Texto hebreo desde MorphHB — sin análisis aún
        </p>
      </div>

      {/* ── Word tokens ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Palabras del versículo
        </h3>
        <div className="flex flex-wrap gap-2">
          {verse.words.map((word, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border border-border/60 bg-background hover:border-primary/30 transition-colors"
            >
              <span
                dir="rtl"
                lang="he"
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "'SBL Hebrew', 'Ezra SIL', serif" }}
              >
                {word.text}
              </span>
              {word.lemma && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {word.lemma}
                </span>
              )}
              {word.oshbMorphCode && (
                <span className="text-[9px] text-primary/60 font-mono">
                  {word.oshbMorphCode}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Analyze CTA ── */}
      <div className="flex items-center justify-center pt-2">
        <button
          id="ht-preview-analyze-btn"
          onClick={onAnalyze}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-solid text-primary-foreground font-semibold text-sm shadow hover:bg-primary-solid-hover active:scale-[0.98] transition-all"
        >
          <SparklesIcon className="w-4 h-4" />
          Analizar este versículo
        </button>
      </div>
    </div>
  );
};
