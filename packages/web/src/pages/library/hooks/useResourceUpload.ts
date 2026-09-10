import { useCallback, useMemo, useState } from 'react';
import { libraryService } from '@dosfilos/application';
import { ResourceType, inferBibleBooksFromTitle } from '@dosfilos/domain';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { hasAcceptedUploadConsent } from '@/components/library/UploadConsentModal';
import { UploadFormMetadata } from '../components/LibraryUploadForm';

/**
 * Upload soft cap (legacy). Files above this still upload but the
 * extraction pipeline takes longer; the soft warning surfaces that
 * before the user commits to a slow extraction.
 */
const MAX_OPTIMAL_SIZE_MB = 50;
/**
 * Upload hard cap. Mirrors `storage.rules` — keep these two in sync
 * (the rules cap is the authoritative gate; this constant just lets
 * us reject large files in the client before kicking off an upload
 * that's destined to 403).
 */
const MAX_UPLOAD_SIZE_MB = 250;
/**
 * Per-tier hard limits enforced by the extraction backends.
 *
 * - **Premium / LlamaParse**: 100MB per file (LlamaParse API cap on
 *   the tier we're on). Files above this skip LlamaParse completely.
 * - **Standard / Gemini inline**: 50MB per file (Gemini inline file
 *   cap; the File API supports more but we don't use it). Files above
 *   this skip Gemini.
 *
 * When a file exceeds a tier's cap, the backend silently degrades to
 * the next tier in the cascade — so without these client-side gates
 * the user picks "Premium" and gets pdf-parse output back. The form
 * uses these values to disable the affected tile and explain why.
 */
const MAX_PREMIUM_TIER_SIZE_MB = 100;
const MAX_STANDARD_TIER_SIZE_MB = 50;

interface UseResourceUploadOptions {
    /** ID of the user owning the upload. Hook is no-op while null/undefined. */
    userId: string | null | undefined;
    /** Whether the user is admin — admins skip the legal consent modal. */
    isAdmin: boolean;
    /** Called when consent gate triggers — caller opens the consent modal. */
    onConsentRequired: () => void;
    /** Called after a successful upload — caller typically closes the form. */
    onSuccess?: () => void;
}

/**
 * Per-tier availability for the currently selected file. Drives the
 * disabled state + warnings on the Premium / Standard tiles in the
 * upload form. When a tier is unavailable, the form prevents the
 * user from selecting it and explains why — the alternative was the
 * silent backend degradation that landed the BHQ upload on Básico
 * even though the user picked Premium (May 2026 incident).
 */
export interface UploadTierAvailability {
    /** True when LlamaParse can handle the file (size ≤ 100MB). */
    premium: boolean;
    /** True when Gemini inline can handle the file (size ≤ 50MB). */
    standard: boolean;
    /** Convenience: true when neither premium nor standard is available. */
    bothUnavailable: boolean;
    /** Effective hard caps in MB — surfaced for UI copy. */
    premiumCapMB: number;
    standardCapMB: number;
    /** Selected file's size in MB (0 when no file picked). */
    fileSizeMB: number;
}

interface UseResourceUploadResult {
    file: File | null;
    fileSizeWarning: boolean;
    metadata: UploadFormMetadata;
    uploading: boolean;
    uploadProgress: number | null;
    /**
     * Live smart-match inference from the current `metadata.title`.
     * Memoized — recomputed on each title edit. Drives the inline
     * preview shown in the upload form. Persisted on submit.
     */
    smartMatchInference: ReturnType<typeof inferBibleBooksFromTitle>;
    /**
     * Per-tier availability for the currently selected file. Always
     * defined — when no file is picked, both tiers report as available.
     */
    tierAvailability: UploadTierAvailability;
    /** File picker change handler. Validates type + sets warning + autofills title. Pass `null` to clear. */
    handleFileChange: (file: File | null) => void;
    /** Patch the metadata partial. */
    setMetadata: (updates: Partial<UploadFormMetadata>) => void;
    /** Form submit handler. Checks consent, uploads, resets state on success. */
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    /** Bypass-consent variant — call after the consent modal has been accepted. */
    performUploadAfterConsent: () => Promise<void>;
}

/**
 * Encapsulates the upload form state and flow:
 * - File picker validation (PDF/EPUB) + size warning
 * - Metadata form state (title/author/category)
 * - Consent gate (one-time legal acceptance for non-admin users)
 * - Upload + progress tracking
 * - Toast notifications
 *
 * Owns NO modal state — the consent modal lives in the parent and is opened
 * via the `onConsentRequired` callback when applicable.
 */
export function useResourceUpload({
    userId,
    isAdmin,
    onConsentRequired,
    onSuccess,
}: UseResourceUploadOptions): UseResourceUploadResult {
    const { t } = useTranslation('library');
    const [file, setFile] = useState<File | null>(null);
    const [fileSizeWarning, setFileSizeWarning] = useState(false);
    const [metadata, setMetadataState] = useState<UploadFormMetadata>({
        title: '',
        author: '',
        type: 'theology',
        // Valor inicial mientras no hay archivo. NO es una recomendación: leer
        // el texto del archivo no es «mejor calidad», es otra cosa, y sobre un
        // escaneo destruye el texto —medido: 0 caracteres hebreos contra 2.418
        // leyendo por imágenes—. Con un archivo elegido, el formulario aplica
        // solo la ruta que el diagnóstico recomienda cuando está seguro.
        extractionMode: 'premium',
    });
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    const setMetadata = useCallback((updates: Partial<UploadFormMetadata>) => {
        setMetadataState(prev => ({ ...prev, ...updates }));
    }, []);

    const reset = useCallback(() => {
        setFile(null);
        setFileSizeWarning(false);
        setMetadataState({ title: '', author: '', type: 'theology', extractionMode: 'premium' });
    }, []);

    const handleFileChange = useCallback((selected: File | null) => {
        if (!selected) {
            setFile(null);
            setFileSizeWarning(false);
            return;
        }

        // Validate by MIME or extension fallback (browsers don't always set
        // application/epub+zip MIME for EPUBs).
        const validTypes = ['application/pdf', 'application/epub+zip'];
        if (!validTypes.includes(selected.type) && !selected.name.match(/\.(pdf|epub)$/i)) {
            toast.error(t('toast.uploadError'));
            return;
        }

        const sizeMB = selected.size / (1024 * 1024);
        // Hard cap — reject before we waste an upload that would 403
        // at the storage rules gate. Toast tells the user the limit
        // explicitly so they know the system isn't broken.
        if (sizeMB > MAX_UPLOAD_SIZE_MB) {
            toast.error(t('toast.fileTooLarge', { maxMB: MAX_UPLOAD_SIZE_MB }));
            return;
        }
        setFileSizeWarning(sizeMB > MAX_OPTIMAL_SIZE_MB);
        setFile(selected);
        // Autofill title from filename — strip extension. Also
        // auto-switch the extraction tier when the current selection
        // is no longer available for this size, so the user doesn't
        // submit a request the backend will silently downgrade.
        const premiumOk = sizeMB <= MAX_PREMIUM_TIER_SIZE_MB;
        const standardOk = sizeMB <= MAX_STANDARD_TIER_SIZE_MB;
        setMetadataState(prev => {
            const nextMode = !premiumOk && prev.extractionMode === 'premium'
                ? 'standard'
                : prev.extractionMode;
            // When standard is also unavailable, we leave the mode at
            // whatever it was — both tiles will be disabled in the UI
            // and a callout explains the file will go to Básico
            // regardless of selection. No auto-switch back to premium.
            return {
                ...prev,
                title: selected.name.replace(/\.[^/.]+$/, '') || '',
                extractionMode: nextMode,
            };
        });
    }, [t]);

    // Per-tier availability for the current file. Memoized off
    // `file?.size` so we don't recompute on every title edit.
    const tierAvailability = useMemo<UploadTierAvailability>(() => {
        const sizeMB = file ? file.size / (1024 * 1024) : 0;
        const premium = sizeMB <= MAX_PREMIUM_TIER_SIZE_MB;
        const standard = sizeMB <= MAX_STANDARD_TIER_SIZE_MB;
        return {
            premium,
            standard,
            bothUnavailable: !premium && !standard,
            premiumCapMB: MAX_PREMIUM_TIER_SIZE_MB,
            standardCapMB: MAX_STANDARD_TIER_SIZE_MB,
            fileSizeMB: sizeMB,
        };
    }, [file]);

    // v1.7 smart-match inference from title. Pure function so memoizing
    // by title is sufficient — no debounce needed at this latency.
    const smartMatchInference = useMemo(
        () => inferBibleBooksFromTitle(metadata.title),
        [metadata.title],
    );

    const performUploadAfterConsent = useCallback(async () => {
        if (!userId || !file) return;
        setUploading(true);
        setUploadProgress(0);
        try {
            await libraryService.uploadResource(
                userId,
                file,
                {
                    title: metadata.title,
                    author: metadata.author,
                    type: metadata.type,
                    requestedExtractionMode: metadata.extractionMode,
                    // Persist smart-match metadata only when the inferer
                    // produced a confident result. When scope is null,
                    // omit both fields and let the legacy default
                    // ([] + 'book') trigger the "metadata incompleta"
                    // nudge in the editor (A.3).
                    ...(smartMatchInference.inferredScope !== null && {
                        coversBibleBooks: smartMatchInference.books,
                        scope: smartMatchInference.inferredScope,
                    }),
                },
                (progress) => {
                    setUploadProgress(progress);
                },
            );
            toast.success(t('toast.uploadSuccess'));
            reset();
            onSuccess?.();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(t('toast.uploadError'));
        } finally {
            setUploading(false);
            setUploadProgress(null);
        }
    }, [userId, file, metadata, smartMatchInference, t, reset, onSuccess]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !file) return;

        // First-time consent gate for non-admin users. Admins manage curated
        // Core Library content under a separate legal framework so they skip.
        if (!isAdmin && !hasAcceptedUploadConsent()) {
            onConsentRequired();
            return;
        }
        await performUploadAfterConsent();
    }, [userId, file, isAdmin, onConsentRequired, performUploadAfterConsent]);

    return {
        file,
        fileSizeWarning,
        metadata,
        uploading,
        uploadProgress,
        smartMatchInference,
        tierAvailability,
        handleFileChange,
        setMetadata,
        handleSubmit,
        performUploadAfterConsent,
    };
}
