import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryService } from '@dosfilos/application';
import { readBibliographyFromCover } from '@dosfilos/infrastructure';
import {
    buildPaperBibliography,
    isCitableSourceType,
    missingBibliographyFields,
    type BibliographicData,
    type BibliographyEntry,
    type ExegeticalPaper,
    type RequiredBibliographyField,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';
import { useFirebase } from '@/context/firebase-context';

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
     * Es la MISMA condición que las reglas de Firestore: dueño del
     * recurso. No «que no sea del sistema», que dejaba pasar la
     * biblioteca común —sus documentos llevan el identificador de un
     * administrador— y también dejaba pasar todo mientras la biblioteca
     * todavía cargaba. Una compuerta de permisos no abre ante la duda.
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
    const { user } = useFirebase();
    const uid = user?.uid;

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
                    editable: !!uid && resource?.userId === uid,
                };
            });
    }, [paper, resources, uid]);
}

/**
 * La bibliografía que se imprime en el trabajo: sólo las fuentes CITADAS.
 *
 * Se separa de `usePaperBibliography` —que lista todas las fuentes citables
 * del corpus, porque esa tarjeta sirve para completar fichas— por lo que cada
 * una responde. La tarjeta pregunta «¿a qué libro de mi corpus le falta la
 * ficha?». El documento pregunta «¿qué libros cité?», y son distintos: el
 * corpus de Santiago 2:1-13 tenía siete fuentes y el trabajo citó cinco.
 */
export function usePaperBibliographyEntries(
    paper: ExegeticalPaper | null | undefined,
): BibliographyEntry[] {
    const rows = usePaperBibliography(paper);
    return useMemo(
        () => (paper ? buildPaperBibliography(paper, rows) : []),
        [paper, rows],
    );
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
