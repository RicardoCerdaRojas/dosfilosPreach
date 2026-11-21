import { useMemo } from 'react';
import {
    commentaryBookCoverage,
    corpusNeeds,
    corpusNeedsCoverage,
    declaresNoFolios,
    exclusionFor,
    getSourceRecommendations,
    isCommentaryType,
    sourceTypesForRubric,
    type ExegeticalPaper,
    type NeedLibraryBook,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';
import { usePaperExclusions } from './usePaperExclusions';
import { tipoDelRecurso } from '@/components/exegesis/setup/faltaParaLaRubrica';
import { resourceIdsOf } from '@/components/exegesis/setup/extractionDefaults';

/**
 * «Qué conseguir» (A6): las necesidades del corpus con sus candidatas. Solo
 * lee: la biblioteca (propia y compartida), el catálogo curado del libro
 * bíblico y la regla de no repetir. No llama al asistente.
 */
export function useCorpusNeeds(paper: ExegeticalPaper) {
    const { resources } = useLibrary();
    const exclusiones = usePaperExclusions(paper);
    return useMemo(() => {
        const bookId = paper.passage.bookId;
        const enElCorpus = resourceIdsOf(paper.sources, () => true);
        const excluido = (author: string | null | undefined) => {
            const ex = exclusionFor({ citationKey: null, author: author ?? null }, exclusiones);
            return ex ? ex.previousPaperTitle ?? ex.key : null;
        };
        const library: NeedLibraryBook[] = resources.map(r => {
            const tipo = tipoDelRecurso(r);
            return {
                id: r.id, title: r.title, author: r.author, sourceType: tipo,
                year: r.bibliography?.year ?? null,
                noFolios: declaresNoFolios(r.pageNumbering),
                otherBook: isCommentaryType(tipo) && commentaryBookCoverage(r, bookId) === 'other-books',
                inCorpus: enElCorpus.has(r.id),
                excludedBy: enElCorpus.has(r.id) ? null : excluido(r.author),
            };
        });
        const lang = paper.displayLanguage === 'en' ? 'en' : 'es';
        const needs = corpusNeeds({
            rubric: paper.rubric,
            corpusTypes: sourceTypesForRubric(paper.sources, id => resources.find(r => r.id === id), bookId),
            library,
            recommendationsFor: type => getSourceRecommendations(bookId, type, lang),
            excludedRecommendation: rec => excluido(rec.author),
            marks: paper.acquisitionMarks,
        });
        return { needs, coverage: corpusNeedsCoverage(needs) };
    }, [paper, resources, exclusiones]);
}
