import React, { useRef, useState } from 'react';
import { Send, Loader2, Paperclip, X, ImageIcon, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { ResponseMode } from '@dosfilos/domain';
import { ModeSelectorButton } from './ModeSelectorButton';

interface FacultyChatInputProps {
    input: string;
    isSending: boolean;
    isStreaming: boolean;
    isLoading: boolean;
    streamingMessage: string;
    isHidden: boolean;
    onInputChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    /** File the user has staged for the next send (one image, MVP). */
    attachment: File | null;
    onAttach: (file: File | null) => void;
    /** Current response mode + setter — colocated with the input
     *  it modifies (replaces the old page-header dropdown). */
    lengthPreference: ResponseMode;
    onSetLengthPreference: (mode: ResponseMode) => void;
    /** Optional action rendered next to the mode selector (e.g. guided-sermon entry). */
    leadingAction?: React.ReactNode;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BYTES = 5 * 1024 * 1024;

function isAcceptedImage(file: File): boolean {
    return ACCEPTED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/');
}

export function FacultyChatInput({
    input,
    isSending,
    isStreaming,
    isLoading,
    streamingMessage,
    isHidden,
    onInputChange,
    onSubmit,
    attachment,
    onAttach,
    lengthPreference,
    onSetLengthPreference,
    leadingAction,
}: FacultyChatInputProps) {
    const { t } = useTranslation('faculty');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Build / tear down the object URL whenever the staged file changes.
    React.useEffect(() => {
        if (!attachment) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(attachment);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [attachment]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e as unknown as React.FormEvent);
        }
    };

    /**
     * Pasting an image (e.g. a screenshot) lands here as a clipboard item
     * of `kind: 'file'` with a mime type like `image/png`. We hijack only
     * those items — any text portion of the paste is left for the textarea
     * to handle natively.
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    // Clipboard images often arrive with a generic name like
                    // "image.png". That's fine for the badge.
                    e.preventDefault();
                    acceptFile(file);
                    return;
                }
            }
        }
    };

    const acceptFile = (file: File): boolean => {
        if (!isAcceptedImage(file)) {
            alert(t('chat.attachment.unsupportedType'));
            return false;
        }
        if (file.size > MAX_BYTES) {
            alert(t('chat.attachment.tooLarge'));
            return false;
        }
        onAttach(file);
        return true;
    };

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) acceptFile(file);
        // Reset input so the same file can be re-selected after removal.
        e.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Only collapse the highlight when we leave the form, not its children.
        if (e.currentTarget === e.target) setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) acceptFile(file);
    };

    const disabled = isSending || isStreaming || isLoading;
    const canSubmit = (input.trim().length > 0 || !!attachment) && !disabled;

    return (
        <div className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-muted/30 via-muted/30 to-transparent pt-12 pb-6 px-4 pointer-events-none",
            isHidden && "hidden"
        )}>
            <div className="max-w-3xl mx-auto relative pointer-events-auto">
                <form
                    onSubmit={onSubmit}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                        "relative flex flex-col shadow-lg rounded-3xl bg-card border transition-all overflow-hidden",
                        isDragging
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border focus-within:border-primary/50 focus-within:shadow-primary/10"
                    )}
                >
                    {attachment && previewUrl && (
                        <div className="px-4 pt-3 space-y-2">
                            <div className="inline-flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-2 pr-3">
                                <img
                                    src={previewUrl}
                                    alt={attachment.name}
                                    className="h-14 w-14 rounded-lg object-cover"
                                />
                                <div className="flex flex-col text-[12px] leading-tight pt-1 max-w-[220px]">
                                    <span className="font-medium text-foreground truncate">{attachment.name}</span>
                                    <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onAttach(null)}
                                    className="ml-1 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    title={t('chat.attachment.remove')}
                                    aria-label={t('chat.attachment.remove')}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <div
                                role="note"
                                className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-subtle px-3 py-2 text-[12px] leading-snug text-info-subtle-foreground"
                            >
                                <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                                <span>{t('chat.attachment.ocrHint')}</span>
                            </div>
                        </div>
                    )}

                    <div className="relative flex items-end">
                        <Textarea
                            value={input}
                            onChange={(e) => onInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={isLoading ? t('chat.inputLoading') : t('chat.inputPlaceholder')}
                            className="border-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 rounded-none w-full min-h-[56px] max-h-[200px] py-4 pl-14 pr-14 text-[15px] bg-transparent font-medium shadow-none resize-none transition-[height]"
                            style={{ fieldSizing: 'content' } as React.CSSProperties}
                            disabled={disabled}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled}
                            className="absolute left-2 bottom-2 h-10 w-10 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-muted disabled:opacity-30 transition-colors"
                            title={t('chat.attachment.attach')}
                            aria-label={t('chat.attachment.attach')}
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFilePick}
                            className="hidden"
                        />
                        <div className="absolute right-2 bottom-2">
                            <Button
                                type="submit"
                                size="icon"
                                className={cn(
                                    "h-10 w-10 rounded-full transition-all duration-300 shadow-sm",
                                    canSubmit ? "bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}
                                disabled={!canSubmit}
                            >
                                {(isSending || isStreaming) && !streamingMessage
                                    ? <Loader2 className="h-5 w-5 animate-spin" />
                                    : <Send className="h-4 w-4 ml-0.5" />
                                }
                            </Button>
                        </div>
                    </div>

                    {/*
                     * Mode selector colocated with the input it
                     * affects. Replaces the old page-header
                     * dropdown — the choice now lives where the
                     * user is when they make it.
                     */}
                    <div className="flex items-center justify-start gap-1.5 px-2 pb-1.5 -mt-1">
                        <ModeSelectorButton
                            value={lengthPreference}
                            onChange={onSetLengthPreference}
                        />
                        {leadingAction}
                    </div>

                    {isDragging && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-primary/10 rounded-3xl">
                            <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                <ImageIcon className="h-4 w-4" />
                                {t('chat.attachment.dropHere')}
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
