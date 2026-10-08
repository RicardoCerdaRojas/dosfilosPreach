/**
 * HebrewTutorContext
 *
 * Provides instantiated use cases to the Hebrew Tutor components.
 * Follows the same dependency-injection pattern as GreekTutorProvider.
 */

import { languageStructureProvider } from '@/components/language-structure/provider';
import React, { createContext, useContext, useMemo } from 'react';
import {
  MorphhbBibleProvider,
  HebrewAnalysisService,
  FirebaseHebrewSessionRepository,
  FirestoreDetectiveSessionRepository,
} from '@dosfilos/infrastructure';
import { FirebaseLexiconRepository } from './lexicon/FirebaseLexiconRepository';
import {
  AnalyzeVerseUseCase,
  GetBibleNavigationUseCase,
  GetVerseTextUseCase,
  SaveDetectiveSessionUseCase,
  UpdateVerseTranslationUseCase,
} from '@dosfilos/application';

interface HebrewTutorContextType {
  analyzeVerse: AnalyzeVerseUseCase;
  getBibleNavigation: GetBibleNavigationUseCase;
  getVerseText: GetVerseTextUseCase;
  /** El análisis guardado, reconciliado con morphhb, sin llamar al modelo. */
  checkCache: (input: { morphhbKey: string; chapter: number; verse: number }) => Promise<import('@dosfilos/domain').VerseAnalysis | null>;
  saveDetectiveSession: SaveDetectiveSessionUseCase;
  updateVerseTranslation: UpdateVerseTranslationUseCase;
}

const HebrewTutorContext = createContext<HebrewTutorContextType | null>(null);

export function useHebrewTutor(): HebrewTutorContextType {
  const ctx = useContext(HebrewTutorContext);
  if (!ctx) throw new Error('useHebrewTutor must be used inside HebrewTutorProvider');
  return ctx;
}

export const HebrewTutorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sin clave: el análisis sale por el proxy del servidor (callable `runLlmPrompt`).
  const value = useMemo<HebrewTutorContextType>(() => {
    const bibleProvider = new MorphhbBibleProvider();
    const analysisService = new HebrewAnalysisService();
    const sessionRepository = new FirebaseHebrewSessionRepository();
    const detectiveRepository = new FirestoreDetectiveSessionRepository();
    const lexiconRepository = new FirebaseLexiconRepository();

    // Cast to include loadBook — MorphhbBibleProvider exposes it publicly
    const provider = bibleProvider as typeof bibleProvider & { loadBook(key: string): Promise<void> };

    const analyzeVerse = new AnalyzeVerseUseCase(provider, analysisService, sessionRepository, lexiconRepository, languageStructureProvider);

    return {
      analyzeVerse,
      getBibleNavigation: new GetBibleNavigationUseCase(provider),
      getVerseText: new GetVerseTextUseCase(provider),
      checkCache: (input) => analyzeVerse.cachedOnly(input),
      saveDetectiveSession: new SaveDetectiveSessionUseCase(detectiveRepository),
      updateVerseTranslation: new UpdateVerseTranslationUseCase(sessionRepository),
    };
  }, []);

  return <HebrewTutorContext.Provider value={value}>{children}</HebrewTutorContext.Provider>;
};
