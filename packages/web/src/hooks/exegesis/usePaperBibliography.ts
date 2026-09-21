import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryService } from '@dosfilos/application';
import { readBibliographyFromCover } from '@dosfilos/infrastructure';
import {
    SYSTEM_SOURCE_OWNER_ID,
    isCitableSourceType,
    missingBibliographyFields,
    type BibliographicData,
    type ExegeticalPaper,
    type RequiredBibliographyField,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';

export interface PaperBibliographyRow {
    sourceId: string;
    resourceId: string;
    citationKey: string;
    displayLabel: string;
    data: BibliographicData | null;
    missing: RequiredBibliographyField[];
    /**
     * Si la ficha de este libro se puede escribir desde aquí.
     *
     * Las fuentes de la biblioteca común son de todos y de nadie: las
     * reglas rechazan el guardado. Sin esta marca el botón invitaba a leer
     * la portada —gastando la llamada al modelo— para chocar después.
     */
    editable: boolean;
}

/**
 * Los datos de portada de las fuentes citables del trabajo.
 *
 * Se leen de la biblioteca, que ya viaja sincronizada: los datos son del
 * LIBRO y no del trabajo, así que se escriben una vez y los reutiliza
 * cada trabajo que lo cite.
 */
export function usePaperBibliography(paper: ExegeticalPaper | null | undefined): PaperBibliographyRow[] {
    const { resources } = useLibrary();

    return useMemo(() => {
        if (!paper) return [];
        const byId = new Map(resources.map(r => [r.id, r as {
            bibliography?: BibliographicData | null;
            userId?: string;
        }]));

        return paper.sources
            .filter(s => isCitableSourceType(s.sourceType))
            .map(s => {
                const resourceId = s.sourceLibraryResourceId ?? s.corpusId;
                const resource = byId.get(resourceId);
                const data = resource?.bibliography ?? null;
                return {
                    sourceId: s.id,
                    resourceId,
                    citationKey: s.citationKey ?? s.displayLabel,
                    displayLabel: s.displayLabel,
                    data,
                    missing: missingBibliographyFields(data),
                    editable: resource?.userId !== SYSTEM_SOURCE_OWNER_ID,
                };
            });
    }, [paper, resources]);
}

/**
 * Guarda los datos de portada sobre el RECURSO, no sobre el trabajo.
 *
 * Es el libro el que tiene editorial y año; escribirlos por trabajo
 * obligaría a repetirlos en cada uno y dejaría dos verdades sobre el
 * mismo ejemplar.
 */
export function useSaveBibliography() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { resourceId: string; data: BibliographicData }) => {
            await libraryService.updateResource(input.resourceId, { bibliography: input.data });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['library'] });
        },
    });
}

/**
 * Lee la ficha de la portada del propio ejemplar.
 *
 * No guarda nada: devuelve una PROPUESTA que el diálogo vuelca sobre los
 * campos vacíos. Quien tiene el libro en la mano confirma y guarda, que es
 * el mismo gesto de siempre.
 */
export function useReadBibliographyFromCover() {
    return useMutation({
        mutationFn: (resourceId: string) => readBibliographyFromCover(resourceId),
    });
}
