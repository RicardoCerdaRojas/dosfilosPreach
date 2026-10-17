import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HEBREW_BOOKS_CATALOG } from '@dosfilos/infrastructure';
import type { BookIndex } from '@dosfilos/domain';
import { SearchIcon, ChevronRightIcon, BookIcon, HashIcon, ListIcon } from 'lucide-react';
import { VerseSearchInput } from './VerseSearchInput';

interface VerseSelectorProps {
  selectedBook: string;
  selectedChapter: number;
  selectedVerse: number;
  bookIndex: BookIndex | null;
  isLoadingBook: boolean;
  onBookChange: (key: string) => void;
  onChapterChange: (chapter: number) => void;
  onVerseChange: (verse: number) => void;
  onNavigate: (book: string, chapter: number, verse: number) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

type TabKey = 'book' | 'chapter' | 'verse';

export const VerseSelector: React.FC<VerseSelectorProps> = ({
  selectedBook,
  selectedChapter,
  selectedVerse,
  bookIndex,
  isLoadingBook,
  onBookChange,
  onChapterChange,
  onVerseChange,
  onNavigate,
  onAnalyze,
  isAnalyzing,
}) => {
  const { t } = useTranslation('hebrewTutor');
  const [activeTab, setActiveTab] = useState<TabKey>('book');
  const [searchQuery, setSearchQuery] = useState('');

  const books = HEBREW_BOOKS_CATALOG;

  const maxVersesInChapter = bookIndex?.versesPerChapter?.[selectedChapter - 1] ?? 1;
  const chapterCount = bookIndex?.versesPerChapter?.length ?? 1;

  const chapterOptions = Array.from({ length: chapterCount }, (_, i) => i + 1);
  const verseOptions = Array.from({ length: maxVersesInChapter }, (_, i) => i + 1);

  const filteredBooks = useMemo(() => {
    if (!searchQuery) return books;
    return books.filter(b => 
      b.nameSpanish.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.nameEnglish.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [books, searchQuery]);

  const handleBookSelect = (bookKey: string) => {
    onNavigate(bookKey, 1, 1);
    setSearchQuery('');
    setActiveTab('chapter');
  };

  const handleChapterSelect = (ch: number) => {
    onNavigate(selectedBook, ch, 1);
    setActiveTab('verse');
  };

  const currentBookName = books.find(b => b.morphhbKey === selectedBook)?.nameSpanish || 'Libro';

  const canAnalyze = !isLoadingBook && !isAnalyzing && selectedBook;

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] bg-background">
      {/* Quick search */}
      <div className="mb-3">
        <VerseSearchInput
          onNavigate={(book, chapter, verse) => {
            onNavigate(book, chapter, verse);
            setActiveTab('verse');
          }}
          disabled={isAnalyzing}
          placeholder="Ir directo… (ej: Salmos 23:1)"
          inputClassName="w-full"
        />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">o navega por pasos</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      {/* Tab Navigation */}
      <div className="flex p-1 bg-muted rounded-xl mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('book')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === 'book' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
        >
          <BookIcon className="w-3.5 h-3.5" /> Libro
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chapter')}
          disabled={!selectedBook}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${activeTab === 'chapter' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
        >
          <HashIcon className="w-3.5 h-3.5" /> Cap
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('verse')}
          disabled={!selectedBook}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${activeTab === 'verse' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
        >
          <ListIcon className="w-3.5 h-3.5" /> Ver
        </button>
      </div>

      {/* Breadcrumb Info */}
      <div className="flex items-center justify-center text-sm font-medium text-foreground mb-4 bg-primary/5 py-2 rounded-xl text-primary/80 border border-primary/10">
        {currentBookName} <ChevronRightIcon className="w-4 h-4 mx-1 opacity-50" /> {selectedChapter} <ChevronRightIcon className="w-4 h-4 mx-1 opacity-50" /> {selectedVerse}
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto mb-4 border border-border/50 rounded-xl bg-card">
        {activeTab === 'book' && (
          <div className="p-3 flex flex-col h-full">
            <div className="relative mb-3">
              <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Buscar libro..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1">
              {filteredBooks.map((book) => (
                <button
                  type="button"
                  key={book.morphhbKey}
                  onClick={() => handleBookSelect(book.morphhbKey)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center ${selectedBook === book.morphhbKey ? 'bg-primary-solid text-primary-foreground font-semibold' : 'hover:bg-muted text-foreground'}`}
                >
                  <span>{book.nameSpanish}</span>
                  <span className={`text-xs ${selectedBook === book.morphhbKey ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{book.morphhbKey}</span>
                </button>
              ))}
              {filteredBooks.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">No se encontraron libros</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chapter' && (
          <div className="p-4">
            {isLoadingBook ? (
              <div className="flex justify-center items-center py-12">
                <span className="inline-block h-6 w-6 border-2 border-primary border-r-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {chapterOptions.map((ch) => (
                  <button
                    type="button"
                    key={'ch'+ch}
                    onClick={() => handleChapterSelect(ch)}
                    className={`aspect-square rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${selectedChapter === ch ? 'bg-primary-solid text-primary-foreground shadow-md scale-105' : 'bg-muted/50 hover:bg-muted text-foreground'}`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'verse' && (
          <div className="p-4">
            {isLoadingBook ? (
              <div className="flex justify-center items-center py-12">
                <span className="inline-block h-6 w-6 border-2 border-primary border-r-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {verseOptions.map((v) => (
                  <button
                    type="button"
                    key={'v'+v}
                    onClick={() => onVerseChange(v)}
                    className={`aspect-square rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${selectedVerse === v ? 'bg-primary-solid text-primary-foreground shadow-md scale-105' : 'bg-muted/50 hover:bg-muted text-foreground'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Analyze button */}
      <button
        type="button"
        id="ht-analyze-btn"
        onClick={onAnalyze}
        disabled={!canAnalyze}
        className="w-full h-12 rounded-xl bg-primary-solid text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-solid-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
      >
        {isLoadingBook ? (
          <>
            <span className="inline-block h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
            Cargando libro...
          </>
        ) : isAnalyzing ? (
          <>
            <span className="inline-block h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
            Analizando...
          </>
        ) : selectedBook ? (
          <>
            <span>✦</span>
            {currentBookName} {selectedChapter}:{selectedVerse}
          </>
        ) : (
          <>
            <span>✦</span>
            Selecciona un versículo
          </>
        )}
      </button>
    </div>
  );
};
