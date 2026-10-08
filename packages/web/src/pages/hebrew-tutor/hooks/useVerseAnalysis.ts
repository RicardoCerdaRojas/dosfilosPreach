/**
 * useVerseAnalysis
 *
 * Hook that drives the verse analysis flow:
 *  - Lazy-loads navigation index for the selected book
 *  - Triggers verse analysis on demand
 *  - Manages loading/error states
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useHebrewTutor } from '../HebrewTutorProvider';
import { useAuthorization } from '../../../hooks/useAuthorization';
import type { VerseAnalysis, BookIndex, HebrewVerse } from '@dosfilos/domain';
import { useTranslation } from 'react-i18next';

interface UseVerseAnalysisState {
  /** Currently selected book key (morphhb key) */
  selectedBook: string;
  selectedChapter: number;
  selectedVerse: number;
  /** Navigation data for the selected book */
  bookIndex: BookIndex | null;
  /** Verse reference string, e.g. "Jonah.3.2" — used for cache updates */
  verseReference: string;
  /** Most recent analysis result */
  analysis: VerseAnalysis | null;
  /** El versículo al que corresponde `analysis` (no el que está seleccionado ahora). */
  analyzedRef: { book: string; chapter: number; verse: number } | null;
  /** Raw Hebrew verse text available without AI (for preview state) */
  hebrewVerse: HebrewVerse | null;
  isLoadingIndex: boolean;
  isAnalyzing: boolean;
  isLoadingVerse: boolean;
  error: string | null;
  canReanalyze: boolean;
}

interface UseVerseAnalysisActions {
  setBook: (key: string) => void;
  setChapter: (chap: number) => void;
  setVerse: (v: number) => void;
  analyze: (forceRefresh?: boolean) => Promise<void>;
  clearError: () => void;
  nextVerse: () => void;
  prevVerse: () => void;
  navigate: (book: string, chapter: number, verse: number) => void;
}

export function useVerseAnalysis(): UseVerseAnalysisState & UseVerseAnalysisActions {
  const { analyzeVerse, getBibleNavigation, getVerseText, checkCache } = useHebrewTutor();
  const { i18n } = useTranslation();
  const language = i18n.language?.startsWith('en') ? 'en' : 'es';

  const [selectedBook, setSelectedBook] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVerse, setSelectedVerse] = useState(1);
  const [bookIndex, setBookIndex] = useState<BookIndex | null>(null);
  const [analysis, setAnalysisState] = useState<VerseAnalysis | null>(null);
  const [analyzedRef, setAnalyzedRef] = useState<UseVerseAnalysisState['analyzedRef']>(null);
  /** El análisis y su versículo cambian juntos: la sección «Estructura» lee el segundo. */
  const setAnalysis = useCallback((a: VerseAnalysis | null, ref: UseVerseAnalysisState['analyzedRef'] = null) => {
    setAnalysisState(a);
    setAnalyzedRef(a ? ref : null);
  }, []);
  /** Cada navegación tiene su número: la respuesta de una anterior que llega tarde se descarta. */
  const navSeq = useRef(0);
  const [hebrewVerse, setHebrewVerse] = useState<HebrewVerse | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingVerse, setIsLoadingVerse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { isAdmin } = useAuthorization();
  const [refreshCounts, setRefreshCounts] = useState<Record<string, number>>({});
  
  const currentKey = `${selectedBook}_${selectedChapter}_${selectedVerse}`;
  const canReanalyze = isAdmin || (refreshCounts[currentKey] || 0) < 2;

  // Load navigation index whenever the book changes.
  // NOTE: Only manages bookIndex/isLoadingIndex.
  // Analysis and verse preview state are managed by navigateToVerse.
  useEffect(() => {
    if (!selectedBook) {
      setBookIndex(null);
      setIsLoadingIndex(false);
      return;
    }

    let cancelled = false;
    setIsLoadingIndex(true);
    setBookIndex(null);

    getBibleNavigation
      .getBookIndex(selectedBook)
      .then(({ bookIndex }) => {
        if (!cancelled) setBookIndex(bookIndex);
      })
      .catch((err) => {
        if (!cancelled)
          setError(`No se pudo cargar el libro: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingIndex(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBook]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh && !canReanalyze) {
        setError('Límite de actualizaciones alcanzado para este versículo.');
        return;
      }
      
      setIsAnalyzing(true);
      setError(null);
      const seq = navSeq.current;
      try {
        const result = await analyzeVerse.execute({
          morphhbKey: selectedBook,
          chapter: selectedChapter,
          verse: selectedVerse,
          language,
          forceRefresh,
        });

        if (forceRefresh && !isAdmin) {
          setRefreshCounts((prev) => ({
            ...prev,
            [currentKey]: (prev[currentKey] || 0) + 1,
          }));
        }

        // Si mientras tanto se navegó a otro versículo, este resultado ya no es el de la pantalla.
        if (seq !== navSeq.current) return;
        setAnalysis(result, { book: selectedBook, chapter: selectedChapter, verse: selectedVerse });
      } catch (err) {
        setError(
          `Error al analizar el versículo: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [analyzeVerse, selectedBook, selectedChapter, selectedVerse, canReanalyze, currentKey, isAdmin],
  );

  /**
   * Core navigation action.
   * 1. Clears current analysis and preview.
   * 2. Updates selected coordinates.
   * 3. Checks Firebase cache → loads full analysis if hit.
   * 4. Falls back to raw MorphHB verse text for preview if miss.
   *
   * All state changes triggered by user selection (dropdowns OR ◀/▶)
   * go through this single function.
   */
  const navigateToVerse = useCallback(
    async (book: string, chapter: number, verse: number) => {
      const seq = ++navSeq.current;
      setAnalysis(null);
      setHebrewVerse(null);
      setSelectedBook(book);
      setSelectedChapter(chapter);
      setSelectedVerse(verse);

      setIsLoadingVerse(true);
      try {
        const cached = await checkCache({ morphhbKey: book, chapter, verse });
        if (seq !== navSeq.current) return;
        if (cached) {
          setAnalysis(cached, { book, chapter, verse });
          return;
        }
        const verseData = await getVerseText.execute({ morphhbKey: book, chapter, verse });
        if (seq !== navSeq.current) return;
        setHebrewVerse(verseData);
      } catch (err) {
        console.warn('[useVerseAnalysis] Could not load verse preview:', err);
      } finally {
        if (seq === navSeq.current) setIsLoadingVerse(false);
      }
    },
    [checkCache, getVerseText],
  );

  /** Changes book and resets to chapter 1, verse 1. */
  const setBook = useCallback(
    (key: string) => void navigateToVerse(key, 1, 1),
    [navigateToVerse],
  );

  /** Changes chapter and resets to verse 1. */
  const setChapter = useCallback(
    (chap: number) => void navigateToVerse(selectedBook, chap, 1),
    [navigateToVerse, selectedBook],
  );

  /** Changes verse within the current chapter. */
  const setVerse = useCallback(
    (v: number) => void navigateToVerse(selectedBook, selectedChapter, v),
    [navigateToVerse, selectedBook, selectedChapter],
  );

  const nextVerse = useCallback(() => {
    if (!bookIndex) return;
    const versesInChapter = bookIndex.versesPerChapter[selectedChapter - 1] ?? 1;
    const totalChapters = bookIndex.versesPerChapter.length;
    if (selectedVerse < versesInChapter) {
      void navigateToVerse(selectedBook, selectedChapter, selectedVerse + 1);
    } else if (selectedChapter < totalChapters) {
      void navigateToVerse(selectedBook, selectedChapter + 1, 1);
    }
  }, [bookIndex, selectedBook, selectedChapter, selectedVerse, navigateToVerse]);

  const prevVerse = useCallback(() => {
    if (!bookIndex) return;
    if (selectedVerse > 1) {
      void navigateToVerse(selectedBook, selectedChapter, selectedVerse - 1);
    } else if (selectedChapter > 1) {
      const prevChapterVerses = bookIndex.versesPerChapter[selectedChapter - 2] ?? 1;
      void navigateToVerse(selectedBook, selectedChapter - 1, prevChapterVerses);
    }
  }, [bookIndex, selectedBook, selectedChapter, selectedVerse, navigateToVerse]);

  return {
    selectedBook,
    selectedChapter,
    selectedVerse,
    verseReference: `${selectedBook}.${selectedChapter}.${selectedVerse}`,
    bookIndex,
    analysis,
    analyzedRef,
    hebrewVerse,
    isLoadingIndex,
    isAnalyzing,
    isLoadingVerse,
    error,
    canReanalyze,
    setBook,
    setChapter,
    setVerse,
    analyze,
    navigate: (b, c, v) => void navigateToVerse(b, c, v),
    nextVerse,
    prevVerse,
    clearError: () => setError(null),
  };
}
