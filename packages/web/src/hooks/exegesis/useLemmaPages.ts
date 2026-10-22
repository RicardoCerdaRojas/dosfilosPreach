import { useQuery } from '@tanstack/react-query';
import { searchLemmasAndEntriesInDocument } from '@dosfilos/infrastructure';
import { rankLemmaSheets, type LemmaPageProposal } from '@dosfilos/domain';

const KEY = 'exegesis-lemma-pages';

/**
 * Las páginas del léxico donde vive cada lema del pasaje.
 *
 * UNA consulta para todos los lemas (modo `'lemas'` de la callable): cada
 * búsqueda lee todos los fragmentos del léxico, y con los lemas del pasaje
 * entero —decenas— una consulta por lema era leer el libro decenas de veces
 * por cada apertura del selector. Se cachea porque los lemas no cambian
 * mientras el pasaje no cambie.
 */
/** La consulta, para varios libros a la vez (`useCorpusQuestionReview`). Misma llave. */
export function lemmaPagesQuery(resourceId: string | null, lemmas: ReadonlyArray<{ lemma: string; term: string }>) {
    const terms = lemmas.map(l => l.lemma).filter(l => l.trim().length > 0);
    return {
        queryKey: [KEY, resourceId, terms.join('|')],
        queryFn: async (): Promise<LemmaPageProposal[]> => {
            const { byTerm, entries } = await searchLemmasAndEntriesInDocument(resourceId!, terms);
            // La entrada del lema, si el libro la abre en negrita o con un título
            // (TP #8, fase 8a, A2): la hoja con más apariciones puede ser la
            // lista de citas, no la definición.
            return lemmas.map(({ lemma, term }) => ({
                lemma,
                term,
                sheets: rankLemmaSheets(byTerm[lemma] ?? []),
                ...(entries[lemma] ? { entry: entries[lemma] } : {}),
            }));
        },
        enabled: !!resourceId && terms.length > 0,
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    };
}

export function useLemmaPages(
    resourceId: string | null,
    lemmas: ReadonlyArray<{ lemma: string; term: string }>,
    enabled: boolean,
) {
    const options = lemmaPagesQuery(resourceId, lemmas);
    const query = useQuery({ ...options, enabled: enabled && options.enabled });

    return {
        proposals: query.data ?? [],
        isLoading: query.isLoading && query.fetchStatus !== 'idle',
        isError: query.isError,
    };
}
