import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon, XIcon } from 'lucide-react';
import { HEBREW_BOOKS_CATALOG } from '@dosfilos/infrastructure';
import { verseSuggestions, type VerseSuggestion } from './buscarVersiculo';

interface VerseSearchInputProps {
  onNavigate: (book: string, chapter: number, verse: number) => void;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
}

export const VerseSearchInput: React.FC<VerseSearchInputProps> = ({
  onNavigate,
  disabled,
  placeholder = 'Ir a versículo…',
  inputClassName = '',
}) => {
  const { t } = useTranslation('hebrewTutor');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => verseSuggestions(query, HEBREW_BOOKS_CATALOG), [query]);
  // Con algo escrito, la lista se abre siempre: con sugerencias o con «no lo encontré» (antes callaba).
  const escrito = query.trim().length >= 2;

  useEffect(() => {
    setActiveIdx(0);
    setOpen(escrito);
  }, [suggestions, escrito]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (s: VerseSuggestion) => {
    setQuery('');
    setOpen(false);
    onNavigate(s.bookKey, s.chapter, s.verse);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (suggestions.length === 0) return;
    // Enter va a la primera sugerencia aunque la lista esté cerrada (después de Escape o de un clic afuera).
    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = open ? suggestions[activeIdx] : suggestions[0];
      if (selected) select(selected);
    } else if (!open) {
      return;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <SearchIcon className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => escrito && setOpen(true)}
          aria-label={t('verseAnalyzer.verseSearch.label')}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-8 pr-7 py-1.5 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 transition-all disabled:opacity-40 placeholder:text-muted-foreground/60 ${inputClassName}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden w-72">
          {suggestions.length === 0 && (
            <p className="m-0 px-3 py-2.5 text-sm text-muted-foreground" role="status" data-testid="verse-search-no-match">
              {t('verseAnalyzer.verseSearch.noMatch')}
            </p>
          )}
          {suggestions.map((s, i) => (
            <button
              key={`${s.bookKey}-${s.chapter}-${s.verse}`}
              type="button"
              onClick={() => select(s)}
              className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors text-sm ${
                i === activeIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
              }`}
            >
              <div>
                <span className="font-semibold">{s.bookName}</span>
                <span className="text-muted-foreground ml-1">
                  {s.chapter}:{s.verse}
                </span>
              </div>
              <span
                className="text-base font-hebrew text-muted-foreground/60 shrink-0"
                dir="rtl"
                lang="he"
              >
                {s.nameHebrew}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
