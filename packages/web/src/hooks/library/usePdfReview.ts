import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    findLibraryResourceForRecommendation,
    getSourceRecommendations,
    reviewPdf,
    SOURCE_TYPE_ORDER,
    type LibraryResource,
    type PdfReview,
    type PdfReviewInput,
} from '@dosfilos/domain';
import { useLibrary } from './useLibrary';
import { useDocumentPdfUrl } from '@/hooks/exegesis/useDocumentPageIndex';
import { tipoDelRecurso } from '@/components/exegesis/setup/faltaParaLaRubrica';
import { readPdfForReview, type PdfReviewRead } from '@/lib/pdf/readPdfForReview';

const isEbook = (r: Pick<LibraryResource, 'mimeType'>) => /epub|mobi/i.test(r.mimeType ?? '');

/**
 * La edición que cita el catálogo para esta obra. Primero en su tipo y después
 * en los demás: McCartney (BECNT) está en el catálogo como expositivo y el
 * registro lo tenía como exegético, y la bandeja decía que no estaba.
 */
export function citedEditionFor(resource: LibraryResource): PdfReviewInput['cited'] {
    const propio = tipoDelRecurso(resource);
    const tipos = [propio, ...SOURCE_TYPE_ORDER.filter(t => t !== propio)];
    for (const libro of resource.coversBibleBooks ?? []) {
        for (const rec of tipos.flatMap(t => getSourceRecommendations(libro, t))) {
            if (findLibraryResourceForRecommendation(rec, [{ id: resource.id, title: resource.title, author: resource.author ?? null, coversBibleBooks: resource.coversBibleBooks ?? null }])) {
                return { title: rec.title, year: rec.year || null, publisher: rec.publisher || null, isbn: rec.isbn };
            }
        }
    }
    return null;
}

export function buildReviewInput(resource: LibraryResource, read: PdfReviewRead | null): PdfReviewInput {
    return {
        declared: {
            title: resource.title,
            author: resource.author ?? null,
            books: resource.coversBibleBooks ?? [],
            bibliographyYear: resource.bibliography?.year ?? null,
            isbn: resource.bibliography?.isbn ?? null,
            storedNumbering: resource.pageNumbering ?? null,
            storedConfirmed: resource.pageNumbering?.origin === 'confirmed',
        },
        cited: citedEditionFor(resource),
        front: read?.front ?? [],
        samples: read?.samples ?? [],
        file: read
            ? { numPages: read.numPages, producer: read.producer, creator: read.creator, hasText: read.hasText }
            // Un libro electrónico no tiene hojas que leer: no tiene páginas impresas.
            : { numPages: 0, hasText: true, isEbook: true },
    };
}

/**
 * La bandeja de revisión de un libro (A7): lee las muestras del PDF en el
 * navegador y las compara con el registro, el catálogo y la numeración
 * guardada. No llama al asistente ni cobra.
 */
export function usePdfReview(resourceId: string | null) {
    const { resources, isLoading: cargandoBiblioteca } = useLibrary();
    const resource = useMemo(() => resources.find(r => r.id === resourceId) ?? null, [resources, resourceId]);
    const ebook = !!resource && isEbook(resource);
    const pdf = useDocumentPdfUrl(resourceId, !!resource && !ebook);
    const lectura = useQuery({
        queryKey: ['pdf-review', resourceId, pdf.data?.url ? 'url' : null],
        enabled: !!pdf.data?.url && !ebook,
        staleTime: 30 * 60 * 1000,
        retry: 0,
        queryFn: () => readPdfForReview(pdf.data!.url),
    });
    const review: PdfReview | null = useMemo(() => {
        if (!resource) return null;
        if (ebook) return reviewPdf(buildReviewInput(resource, null));
        return lectura.data ? reviewPdf(buildReviewInput(resource, lectura.data)) : null;
    }, [resource, ebook, lectura.data]);
    return {
        resource,
        review,
        ebook,
        read: lectura.data ?? null,
        pdfUrl: pdf.data?.url ?? null,
        isLoading: cargandoBiblioteca || (!ebook && (pdf.isLoading || lectura.isLoading)),
        error: pdf.error ?? lectura.error ?? null,
        notFound: !cargandoBiblioteca && !resource,
    };
}
