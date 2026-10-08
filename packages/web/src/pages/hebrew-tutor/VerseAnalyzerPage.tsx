/**
 * VerseAnalyzerPage
 *
 * Main page for the "Analizador de Versículos" tool.
 *
 * Desktop (md+): persistent VerseNavBar replaces the Sheet modal.
 * Mobile:        compact top bar + improved Sheet drawer.
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpenIcon, MenuIcon, SparklesIcon, SearchIcon, ArrowRightIcon, ClockIcon, BookOpenCheckIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { VerseSelector } from './components/VerseSelector';
import { VerseNavBar } from './components/VerseNavBar';
import { ModeSelectorInline } from './components/ModeSelectorInline';
import { HebrewToolbar } from './components/HebrewToolbar';
import { VerseAnalysisResult } from './components/VerseAnalysisResult';
import { VersePreview } from './components/VersePreview';
import { HebrewLoadingTips } from './components/HebrewLoadingTips';
import { useVerseAnalysis } from './hooks/useVerseAnalysis';
import { addRecentVerse, useRecentVerses } from './hooks/useRecentVerses';
import { HEBREW_BOOKS_CATALOG } from '@dosfilos/infrastructure';
import { hebrewStudySessionRepo } from '@/hooks/useHebrewSessions';
import { useFirebase } from '@/context/firebase-context';
import type { TutorMode } from './HebrewTutorPage';

interface VerseAnalyzerPageProps {
  mode: TutorMode;
  onModeChange: (mode: TutorMode) => void;
  toolbarCollapsed: boolean;
  onToggleToolbar: () => void;
}

export const VerseAnalyzerPage: React.FC<VerseAnalyzerPageProps> = ({
  mode,
  onModeChange,
  toolbarCollapsed,
  onToggleToolbar,
}) => {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false);
  const {
    selectedBook,
    selectedChapter,
    selectedVerse,
    verseReference,
    bookIndex,
    analysis,
    analyzedRef,
    hebrewVerse,
    isLoadingIndex,
    isAnalyzing,
    isLoadingVerse,
    error,
    setBook,
    setChapter,
    setVerse,
    analyze,
    clearError,
    canReanalyze,
    navigate,
    nextVerse,
    prevVerse,
  } = useVerseAnalysis();

  // Las ediciones de traducción se aplican sobre EL análisis que las recibió.
  // Derivado en el mismo render (sin efecto): con un efecto, al navegar se
  // mostraba un render el análisis viejo con la referencia nueva.
  const [ediciones, setEdiciones] = React.useState<{ base: typeof analysis; cambios: { literalTranslation?: string; fluidTranslation?: string } }>({ base: null, cambios: {} });
  const localAnalysis = analysis && ediciones.base === analysis ? { ...analysis, ...ediciones.cambios } : analysis;

  const { recents, refresh } = useRecentVerses();
  const { user } = useFirebase();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get('projectId') || undefined;
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (analysis && selectedBook) {
      addRecentVerse(selectedBook, selectedChapter, selectedVerse);
      refresh();

      // Record per-user activity (idempotent on userId+passage). When the user
      // landed via /dashboard/hebrew-tutor?projectId=X this also links the
      // session to that project automatically.
      if (user?.uid) {
        const passage = `${currentBookName} ${selectedChapter}:${selectedVerse}`;
        hebrewStudySessionRepo
          .recordActivity({
            userId: user.uid,
            passage,
            projectId: projectIdFromUrl,
          })
          .then(() => queryClient.invalidateQueries({ queryKey: ['hebrew', 'sessions'] }))
          .catch((err) => console.warn('[HebrewTutor] could not record activity:', err));
      }
    }
  }, [analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentBookName =
    HEBREW_BOOKS_CATALOG.find((b) => b.morphhbKey === selectedBook)?.nameSpanish ?? selectedBook;

  return (
    <div className="flex flex-col h-full min-h-0 w-full print:block print:h-auto">

      {/* ── Professional toolbar ─────────────────────────────────────────── */}
      <HebrewToolbar
        collapsed={toolbarCollapsed}
        onToggle={onToggleToolbar}
        collapsedSummary={
          <>
            <BookOpenCheckIcon className="w-3.5 h-3.5 text-primary/60 shrink-0" />
            <span className="font-medium text-foreground/70">Analizador</span>
            {selectedBook && (
              <>
                <span className="text-border">·</span>
                <span className="font-semibold text-foreground">
                  {currentBookName} {selectedChapter}:{selectedVerse}
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
            selectedBook={selectedBook}
            selectedChapter={selectedChapter}
            selectedVerse={selectedVerse}
            bookIndex={bookIndex}
            isLoadingIndex={isLoadingIndex}
            isAnalyzing={isAnalyzing}
            onBookChange={setBook}
            onChapterChange={setChapter}
            onVerseChange={setVerse}
            onNavigate={navigate}
            onAnalyze={() => analyze(false)}
            onNext={nextVerse}
            onPrev={prevVerse}
          />
        </div>

        {/* Mobile: sheet trigger */}
        <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors shrink-0">
              <MenuIcon className="w-3.5 h-3.5" />
              <span>{currentBookName} {selectedChapter}:{selectedVerse}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader className="pb-4 border-b border-border/50">
              <SheetTitle className="flex items-center gap-2">
                <BookOpenIcon className="w-4 h-4 text-primary" />
                Navegador Bíblico
              </SheetTitle>
              <SheetDescription>
                Selecciona libro, capítulo y versículo para analizar
              </SheetDescription>
            </SheetHeader>
            <div className="pt-4">
              <VerseSelector
                selectedBook={selectedBook}
                selectedChapter={selectedChapter}
                selectedVerse={selectedVerse}
                bookIndex={bookIndex}
                isLoadingBook={isLoadingIndex}
                onBookChange={setBook}
                onChapterChange={setChapter}
                onVerseChange={setVerse}
                onNavigate={navigate}
                onAnalyze={() => { analyze(false); setIsMobileSheetOpen(false); }}
                isAnalyzing={isAnalyzing}
              />
            </div>
          </SheetContent>
        </Sheet>
      </HebrewToolbar>

      {/* ── Main: analysis result ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 print:overflow-visible print:block print:p-0">
        {error && (
          <div
            id="ht-error-banner"
            className="mb-4 flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-4"
          >
            <span className="text-destructive text-lg">⚠</span>
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
            <button onClick={clearError} className="text-destructive/60 hover:text-destructive text-lg leading-none">
              ×
            </button>
          </div>
        )}

        {isAnalyzing && <HebrewLoadingTips />}

        {!isAnalyzing && localAnalysis && (
          <VerseAnalysisResult
            analysis={localAnalysis}
            verseReference={verseReference}
            structureRef={analyzedRef ?? undefined}
            canForceRefresh={canReanalyze}
            onForceRefresh={() => analyze(true)}
            onTranslationUpdate={(updates) =>
              setEdiciones(prev => ({ base: analysis, cambios: { ...(prev.base === analysis ? prev.cambios : {}), ...updates } }))
            }
          />
        )}

        {!isAnalyzing && !analysis && hebrewVerse && (
          <VersePreview
            verse={hebrewVerse}
            isLoading={isLoadingVerse}
            onAnalyze={() => analyze(false)}
          />
        )}

        {!isAnalyzing && !analysis && !hebrewVerse && !error && (
          <EmptyState
            onQuickStart={(b, c, v) => navigate(b, c, v)}
            openMobileSheet={() => setIsMobileSheetOpen(true)}
            recents={recents}
          />
        )}
      </main>
    </div>
  );
};

// ── Curated quick-start verses ────────────────────────────────────────────────

const QUICK_VERSES = [
  {
    book: 'Gen',  chapter: 1, verse: 1,
    ref: 'Génesis 1:1',  subtitle: 'El principio de todo',
    grammar: 'Verbo Qal · Sust.',  words: 7,  level: 'Introductorio',
    gradient: 'from-blue-500/10 to-indigo-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    iconBg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    levelColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    book: 'Jonah', chapter: 1, verse: 1,
    ref: 'Jonás 1:1',  subtitle: 'Un llamado divino',
    grammar: 'Wayyiqtol · Prepos.',  words: 8,  level: 'Introductorio',
    gradient: 'from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    iconBg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    levelColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    book: 'Ps',  chapter: 23, verse: 1,
    ref: 'Salmos 23:1',  subtitle: 'El Señor es mi pastor',
    grammar: 'Participio · Sufijo pron.',  words: 4,  level: 'Básico',
    gradient: 'from-emerald-500/10 to-teal-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    levelColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    book: 'Gen',  chapter: 3, verse: 10,
    ref: 'Génesis 3:10',  subtitle: 'La desnudez revelada',
    grammar: 'Qal Impf. · Estado constr.',  words: 9,  level: 'Intermedio',
    gradient: 'from-violet-500/10 to-purple-500/10',
    border: 'border-violet-500/20 hover:border-violet-500/40',
    iconBg: 'bg-violet-500/20 text-violet-600 dark:text-violet-400',
    levelColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    book: 'Prov', chapter: 3, verse: 5,
    ref: 'Proverbios 3:5',  subtitle: 'Confía en el Señor',
    grammar: 'Imperativo · Sufijo pron.',  words: 6,  level: 'Básico',
    gradient: 'from-rose-500/10 to-pink-500/10',
    border: 'border-rose-500/20 hover:border-rose-500/40',
    iconBg: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
    levelColor: 'text-rose-600 dark:text-rose-400',
  },
  {
    book: 'Isa',  chapter: 6, verse: 1,
    ref: 'Isaías 6:1',  subtitle: 'La visión del trono',
    grammar: 'Wayyiqtol · Hiphil · Inf.',  words: 12,  level: 'Avanzado',
    gradient: 'from-sky-500/10 to-cyan-500/10',
    border: 'border-sky-500/20 hover:border-sky-500/40',
    iconBg: 'bg-sky-500/20 text-sky-600 dark:text-sky-400',
    levelColor: 'text-sky-600 dark:text-sky-400',
  },
] as const;

// ── Static word preview data (Genesis 1:1) ───────────────────────────────────

const PREVIEW_WORDS = [
  {
    hebrew: 'בְּרֵאשִׁית',
    transliteration: 'bə-rê-šîṯ',
    translation: 'en el principio',
    morphemes: [
      { text: 'בְּ', color: '#2563EB' },
      { text: 'רֵאשִׁית', color: '#64748B' },
    ],
    grammar: 'Prep. + Sust.',
    detail: 'f.sg.abs',
  },
  {
    hebrew: 'בָּרָא',
    transliteration: 'bā-rāʾ',
    translation: 'creó',
    morphemes: [
      { text: 'בָּ', color: '#64748B' },
      { text: 'רָ', color: '#EF4444' },
      { text: 'א', color: '#64748B' },
    ],
    grammar: 'Verbo Qal',
    detail: 'Perfecto 3ms',
  },
  {
    hebrew: 'אֱלֹהִים',
    transliteration: 'ʾĕ-lō-hîm',
    translation: 'Dios',
    morphemes: [
      { text: 'אֱלֹהִ', color: '#64748B' },
      { text: 'ים', color: '#8B5CF6' },
    ],
    grammar: 'Sust.',
    detail: 'm.pl.abs',
  },
];

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{
  onQuickStart: (book: string, chapter: number, verse: number) => void;
  openMobileSheet: () => void;
  recents: import('./hooks/useRecentVerses').RecentVerse[];
}> = ({ onQuickStart, openMobileSheet, recents }) => (
  <div className="flex flex-col items-center justify-center h-full py-8 px-4 max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">

    {/* Analysis preview card */}
    <div className="w-full max-w-2xl mb-8 rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Preview label */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border/40">
        <SparklesIcon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Vista previa del análisis — Génesis 1:1
        </span>
      </div>

      <div className="p-5">
        {/* Hebrew text header */}
        <div
          className="text-3xl md:text-4xl font-hebrew text-center leading-loose mb-4 text-foreground"
          dir="rtl"
          lang="he"
        >
          {PREVIEW_WORDS.map((w) => (
            <span key={w.hebrew} className="mx-1">
              {w.morphemes.map((m, i) => (
                <span key={i} style={{ color: m.color }}>{m.text}</span>
              ))}
            </span>
          ))}
          <span className="mx-1 text-muted-foreground/60">…</span>
        </div>

        {/* Translations */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Literal</div>
            <div className="text-sm text-foreground">En el principio creó Dios…</div>
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5">
            <div className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider mb-1">Fluida</div>
            <div className="text-sm text-foreground">Al inicio de todo, Dios creó…</div>
          </div>
        </div>

        {/* Word cards preview */}
        <div className="grid grid-cols-3 gap-2">
          {PREVIEW_WORDS.map((w) => (
            <div
              key={w.hebrew}
              className="rounded-xl border border-border/50 bg-background/60 p-3 flex flex-col items-center gap-1.5"
            >
              <div className="text-xl font-hebrew" dir="rtl" lang="he">
                {w.morphemes.map((m, i) => (
                  <span key={i} style={{ color: m.color }}>{m.text}</span>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">{w.transliteration}</div>
              <div className="text-xs font-semibold text-foreground text-center">"{w.translation}"</div>
              <div className="mt-auto pt-1 border-t border-border/30 w-full text-center">
                <div className="text-[10px] font-semibold text-primary/80">{w.grammar}</div>
                <div className="text-[10px] text-muted-foreground">{w.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Recent verses */}
    {recents.length > 0 && (
      <div className="w-full max-w-2xl mb-5">
        <div className="flex items-center gap-2 mb-2">
          <ClockIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recientes
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {recents.map((r) => (
            <button
              key={`${r.book}-${r.chapter}-${r.verse}`}
              onClick={() => onQuickStart(r.book, r.chapter, r.verse)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/40 text-sm text-foreground hover:bg-muted hover:border-primary/30 transition-all active:scale-[0.97]"
            >
              <span className="font-medium">{r.bookName} {r.chapter}:{r.verse}</span>
              <ArrowRightIcon className="w-3 h-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Quick Actions */}
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Versículos sugeridos
        </span>
      </div>

      {/* Mobile: search button */}
      <button
        onClick={openMobileSheet}
        className="md:hidden w-full group flex items-center justify-between p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] mb-3"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <SearchIcon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-foreground text-sm">Buscar Pasaje</div>
            <div className="text-xs text-muted-foreground">Abre el navegador</div>
          </div>
        </div>
        <ArrowRightIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </button>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {QUICK_VERSES.map((v) => (
          <button
            key={`${v.book}-${v.chapter}-${v.verse}`}
            onClick={() => onQuickStart(v.book, v.chapter, v.verse)}
            className={`group flex flex-col gap-2 p-3.5 rounded-2xl bg-gradient-to-br ${v.gradient} border ${v.border} shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-foreground text-sm leading-tight">{v.ref}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{v.subtitle}</div>
              </div>
              <ArrowRightIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0 mt-0.5" />
            </div>
            <div className="flex flex-col gap-1 pt-1 border-t border-border/20">
              <div className={`text-[10px] font-semibold ${v.levelColor}`}>{v.level}</div>
              <div className="text-[10px] text-muted-foreground">{v.grammar}</div>
              <div className="text-[10px] text-muted-foreground/70">{v.words} palabras</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);
