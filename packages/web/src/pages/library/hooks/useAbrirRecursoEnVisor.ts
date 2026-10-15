import { useCallback } from 'react';
import type { LibraryResourceEntity } from '@dosfilos/domain';
import { useSourceViewer } from '@/components/exegesis/citation/SourceViewerProvider';
import { apellidoDelAutor } from '../apellidoDelAutor';

// Se reexporta: las pruebas y quien ya lo importaba de acá siguen igual.
export { apellidoDelAutor };

/**
 * «Ver» un recurso de la Biblioteca (fase F, F3).
 *
 * Un PDF se abre en el visor ampliado: página impresa, búsqueda en el libro y
 * «Citar», que aquí copia porque no hay un trabajo abierto. La clave con que
 * se cita es el apellido del primer autor. Lo que no es PDF (EPUB, Word) sigue
 * abriéndose como archivo: el visor sólo dibuja PDFs.
 */
export function useAbrirRecursoEnVisor() {
    const sourceViewer = useSourceViewer();
    return useCallback((resource: LibraryResourceEntity) => {
        if (resource.mimeType !== 'application/pdf') {
            window.open(resource.storageUrl, '_blank');
            return;
        }
        sourceViewer.open({
            paperId: null,
            citation: { sourceKey: apellidoDelAutor(resource.author) || resource.title, page: 1, resourceId: resource.id, label: resource.title },
        }, 'full');
    }, [sourceViewer]);
}
