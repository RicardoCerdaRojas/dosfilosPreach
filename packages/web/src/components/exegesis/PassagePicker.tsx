import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import {
    getBookById,
    parsePassageReference,
    formatPassageReference,
    type PassageReference,
    type ParseResult,
} from '@dosfilos/domain';
import { BiblePassageBuilder } from './BiblePassageBuilder';
import { Button } from '@/components/ui/button';

export interface PassagePickerProps {
    /** Current parsed passage (if any). The parent owns the state. */
    value: PassageReference | null;
    /**
     * Called whenever the user produces a (possibly-invalid) result. When
     * the input parses cleanly, `error` is undefined and `ref` is set;
     * when it doesn't, `ref` is null and `error` describes the problem.
     * The parent decides whether to enable downstream UI based on `ref`.
     */
    onChange: (ref: PassageReference | null, error?: { code: string; hint: string }) => void;
    /** Lock the language used for book display labels. Defaults to UI language. */
    displayLanguage?: 'es' | 'en';
}

/**
 * Date-picker-style passage input.
 *
 * Always-visible text input shows the formatted reference. Focusing the
 * input opens an inline drill-down panel underneath (book → chapter →
 * verse). Picking through the panel writes the formatted ref back into
 * the input; typing in the input live-parses freeform refs ("heb 12:1-2")
 * and feeds them to the panel so the stages stay in sync. The panel
 * closes on:
 *   - "Listo" button click
 *   - Click outside the container
 *   - Escape key
 *   - Enter key in the input (commits the current parsed ref)
 *
 * The committed value travels through `onChange` only when parsing
 * succeeds. While the input holds an unparseable string the parent is
 * told `null` + the error hint, so the wizard's "Continue" CTA stays
 * gated until the user produces a real reference.
 */
export function PassagePicker({
    value,
    onChange,
    displayLanguage,
}: PassagePickerProps) {
    const { t, i18n } = useTranslation('exegesis');
    const lang = displayLanguage ?? (i18n.language?.split('-')[0] === 'en' ? 'en' : 'es');

    // Input text — what the user sees/types. Sync from external `value`
    // changes (e.g. parent reset) but otherwise the user owns it.
    const [inputText, setInputText] = useState<string>(
        value ? formatPassageReference(value, lang) : '',
    );
    const [expanded, setExpanded] = useState<boolean>(false);
    // Last parse attempt of the input text. `null` = empty input.
    const [textParseResult, setTextParseResult] = useState<ParseResult | null>(null);
    // Last result coming from the builder (overrides textParseResult
    // because picking via stages is the authoritative path).
    const [builderResult, setBuilderResult] = useState<ParseResult | null>(null);
    // Bumping this re-mounts the builder so it re-initializes from the
    // current `value`. Useful when the user closes/reopens the panel.
    const [resetSignal, setResetSignal] = useState(0);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // External value → input text sync. Only when the user isn't
    // actively editing (panel closed) so we don't fight typing.
    useEffect(() => {
        if (expanded) return;
        setInputText(value ? formatPassageReference(value, lang) : '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, lang]);

    // Live parse of the input text.
    useEffect(() => {
        const trimmed = inputText.trim();
        if (!trimmed) {
            setTextParseResult(null);
            return;
        }
        // Lo que el estudiante escribe: solo versículos que existen (TP #9, B1).
        setTextParseResult(parsePassageReference(trimmed, { strictVerses: true }));
    }, [inputText]);

    // Push the authoritative result up. Builder result wins when the
    // user is interacting with the panel; otherwise text parse drives.
    const effectiveResult: ParseResult | null = useMemo(() => {
        if (builderResult) return builderResult;
        return textParseResult;
    }, [builderResult, textParseResult]);

    useEffect(() => {
        if (effectiveResult === null) {
            // Empty → null. Parent disables CTA, no error shown.
            onChange(null);
            return;
        }
        if (effectiveResult.ok) {
            onChange(effectiveResult.ref);
        } else {
            onChange(null, { code: effectiveResult.error, hint: effectiveResult.hint });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveResult]);

    // When the builder picks a complete ref, mirror it into the input.
    useEffect(() => {
        if (!builderResult?.ok) return;
        setInputText(formatPassageReference(builderResult.ref, lang));
    }, [builderResult, lang]);

    // Click-outside closes the panel (committing whatever's parsed).
    useEffect(() => {
        if (!expanded) return;
        const handler = (e: MouseEvent | TouchEvent) => {
            const node = containerRef.current;
            if (!node) return;
            if (e.target instanceof Node && node.contains(e.target)) return;
            setExpanded(false);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [expanded]);

    const handleOpen = () => {
        if (expanded) return;
        setResetSignal((s) => s + 1);
        setExpanded(true);
    };

    const handleClose = () => {
        setExpanded(false);
        // Drop the builder result on close so the next open re-derives
        // from the committed value (avoids stale "becameComplete" pings).
        setBuilderResult(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            handleClose();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            // Commit whatever's parsed; don't toggle state if empty.
            if (textParseResult?.ok) {
                handleClose();
            }
        }
    };

    return (
        <div ref={containerRef} className="space-y-2">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => {
                        setInputText(e.target.value);
                        // User typed → reset builder dominance so the
                        // text parse drives until they click stages
                        // again.
                        setBuilderResult(null);
                    }}
                    onFocus={handleOpen}
                    onKeyDown={handleKeyDown}
                    placeholder={t('setup.passage.inputPlaceholder')}
                    spellCheck={false}
                    autoComplete="off"
                    className={cn(
                        'w-full rounded-lg border bg-white dark:bg-zinc-900 pl-9 pr-9 py-2.5 text-[15px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors',
                        textParseResult && !textParseResult.ok
                            ? 'border-rose-300 dark:border-rose-800'
                            : 'border-slate-200 dark:border-zinc-800',
                    )}
                />
                {inputText && (
                    <button
                        type="button"
                        onClick={() => {
                            setInputText('');
                            setBuilderResult(null);
                            inputRef.current?.focus();
                        }}
                        aria-label={t('setup.passage.clear')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {expanded && (
                <div className="space-y-2">
                    <BiblePassageBuilder
                        key={resetSignal}
                        value={textParseResult?.ok ? textParseResult.ref : value}
                        onResult={setBuilderResult}
                        displayLanguage={lang}
                        t={t}
                    />
                    <div className="flex items-center justify-between gap-2">
                        <FeedbackLine result={effectiveResult} lang={lang} t={t} />
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleClose}
                            disabled={!effectiveResult?.ok}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {t('setup.passage.done')}
                        </Button>
                    </div>
                </div>
            )}

            {!expanded && <FeedbackLine result={effectiveResult} lang={lang} t={t} />}
        </div>
    );
}

function FeedbackLine({
    result,
    lang,
    t,
}: {
    result: ParseResult | null;
    lang: 'es' | 'en';
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    if (result === null) {
        return (
            <p className="text-xs text-slate-400 dark:text-slate-500">
                {t('setup.passage.helperHint')}
            </p>
        );
    }
    if (result.ok) {
        return (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                    {t('setup.passage.parsedAs')} <strong>{formatPassageReference(result.ref, lang)}</strong>
                </span>
            </p>
        );
    }
    // El versículo que no existe, dicho en el idioma de la pantalla (TP #9, B1).
    const book = result.limit ? getBookById(result.limit.bookId) : null;
    const mensaje = result.error === 'verse-out-of-range' && result.limit && book
        ? t('setup.passage.errorVerseOutOfRange', { book: lang === 'en' ? book.nameEn : book.nameEs, chapter: result.limit.chapter, count: result.limit.verses, verse: result.limit.verse })
        : result.hint;
    return (
        <p className="inline-flex items-start gap-1.5 text-xs font-medium text-destructive" role="alert">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{mensaje}</span>
        </p>
    );
}
