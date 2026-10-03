import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    lemmaKey,
    suggestGrammarSelection,
    suggestLexiconSelection,
    type LemmaPageProposal,
    type LexiconSuggestion,
    type PageIndexEntry,
    type PassageLemma,
    type SectionProposal,
} from '@dosfilos/domain';
import { loadNtFrequency, loadOtFrequency } from './lemmaFrequency';

/**
 * Desde cuántas apariciones en la Biblia un lema es «de todos los días» y va
 * al final. Distinto por testamento: en estas tablas el AT tiene 300.808
 * palabras y el NT 137.554 (×2,2). Medido: אָמַר 5.318, הָיָה 3.575 en el AT;
 * λέγω 2.345, εἰμί 2.456 en el NT.
 */
const COMMON_FROM = { hebrew: 1000, greek: 500 } as const;

/**
 * La «Selección sugerida» del libro que se está curando: para un léxico, la
 * entrada de cada lema del pasaje (`suggestLexiconSelection`); para una
 * gramática, las secciones que tratan sus categorías
 * (`suggestGrammarSelection`).
 *
 * Sin tope total: las hojas elegidas son un FILTRO, y el tope se aplica por
 * versículo al consultar (`retrieveCurated` → `selectForPrompt`). Cortar el
 * total con el tope de un versículo dejaba «fuera por presupuesto» entradas
 * que en su versículo entraban sin problema —el error de #730, otra vez
 * (revisión adversarial de B3)—. Lo común va al final para que se desmarque
 * a mano si sobra.
 */
const SIN_TOPE = Number.POSITIVE_INFINITY;
export function useLexiconSuggestion(input: {
    kind: 'lexicon' | 'grammar' | null;
    hebrew: boolean;
    lemmas: ReadonlyArray<PassageLemma>;
    lemmaProposals: ReadonlyArray<LemmaPageProposal>;
    sectionProposals: ReadonlyArray<SectionProposal>;
    pages: ReadonlyArray<PageIndexEntry>;
}): LexiconSuggestion | null {
    const frecuencia = useQuery({
        queryKey: ['exegesis-lemma-frequency', input.hebrew ? 'ot' : 'nt'],
        queryFn: () => (input.hebrew ? loadOtFrequency() : loadNtFrequency()),
        enabled: input.kind === 'lexicon' && input.lemmas.length > 0,
        staleTime: Infinity,
    });

    return useMemo(() => {
        const chars = new Map(input.pages.map(p => [p.sheet, p.charCount]));
        const sheetChars = (sheet: number) => chars.get(sheet) ?? 0;
        if (input.kind === 'grammar') {
            if (input.sectionProposals.length === 0) return null;
            return suggestGrammarSelection({ sections: input.sectionProposals, sheetChars, budgetChars: SIN_TOPE });
        }
        if (input.kind !== 'lexicon' || !frecuencia.data || input.lemmaProposals.length === 0) return null;
        const tabla = frecuencia.data;
        // Por clave de lema, no por la grafía: el análisis escribe «חוס» o ά con
        // oxia y la morfología «חוּס» o U+03AC (revisión adversarial de B2).
        const hojas = new Map(input.lemmaProposals.map(p => [lemmaKey(p.lemma), p.sheets]));
        const sugerencia = suggestLexiconSelection({
            lemmas: input.lemmas,
            sheetsOf: l => hojas.get(lemmaKey(l)) ?? [],
            bibleCount: l => (input.hebrew ? (l.strong ? tabla[String(l.strong)] : undefined) : tabla[l.lemma]),
            commonFrom: input.hebrew ? COMMON_FROM.hebrew : COMMON_FROM.greek,
            sheetChars,
            budgetChars: SIN_TOPE,
        });
        return { ...sugerencia, frequencyCorpus: input.hebrew ? 'OT' : 'NT' };
    }, [input.kind, input.hebrew, input.lemmas, input.lemmaProposals, input.sectionProposals, input.pages, frecuencia.data]);
}
