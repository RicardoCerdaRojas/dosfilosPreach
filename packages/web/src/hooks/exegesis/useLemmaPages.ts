import { useQueries } from '@tanstack/react-query';
import { searchDocumentText } from '@dosfilos/infrastructure';
import { rankLemmaSheets, type LemmaPageProposal } from '@dosfilos/domain';

const KEY = 'exegesis-lemma-pages';

/**
 * Las páginas del léxico donde vive cada lema del pasaje.
 *
 * Una consulta por lema, en paralelo: son pocos —siete en un estudio de
 * tres versos— y así la primera propuesta aparece sin esperar a la
 * última. Se cachean porque el lema no cambia mientras el análisis no
 * cambie, y recorrer un léxico de 807 páginas cuesta segundos.
 */
export function useLemmaPages(
    resourceId: string | null,
    lemmas: ReadonlyArray<{ lemma: string; term: string }>,
    enabled: boolean,
) {
    const results = useQueries({
        queries: lemmas.map(({ lemma, term }) => ({
            queryKey: [KEY, resourceId, lemma],
            queryFn: async (): Promise<LemmaPageProposal> => {
                const { hits } = await searchDocumentText(resourceId!, lemma, 'lema');
                return { lemma, term, sheets: rankLemmaSheets(hits) };
            },
            enabled: enabled && !!resourceId && lemma.trim().length > 0,
            staleTime: 30 * 60 * 1000,
            gcTime: 60 * 60 * 1000,
            retry: 1,
        })),
    });

    return {
        proposals: results.map(r => r.data).filter((p): p is LemmaPageProposal => !!p),
        isLoading: results.some(r => r.isLoading),
        isError: results.length > 0 && results.every(r => r.isError),
    };
}
