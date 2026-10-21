import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
    LEMMA_ENTRY_SOURCE_TYPES,
    declaresNoFolios,
    hasResolvedNumbering,
    normalizeSheetRanges,
    parseBriefQuestions,
    questionLemmas,
    reviewCorpusByQuestion,
    type CorpusQuestionReview,
    type ExegeticalPaper,
    type LibraryResource,
    type ProjectSource,
    type QuestionReviewSource,
    type SheetRange,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';
import { passagePagesQuery } from './usePassagePages';
import { lemmaPagesQuery } from './useLemmaPages';
import { usePassageLemmas } from './usePassageLemmas';

/** Una fuente del corpus que la revisión puede leer: tiene libro en la biblioteca. */
export interface ReviewedSource {
    source: ProjectSource;
    resourceId: string;
    resource: LibraryResource;
    /** Lo que el corpus declara de esta fuente; `null` = el documento entero. */
    selected: SheetRange[] | null;
}

export interface CorpusQuestionReviewState {
    /** `null` cuando no hay nada que revisar: sin preguntas o pasaje de varios capítulos. */
    review: CorpusQuestionReview | null;
    sources: ReadonlyMap<string, ReviewedSource>;
    /** Fuentes cuya búsqueda falló: no se juzgan, y la tarjeta lo dice. */
    failed: string[];
    isLoading: boolean;
}

/**
 * «¿Qué responde cada pregunta?» (TP #8, fase 8a, A4): los datos de la
 * revisión del corpus por pregunta.
 *
 * Una búsqueda por libro en el índice de pasajes (la misma que usa el
 * selector de páginas, con la misma llave: lo que ya se buscó allí no se busca
 * de nuevo) y, en léxicos y diccionarios, una de los lemas de la consigna. No
 * usa al asistente ni embeddings: lee los fragmentos del libro en Firestore.
 */
export function useCorpusQuestionReview(paper: ExegeticalPaper | null | undefined): CorpusQuestionReviewState {
    const { resources } = useLibrary();

    const questions = useMemo(
        () => (paper ? parseBriefQuestions(paper.assignmentBrief, paper.passage) : []),
        [paper],
    );
    const passage = paper?.passage ?? null;
    const unCapitulo = !!passage && passage.chapterStart === (passage.chapterEnd ?? passage.chapterStart);
    const conPreguntas = unCapitulo && questions.some(q => q.verses.some(v => v.chapter === passage!.chapterStart));

    const fuentes = useMemo(() => {
        const out = new Map<string, ReviewedSource>();
        for (const source of paper?.sources ?? []) {
            // El paper modelo no se cita: ni páginas ni numeración que revisar.
            if (source.sourceType === 'style-template-paper') continue;
            const resourceId = source.sourceLibraryResourceId ?? source.corpusId;
            // Sólo los libros de la biblioteca tienen índice de pasajes. Una
            // fuente subida por fuera devolvería «no nombra nada» y la revisión
            // diría que sobra.
            const resource = resources.find(r => r.id === resourceId);
            if (!resource) continue;
            const selected = selectedSheetsOf(source);
            if (selected === undefined) continue;
            out.set(source.id, { source, resourceId, resource, selected });
        }
        return out;
    }, [paper?.sources, resources]);
    const lista = [...fuentes.values()];
    const lexicas = lista.filter(f => LEMMA_ENTRY_SOURCE_TYPES.has(f.source.sourceType));

    const morfologia = usePassageLemmas(paper, conPreguntas && lexicas.length > 0);
    const lemas = useMemo(
        () => questionLemmas(questions, morfologia.data?.entries ?? []),
        [questions, morfologia.data],
    );

    const porPasaje = useQueries({
        queries: lista.map(f => {
            const options = passagePagesQuery(f.resourceId, passage);
            return { ...options, enabled: conPreguntas && options.enabled };
        }),
    });
    const porLema = useQueries({
        queries: lexicas.map(f => {
            const options = lemmaPagesQuery(f.resourceId, lemas);
            return { ...options, enabled: conPreguntas && !morfologia.isLoading && options.enabled };
        }),
    });

    // Los arreglos de `useQueries` son nuevos en cada render: el memo se ata a
    // su estado, como en `useCorpusFootprint`.
    const clavePasaje = porPasaje.map(q => `${q.status}${q.dataUpdatedAt}`).join(',');
    const claveLema = porLema.map(q => `${q.status}${q.dataUpdatedAt}`).join(',');

    return useMemo(() => {
        if (!conPreguntas || !passage) {
            return { review: null, sources: fuentes, failed: [], isLoading: false };
        }
        const failed: string[] = [];
        const entradas: QuestionReviewSource[] = lista.map((f, i) => {
            const pasaje = porPasaje[i]!;
            if (pasaje.isError) failed.push(f.source.id);
            const esLexica = LEMMA_ENTRY_SOURCE_TYPES.has(f.source.sourceType);
            let lemmaEntries: QuestionReviewSource['lemmaEntries'];
            if (esLexica) {
                const q = porLema[lexicas.indexOf(f)];
                if (morfologia.isLoading) lemmaEntries = null;
                else if (lemas.length === 0) lemmaEntries = [];
                else if (q?.isSuccess) {
                    lemmaEntries = lemas.map(l => {
                        const hallado = q.data.find(p => p.lemma === l.lemma);
                        return {
                            question: l.question,
                            lemma: l.lemma,
                            term: l.term,
                            entry: hallado?.entry ? { start: hallado.entry.startSheet, end: hallado.entry.endSheet } : null,
                            appears: !!hallado && (hallado.sheets.length > 0 || !!hallado.entry),
                        };
                    });
                } else {
                    if (q?.isError) failed.push(f.source.id);
                    lemmaEntries = null;
                }
            }
            return {
                sourceId: f.source.id,
                sourceType: f.source.sourceType,
                selected: f.selected,
                pinned: f.source.excerptRecipe?.pinnedRanges ?? [],
                verseHits: pasaje.isSuccess
                    ? pasaje.data.map(h => ({ sheet: h.sheet, count: h.count, verses: h.verses }))
                    : null,
                ...(esLexica ? { lemmaEntries } : {}),
                printedPages: printedPagesOf(f),
            };
        });
        const review = reviewCorpusByQuestion({ questions, chapter: passage.chapterStart, sources: entradas });
        return {
            review,
            sources: fuentes,
            failed: [...new Set(failed)],
            isLoading: review.pending.length > failed.length,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conPreguntas, passage, fuentes, questions, lemas, morfologia.isLoading, clavePasaje, claveLema]);
}

/**
 * Las hojas que el corpus declara de una fuente. `null`: el documento entero.
 * `undefined`: no se puede saber (fragmentos viejos sin hoja), y la fuente no
 * se revisa: afirmar «esa hoja no está» sobre una fuente así sería inventar.
 */
function selectedSheetsOf(source: ProjectSource): SheetRange[] | null | undefined {
    if (source.excerptRecipe) return [...source.excerptRecipe.sheetRanges];
    if (source.mode === 'full-document') return null;
    const hojas = source.excerpts.map(e => e.sheet).filter((s): s is number => typeof s === 'number');
    return hojas.length > 0 ? normalizeSheetRanges(hojas.map(s => ({ start: s, end: s }))) : undefined;
}

function printedPagesOf(f: ReviewedSource): QuestionReviewSource['printedPages'] {
    if (declaresNoFolios(f.resource.pageNumbering)) return 'none';
    return hasResolvedNumbering(f.resource.pageNumbering) ? 'resolved' : 'unresolved';
}
