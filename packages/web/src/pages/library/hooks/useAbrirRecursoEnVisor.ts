import { useCallback } from 'react';
import type { LibraryResourceEntity } from '@dosfilos/domain';
import { useSourceViewer } from '@/components/exegesis/citation/SourceViewerProvider';

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

/**
 * El apellido del primer autor. «McCartney, Dan G.» → «McCartney»; «John A
 * Motyer» → «Motyer»; «Eberhard Nestle, Kurt Aland» → «Nestle» (la coma separa
 * autores cuando lo de antes ya es un nombre completo); «John Smith Jr.» →
 * «Smith». Un apellido doble español sin coma da el último: es una propuesta,
 * la clave se puede corregir en el trabajo.
 */
export function apellidoDelAutor(author: string | null | undefined): string {
    const primero = ((author ?? '').split(/;| y | and | & /)[0] ?? '').trim();
    const antesDeLaComa = (primero.split(',')[0] ?? '').trim();
    // «Apellido, Nombre»: lo de antes de la coma es una sola palabra.
    if (primero.includes(',') && !/\s/.test(antesDeLaComa)) return antesDeLaComa;
    // «Nombre Apellido[, Otro Autor]»: la última palabra, sin «Jr.» y similares.
    const palabras = antesDeLaComa.split(/\s+/).filter(p => !/^(jr|sr|ii|iii|iv)\.?$/i.test(p));
    return palabras.at(-1) ?? '';
}
