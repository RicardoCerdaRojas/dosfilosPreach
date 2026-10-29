import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    buildPassageReference,
    parsePassageReference,
    formatPassageReference,
    getAllBooks,
    versesInChapter,
    type BibleBookId,
    type BibleCanonBook,
    type PassageReference,
    type ParseResult,
} from '@dosfilos/domain';

type Stage = 'book' | 'chapter' | 'verse';

export interface BiblePassageBuilderProps {
    value: PassageReference | null;
    onResult: (result: ParseResult | null) => void;
    displayLanguage: 'es' | 'en';
    t: (key: string, opts?: Record<string, unknown>) => string;
}

/**
 * Integrated drill-down picker. Single surface — book → chapter →
 * verse range — with a typeable search bar that always parses freeform
 * "Heb 12:1-2" into the same `PassageReference` shape the stages
 * produce. Auto-advances on each pick so the user never moves between
 * mouse and keyboard mid-flow.
 *
 * Design notes:
 *   - **No chapter range UI.** Exegesis papers are 99% within one
 *     chapter; the dual-input UX cost wasn't worth the rare benefit.
 *     Free-text mode in the parent still accepts cross-chapter ranges
 *     for power users.
 *   - **Verse grid expands on demand.** Default 50 buttons covers all
 *     but the longest chapters; "Mostrar más" reveals 50 more (Psalm
 *     119 needs 176 — handled).
 *   - **Search bar is multi-purpose.** Book stage: filters book list.
 *     Chapter / verse stages: parses anything that looks like a full
 *     reference (`heb 12:1-2`) and snaps the stages forward.
 *   - **Single-chapter books skip the chapter stage** (Phm, 2-3Jn,
 *     Jud, Obadiah). The stage flow re-routes invisibly.
 */
export function BiblePassageBuilder({
    value,
    onResult,
    displayLanguage,
    t,
}: BiblePassageBuilderProps) {
    const allBooks = useMemo(() => getAllBooks(), []);
    const labelFor = (b: BibleCanonBook) => (displayLanguage === 'en' ? b.nameEn : b.nameEs);

    const [bookId, setBookId] = useState<BibleBookId | null>(value?.bookId ?? null);
    const [chapter, setChapter] = useState<number | null>(value?.chapterStart ?? null);
    const [verseStart, setVerseStart] = useState<number | null>(value?.verseStart ?? null);
    const [verseEnd, setVerseEnd] = useState<number | null>(value?.verseEnd ?? null);
    const [stage, setStage] = useState<Stage>(() => {
        if (!value) return 'book';
        if (value.verseStart === null) return 'verse';
        return 'verse';
    });
    const [query, setQuery] = useState('');
    const [verseGridSize, setVerseGridSize] = useState(50);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const selectedBook = useMemo(
        () => (bookId ? allBooks.find(b => b.id === bookId) ?? null : null),
        [bookId, allBooks],
    );

    // ── Push results upward whenever the parts produce a valid ref ─────
    useEffect(() => {
        if (!bookId || chapter === null) {
            onResult(null);
            return;
        }
        const result = buildPassageReference({
            bookId,
            chapterStart: chapter,
            chapterEnd: chapter,
            verseStart,
            verseEnd: verseEnd ?? verseStart ?? null,
        }, { strictVerses: true });
        onResult(result);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId, chapter, verseStart, verseEnd]);

    // ── Search bar: try to parse the query as a full reference ─────────
    // Whenever the user types something that looks like a complete
    // ref ("heb 12:1-2"), snap the staged state to it and jump to verse
    // stage so they see the result without hunting through buttons.
    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 3) return;
        const parsed = parsePassageReference(trimmed, { strictVerses: true });
        if (!parsed.ok) return;
        // Only snap when the parser produced a same-chapter ref — this
        // matches our drill-down's single-chapter scope. For
        // cross-chapter requests the user should switch to free-text
        // mode in the parent.
        if (parsed.ref.chapterStart !== parsed.ref.chapterEnd) return;
        setBookId(parsed.ref.bookId);
        setChapter(parsed.ref.chapterStart);
        setVerseStart(parsed.ref.verseStart);
        setVerseEnd(parsed.ref.verseEnd);
        setStage('verse');
        setQuery('');
    }, [query]);

    // ── Auto-focus the search input on mount + on stage change ─────────
    // Keeps the keyboard-first flow alive: the input always has focus
    // unless the user is mid-click, so typing starts working
    // immediately.
    useEffect(() => {
        inputRef.current?.focus();
    }, [stage]);

    // ── Stage transitions ──────────────────────────────────────────────
    const pickBook = (id: BibleBookId) => {
        const book = allBooks.find(b => b.id === id);
        if (!book) return;
        setBookId(id);
        setChapter(null);
        setVerseStart(null);
        setVerseEnd(null);
        setQuery('');
        // Single-chapter book → skip the chapter grid.
        if (book.chapterCount === 1) {
            setChapter(1);
            setStage('verse');
            return;
        }
        setStage('chapter');
    };

    const pickChapter = (ch: number) => {
        setChapter(ch);
        setVerseStart(null);
        setVerseEnd(null);
        setQuery('');
        setVerseGridSize(50);
        setStage('verse');
    };

    const pickVerse = (v: number) => {
        // Three click states:
        //   - No selection yet → set as start.
        //   - Start set, no end → set as end (creates range or single).
        //   - Range set → reset to single-verse start.
        if (verseStart === null) {
            setVerseStart(v);
            setVerseEnd(null);
            return;
        }
        if (verseEnd === null) {
            // Second click sets the end. Normalize order so clicks
            // can be in either direction.
            if (v === verseStart) {
                setVerseEnd(v);
                return;
            }
            const lo = Math.min(verseStart, v);
            const hi = Math.max(verseStart, v);
            setVerseStart(lo);
            setVerseEnd(hi);
            return;
        }
        // Range exists — start over with this verse.
        setVerseStart(v);
        setVerseEnd(null);
    };

    const clearVerseSelection = () => {
        setVerseStart(null);
        setVerseEnd(null);
    };

    const goBack = () => {
        if (stage === 'verse') {
            // Single-chapter books go straight back to book.
            if (selectedBook?.chapterCount === 1) {
                setStage('book');
                setBookId(null);
                setChapter(null);
                setVerseStart(null);
                setVerseEnd(null);
                return;
            }
            setStage('chapter');
            setVerseStart(null);
            setVerseEnd(null);
            return;
        }
        if (stage === 'chapter') {
            setStage('book');
            setBookId(null);
            setChapter(null);
            return;
        }
    };

    return (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            {/* ── Header: search + breadcrumb ─────────────────────────── */}
            <div className="border-b border-slate-100 dark:border-zinc-800/80 px-3 py-2.5 flex items-center gap-2">
                {stage !== 'book' && (
                    <button
                        type="button"
                        onClick={goBack}
                        aria-label={t('setup.passage.back')}
                        className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                )}
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                        stage === 'book'
                            ? t('setup.passage.builder.searchBook')
                            : stage === 'chapter'
                                ? t('setup.passage.builder.searchChapter')
                                : t('setup.passage.builder.searchVerse')
                    }
                    spellCheck={false}
                    autoComplete="off"
                    className="flex-1 bg-transparent text-[14px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
                <Breadcrumb
                    selectedBook={selectedBook}
                    chapter={chapter}
                    verseStart={verseStart}
                    verseEnd={verseEnd}
                    labelFor={labelFor}
                    stage={stage}
                    onJumpTo={(s) => {
                        if (s === 'book') {
                            setBookId(null);
                            setChapter(null);
                            setVerseStart(null);
                            setVerseEnd(null);
                            setStage('book');
                        } else if (s === 'chapter' && selectedBook && selectedBook.chapterCount > 1) {
                            setVerseStart(null);
                            setVerseEnd(null);
                            setStage('chapter');
                        }
                    }}
                />
            </div>

            {/* ── Body ─────────────────────────────────────────────────── */}
            <div className="p-3">
                {stage === 'book' && (
                    <BookStage
                        books={allBooks}
                        labelFor={labelFor}
                        query={query}
                        onPick={pickBook}
                        currentBookId={bookId}
                        t={t}
                    />
                )}
                {stage === 'chapter' && selectedBook && (
                    <ChapterStage
                        book={selectedBook}
                        labelFor={labelFor}
                        query={query}
                        currentChapter={chapter}
                        onPick={pickChapter}
                    />
                )}
                {stage === 'verse' && selectedBook && chapter !== null && (
                    <VerseStage
                        book={selectedBook}
                        labelFor={labelFor}
                        chapter={chapter}
                        verseStart={verseStart}
                        verseEnd={verseEnd}
                        onPick={pickVerse}
                        onClear={clearVerseSelection}
                        gridSize={verseGridSize}
                        onExpandGrid={() => setVerseGridSize((s) => s + 50)}
                        t={t}
                    />
                )}
            </div>
        </div>
    );
}

// ── Breadcrumb ─────────────────────────────────────────────────────

function Breadcrumb({
    selectedBook,
    chapter,
    verseStart,
    verseEnd,
    labelFor,
    stage,
    onJumpTo,
}: {
    selectedBook: BibleCanonBook | null;
    chapter: number | null;
    verseStart: number | null;
    verseEnd: number | null;
    labelFor: (b: BibleCanonBook) => string;
    stage: Stage;
    onJumpTo: (s: Stage) => void;
}) {
    if (!selectedBook) return null;
    return (
        <div className="ml-auto inline-flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400 max-w-[55%] overflow-hidden">
            <button
                type="button"
                onClick={() => onJumpTo('book')}
                className={cn(
                    'truncate hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors',
                    stage === 'book' && 'text-emerald-700 dark:text-emerald-300 font-medium',
                )}
            >
                {labelFor(selectedBook)}
            </button>
            {chapter !== null && (
                <>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <button
                        type="button"
                        onClick={() => onJumpTo('chapter')}
                        disabled={selectedBook.chapterCount === 1}
                        className={cn(
                            'tabular-nums hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors disabled:hover:text-current disabled:cursor-default',
                            stage === 'chapter' && 'text-emerald-700 dark:text-emerald-300 font-medium',
                        )}
                    >
                        {chapter}
                    </button>
                </>
            )}
            {verseStart !== null && (
                <>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span className="tabular-nums text-emerald-700 dark:text-emerald-300 font-medium">
                        {verseEnd && verseEnd !== verseStart
                            ? `${verseStart}-${verseEnd}`
                            : verseStart}
                    </span>
                </>
            )}
        </div>
    );
}

// ── Stage 1: Book picker ───────────────────────────────────────────

function BookStage({
    books,
    labelFor,
    query,
    currentBookId,
    onPick,
    t,
}: {
    books: BibleCanonBook[];
    labelFor: (b: BibleCanonBook) => string;
    query: string;
    currentBookId: BibleBookId | null;
    onPick: (id: BibleBookId) => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    const filtered = useMemo(() => {
        if (!query.trim()) return books;
        const q = query.trim().toLowerCase();
        return books.filter(b =>
            b.id.toLowerCase().includes(q) ||
            b.nameEs.toLowerCase().includes(q) ||
            b.nameEn.toLowerCase().includes(q) ||
            b.aliases.some(a => a.toLowerCase().includes(q)),
        );
    }, [books, query]);

    const ot = filtered.filter(b => b.testament === 'OT');
    const nt = filtered.filter(b => b.testament === 'NT');

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[340px] overflow-y-auto pr-1">
            {ot.length > 0 && (
                <div className="col-span-full">
                    <SectionHeading>{t('setup.passage.testamentOt')}</SectionHeading>
                </div>
            )}
            {ot.map(b => (
                <BookButton
                    key={b.id}
                    label={labelFor(b)}
                    selected={currentBookId === b.id}
                    onClick={() => onPick(b.id)}
                />
            ))}
            {nt.length > 0 && (
                <div className="col-span-full mt-2">
                    <SectionHeading>{t('setup.passage.testamentNt')}</SectionHeading>
                </div>
            )}
            {nt.map(b => (
                <BookButton
                    key={b.id}
                    label={labelFor(b)}
                    selected={currentBookId === b.id}
                    onClick={() => onPick(b.id)}
                />
            ))}
            {filtered.length === 0 && (
                <p className="col-span-full text-center text-xs text-slate-400 dark:text-slate-500 py-6">
                    —
                </p>
            )}
        </div>
    );
}

function BookButton({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'text-left rounded-md border px-2.5 py-1.5 text-[13px] transition-colors truncate',
                selected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-100 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20',
            )}
        >
            {label}
        </button>
    );
}

// ── Stage 2: Chapter grid ──────────────────────────────────────────

function ChapterStage({
    book,
    labelFor,
    query,
    currentChapter,
    onPick,
}: {
    book: BibleCanonBook;
    labelFor: (b: BibleCanonBook) => string;
    query: string;
    currentChapter: number | null;
    onPick: (ch: number) => void;
}) {
    // Filter chapters by typed digits, e.g. "1" highlights 1, 10, 11 ...
    const typedDigits = query.trim();
    const chapters = useMemo(() => {
        const list = Array.from({ length: book.chapterCount }, (_, i) => i + 1);
        if (!typedDigits) return list;
        return list.filter(n => String(n).startsWith(typedDigits));
    }, [book.chapterCount, typedDigits]);

    return (
        <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-semibold">
                {labelFor(book)} · {book.chapterCount} {book.chapterCount === 1 ? 'cap.' : 'caps.'}
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-1.5 max-h-[320px] overflow-y-auto pr-1">
                {chapters.map(ch => (
                    <NumberButton
                        key={ch}
                        n={ch}
                        selected={currentChapter === ch}
                        onClick={() => onPick(ch)}
                    />
                ))}
                {chapters.length === 0 && (
                    <p className="col-span-full text-center text-xs text-slate-400 dark:text-slate-500 py-6">
                        —
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Stage 3: Verse grid ────────────────────────────────────────────

function VerseStage({
    book,
    labelFor,
    chapter,
    verseStart,
    verseEnd,
    onPick,
    onClear,
    gridSize,
    onExpandGrid,
    t,
}: {
    book: BibleCanonBook;
    labelFor: (b: BibleCanonBook) => string;
    chapter: number;
    verseStart: number | null;
    verseEnd: number | null;
    onPick: (v: number) => void;
    onClear: () => void;
    gridSize: number;
    onExpandGrid: () => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    // Los versículos que el capítulo tiene (TP #9, B1: Santiago 4 mostraba 50
    // y tiene 17). Sin el dato, la grilla de antes, que crece a pedido.
    const total = versesInChapter(book.id, chapter);
    const verses = Array.from({ length: total ?? gridSize }, (_, i) => i + 1);

    const inRange = (v: number): boolean => {
        if (verseStart === null) return false;
        if (verseEnd === null) return v === verseStart;
        const lo = Math.min(verseStart, verseEnd);
        const hi = Math.max(verseStart, verseEnd);
        return v >= lo && v <= hi;
    };

    const isAnchor = (v: number): boolean => verseStart === v || verseEnd === v;

    const hint = verseStart === null
        ? t('setup.passage.builder.verseHint.idle')
        : verseEnd === null
            ? t('setup.passage.builder.verseHint.pickEnd', { start: verseStart })
            : t('setup.passage.builder.verseHint.range', { start: verseStart, end: verseEnd });

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                    {labelFor(book)} {chapter} · {t('setup.passage.builder.verses')}
                </p>
                {(verseStart !== null || verseEnd !== null) && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                        {t('setup.passage.builder.clear')}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                {verses.map(v => (
                    <NumberButton
                        key={v}
                        n={v}
                        selected={inRange(v)}
                        anchor={isAnchor(v)}
                        onClick={() => onPick(v)}
                    />
                ))}
            </div>

            <div className="flex items-center justify-between mt-2">
                <p className="text-[12px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                    {verseStart !== null && verseEnd !== null && verseStart !== verseEnd && (
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span>{hint}</span>
                </p>
                {total === null ? (
                    <button
                        type="button"
                        onClick={onExpandGrid}
                        className="text-[11px] text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 transition-colors"
                    >
                        {t('setup.passage.builder.showMore')}
                    </button>
                ) : (
                    <span className="text-[11px] text-muted-foreground" data-testid="verse-count">{t('setup.passage.verseCount', { count: total })}</span>
                )}
            </div>
        </div>
    );
}

function NumberButton({
    n,
    selected,
    anchor,
    onClick,
}: {
    n: number;
    selected: boolean;
    anchor?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'h-8 rounded-md text-[13px] font-medium tabular-nums transition-colors border',
                selected
                    ? anchor
                        ? 'border-emerald-600 bg-emerald-500 text-white dark:bg-emerald-500'
                        : 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20',
            )}
        >
            {n}
        </button>
    );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            {children}
        </p>
    );
}

// Display helper exported for parent feedback line
export function formatBuilderRef(ref: PassageReference, lang: 'es' | 'en'): string {
    return formatPassageReference(ref, lang);
}
