/**
 * VerseNavBar
 *
 * Persistent horizontal navigation bar for the verse analyzer.
 * Replaces the Sheet-based VerseSelector on desktop (md+).
 *
 * Layout:
 *   [ Buscar ]  |  VersePicker: [ Libro ▾ ] › [ Cap. N ▾ ] › [ v. N ▾ ]  |  [◀] [▶]  |  [✦ Analizar]
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { HEBREW_BOOKS_CATALOG } from '@dosfilos/infrastructure';
import type { BookIndex } from '@dosfilos/domain';
import { SparklesIcon, LoaderIcon } from 'lucide-react';
import { VerseSearchInput } from './VerseSearchInput';
import { VersePicker, type PickerBook } from '@/components/bible-nav/VersePicker';

const LIBROS: PickerBook[] = HEBREW_BOOKS_CATALOG.map(b => ({ key: b.morphhbKey, name: b.nameSpanish, hint: b.morphhbKey }));

interface VerseNavBarProps {
  selectedBook: string;
  selectedChapter: number;
  selectedVerse: number;
  bookIndex: BookIndex | null;
  isLoadingIndex: boolean;
  isAnalyzing: boolean;
  onBookChange: (key: string) => void;
  onChapterChange: (chapter: number) => void;
  onVerseChange: (verse: number) => void;
  onNavigate: (book: string, chapter: number, verse: number) => void;
  onAnalyze: () => void;
  onNext: () => void;
  onPrev: () => void;
}

// ── Main bar ────────────────────────────────────────────────────────────────

export const VerseNavBar: React.FC<VerseNavBarProps> = ({
  selectedBook,
  selectedChapter,
  selectedVerse,
  bookIndex,
  isLoadingIndex,
  isAnalyzing,
  onBookChange,
  onChapterChange,
  onVerseChange,
  onNavigate,
  onAnalyze,
  onNext,
  onPrev,
}) => {
  const { t } = useTranslation('hebrewTutor');

  const currentBookName =
    HEBREW_BOOKS_CATALOG.find((b) => b.morphhbKey === selectedBook)?.nameSpanish || 'Seleccionar Libro';

  const chapterCount = bookIndex?.versesPerChapter?.length ?? 1;
  const versesInChapter = bookIndex?.versesPerChapter?.[selectedChapter - 1] ?? 1;

  const isFirst = selectedChapter === 1 && selectedVerse === 1;
  const isLast =
    bookIndex &&
    selectedChapter === chapterCount &&
    selectedVerse === versesInChapter;

  return (
    <div className="flex items-center gap-2 flex-wrap print:hidden">
      {/* ── Quick search ── */}
      <VerseSearchInput
        onNavigate={onNavigate}
        disabled={isAnalyzing}
        placeholder="Ir a versículo…"
        inputClassName="w-44"
      />

      <div className="h-5 w-px bg-border/60 mx-1" />

      {/* ── Libro › capítulo › versículo y ◀ ▶ — compartido con el griego ── */}
      <VersePicker
        books={LIBROS}
        book={selectedBook}
        chapter={selectedChapter}
        verse={selectedVerse}
        chapters={bookIndex ? Array.from({ length: chapterCount }, (_, i) => i + 1) : []}
        versesInChapter={versesInChapter}
        onNavigate={onNavigate}
        onPrev={onPrev}
        onNext={onNext}
        canPrev={!isFirst}
        canNext={!isLast}
        disabled={isAnalyzing}
        loadingIndex={isLoadingIndex}
      />

      {/* ── Divider ── */}
      <div className="h-5 w-px bg-border/60 mx-1" />

      {/* ── Analyze ── */}
      <button
        type="button"
        id="ht-analyze-btn"
        onClick={onAnalyze}
        disabled={isAnalyzing || isLoadingIndex || !selectedBook}
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isAnalyzing ? (
          <>
            <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
            {t('verseAnalyzer.analyzing')}
          </>
        ) : isLoadingIndex ? (
          <>
            <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
            Cargando...
          </>
        ) : selectedBook ? (
          <>
            <SparklesIcon className="w-3.5 h-3.5" />
            {currentBookName} {selectedChapter}:{selectedVerse}
          </>
        ) : (
          <>
            <SparklesIcon className="w-3.5 h-3.5" />
            {t('verseAnalyzer.analyze')}
          </>
        )}
      </button>
    </div>
  );
};
