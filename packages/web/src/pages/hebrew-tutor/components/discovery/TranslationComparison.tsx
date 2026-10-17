/**
 * TranslationComparison
 *
 * Final phase of the Discovery Mode: side-by-side comparison of the student's
 * translation against the expert (Gemini) analysis. Shows:
 *
 *  1. Hebrew text of the verse
 *  2. Student's full translation
 *  3. Expert's literal + fluid translations
 *  4. Word-by-word comparison table
 *  5. Score summary
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VerseAnalysis } from '@dosfilos/domain';
import type { DiscoveryWordState } from '../../hooks/useDiscoveryMode';
import {
  BookOpenIcon,
  CheckCircle2Icon,
  GraduationCapIcon,
  XCircleIcon,
  UserIcon,
  SparklesIcon,
} from 'lucide-react';

interface TranslationComparisonProps {
  readonly studentFullTranslation: string;
  readonly expertAnalysis: VerseAnalysis;
  readonly discoveryWords: readonly DiscoveryWordState[];
  readonly onReset: () => void;
  readonly onNextVerse: () => void;
}

export const TranslationComparison: React.FC<TranslationComparisonProps> = ({
  studentFullTranslation,
  expertAnalysis,
  discoveryWords,
  onReset,
  onNextVerse,
}) => {
  const { t } = useTranslation('hebrewTutor');

  const wordStats = useMemo(() => {
    const withScore = discoveryWords.filter((w) => w.detectiveScore !== undefined);
    const avgScore =
      withScore.length > 0
        ? Math.round(withScore.reduce((sum, w) => sum + (w.detectiveScore ?? 0), 0) / withScore.length)
        : null;

    const exactMatches = discoveryWords.filter((w) => {
      const expert = expertAnalysis.words[w.index]?.translation ?? '';
      return w.studentTranslation.trim().toLowerCase() === expert.trim().toLowerCase();
    }).length;

    return { avgScore, exactMatches, total: discoveryWords.length };
  }, [discoveryWords, expertAnalysis]);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* ── Hebrew verse ── */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          {expertAnalysis.reference}
        </p>
        <p
          dir="rtl"
          lang="he"
          className="text-2xl sm:text-3xl leading-loose font-hebrew text-foreground"
          style={{ fontFamily: "'SBL Hebrew', 'Ezra SIL', serif" }}
        >
          {expertAnalysis.hebrewText}
        </p>
      </div>

      {/* ── Side-by-side translations ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Student */}
        <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/30 dark:bg-indigo-950/20 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {t('discovery.comparison.student', { defaultValue: 'Tu Traducción' })}
            </h4>
          </div>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            {studentFullTranslation || '—'}
          </p>
        </div>

        {/* Expert */}
        <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/20 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              {t('discovery.comparison.expert', { defaultValue: 'Traducción Experta' })}
            </h4>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              {t('discovery.comparison.literal', { defaultValue: 'Literal' })}
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {expertAnalysis.literalTranslation}
            </p>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-2">
              {t('discovery.comparison.fluid', { defaultValue: 'Fluida' })}
            </p>
            <p className="text-sm text-foreground leading-relaxed font-medium">
              {expertAnalysis.fluidTranslation}
            </p>
          </div>
        </div>
      </div>

      {/* ── Score summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {wordStats.avgScore !== null && (
          <div className="rounded-xl border border-border/60 bg-background p-3 text-center">
            <GraduationCapIcon className="w-5 h-5 mx-auto text-indigo-500 mb-1" />
            <p className="text-xl font-bold text-foreground">{wordStats.avgScore}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t('discovery.comparison.avgScore', { defaultValue: 'Puntaje Promedio' })}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-border/60 bg-background p-3 text-center">
          <CheckCircle2Icon className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-xl font-bold text-foreground">
            {wordStats.exactMatches}/{wordStats.total}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {t('discovery.comparison.exactMatches', { defaultValue: 'Coincidencias Exactas' })}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background p-3 text-center">
          <BookOpenIcon className="w-5 h-5 mx-auto text-amber-500 mb-1" />
          <p className="text-xl font-bold text-foreground">{wordStats.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {t('discovery.comparison.totalWords', { defaultValue: 'Palabras Analizadas' })}
          </p>
        </div>
      </div>

      {/* ── Word-by-word table ── */}
      <div className="rounded-2xl border border-border/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('discovery.comparison.wordTable', { defaultValue: 'Comparación por Palabra' })}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                  #
                </th>
                <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                  {t('discovery.comparison.hebrew', { defaultValue: 'Hebreo' })}
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                  {t('discovery.comparison.yours', { defaultValue: 'Tu Trad.' })}
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                  {t('discovery.comparison.reference', { defaultValue: 'Referencia' })}
                </th>
                <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                  ✓
                </th>
              </tr>
            </thead>
            <tbody>
              {discoveryWords.map((dw) => {
                const expert = expertAnalysis.words[dw.index];
                const matches =
                  dw.studentTranslation.trim().toLowerCase() ===
                  (expert?.translation ?? '').trim().toLowerCase();

                return (
                  <tr
                    key={dw.index}
                    className="border-t border-border/30 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{dw.index + 1}</td>
                    <td className="px-4 py-2 text-right" dir="rtl" lang="he">
                      <span
                        className="text-sm font-semibold text-foreground"
                        style={{ fontFamily: "'SBL Hebrew', 'Ezra SIL', serif" }}
                      >
                        {dw.word.hebrewText}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-sm font-medium ${
                          matches ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {dw.studentTranslation || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {expert?.translation ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {matches ? (
                        <CheckCircle2Icon className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-orange-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={onReset}
          className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          {t('discovery.comparison.restart', { defaultValue: 'Reintentar este versículo' })}
        </button>
        <button
          onClick={onNextVerse}
          className="px-6 py-2.5 rounded-xl bg-primary-solid text-primary-foreground text-sm font-semibold shadow hover:bg-primary-solid-hover active:scale-[0.98] transition-all"
        >
          {t('discovery.comparison.next', { defaultValue: 'Siguiente versículo →' })}
        </button>
      </div>
    </div>
  );
};
