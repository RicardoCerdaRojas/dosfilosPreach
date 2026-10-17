/**
 * DiscoveryModePage
 *
 * Main page for the "Modo Descubrimiento" flow.
 * The student selects a verse, the analysis runs silently, then words are
 * presented one-by-one for detective investigation. After all words are
 * investigated, the student composes a full translation and compares it
 * against the expert analysis.
 *
 * Flow:  idle → preparing → investigating → composing → comparing
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpenIcon,
  MenuIcon,
  ArrowRightIcon,
  SearchIcon,
  SendIcon,
} from 'lucide-react';
import { useRecentVerses, addRecentVerse } from './hooks/useRecentVerses';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { GrammaticalCategory } from '@dosfilos/domain';
import { HEBREW_BOOKS_CATALOG } from '@dosfilos/infrastructure';
import type { TutorMode } from './HebrewTutorPage';

import { useDiscoveryMode } from './hooks/useDiscoveryMode';
import { VerseSelector } from './components/VerseSelector';
import { VerseNavBar } from './components/VerseNavBar';
import { ModeSelectorInline } from './components/ModeSelectorInline';
import { HebrewToolbar } from './components/HebrewToolbar';
import { HebrewLoadingTips } from './components/HebrewLoadingTips';
import { VerbDetectivePanel } from './components/VerbDetectivePanel';
import { NominalDetectivePanel } from './components/NominalDetectivePanel';
import { DiscoveryWordStepper } from './components/discovery/DiscoveryWordStepper';
import { TranslationBuilder } from './components/discovery/TranslationBuilder';
import { TranslationComparison } from './components/discovery/TranslationComparison';
import { ParticleQuickPanel } from './components/discovery/ParticleQuickPanel';
import { DiscoveryEmptyState } from './components/discovery/DiscoveryEmptyState';
import { getGrammaticalCategoryLabel } from './utils/grammarLabels';

// ── Word category routing ─────────────────────────────────────────────────────

const VERB_CATEGORIES = new Set([GrammaticalCategory.VERB]);

const NOMINAL_CATEGORIES = new Set([
  GrammaticalCategory.NOUN,
  GrammaticalCategory.PROPER_NOUN,
  GrammaticalCategory.ADJECTIVE,
  GrammaticalCategory.PRONOUN,
  GrammaticalCategory.PERSONAL_PRONOUN,
  GrammaticalCategory.DEMONSTRATIVE_PRONOUN,
  GrammaticalCategory.RELATIVE_PRONOUN,
]);

function getDetectiveType(category: GrammaticalCategory): 'verb' | 'nominal' | 'particle' {
  if (VERB_CATEGORIES.has(category)) return 'verb';
  if (NOMINAL_CATEGORIES.has(category)) return 'nominal';
  return 'particle';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DiscoveryModePageProps {
  mode: TutorMode;
  onModeChange: (mode: TutorMode) => void;
  toolbarCollapsed: boolean;
  onToggleToolbar: () => void;
}

export const DiscoveryModePage: React.FC<DiscoveryModePageProps> = ({
  mode,
  onModeChange,
  toolbarCollapsed,
  onToggleToolbar,
}) => {
  const { t } = useTranslation('hebrewTutor');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Font size scale
  const [textScale, setTextScale] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('discoveryTextScale') || '1') || 1;
    } catch { return 1; }
  });

  const updateTextScale = useCallback((delta: number) => {
    setTextScale(prev => {
      const next = Math.max(0.7, Math.min(2.5, prev + delta));
      try { localStorage.setItem('discoveryTextScale', next.toString()); } catch (_e) { /* localStorage unavailable (e.g. private mode) */ }
      return next;
    });
  }, []);

  // Detective panel state
  const [detectiveOpen, setDetectiveOpen] = useState(false);
  const [detectiveType, setDetectiveType] = useState<'verb' | 'nominal' | 'particle'>('particle');

  const dm = useDiscoveryMode();
  const { recents, refresh: refreshRecents } = useRecentVerses();

  // Register verse in history when the comparing phase starts
  React.useEffect(() => {
    if (dm.phase === 'comparing' && dm.selectedBook) {
      addRecentVerse(dm.selectedBook, dm.selectedChapter, dm.selectedVerse);
      refreshRecents();
    }
  }, [dm.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentBookName =
    HEBREW_BOOKS_CATALOG.find((b) => b.morphhbKey === dm.selectedBook)?.nameSpanish ?? dm.selectedBook;

  /** Prev/next words for contextual display in the detective hero card */
  const detectiveAdjacentWords = useMemo(() => {
    if (!dm.activeWord || dm.activeWordIndex < 0) return undefined;
    const words = dm.discoveryWords;
    const idx = dm.activeWordIndex;
    const prev = idx > 0 ? words[idx - 1]?.word : null;
    const next = idx < words.length - 1 ? words[idx + 1]?.word : null;
    return {
      prev: prev ? { hebrewText: prev.hebrewText, transliteration: prev.transliteration } : null,
      next: next ? { hebrewText: next.hebrewText, transliteration: next.transliteration } : null,
    };
  }, [dm.activeWord, dm.activeWordIndex, dm.discoveryWords]);

  // ── Detective routing ──────────────────────────────────────────────────

  const openDetective = useCallback(() => {
    if (!dm.activeWord) return;
    const type = getDetectiveType(dm.activeWord.category);
    setDetectiveType(type);
    setDetectiveOpen(true);
  }, [dm.activeWord]);

  const handleDetectiveClose = useCallback(() => {
    setDetectiveOpen(false);
  }, []);

  const handleParticleComplete = useCallback(
    (translation: string) => {
      dm.completeWord(translation, 100); // Particles always score 100
    },
    [dm],
  );

  // When the existing detective panels close (user clicks X or sheet closes),
  // if the word has no translation yet, prompt for one via the stepper
  const handleDetectiveCloseWithTranslation = useCallback(() => {
    setDetectiveOpen(false);
    // The detective is closing; the student can provide a translation 
    // via the word click → re-open detective pattern
  }, []);

  // Word click on stepper (for reviewing completed words)
  const handleWordClick = useCallback(
    (_index: number) => {
      // Currently we only allow reviewing, not re-investigating
    },
    [],
  );

  // ── Composing phase submit ─────────────────────────────────────────────

  const handleComposingSubmit = useCallback(() => {
    dm.submitTranslation();
  }, [dm]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full">

      {/* ── Professional toolbar ─────────────────────────────────────────── */}
      <HebrewToolbar
        collapsed={toolbarCollapsed}
        onToggle={onToggleToolbar}
        collapsedSummary={
          <>
            <SearchIcon className="w-3.5 h-3.5 text-primary/60 shrink-0" />
            <span className="font-medium text-foreground/70">{t('discovery.translationMode')}</span>
            {dm.selectedBook && (
              <>
                <span className="text-border">·</span>
                <span className="font-semibold text-foreground">
                  {currentBookName} {dm.selectedChapter}:{dm.selectedVerse}
                </span>
              </>
            )}
          </>
        }
      >
        {/* Mode selector */}
        <ModeSelectorInline mode={mode} onModeChange={onModeChange} />

        <div className="h-5 w-px bg-border/50 shrink-0" />

        {/* Desktop navbar */}
        <div className="hidden md:flex flex-1 min-w-0">
          <VerseNavBar
            selectedBook={dm.selectedBook}
            selectedChapter={dm.selectedChapter}
            selectedVerse={dm.selectedVerse}
            bookIndex={dm.bookIndex}
            isLoadingIndex={dm.isLoadingIndex}
            isAnalyzing={dm.phase === 'preparing'}
            onBookChange={dm.setBook}
            onChapterChange={dm.setChapter}
            onVerseChange={dm.setVerse}
            onNavigate={dm.navigate}
            onAnalyze={() => dm.startDiscovery()}
            onNext={dm.nextVerse}
            onPrev={dm.prevVerse}
          />
        </div>

        {/* Font size controls */}
        <div className="hidden md:flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => updateTextScale(-0.15)}
            disabled={textScale <= 0.7}
            className="px-2 py-1 rounded-md text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
            title={t('discovery.fontSize.smaller')}
          >A-</button>
          <button
            onClick={() => updateTextScale(0.15)}
            disabled={textScale >= 2.5}
            className="px-2 py-1 rounded-md text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
            title={t('discovery.fontSize.larger')}
          >A+</button>
        </div>

        {/* Mobile: sheet trigger */}
        <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors shrink-0">
              <MenuIcon className="w-3.5 h-3.5" />
              <span>{currentBookName} {dm.selectedChapter}:{dm.selectedVerse}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader className="pb-4 border-b border-border/50">
              <SheetTitle className="flex items-center gap-2">
                <BookOpenIcon className="w-4 h-4 text-primary" />
                {t('discovery.navigator')}
              </SheetTitle>
              <SheetDescription>
                {t('discovery.navigatorDesc')}
              </SheetDescription>
            </SheetHeader>
            <div className="pt-4">
              <VerseSelector
                selectedBook={dm.selectedBook}
                selectedChapter={dm.selectedChapter}
                selectedVerse={dm.selectedVerse}
                bookIndex={dm.bookIndex}
                isLoadingBook={dm.isLoadingIndex}
                onBookChange={dm.setBook}
                onChapterChange={dm.setChapter}
                onVerseChange={dm.setVerse}
                onNavigate={dm.navigate}
                onAnalyze={() => { dm.startDiscovery(); setIsMobileSheetOpen(false); }}
                isAnalyzing={dm.phase === 'preparing'}
              />
            </div>
          </SheetContent>
        </Sheet>
      </HebrewToolbar>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Error banner */}
        {dm.error && (
          <div className="mb-4 flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <span className="text-destructive text-lg">⚠</span>
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">{dm.error}</p>
            </div>
            <button
              onClick={dm.clearError}
              className="text-destructive/60 hover:text-destructive text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Phase: Preparing (loading screen) */}
        {dm.phase === 'preparing' && <HebrewLoadingTips />}

        {dm.phase === 'investigating' && dm.activeWord && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Hebrew verse display */}
            <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-muted/40 via-background to-primary/5 p-4 sm:p-5 text-center">
              <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-[0.2em] mb-2">
                {dm.verseDisplayReference}
              </p>
              <p
                dir="rtl"
                lang="he"
                className="leading-loose text-foreground/90 transition-all duration-300"
                style={{
                  fontFamily: "'SBL Hebrew', 'Ezra SIL', serif",
                  fontSize: `${1.75 * textScale}rem` // base text-2xl/3xl approx
                }}
              >
                {/* Highlight the active word within the verse */}
                {dm.discoveryWords.map((dw, i) => (
                  <span
                    key={i}
                    className={`
                      inline px-0.5 transition-all duration-300
                      ${i === dm.activeWordIndex
                        ? 'text-primary font-bold underline decoration-primary/40 decoration-2 underline-offset-4'
                        : dw.status === 'completed'
                          ? 'text-success/80'
                          : 'text-foreground/40'
                      }
                    `}
                  >
                    {dw.word.hebrewText}
                    {i < dm.discoveryWords.length - 1 && ' '}
                  </span>
                ))}
              </p>
            </div>

            {/* Word stepper */}
            <DiscoveryWordStepper
              words={dm.discoveryWords}
              activeWordIndex={dm.activeWordIndex}
              onWordClick={handleWordClick}
            />

            {/* ── Active word spotlight ── */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-3xl" />

              <div className="relative rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6 sm:p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                      {t('discovery.investigate.wordN', {
                        n: dm.activeWordIndex + 1,
                        total: dm.totalWords,
                      })}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <span
                      dir="rtl"
                      lang="he"
                      className="font-semibold text-primary drop-shadow-sm transition-all duration-500"
                      style={{ 
                        fontFamily: "'SBL Hebrew', 'Ezra SIL', serif",
                        fontSize: `${3.75 * textScale}rem` // base text-6xl approx
                      }}
                    >
                      {dm.activeWord.hebrewText}
                    </span>

                    {/* Transliteration hint */}
                    {dm.activeWord.transliteration && (
                      <span className="text-xs text-muted-foreground/60 italic tracking-wide">
                        {dm.activeWord.transliteration}
                      </span>
                    )}
                  </div>

                  {/* Category + grammatical info */}
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <span className="text-[11px] font-semibold text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
                      {getGrammaticalCategoryLabel(dm.activeWord.category)}
                    </span>
                    {dm.activeWord.root && (
                      <span className="text-[11px] text-muted-foreground/70 bg-muted/20 px-2 py-1 rounded-lg border border-border/30">
                        <span dir="rtl" lang="he" style={{ fontFamily: "'SBL Hebrew', 'Ezra SIL', serif" }}>
                          {dm.activeWord.root}
                        </span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={openDetective}
                    className="mt-2 flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-primary-solid text-primary-foreground font-bold text-sm shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:bg-primary-solid-hover active:scale-[0.97] transition-all duration-200"
                  >
                    <SearchIcon className="w-4.5 h-4.5" />
                    {t('discovery.investigate.start')}
                  </button>
                </div>
              </div>
            </div>

            {/* Translation builder */}
            <TranslationBuilder
              words={dm.discoveryWords}
              verseReference={dm.verseDisplayReference}
              completedCount={dm.completedCount}
              totalWords={dm.totalWords}
            />

            {/* Finish investigation button */}
            {dm.completedCount === dm.totalWords && dm.totalWords > 0 && (
              <div className="flex items-center justify-center py-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button
                  onClick={dm.finishInvestigation}
                  className="flex items-center gap-2.5 px-10 py-3.5 rounded-2xl bg-success text-success-foreground font-bold text-sm shadow-xl shadow-success/20 hover:shadow-success/30 hover:bg-success/90 active:scale-[0.97] transition-all duration-200"
                >
                  <ArrowRightIcon className="w-4 h-4" />
                  {t('discovery.investigate.finish')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Phase: Composing */}
        {dm.phase === 'composing' && (
          <div className="space-y-5 max-w-2xl mx-auto animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-foreground">
                {t('discovery.compose.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('discovery.compose.description')}
              </p>
            </div>

            {/* Hebrew text reference */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                {dm.verseDisplayReference}
              </p>
              <p
                dir="rtl"
                lang="he"
                className="leading-loose font-hebrew text-foreground transition-all duration-300"
                style={{ 
                  fontFamily: "'SBL Hebrew', 'Ezra SIL', serif",
                  fontSize: `${1.5 * textScale}rem` // base text-2xl approx
                }}
              >
                {dm.hebrewVerse?.hebrewText ?? dm.discoveryWords.map(w => w.word.hebrewText).join(' ')}
              </p>
            </div>

            {/* Word translations summary */}
            <div className="flex flex-wrap gap-2 justify-center" dir="rtl">
              {dm.discoveryWords.map((dw, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-muted/30 border border-border/40"
                >
                  <span
                    dir="rtl"
                    lang="he"
                    className="font-semibold text-foreground transition-all duration-300"
                    style={{ 
                      fontFamily: "'SBL Hebrew', 'Ezra SIL', serif",
                      fontSize: `${1.125 * textScale}rem` // base text-lg approx
                    }}
                  >
                    {dw.word.hebrewText}
                  </span>
                  <span className="text-[10px] text-success font-medium">
                    {dw.studentTranslation || '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Full translation textarea */}
            <textarea
              value={dm.studentFullTranslation}
              onChange={(e) => dm.setStudentFullTranslation(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors resize-none"
              placeholder={t('discovery.compose.placeholder')}
            />

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleComposingSubmit}
                disabled={!dm.studentFullTranslation.trim()}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary-solid text-primary-foreground font-bold text-sm shadow-lg hover:bg-primary-solid-hover disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                <SendIcon className="w-4 h-4" />
                {t('discovery.compose.submit')}
              </button>
            </div>
          </div>
        )}

        {/* Phase: Comparing */}
        {dm.phase === 'comparing' && dm.expertAnalysis && (
          <TranslationComparison
            studentFullTranslation={dm.studentFullTranslation}
            expertAnalysis={dm.expertAnalysis}
            discoveryWords={dm.discoveryWords}
            onReset={dm.reset}
            onNextVerse={() => {
              dm.nextVerse();
              // After navigating, need to start discovery on new verse
            }}
          />
        )}

        {/* Phase: Idle (empty state) */}
        {dm.phase === 'idle' && !dm.error && (
          <DiscoveryEmptyState
            onQuickStart={(b, c, v) => dm.navigate(b, c, v)}
            openMobileSheet={() => setIsMobileSheetOpen(true)}
            recents={recents}
          />
        )}
      </main>

      {/* ── Detective panels ─────────────────────────────────────────────── */}
      {detectiveType === 'verb' && (
        <VerbDetectivePanel
          word={dm.activeWord}
          verseReference={dm.verseDisplayReference}
          isOpen={detectiveOpen}
          onClose={handleDetectiveCloseWithTranslation}
          adjacentWords={detectiveAdjacentWords}
          onDiscoveryComplete={(translation, score) => {
            dm.completeWord(translation, score);
            setDetectiveOpen(false);
          }}
        />
      )}

      {detectiveType === 'nominal' && (
        <NominalDetectivePanel
          word={dm.activeWord}
          verseReference={dm.verseDisplayReference}
          isOpen={detectiveOpen}
          onClose={handleDetectiveCloseWithTranslation}
          adjacentWords={detectiveAdjacentWords}
          onDiscoveryComplete={(translation, score) => {
            dm.completeWord(translation, score);
            setDetectiveOpen(false);
          }}
        />
      )}

      {detectiveType === 'particle' && (
        <ParticleQuickPanel
          word={dm.activeWord}
          isOpen={detectiveOpen}
          onClose={handleDetectiveClose}
          onComplete={handleParticleComplete}
        />
      )}
    </div>
  );
};
