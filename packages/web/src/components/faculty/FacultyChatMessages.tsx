import React, { useEffect, useState } from 'react';
import { Sparkles, MessageSquareQuote, Trash2, Loader2, GraduationCap, Copy, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useTranslation } from '@/i18n';
import type { SourceReference, ConcreteResponseMode, SupportedLanguage } from '@dosfilos/domain';
import { resolveLocalized } from '@dosfilos/domain';
import { extractCitations, CitationSup, Bibliography, wrapLanguageRuns, transformCallouts, Callout, wrapScriptureRefs, ScriptureRef, normalizeAssistantMarkdown } from '@/lib/citations';
import { useModeMeta } from './FacultyChatHeader';
import { useAuthorization } from '@/hooks/useAuthorization';
import { PromoverElementoButton } from './estudio-madre/PromoverElementoButton';
import { SeleccionPromoverToolbar } from './estudio-madre/SeleccionPromoverToolbar';

interface AttachmentMeta {
    filename: string;
    mimeType: string;
    sizeBytes: number;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    sources?: SourceReference[];
    modeUsed?: ConcreteResponseMode;
    modeWasAuto?: boolean;
    attachments?: AttachmentMeta[];
}

function formatAttachmentSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Small badge shown below a response when the mode was auto-inferred by the router.
 * Non-intrusive hint so the user understands why a particular style/length was chosen
 * and can override if needed.
 */
function InferredModeBadge({ mode }: { mode: ConcreteResponseMode }) {
    const { t } = useTranslation('faculty');
    const modeMeta = useModeMeta();
    const meta = modeMeta[mode];
    if (!meta) return null;
    const Icon = meta.icon;
    return (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>{t('chat.inferredModeLabel')}</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Icon className={cn("h-3 w-3", meta.iconColor)} />
                {meta.label}
            </span>
        </div>
    );
}

/**
 * Renders an assistant message: transforms inline citations into numbered superscripts
 * with a Popover preview, and appends a Bibliography panel at the bottom.
 */
function AssistantMessageContent({ content, sources, isAdmin }: { content: string; sources?: SourceReference[]; isAdmin: boolean }) {
    const { rendered, citations, protectedSourcesCount } = React.useMemo(() => {
        // Pipeline: normalize → citations → scripture refs → callouts → hebrew/greek language tagging.
        // Order matters: citations have a latin format that scripture regex won't match;
        // scripture must run before language tagging so the wrapping span stays intact.
        //
        // Step 0 (normalize) repairs malformed assistant markdown where
        // multi-line blockquotes arrive on a single line with literal
        // " > " separators. Without it, ReactMarkdown renders the raw
        // `>` characters as text instead of structured blockquotes.
        // Idempotent on well-formed responses.
        //
        // Gating: non-admin users only see citations whose source has `publiclyCitable=true`
        // (per-document flag managed by admin in Core Library). Citations of private/
        // pending-licensed material are stripped entirely from the prose, and those
        // sources are excluded from the Bibliography panel.
        const step0 = normalizeAssistantMarkdown(content);
        const step1 = extractCitations(step0, sources ?? [], { onlyCitableSources: !isAdmin });
        const step2 = wrapScriptureRefs(step1.rendered);
        const step3 = transformCallouts(step2);
        const step4 = wrapLanguageRuns(step3);
        // Count protected sources (only relevant for non-admin readers — admin
        // sees the real attribution in the citation list itself).
        const protectedCount = isAdmin
            ? 0
            : (sources ?? []).filter(s => s.publiclyCitable !== true).length;
        return { rendered: step4, citations: step1.citations, protectedSourcesCount: protectedCount };
    }, [content, sources, isAdmin]);

    return (
        <>
            <div className={cn(
                // Measure (line length) is capped on the bubble card itself
                // (max-w-[42rem] ≈ 68ch) — robust regardless of the typography
                // plugin's default; prose fills that capped card.
                "prose prose-slate prose-sm md:prose-base dark:prose-invert max-w-none break-words",
                // Modern sans body (Inter) — clean, contemporary chat feel
                "font-sans",
                // Comfortable leading for sans long-form reading
                "prose-p:leading-[1.7]",
                // Tighter leading AND margins inside lists — dense bullets read better than airy ones
                "prose-li:leading-normal prose-li:my-0.5",
                "prose-ul:my-3 prose-ol:my-3",
                "prose-li:marker:text-muted-foreground",
                // Refined heading hierarchy — tight, heavier, clear scale steps
                "prose-headings:font-sans prose-headings:tracking-tight prose-headings:font-semibold",
                "prose-h2:text-[1.15em] prose-h2:mt-5 prose-h2:mb-2",
                "prose-h3:text-[1.02em] prose-h3:mt-4 prose-h3:mb-1.5",
                "prose-strong:text-foreground prose-strong:font-semibold",
                // Tables (paradigms, conjugations) — cleaner borders
                "prose-table:text-sm prose-th:bg-muted"
            )}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        sup: (props: any) => <CitationSup citations={citations} {...props} />,
                        div: (props: any) => {
                            if (props['data-callout']) return <Callout {...props} />;
                            return <div {...props} />;
                        },
                        span: (props: any) => {
                            if (props['data-scripture']) return <ScriptureRef {...props} />;
                            return <span {...props} />;
                        },
                    }}
                >
                    {rendered}
                </ReactMarkdown>
            </div>
            <Bibliography citations={citations} protectedSourcesCount={protectedSourcesCount} />
        </>
    );
}

interface ActiveAgent {
    name: string;
}

interface FacultyChatMessagesProps {
    messages: ChatMessage[];
    isNewSession: boolean;
    isStreaming: boolean;
    isSending: boolean;
    /** Message id currently being deleted; only that row shows a spinner. */
    deletingMessageId: string | null;
    streamingMessage: string;
    activeAgents: ActiveAgent[];
    agentNameForNew: string;
    /** Asks the page to open the delete-confirmation dialog for this message. */
    onRequestDeleteMessage: (messageId: string) => void;
    /**
     * Copies the message body to clipboard; the page handles the toast.
     * Receives both the raw markdown (for plain-text paste) and the
     * message id (used to look up the rendered DOM for rich-text paste).
     */
    onCopyMessage: (content: string, messageId: string) => void;
    /**
     * Sesión activa. Cuando está presente, cada mensaje gana el gesto de
     * "promover a elemento" del Estudio Madre (spec v1.3 §2.4). Ausente en el
     * estado nuevo/sin sesión materializada.
     */
    sessionId?: string;
}

export function FacultyChatMessages({
    messages,
    isNewSession,
    isStreaming,
    isSending,
    deletingMessageId,
    streamingMessage,
    activeAgents,
    agentNameForNew,
    onRequestDeleteMessage,
    onCopyMessage,
    sessionId,
}: FacultyChatMessagesProps) {
    const { t, language } = useTranslation('faculty');
    const activeLanguage: SupportedLanguage = language === 'en' ? 'en' : 'es';
    // Citations are gated to admin users while book licensing approval is pending.
    // Non-admin users see the prose without inline `(Autor, "Título", p. N)` markers
    // and without the Bibliography panel.
    // Admin sees citations from all sources; non-admin only sees citations whose
    // source is marked `publiclyCitable=true` in the Core Library.
    const { isAdmin } = useAuthorization();

    // Provenance highlight — triggered by an extraction's "Ver origen"
    // action that navigates with `#origin=msg1,msg2,...`. Each id gets
    // a scroll-into-view + temporary indigo ring so the user sees which
    // turns produced the artifact they're looking at.
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        const apply = () => {
            const hash = window.location.hash;
            const match = hash.match(/origin=([^&]+)/);
            if (!match) return;
            const ids = match[1].split(',').filter(Boolean);
            if (ids.length === 0) return;
            setHighlightedIds(new Set(ids));
            // Defer scroll so the messages have rendered with their
            // data-message-id attributes.
            setTimeout(() => {
                const first = ids[0];
                const node = document.querySelector(`[data-message-id="${CSS.escape(first)}"]`);
                node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            // Auto-fade after 6s and strip the hash so a reload doesn't
            // re-trigger the highlight.
            setTimeout(() => {
                setHighlightedIds(new Set());
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }, 6000);
        };
        apply();
        window.addEventListener('hashchange', apply);
        return () => window.removeEventListener('hashchange', apply);
    }, [messages.length]);

    return (
        <>
            {sessionId && <SeleccionPromoverToolbar sessionId={sessionId} />}
            {/* New-session blank state */}
            {isNewSession && !isStreaming && !isSending && (
                <div className="text-center py-20 text-muted-foreground">
                    <div className="w-16 h-16 mx-auto bg-warning/20 rounded-full flex items-center justify-center mb-4">
                        <GraduationCap className="w-8 h-8 text-warning" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('chat.emptyNewTitle', { agentName: agentNameForNew })}</h3>
                    <p className="max-w-md mx-auto">{t('chat.emptyNewDescription')}</p>
                </div>
            )}

            {/* Existing session blank state */}
            {!isNewSession && messages.length === 0 && !isStreaming && !isSending && (
                <div className="text-center py-20 text-muted-foreground">
                    <div className="w-16 h-16 mx-auto bg-primary/15 rounded-full flex items-center justify-center mb-4">
                        <GraduationCap className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('chat.emptyExistingTitle')}</h3>
                    <p className="max-w-md mx-auto">{t('chat.emptyExistingDescription')}</p>
                </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
                <div key={i} className={cn("flex w-full gap-4 group", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    {msg.role !== 'user' && (
                        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 mt-3 shadow-sm">
                            <MessageSquareQuote className="h-4 w-4 text-primary" />
                        </div>
                    )}
                    <div
                        data-message-id={msg.id || undefined}
                        className={cn(
                            "relative text-[15px] leading-relaxed transition-shadow duration-500",
                            msg.role === 'user'
                                ? "bg-primary-solid text-primary-foreground rounded-3xl rounded-tr-sm px-6 py-3.5 max-w-[85%] md:max-w-[70%] shadow-sm font-medium"
                                : "w-full max-w-[42rem] min-w-0 bg-card border border-border shadow-sm rounded-3xl rounded-tl-sm px-6 py-5",
                            msg.id && highlightedIds.has(msg.id) && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                    >
                        {msg.role === 'user' ? (
                            <>
                                {msg.content && (
                                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                )}
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className={cn("flex flex-wrap gap-1.5", msg.content ? "mt-2" : "")}>
                                        {msg.attachments.map((att, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/20 transition-colors px-2.5 py-1 text-[12px]"
                                                title={`${att.filename} · ${formatAttachmentSize(att.sizeBytes)}`}
                                            >
                                                <Paperclip className="h-3 w-3 opacity-80" />
                                                <span className="truncate max-w-[200px]">{att.filename}</span>
                                                <span className="opacity-70">· {formatAttachmentSize(att.sizeBytes)}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <AssistantMessageContent content={msg.content} sources={msg.sources} isAdmin={isAdmin} />
                                {msg.modeWasAuto && msg.modeUsed && <InferredModeBadge mode={msg.modeUsed} />}
                            </>
                        )}

                        {msg.id && (
                            <div
                                className={cn(
                                    "absolute top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                                    msg.role === 'user' ? "-left-[5.25rem]" : "right-2",
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => onCopyMessage(msg.content, msg.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"
                                    title={t('dialogs.copy')}
                                    aria-label={t('dialogs.copy')}
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRequestDeleteMessage(msg.id)}
                                    disabled={deletingMessageId === msg.id}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                                    title={t('chat.deleteMessage')}
                                    aria-label={t('chat.deleteMessage')}
                                >
                                    {deletingMessageId === msg.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                                {sessionId && (
                                    <PromoverElementoButton
                                        sessionId={sessionId}
                                        mensajeId={msg.id}
                                        contenido={msg.content}
                                        role={msg.role === 'user' ? 'user' : 'model'}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Streaming / loading indicator */}
            {(isStreaming || isSending) && (
                <div className="flex w-full gap-4 justify-start animate-in fade-in duration-300">
                    <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 mt-3 shadow-sm">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0 bg-card border border-border shadow-sm rounded-3xl rounded-tl-sm px-6 py-5">
                        <div className="text-xs text-primary font-semibold mb-2 flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" />
                            {activeAgents.length > 0
                                ? activeAgents.map(a => resolveLocalized(a.name, activeLanguage)).join(' + ')
                                : t('chat.selectingSpecialist')}
                        </div>
                        {streamingMessage ? (
                            <div className="relative">
                                <AssistantMessageContent content={streamingMessage} isAdmin={isAdmin} />
                                <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
                            </div>
                        ) : (
                            <div className="flex gap-1.5 align-middle h-6 items-center">
                                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
