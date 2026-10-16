import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import type { useResourceUpload } from '../hooks/useResourceUpload';
import { LibraryUploadForm, type LibraryUploadFormProps } from './LibraryUploadForm';

/**
 * «Agregar recurso» en un modal (pedido del fundador, 2026-10-17): antes el
 * formulario vivía dentro de «Mis libros» y, desde «Consultar», el botón lo
 * abría donde no se veía. En un modal funciona desde las dos pestañas y no
 * empuja la lista. Mientras sube un archivo no se puede cerrar.
 */
export function LibraryUploadDialog({ open, onOpenChange, categories, upload }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: LibraryUploadFormProps['categories'];
    upload: ReturnType<typeof useResourceUpload>;
}) {
    const { t } = useTranslation('library');
    return (
        <Dialog open={open} onOpenChange={o => { if (!o && upload.uploading) return; onOpenChange(o); }}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
                <DialogTitle className="sr-only">{t('header.addButton')}</DialogTitle>
                <DialogDescription className="sr-only">{t('upload.sectionLabel')}</DialogDescription>
                <LibraryUploadForm
                    categories={categories}
                    file={upload.file}
                    fileSizeWarning={upload.fileSizeWarning}
                    metadata={upload.metadata}
                    uploading={upload.uploading}
                    uploadProgress={upload.uploadProgress}
                    smartMatchInference={upload.smartMatchInference}
                    onFileChange={upload.handleFileChange}
                    onMetadataChange={upload.setMetadata}
                    onSubmit={upload.handleSubmit}
                />
            </DialogContent>
        </Dialog>
    );
}
