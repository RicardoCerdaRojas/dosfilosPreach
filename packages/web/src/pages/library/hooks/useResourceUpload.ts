import { useCallback, useMemo, useState } from 'react';
import { libraryService } from '@dosfilos/application';
import { ResourceType, disponibilidadDeRutas, inferBibleBooksFromTitle } from '@dosfilos/domain';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { hasAcceptedUploadConsent } from '@/components/library/UploadConsentModal';
import { MAX_UPLOAD_SIZE_MB } from '@/lib/library/limitesDeSubida';
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
// Reexportado desde el módulo común para no tener dos números que
// gobiernen la misma cantidad; los llamadores de siempre no cambian.
export { MAX_UPLOAD_SIZE_MB } from '@/lib/library/limitesDeSubida';
/**
 * Los topes por ruta NO se declaran acá.
 *
 * Estaban escritos tres veces —en el dominio, en este hook y en los textos de
 * la interfaz— y ninguna copia sabía que la ruta de visión, cuando el libro se
 * recorre en cola, tolera mucho más peso. La pantalla llegó a afirmar tres
 * límites distintos sobre el mismo archivo. La única fuente es
 * `disponibilidadDeRutas` en el dominio, que además necesita el número de
 * páginas para saber qué tope aplica.
 */

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
        // Sin haber leído el PDF todavía no se sabe cuántas páginas tiene, así
        // que acá se aplica el tope conservador. La pantalla recalcula con el
        // número real en cuanto la lectura previa termina.
        const { premium: premiumOk } = disponibilidadDeRutas({ sizeBytes: selected.size });
        setMetadataState(prev => {
            const nextMode = !premiumOk && prev.extractionMode === 'premium'
                ? 'standard'
                : prev.extractionMode;
            // Si estándar tampoco estuviera disponible no se toca la elección:
            // la pantalla lo explica con el número de páginas ya leído, que acá
            // todavía no se tiene.
            return {
                ...prev,
                title: selected.name.replace(/\.[^/.]+$/, '') || '',
                extractionMode: nextMode,
            };
        });
    }, [t]);

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
        handleFileChange,
        setMetadata,
        handleSubmit,
        performUploadAfterConsent,
    };
}
