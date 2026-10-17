import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Search, Library, ScrollText, HeartHandshake,
    Mic, Send, Sparkles, ArrowRight, Loader2, BookOpen, Brain, MessageCircle, Users,
    Paperclip, X, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFacultyAgents, useFacultySessions } from '../../hooks/faculty';
import { useFirebase } from '@/context/firebase-context';
import { useStudyDepthGate } from '@/hooks/usePastoralFidelityGate';
import { AIAgent, resolveLocalized } from '@dosfilos/domain';
import type { SupportedLanguage } from '@dosfilos/domain';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { FreeStarterCard } from './components/FreeStarterCard';
import { setPendingFacultyInput } from './utils/pendingFacultyInput';
import { useResponseModePref } from './hooks/useResponseModePref';
import { ModeSelectorButton } from '@/components/faculty/ModeSelectorButton';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result ?? '');
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });
}

// Two representative chips only — the previous 4 were redundant with
// the right-side Recursos panel. Outline (most common) + Exegesis
// (theological depth) cover the activation surface; users who want
// the other shapes (counseling/theology) still get there via natural
// language in the input.
const QUICK_PROMPT_KEYS: Array<{ key: 'outline' | 'exegesis'; icon: React.ElementType }> = [
    { key: 'outline', icon: BookOpen },
    { key: 'exegesis', icon: ScrollText },
];

// Role-specific icon config — each agent has its own palette. Brand
// identity colors stay raw (intentional per-agent visual identity);
// semantic tokens cover the surrounding chrome.
const ICON_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string; ring: string }> = {
    'book-a':          { icon: Library,       bg: 'bg-sky-100 dark:bg-sky-900/40',      text: 'text-sky-700 dark:text-sky-300',      ring: 'ring-sky-200 dark:ring-sky-700' },
    'scroll':          { icon: ScrollText,    bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-300',  ring: 'ring-amber-200 dark:ring-amber-700' },
    'heart-handshake': { icon: HeartHandshake,bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-700' },
    'mic':             { icon: Mic,           bg: 'bg-rose-100 dark:bg-rose-900/40',    text: 'text-rose-700 dark:text-rose-300',    ring: 'ring-rose-200 dark:ring-rose-700' },
    'library':         { icon: Library,       bg: 'bg-muted',                            text: 'text-foreground',                     ring: 'ring-border' },
    'users':           { icon: Users,         bg: 'bg-violet-100 dark:bg-violet-900/40',text: 'text-violet-700 dark:text-violet-300',ring: 'ring-violet-200 dark:ring-violet-700' },
};
const DEFAULT_ICON_CONFIG = ICON_CONFIG['users'];

export function FacultyDirectoryPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [orchestratorInput, setOrchestratorInput] = useState('');
    // Response-mode picker is shared with the chat session via
    // localStorage so the choice carries across surfaces. Lives on
    // the home input as a chip below the textarea.
    const [responseMode, setResponseMode] = useResponseModePref();
    const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    // Specialists are now a secondary path behind a disclosure — the
    // primary CTA is the orchestrator input. Keeps the home focused
    // on "describe what you need" instead of a tutor-catalog dump.
    // Expanded by default so the direct-to-specialist option is visible on landing.
    const [showSpecialists, setShowSpecialists] = useState(true);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: agents = [], isLoading: isLoadingAgents } = useFacultyAgents();
    const { user } = useFirebase();
    const { sessions, isLoading: isLoadingSessions, createSession } = useFacultySessions();
    const { t, i18n } = useTranslation('faculty');
    const activeLanguage: SupportedLanguage = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';

    // Build / tear down the object URL whenever the staged file changes.
    useEffect(() => {
        if (!pendingAttachment) {
            setAttachmentPreview(null);
            return;
        }
        const url = URL.createObjectURL(pendingAttachment);
        setAttachmentPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [pendingAttachment]);

    // Onboarding intent prepop — when the user landed here from the wizard
    // with `?intent=devotional`, seed the orchestrator with a starter prompt
    // and surface a toast so they know we read their selection. Fires once
    // per arrival; the URL param then gets stripped via history.replaceState
    // so a refresh doesn't re-fire the toast.
    useEffect(() => {
        const intent = searchParams.get('intent');
        if (intent !== 'devotional') return;
        if (orchestratorInput) return;
        setOrchestratorInput(t('directory.intentPrepop.devotionalPrompt'));
        toast.info(t('directory.intentPrepop.devotionalToast'));
        const url = new URL(window.location.href);
        url.searchParams.delete('intent');
        window.history.replaceState({}, '', url.toString());
        // intentionally not depending on orchestratorInput — we only want the
        // effect to run on mount when the intent param is present.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Clipboard paste — anywhere on the directory page, an image
    // pasted into the OS clipboard lands in the orchestrator input
    // slot. Mirrors the FacultyChatInput behavior so the entry point
    // and the chat body offer the same affordance.
    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (blob) {
                        if (blob.size > MAX_ATTACHMENT_BYTES) {
                            toast.error(t('directory.attachment.tooLarge'));
                            return;
                        }
                        const ext = blob.type.split('/')[1] || 'png';
                        setPendingAttachment(new File([blob], `pasted.${ext}`, { type: blob.type }));
                        toast.info(t('directory.attachment.pastedToast'));
                        e.preventDefault();
                        return;
                    }
                }
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [t]);

    const handlePickFile = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error(t('directory.attachment.unsupportedType'));
            return;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
            toast.error(t('directory.attachment.tooLarge'));
            return;
        }
        setPendingAttachment(file);
    };

    // Free-tier starter card — visible only until the user fires their first
    // query. Hito 5.1: closes the activation gap that the existing always-on
    // chips weren't moving the needle on.
    const planId = user?.subscription?.planId;
    const isFreeTier = !planId || planId === 'free';
    const showFreeStarter = isFreeTier && !isLoadingSessions && sessions.length === 0;

    // When this directory is opened from a project workspace
    // (`/dashboard/faculty?projectId=...`), every link to `/faculty/new` MUST
    // carry the projectId forward — otherwise the new session is born orphan
    // and the orchestrator can't scope RAG to the project's source set.
    const projectIdFromUrl = searchParams.get('projectId');
    const newSessionQuery = (extra: string) => {
        const params = new URLSearchParams(extra);
        if (projectIdFromUrl) params.set('projectId', projectIdFromUrl);
        const q = params.toString();
        return q ? `?${q}` : '';
    };

    // Auto-resize textarea — skip when empty so the input collapses
    // back to its CSS-driven `rows={1}` height instead of inheriting
    // a stale scrollHeight from a previous (now cleared) value. This
    // is what kept the empty input visibly tall in the empty state.
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        if (orchestratorInput.length === 0) {
            el.style.height = '';
            return;
        }
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [orchestratorInput]);

    // Lazy navigation — no session created until the user sends a first message.
    // When an image attachment is staged, route through sessionStorage so the
    // chat page can replay create-session-and-send-with-attachment cleanly
    // (URL params can't carry binary).
    const handleStartOrchestrated = async (question: string) => {
        const q = question.trim();
        // Allow attachment-only sends — image alone can be the prompt.
        if ((!q && !pendingAttachment) || agents.length === 0) return;

        if (pendingAttachment) {
            try {
                const base64 = await fileToBase64(pendingAttachment);
                setPendingFacultyInput({
                    question: q,
                    attachment: {
                        mimeType: pendingAttachment.type || 'image/png',
                        base64,
                        filename: pendingAttachment.name,
                        sizeBytes: pendingAttachment.size,
                    },
                });
                setPendingAttachment(null);
                navigate(`/dashboard/faculty/new${newSessionQuery('')}`);
                return;
            } catch (err) {
                console.error('[FacultyDirectory] failed to encode attachment:', err);
                toast.error(t('directory.attachment.encodeFailed'));
                return;
            }
        }

        navigate(`/dashboard/faculty/new${newSessionQuery(`q=${encodeURIComponent(q)}`)}`);
    };

    // Phase 2.5 PR B reroute (ADR-028): under the `study_depth` flag the
    // "Bosquejo de Sermón" chip mints a fresh session + lands the pastor
    // on it with the guided-sermon agent activation prompt already open.
    // Falls back to the existing orchestrated prompt when the flag is off.
    const studyDepthGate = useStudyDepthGate();
    const handleStartGuided = async () => {
        if (agents.length === 0 || isBusy) return;
        try {
            const created = await createSession.mutateAsync({
                agentId: agents[0].id,
            });
            navigate(`/dashboard/faculty/${created.id}?guided=1`);
        } catch (err) {
            console.error('[FacultyDirectory] failed to start guided session', err);
            toast.error(t('directory.attachment.encodeFailed'));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleStartOrchestrated(orchestratorInput);
        }
    };

    const handleStartSession = (agent: AIAgent) => {
        const name = resolveLocalized(agent.name, activeLanguage);
        navigate(`/dashboard/faculty/new${newSessionQuery(`agent=${agent.id}&agentName=${encodeURIComponent(name)}`)}`);
    };

    const filteredAgents = agents.filter(agent => {
        const q = searchQuery.toLowerCase();
        return resolveLocalized(agent.name, activeLanguage).toLowerCase().includes(q)
            || resolveLocalized(agent.expertiseArea, activeLanguage).toLowerCase().includes(q);
    });

    const isBusy = isLoadingAgents;

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-y-auto">

            {/* ── Hero + Orchestrator Input ─────────────────────────────────────── */}
            {/*
                Theme-aware hero. Previous version forced a slate-900 dark
                gradient even in light mode, which broke visual hierarchy
                (the dark frame competed with surrounding chrome). Now the
                hero uses `bg-card` over the page's `bg-background` so it
                reads as a soft container in both themes — no jarring
                cross-mode mismatch.
            */}
            <div className="relative pt-10 pb-10 px-6 sm:px-12 lg:px-20 bg-card border-b border-border overflow-hidden shrink-0">
                {/* Subtle radial accent — adds warmth without the previous
                    full-frame dark treatment. Same primary tint in both
                    themes (token-driven), just a soft glow. */}
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -left-16 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-2xl mx-auto text-center">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2 leading-tight font-serif">
                        {t('directory.heroTitle')}
                    </h1>
                    <p className="text-muted-foreground mb-6 text-sm md:text-base leading-relaxed">
                        {t('directory.heroSubtitle')}
                    </p>

                    {/* Orchestrator input — primary CTA. Theme-aware
                        styling: in light mode reads as a normal input
                        with shadow; in dark mode same tokens give an
                        elevated card look. */}
                    <div className="bg-background border border-border rounded-2xl p-2 shadow-sm focus-within:border-primary/50 focus-within:shadow-md transition-shadow">
                        {pendingAttachment && attachmentPreview && (
                            <div className="flex items-center gap-2 px-2 pt-1.5 pb-1 mb-1 border-b border-border">
                                <img
                                    src={attachmentPreview}
                                    alt={pendingAttachment.name}
                                    className="h-10 w-10 object-cover rounded-md border border-border"
                                />
                                <div className="flex-1 min-w-0 text-[11px]">
                                    <div className="text-foreground truncate">{pendingAttachment.name}</div>
                                    <div className="text-muted-foreground">{(pendingAttachment.size / 1024).toFixed(0)} KB</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPendingAttachment(null)}
                                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                                    aria-label={t('directory.attachment.remove')}
                                    title={t('directory.attachment.remove')}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <Sparkles className="h-5 w-5 text-primary shrink-0 mb-3 ml-2" />
                            <textarea
                                ref={inputRef}
                                value={orchestratorInput}
                                onChange={e => setOrchestratorInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('directory.inputPlaceholder')}
                                rows={1}
                                className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground text-[15px] leading-relaxed outline-none py-2.5 px-1 max-h-40 overflow-y-hidden"
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => {
                                    handlePickFile(e.target.files?.[0] ?? null);
                                    e.target.value = '';
                                }}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isBusy || agents.length === 0}
                                className="shrink-0 h-10 w-10 p-0 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted"
                                title={t('directory.attachment.attachLabel')}
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button
                                onClick={() => void handleStartOrchestrated(orchestratorInput)}
                                disabled={(!orchestratorInput.trim() && !pendingAttachment) || isBusy || agents.length === 0}
                                className="shrink-0 h-10 w-10 p-0 rounded-xl bg-primary-solid hover:bg-primary-solid-hover disabled:opacity-40 text-primary-foreground shadow-sm transition-all"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/*
                     * Quick prompts + mode selector live together
                     * directly under the input — both modify how the
                     * orchestrator will behave on submit, so they
                     * belong in the same proximity. ModeSelectorButton
                     * persists via localStorage so the chat session
                     * inherits whatever mode the user picked here.
                     */}
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
                        {QUICK_PROMPT_KEYS.map(({ key, icon: Icon }) => {
                            const label = t(`directory.quickPrompts.${key}.label`);
                            const prompt = t(`directory.quickPrompts.${key}.prompt`);
                            const rerouteToGuided = key === 'outline' && studyDepthGate.enabled;
                            // "Trabajemos en tu Sermón" is the primary action on this
                            // surface — render it filled so it reads as the main CTA,
                            // the other quick prompts stay as subtle muted chips.
                            const isFeatured = key === 'outline';
                            return (
                                <button
                                    key={key}
                                    onClick={() =>
                                        rerouteToGuided
                                            ? handleStartGuided()
                                            : handleStartOrchestrated(prompt)
                                    }
                                    disabled={isBusy || agents.length === 0}
                                    className={
                                        isFeatured
                                            ? "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary-solid hover:bg-primary-solid-hover border border-primary text-primary-foreground text-xs font-semibold shadow-sm transition-colors disabled:opacity-40"
                                            : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-secondary border border-border text-foreground text-xs font-medium transition-colors disabled:opacity-40"
                                    }
                                >
                                    <Icon className="h-3 w-3" />
                                    {label}
                                </button>
                            );
                        })}
                        {/* Visual separator + label so the user understands
                            this control is a setting (modifies how every
                            future answer is shaped) and not another quick
                            prompt that submits on click. */}
                        <span className="h-4 w-px bg-border mx-1" aria-hidden />
                        <span className="text-[11px] text-muted-foreground font-medium">
                            {t('directory.modeLabel')}
                        </span>
                        <ModeSelectorButton value={responseMode} onChange={setResponseMode} />
                    </div>

                    {showFreeStarter && (
                        <FreeStarterCard
                            onPickPrompt={handleStartOrchestrated}
                            disabled={isBusy || agents.length === 0}
                        />
                    )}
                </div>
            </div>

            {/* ── Direct Specialists (collapsed disclosure) ─────────────────────── */}
            {/*
                Demoted from primary section to disclosure. The orchestrator
                input above already routes to the right specialist
                automatically — direct selection is a power-user shortcut,
                not the default path. Collapsed by default to keep the
                home focused on the single primary action.
            */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
                <button
                    type="button"
                    onClick={() => setShowSpecialists(prev => !prev)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all text-left group"
                    aria-expanded={showSpecialists}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">
                                {t('directory.specialistsTitle')}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                                {t('directory.specialistsSubtitle')}
                            </div>
                        </div>
                    </div>
                    <ChevronDown
                        className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                            showSpecialists && 'rotate-180'
                        )}
                    />
                </button>

                {showSpecialists && (
                    <div className="mt-4">
                        <div className="relative w-full md:w-72 mb-5">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder={t('directory.specialistsSearchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 bg-card border-border focus-visible:ring-primary rounded-full shadow-sm text-sm"
                            />
                        </div>

                        {isLoadingAgents ? (
                            <div className="py-12 flex justify-center items-center">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : filteredAgents.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <MessageCircle className="h-9 w-9 mx-auto mb-3 opacity-40" />
                                <p>{t('directory.specialistsEmpty')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredAgents.map((agent) => {
                                    const cfg = ICON_CONFIG[agent.icon ?? ''] ?? DEFAULT_ICON_CONFIG;
                                    const IconComponent = cfg.icon;
                                    return (
                                        <div
                                            key={agent.id}
                                            className="group relative bg-card rounded-2xl p-5 shadow-sm border border-border hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col cursor-pointer"
                                            onClick={() => !isBusy && handleStartSession(agent)}
                                        >
                                            {/* Icon — small circle, role-specific brand color */}
                                            <div className={cn(
                                                'mb-3 w-11 h-11 rounded-full flex items-center justify-center ring-2 transition-transform duration-200 group-hover:scale-110 shadow-sm',
                                                cfg.bg, cfg.text, cfg.ring
                                            )}>
                                                <IconComponent className="w-5 h-5" />
                                            </div>

                                            <div className="flex-1 mb-4">
                                                <h2 className="text-lg font-bold text-foreground">{resolveLocalized(agent.name, activeLanguage)}</h2>
                                                <p className={cn('text-sm font-medium mb-2', cfg.text)}>{resolveLocalized(agent.expertiseArea, activeLanguage)}</p>
                                                <p className="text-sm text-muted-foreground line-clamp-3">{resolveLocalized(agent.description, activeLanguage)}</p>
                                            </div>

                                            <div className="pt-3 border-t border-border/50 flex items-center justify-between mt-auto">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('directory.card.directSession')}</span>
                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                                    {t('directory.card.start')}
                                                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

// Alias used by FacultyChatPage to embed this as the home state
export { FacultyDirectoryPage as FacultyHomeContent };
