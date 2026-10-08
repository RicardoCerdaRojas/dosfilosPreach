/**
 * VersePicker — libro › capítulo › versículo y ◀ ▶, compartido por los
 * módulos de hebreo y de griego (pedido del fundador, 2026-10-08: «que sean
 * uniformes»). Nació como la barra del analizador hebreo; el griego usaba los
 * `Select` genéricos, que con muchos versículos se salían de la pantalla.
 *
 * Capítulos y versículos se eligen en una grilla de números con altura
 * máxima y scroll propio; el libro, en una lista con buscador.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PickerBook {
    key: string;
    name: string;
    /** Texto chico a la derecha (la clave morphhb en hebreo). */
    hint?: string;
}

// ── Dropdown ────────────────────────────────────────────────────────────────

const NavDropdown: React.FC<{
    label: string;
    disabled?: boolean;
    testId?: string;
    children: (close: () => void) => React.ReactNode;
}> = ({ label, disabled, testId, children }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const fuera = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                data-testid={testId}
                onClick={() => !disabled && setOpen(p => !p)}
                disabled={disabled}
                aria-expanded={open}
                className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-border/60 bg-background',
                    'hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                    open ? 'border-primary/50 bg-primary/5 text-primary' : 'text-foreground',
                )}
            >
                {label}
                <ChevronDownIcon className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden min-w-[200px]">
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    );
};

// ── Libro: lista con buscador ───────────────────────────────────────────────

const BookPicker: React.FC<{ books: readonly PickerBook[]; selected: string; onChange: (key: string) => void }> = ({
    books,
    selected,
    onChange,
}) => {
    const { t } = useTranslation('common');
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const q = query.toLowerCase();
    const filtrados = q ? books.filter(b => b.name.toLowerCase().includes(q) || b.key.toLowerCase().includes(q)) : books;

    return (
        <div className="flex flex-col w-60 max-h-80">
            <div className="p-2 border-b border-border">
                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t('versePicker.searchBook')}
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                </div>
            </div>
            <div className="overflow-y-auto flex-1">
                {filtrados.map(b => (
                    <button
                        type="button"
                        key={b.key}
                        onClick={() => onChange(b.key)}
                        className={cn(
                            'w-full text-left px-3 py-2 text-sm flex justify-between items-center transition-colors',
                            selected === b.key ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-foreground',
                        )}
                    >
                        <span>{b.name}</span>
                        {b.hint && <span className="text-[10px] text-muted-foreground font-mono">{b.hint}</span>}
                    </button>
                ))}
                {filtrados.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">{t('versePicker.noResults')}</p>}
            </div>
        </div>
    );
};

// ── Capítulo / versículo: grilla de números ─────────────────────────────────

const NumberPicker: React.FC<{ numbers: readonly number[]; selected: number; onChange: (n: number) => void }> = ({
    numbers,
    selected,
    onChange,
}) => {
    const cols = numbers.length > 50 ? 8 : numbers.length > 20 ? 6 : 5;
    return (
        <div className="p-2 overflow-y-auto max-h-[260px]" style={{ width: `${cols * 40 + 16}px` }} data-testid="number-picker">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {numbers.map(n => (
                    <button
                        type="button"
                        key={n}
                        onClick={() => onChange(n)}
                        className={cn(
                            'aspect-square rounded-md text-xs font-semibold flex items-center justify-center transition-all',
                            selected === n ? 'bg-primary text-primary-foreground shadow scale-105' : 'bg-muted/50 hover:bg-muted text-foreground',
                        )}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ── La barra ────────────────────────────────────────────────────────────────

export interface VersePickerProps {
    books: readonly PickerBook[];
    book: string;
    chapter: number;
    verse: number;
    /** Capítulos del libro y versículos del capítulo actual (vacío mientras carga). */
    chapters: readonly number[];
    versesInChapter: number;
    onNavigate: (book: string, chapter: number, verse: number) => void;
    onPrev: () => void;
    onNext: () => void;
    canPrev?: boolean;
    canNext?: boolean;
    /** Deshabilita todo (p. ej., mientras se analiza). */
    disabled?: boolean;
    /** El índice del libro todavía no llegó: capítulo y versículo esperan. */
    loadingIndex?: boolean;
}

export const VersePicker: React.FC<VersePickerProps> = ({
    books,
    book,
    chapter,
    verse,
    chapters,
    versesInChapter,
    onNavigate,
    onPrev,
    onNext,
    canPrev = true,
    canNext = true,
    disabled = false,
    loadingIndex = false,
}) => {
    const { t } = useTranslation('common');
    const nombre = books.find(b => b.key === book)?.name ?? t('versePicker.chooseBook');
    const sinIndice = disabled || loadingIndex || chapters.length === 0;
    const versiculos = Array.from({ length: versesInChapter }, (_, i) => i + 1);
    const flecha =
        'p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed';

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <NavDropdown label={nombre} disabled={disabled} testId="picker-book">
                {close => <BookPicker books={books} selected={book} onChange={k => { close(); onNavigate(k, 1, 1); }} />}
            </NavDropdown>
            <span className="text-muted-foreground/40 text-sm select-none">›</span>
            <NavDropdown label={t('versePicker.chapterShort', { n: chapter })} disabled={sinIndice} testId="picker-chapter">
                {close => <NumberPicker numbers={chapters} selected={chapter} onChange={c => { close(); onNavigate(book, c, 1); }} />}
            </NavDropdown>
            <span className="text-muted-foreground/40 text-sm select-none">›</span>
            <NavDropdown label={t('versePicker.verseShort', { n: verse })} disabled={sinIndice} testId="picker-verse">
                {close => <NumberPicker numbers={versiculos} selected={verse} onChange={v => { close(); onNavigate(book, chapter, v); }} />}
            </NavDropdown>
            <div className="h-5 w-px bg-border/60 mx-1" />
            <div className="flex items-center gap-1">
                <button type="button" onClick={onPrev} disabled={!canPrev || sinIndice} title={t('versePicker.prevVerse')} aria-label={t('versePicker.prevVerse')} className={flecha}>
                    <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button type="button" onClick={onNext} disabled={!canNext || sinIndice} title={t('versePicker.nextVerse')} aria-label={t('versePicker.nextVerse')} className={flecha}>
                    <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
