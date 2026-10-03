import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import { fetchDocumentPageIndex, proposeSheetRanges } from '@dosfilos/infrastructure';
import type { ExegeticalPaper } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useSelectSourcePages } from './useSelectSourcePages';
import { heredarConPaginas } from './heredarConPaginas';

/**
 * El corpus que este trabajo puede heredar de sus hermanos de serie.
 *
 * Vive aparte de `useExegesisPapers` porque se consulta en un solo lugar —el
 * paso del corpus— y porque la consulta necesita el `paperId`, que aquel hook
 * no tiene.
 */
export function useCorpusHeredado(paperId: string | null | undefined) {
    const { user } = useFirebase();
    const queryClient = useQueryClient();

    const propuesta = useQuery({
        queryKey: ['exegesis', 'corpusHeredado', user?.uid, paperId],
        queryFn: async () => {
            if (!user?.uid || !paperId) return null;
            return exegesisService.inheritCorpus.proponer(user.uid, paperId);
        },
        enabled: !!user?.uid && !!paperId,
        // La propuesta sale de leer todos los trabajos del usuario. No cambia
        // mientras se mira la pantalla, así que no se revalida al enfocar.
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const selectPages = useSelectSourcePages();
    const [avance, setAvance] = useState<{ hechas: number; total: number } | null>(null);

    /**
     * Trae las fuentes Y les propone páginas para este pasaje
     * (`heredarConPaginas`). Sin la segunda parte, el análisis leía cada
     * libro heredado desde la portada.
     */
    const heredar = useMutation({
        mutationFn: async (input: { soloEstos?: ReadonlyArray<string>; paper: ExegeticalPaper }) => {
            if (!user?.uid || !paperId) throw new Error('User not authenticated');
            const uid = user.uid;
            setAvance(null);
            return heredarConPaginas({
                heredar: () => exegesisService.inheritCorpus.aplicar({ ownerId: uid, paperId, soloEstos: input.soloEstos }),
                proponer: async resourceId => {
                    const index = await fetchDocumentPageIndex(resourceId);
                    const p = await proposeSheetRanges({
                        resourceId,
                        userId: uid,
                        passage: input.paper.passage,
                        assignmentBrief: input.paper.assignmentBrief,
                        language: input.paper.displayLanguage,
                        pageIndex: index.pages,
                    });
                    return { ranges: p.ranges, kind: p.kind, pageIndex: index.pages };
                },
                guardar: async (fuente, propuesta, hojas, fijadas) => {
                    await selectPages.mutateAsync({
                        paperId,
                        libraryResourceId: fuente.sourceLibraryResourceId ?? fuente.corpusId,
                        displayLabel: fuente.displayLabel,
                        sourceType: fuente.sourceType,
                        chosenRole: fuente.chosenRole ?? null,
                        citationKey: fuente.citationKey ?? null,
                        sheetRanges: hojas,
                        proposedRanges: propuesta.ranges,
                        pinnedRanges: fijadas,
                        pageIndex: propuesta.pageIndex,
                        // La propuesta se aceptó sin pasar por ojo humano, y
                        // queda dicho para que el corpus pueda mostrarlo.
                        selectionMode: propuesta.kind === 'structural' ? 'structural' : 'semantic',
                    });
                },
                alAvanzar: (hechas, total) => setAvance({ hechas, total }),
            });
        },
        onSettled: () => {
            setAvance(null);
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'corpusHeredado', user?.uid, paperId] });
        },
    });

    return { propuesta, heredar, avance };
}
