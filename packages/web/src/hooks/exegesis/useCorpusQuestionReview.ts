import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
    LEMMA_ENTRY_SOURCE_TYPES,
    commentarySectionsByVerse,
    declaresNoFolios,
    hasResolvedNumbering,
    normalizeSheetRanges,
    parseBriefQuestions,
    questionLemmas,
    questionsOfStep,
    stepPinnedSheets,
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
import { documentOutlineQuery, documentPageIndexQuery } from './useDocumentPageIndex';

/** Texto base, aparato y comentario textual: sus pocas hojas del pasaje sirven a toda pregunta (A3). */
const DEL_PASAJE: ReadonlySet<string> = new Set(['biblical-text-edition', 'critical-apparatus', 'textual-commentary']);
/** Más hojas que esto no son «la porción del pasaje»: el corpus tomó otra cosa. */
const MAX_HOJAS_DEL_PASAJE = 4;
const esComentario = (t: string) => t === 'commentary-critical' || t === 'commentary-expository';

/** Una fuente del corpus que la revisión puede leer: tiene libro en la biblioteca. */
export interface ReviewedSource {
    source: ProjectSource;
    resourceId: string;
    resource: LibraryResource;
    /** Lo que el corpus declara de esta fuente; `null` = el documento entero. */
    selected: SheetRange[] | null;
    /**
     * Se le pueden agregar y fijar hojas: tiene receta de páginas. Un
     * documento completo o una fuente de fragmentos sin receta se ajustan en
     * el selector (revisión de 8a).
     */
    editable: boolean;
}

export interface CorpusQuestionReviewState {
    /** `null` cuando no hay nada que revisar: sin preguntas o pasaje de varios capítulos. */
    review: CorpusQuestionReview | null;
    sources: ReadonlyMap<string, ReviewedSource>;
    /** Fuentes cuya búsqueda falló: no se juzgan, y la tarjeta lo dice. */
    failed: string[];
    /** Fuentes sin fragmentos indexados: tampoco se juzgan. */
    unindexed: string[];
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
            out.set(source.id, { source, resourceId, resource, selected, editable: !!source.excerptRecipe });
        }
        return out;
    }, [paper?.sources, resources]);
    const lista = [...fuentes.values()];
    const lexicas = lista.filter(f => LEMMA_ENTRY_SOURCE_TYPES.has(f.source.sourceType));

    const morfologia = usePassageLemmas(paper, conPreguntas && lexicas.length > 0);
    const lemas = useMemo(
        () => questionLemmas(questions, morfologia.data?.entries ?? [], morfologia.data?.strongToLemma),
        [questions, morfologia.data],
    );

    const porPasaje = useQueries({
        queries: lista.map(f => {
            const options = passagePagesQuery(f.resourceId, passage);
            return { ...options, enabled: conPreguntas && options.enabled };
        }),
    });
    // Comentarios: el esquema y el índice de hojas, para la sección de cada versículo (A3).
    const comentarios = lista.filter(f => esComentario(f.source.sourceType));
    const porEsquema = useQueries({
        queries: comentarios.map(f => ({ ...documentOutlineQuery(f.resourceId), enabled: conPreguntas })),
    });
    const porIndice = useQueries({
        queries: comentarios.map(f => ({ ...documentPageIndexQuery(f.resourceId), enabled: conPreguntas })),
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
    const claveSecciones = [...porEsquema, ...porIndice].map(q => `${q.status}${q.dataUpdatedAt}`).join(',');
    const versiculosConPregunta = useMemo(
        () => [...new Set(questions.flatMap(q => q.verses.filter(v => v.chapter === passage?.chapterStart).map(v => v.verse)))],
        [questions, passage?.chapterStart],
    );

    return useMemo(() => {
        if (!conPreguntas || !passage) {
            return { review: null, sources: fuentes, failed: [], unindexed: [], isLoading: false };
        }
        const failed: string[] = [];
        // Un libro sin fragmentos indexados (sin extraer, fallido, en
        // reproceso) no «no nombra nada»: no se puede revisar.
        const sinIndice: string[] = [];
        const entradas: QuestionReviewSource[] = lista.map((f, i) => {
            const pasaje = porPasaje[i]!;
            if (pasaje.isError) failed.push(f.source.id);
            const indexado = !pasaje.isSuccess || pasaje.data.scannedChunks > 0;
            if (!indexado) sinIndice.push(f.source.id);
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
            const c = comentarios.indexOf(f);
            const esquema = c >= 0 ? porEsquema[c] : undefined;
            const indice = c >= 0 ? porIndice[c] : undefined;
            const sectionsByVerse = esquema?.isSuccess && indice?.isSuccess
                ? commentarySectionsByVerse({
                    entries: esquema.data,
                    pageIndex: indice.data.pages,
                    passage,
                    verses: versiculosConPregunta,
                    sourceType: f.source.sourceType,
                })
                : undefined;
            const hojasDelPasaje = f.selected?.reduce((n, r) => n + r.end - r.start + 1, 0) ?? Infinity;
            const passageSheets = DEL_PASAJE.has(f.source.sourceType) && f.selected && hojasDelPasaje <= MAX_HOJAS_DEL_PASAJE
                ? f.selected
                : undefined;
            return {
                sourceId: f.source.id,
                sourceType: f.source.sourceType,
                selected: f.selected,
                ...(sectionsByVerse ? { sectionsByVerse } : {}),
                ...(passageSheets ? { passageSheets } : {}),
                pinned: f.source.excerptRecipe?.pinnedRanges ?? [],
                pinnedByQuestion: fijadoPorPregunta(paper, questions, f.source.id),
                verseHits: pasaje.isSuccess && indexado
                    ? pasaje.data.proposals.map(h => ({ sheet: h.sheet, count: h.count, verses: h.verses, snippet: h.snippet }))
                    : null,
                ...(esLexica ? { lemmaEntries } : {}),
                printedPages: printedPagesOf(f),
            };
        });
        const review = reviewCorpusByQuestion({ questions, chapter: passage.chapterStart, sources: entradas });
        // Sin repetir: un léxico cuyas dos búsquedas fallaron contaba dos veces
        // y apagaba «cargando» con otra fuente todavía en vuelo (revisión de 8a).
        const fallidas = [...new Set(failed)];
        const sinIndiceUnicas = [...new Set(sinIndice)].filter(id => !fallidas.includes(id));
        return {
            review,
            sources: fuentes,
            failed: fallidas,
            unindexed: sinIndiceUnicas,
            isLoading: review.pending.length > fallidas.length + sinIndiceUnicas.length,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conPreguntas, passage, fuentes, questions, lemas, morfologia.isLoading, clavePasaje, claveLema, claveSecciones, versiculosConPregunta]);
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

/** Lo fijado solo en un paso, por pregunta de ese paso (PR 2). */
function fijadoPorPregunta(
    paper: ExegeticalPaper | null | undefined,
    questions: ReturnType<typeof parseBriefQuestions>,
    sourceId: string,
): Record<number, SheetRange[]> {
    const out: Record<number, SheetRange[]> = {};
    for (const step of paper?.steps ?? []) {
        const hojas = stepPinnedSheets(paper!.stepPlan.perStep[step.id], sourceId);
        if (hojas.length === 0) continue;
        for (const q of questionsOfStep(step, questions)) out[q.number] = normalizeSheetRanges([...(out[q.number] ?? []), ...hojas]);
    }
    return out;
}
