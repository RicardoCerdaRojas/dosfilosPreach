import { useTranslation } from '@/i18n';
import {
    LibraryCategory,
    ResourceType,
    type BibleBookId,
    type LibraryResourceScope,
    recommendExtractionMode,
    requiredScriptsFor,
} from '@dosfilos/domain';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { AlertTriangle, Loader2, Plus, Sparkles, Upload, Wand2 } from 'lucide-react';
import { PdfPreflightNotice } from './PdfPreflightNotice';
import { usePdfPreflight } from '../hooks/usePdfPreflight';
import { ModeAdvice, ModeTile, Paso, SmartMatchPreview, TierCallout } from './UploadFormParts';

export type ExtractionMode = 'standard' | 'premium';

export interface UploadFormMetadata {
    title: string;
    author: string;
    type: ResourceType;
    extractionMode: ExtractionMode;
}

/**
 * v1.7 smart-match autocomplete result. Mirrors the return shape of
 * `inferBibleBooksFromTitle` so the form can render the live preview
 * without re-importing the domain helper.
 */
export interface SmartMatchInferenceResult {
    books: ReadonlyArray<BibleBookId>;
    inferredScope: LibraryResourceScope | null;
}

/**
 * Subset of `UploadTierAvailability` consumed by this form. Mirrored
 * locally so the form can be rendered in stories/tests without the hook.
 */
export interface TierAvailabilityProp {
    premium: boolean;
    standard: boolean;
    bothUnavailable: boolean;
    premiumCapMB: number;
    standardCapMB: number;
    fileSizeMB: number;
}

interface LibraryUploadFormProps {
    /** Categories available in the dropdown — sourced from `categoryService`. */
    categories: LibraryCategory[];
    /** Selected file (or null if not yet picked). */
    file: File | null;
    /** Whether the picked file exceeds the soft size cap (50MB). */
    fileSizeWarning: boolean;
    /** Form state for title/author/category. */
    metadata: UploadFormMetadata;
    /** True while the upload request is in flight. */
    uploading: boolean;
    /** Upload progress percentage (0-100) or null if not started yet. */
    uploadProgress: number | null;
    /**
     * Live smart-match inference from the title. Drives the inline
     * preview ("✨ 2 libros detectados — 1 Pedro, 2 Pedro · libro").
     * Not editable from this form in v1.7 — the metadata editor on
     * the resource detail (A.3) is the canonical spot for adjustment.
     */
    smartMatchInference: SmartMatchInferenceResult;
    /**
     * Per-tier availability for the currently picked file. Drives the
     * disabled state on the Premium / Standard tiles and the
     * "se procesará con Básico" callout. Without this, users could
     * pick Premium for a 200MB file and silently get pdf-parse output.
     */
    tierAvailability: TierAvailabilityProp;
    /** File picker handler — caller validates type + sets file/warning. Pass `null` to clear. */
    onFileChange: (file: File | null) => void;
    /** Metadata patch — caller spreads over current state. */
    onMetadataChange: (updates: Partial<UploadFormMetadata>) => void;
    /** Submit handler. Caller checks consent gate, runs upload, hides form on success. */
    onSubmit: (e: React.FormEvent) => void;
}

/**
 * Collapsible upload form for adding a new resource. Displays file picker,
 * size warning, metadata fields (title/author/category), and submit button.
 *
 * Pure presentational — caller owns form state, validation, and the actual
 * upload call. Component just orchestrates the inputs and renders progress.
 */
export function LibraryUploadForm({
    categories,
    file,
    fileSizeWarning,
    metadata,
    uploading,
    uploadProgress,
    smartMatchInference,
    tierAvailability,
    onFileChange,
    onMetadataChange,
    onSubmit,
}: LibraryUploadFormProps) {
    const { t, i18n } = useTranslation('library');
    // Lee el PDF elegido en el navegador y advierte si no va a servir.
    // No bloquea: el botón de subir sigue disponible pase lo que pase.
    const preflight = usePdfPreflight(file);
    const showTierCallout = file !== null && (!tierAvailability.premium || !tierAvailability.standard);
    // Qué motor conviene para ESTE archivo. El producto traía Premium marcado
    // de fábrica y sobre un escaneo eso destruye el texto: medido sobre el
    // mismo archivo, Premium dio 0 caracteres hebreos y Estándar 2.418.
    // El título y la categoría dicen qué escritura necesita el libro, y ya están
    // escritos cuando se elige el motor —el título se autocompleta del nombre
    // del archivo—. Con eso se distingue el caso que «¿es un escaneo?» no ve:
    // libros CON capa de texto cuya escritura está mal codificada.
    const recommendation = recommendExtractionMode({
        sizeBytes: file?.size ?? 0,
        diagnosis: preflight.status === 'done' ? preflight.diagnosis : null,
        requiredScripts: requiredScriptsFor({ type: metadata.type, title: metadata.title }),
        evidence: preflight.status === 'done' ? preflight.evidence : null,
    });

    return (
        <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 space-y-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-medium inline-flex items-center gap-1.5">
                <Plus className="h-3 w-3" />
                {t('upload.sectionLabel')}
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
                {/* ── 1. El archivo ───────────────────────────────────────
                    Va primero porque todo lo demás depende de él: el motor
                    correcto se deduce de lo que el archivo ES, y antes de
                    elegirlo la pregunta no tiene respuesta. La versión
                    anterior ponía el selector de motor arriba y traía Premium
                    marcado de fábrica, o sea que pedía una decisión sin el
                    dato y proponía la equivocada para los escaneos. */}
                <Paso numero={1} titulo={t('upload.stepFile')}>
                    <FileDropzone
                        id="file"
                        accept=".pdf,.epub"
                        value={file}
                        onChange={onFileChange}
                        disabled={uploading}
                        hint="PDF o EPUB"
                        emptyLabel={t('common:fileDropzone.empty')}
                        clearLabel={t('common:fileDropzone.clear')}
                    />
                    {fileSizeWarning && (
                        <Alert variant="destructive" className="bg-warning-subtle border-warning/40 py-2">
                            <AlertTriangle className="h-3 w-3 text-warning-subtle-foreground" />
                            <AlertDescription className="text-warning-subtle-foreground text-[11px]">
                                {t('upload.fileSizeWarning')}
                            </AlertDescription>
                        </Alert>
                    )}
                    <PdfPreflightNotice state={preflight} />
                </Paso>

                {/* ── 2. Cómo procesarlo ──────────────────────────────────
                    Sólo aparece con un archivo elegido. Sin él la elección no
                    significa nada, y un valor por defecto visible se lee como
                    consejo. */}
                <Paso numero={2} titulo={t('upload.stepMode')}>
                    {!file ? (
                        <p className="text-[11px] text-muted-foreground">{t('upload.stepModeWaiting')}</p>
                    ) : (
                        <>
                        <ModeAdvice recommendation={recommendation} t={t} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ModeTile
                                active={metadata.extractionMode === 'standard'}
                                disabled={!tierAvailability.standard}
                                disabledHint={t('upload.tierUnavailableHint', { capMB: tierAvailability.standardCapMB })}
                                recommended={recommendation.recommended === 'standard'}
                                recommendedLabel={t('upload.recommendedBadge')}
                                onClick={() => onMetadataChange({ extractionMode: 'standard' })}
                                icon={<Wand2 className="h-3.5 w-3.5" />}
                                title={t('upload.modeStandardTitle')}
                                description={t('upload.modeStandardDescription')}
                                tone="info"
                            />
                            <ModeTile
                                active={metadata.extractionMode === 'premium'}
                                disabled={!tierAvailability.premium}
                                disabledHint={t('upload.tierUnavailableHint', { capMB: tierAvailability.premiumCapMB })}
                                recommended={recommendation.recommended === 'premium'}
                                recommendedLabel={t('upload.recommendedBadge')}
                                onClick={() => onMetadataChange({ extractionMode: 'premium' })}
                                icon={<Sparkles className="h-3.5 w-3.5" />}
                                title={t('upload.modePremiumTitle')}
                                description={t('upload.modePremiumDescription')}
                                tone="success"
                            />
                        </div>
                        {showTierCallout && <TierCallout availability={tierAvailability} />}
                        </>
                    )}
                </Paso>

                {/* ── 3. Los datos del libro ──────────────────────────── */}
                <Paso numero={3} titulo={t('upload.stepMetadata')}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="title" className="text-[12.5px]">{t('upload.titleLabel')}</Label>
                            <Input
                                id="title"
                                value={metadata.title}
                                onChange={e => onMetadataChange({ title: e.target.value })}
                                placeholder={t('upload.titlePlaceholder')}
                                required
                            />
                            <SmartMatchPreview
                                inference={smartMatchInference}
                                language={i18n.language}
                                t={t}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="author" className="text-[12.5px]">{t('upload.authorLabel')}</Label>
                            <Input
                                id="author"
                                value={metadata.author}
                                onChange={e => onMetadataChange({ author: e.target.value })}
                                placeholder={t('upload.authorPlaceholder')}
                                required
                            />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 sm:max-w-xs">
                            <Label htmlFor="type" className="text-[12.5px]">{t('upload.categoryLabel')}</Label>
                            <Select
                                value={metadata.type}
                                onValueChange={(v: ResourceType) => onMetadataChange({ type: v })}
                            >
                                <SelectTrigger id="type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Paso>

                <div className="flex justify-end border-t border-border/60 pt-4">
                    <Button type="submit" className="gap-2 min-w-40" disabled={uploading || !file}>
                        {uploading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {uploadProgress !== null ? `${Math.round(uploadProgress)}%` : '…'}
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                {t('upload.uploadButton')}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
