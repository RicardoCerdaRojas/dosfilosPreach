import type { SheetRange } from '../entities/ProjectSource';
import { normalizeSheetRanges } from '../outline/documentPageIndex';
import type { SourceType } from '../entities/SourceType';
import type { BriefQuestion } from './briefQuestions';

/**
 * «¿Qué responde cada pregunta?»: la revisión del corpus ANTES de generar.
 *
 * TP #8 (2026-10-21, fase 8a, A4). Las alarmas del día salieron de material
 * que faltaba en el corpus y nadie lo sabía hasta que el verificador no
 * encontraba la cita: la nota de Mayor sobre 4:3 (h. 411) quedó afuera, las
 * hojas de Wallace que nombran Stg 4 no estaban fijadas, la entrada de μέλος
 * en Tuggy entró a medias (585 sin la 584). Con los datos de A1 (las hojas que
 * nombran cada versículo), A2 (la entrada de cada lema de la consigna) y A3
 * (las notas de los comentarios clásicos) se puede decir todo eso antes de
 * gastar en el análisis.
 *
 * Es determinista: no lee ningún texto, sólo cruza lo que ya devolvió el
 * índice con lo que el corpus declara (`excerptRecipe`).
 */

/** Lo que se sabe de UNA fuente del corpus. */
export interface QuestionReviewSource {
    sourceId: string;
    sourceType: SourceType;
    /** Las hojas que el corpus declara. `null`: entra el documento entero. */
    selected: ReadonlyArray<SheetRange> | null;
    /** Las hojas fijadas (entran a todos los pasos sin competir). */
    pinned: ReadonlyArray<SheetRange>;
    /**
     * Las hojas del libro que nombran versículos del capítulo del pasaje, con
     * los versículos que nombra cada una (A1/A3). `null`: no se pudo buscar
     * (todavía cargando, o la búsqueda falló); la fuente no se juzga.
     */
    verseHits: ReadonlyArray<{ sheet: number; count: number; verses: ReadonlyArray<number>; snippet?: string }> | null;
    /**
     * La entrada de cada lema de la consigna en este libro (A2). Sólo para
     * léxicos y diccionarios; `null` mientras carga o si falló.
     */
    lemmaEntries?: ReadonlyArray<QuestionLemmaEntry> | null;
    /**
     * Si las hojas del libro tienen página impresa: `'resolved'`, `'none'` (el
     * libro declara no tener folios; se cita por sección) o `'unresolved'`
     * (falta calibrar: sus citas no se podrán comprobar).
     */
    printedPages: 'resolved' | 'none' | 'unresolved';
}

export interface QuestionLemmaEntry {
    question: number;
    lemma: string;
    /** La palabra como la escribe la consigna. */
    term: string;
    /** El tramo de la entrada; `null` si el libro no la abre en negrita ni con título. */
    entry: SheetRange | null;
    /**
     * El lema aparece en el libro aunque no se haya detectado su entrada. Un
     * diccionario que lo trata en el cuerpo de otro artículo sirve: sin esto,
     * la revisión diría que la fuente no aporta nada. Por defecto, si hay entrada.
     */
    appears?: boolean;
}

/** Una hoja que toca una pregunta, y dónde está respecto del corpus. */
export interface QuestionSheet {
    sheet: number;
    /** `pinned` implica `in-corpus`. */
    state: 'pinned' | 'in-corpus' | 'outside';
    /** El renglón donde la hoja nombra el versículo, cuando la búsqueda lo trae. */
    snippet?: string;
}

/** Lo que una fuente aporta a una pregunta. */
export interface QuestionSourceCoverage {
    sourceId: string;
    /** Por qué la toca: nombra el versículo, o es la entrada de un lema. */
    via: 'verse' | 'lemma';
    /** Con `via: 'lemma'`, la palabra de la consigna. */
    term?: string;
    sheets: QuestionSheet[];
}

export interface QuestionReviewRow {
    number: number;
    text: string;
    /** Los versículos de la pregunta dentro del capítulo del pasaje. */
    verses: number[];
    sources: QuestionSourceCoverage[];
}

export type CorpusReviewWarning =
    /** La fuente no tiene ninguna hoja que nombre los versículos con pregunta. */
    | { kind: 'unrelated'; sourceId: string }
    /** Sus citas no se podrán comprobar: falta la página impresa. */
    | { kind: 'no-printed-pages'; sourceId: string }
    /**
     * El libro trata la pregunta en estas hojas y faltan en el corpus: la
     * fuente no trae nada de ella, o quedaron en un hueco de la sección
     * (Mayor 411 sobre 4:3). Una hoja que trata varias preguntas («IV 2, 3]
     * NOTES») da UN aviso con todas.
     */
    | { kind: 'missing-sheets'; sourceId: string; questions: number[]; sheets: number[] }
    /** La entrada del lema está incompleta o ausente del corpus (Tuggy 584–585). */
    | { kind: 'missing-entry'; sourceId: string; question: number; term: string; sheets: number[]; whole: boolean }
    /** Ninguna hoja del corpus nombra los versículos de la pregunta. */
    | { kind: 'question-uncovered'; question: number };

export interface CorpusQuestionReview {
    rows: QuestionReviewRow[];
    warnings: CorpusReviewWarning[];
    /** Fuentes todavía sin datos (cargando o con la búsqueda fallida). */
    pending: string[];
}

/**
 * Hojas que se muestran por fuente y pregunta. Un comentario nombra 4:5 en la
 * introducción, en el índice y en la nota: las del corpus van primero y las de
 * afuera, de más menciones a menos, hasta este tope.
 */
export const MAX_SHEETS_PER_QUESTION = 4;

/**
 * Tipos que no se juzgan por nombrar versículos.
 *
 * - El texto base y su aparato SON el pasaje: sus páginas imprimen «4» y «3»
 *   como números de capítulo y versículo, no «4:3», y el índice no las ve.
 *   Decirle al estudiante «NA28 no nombra ningún versículo» sería un consejo
 *   dañino.
 * - El paper modelo de estilo no se cita.
 * - Un comentario del libro trata el pasaje por definición. Que el índice no
 *   lo vea nombrar los versículos dice algo del índice, no del comentario:
 *   medido con el TP #8, Mayor escribe «iv. 3» y, antes de rellenar sus refs,
 *   salía «no nombra ningún versículo» → [Quitar del corpus], el peor consejo
 *   posible sobre el mejor comentario del corpus. El comentario de OTRO libro
 *   ya lo avisa la cobertura del comentario (`commentaryBookCoverage`).
 * - Léxicos y diccionarios se juzgan por la entrada del lema (ver abajo).
 */
const SIN_JUICIO_POR_VERSICULO: ReadonlySet<SourceType> = new Set<SourceType>([
    'biblical-text-edition',
    'critical-apparatus',
    'commentary-critical',
    'commentary-expository',
    'style-template-paper',
]);

/**
 * Hojas sin elegir entre dos hojas elegidas de la misma fuente, a lo sumo,
 * para leerlas como un hueco en la sección y no como otra parte del libro.
 * Medido con el TP #8: sin la 411, Mayor tenía en el corpus la 413, que
 * también nombra 4:3, y «sólo si no hay nada» no avisaba. La nota de 4:5
 * (415–417) cabe en el mismo tope.
 */
export const MAX_SECTION_GAP = 4;

/** Tipos con una entrada por lema. */
export const LEMMA_ENTRY_SOURCE_TYPES: ReadonlySet<SourceType> = new Set<SourceType>([
    'lexicon-technical',
    'theological-dictionary',
]);

export function reviewCorpusByQuestion(input: {
    questions: ReadonlyArray<BriefQuestion>;
    /** El capítulo del pasaje: los versículos de otro capítulo no se buscan. */
    chapter: number;
    sources: ReadonlyArray<QuestionReviewSource>;
}): CorpusQuestionReview {
    const rows: QuestionReviewRow[] = input.questions
        .map(q => ({
            number: q.number,
            text: q.text,
            verses: [...new Set(q.verses.filter(v => v.chapter === input.chapter).map(v => v.verse))],
            sources: [] as QuestionSourceCoverage[],
        }))
        .filter(r => r.verses.length > 0);

    const warnings: CorpusReviewWarning[] = [];
    const pending: string[] = [];
    const versiculosConPregunta = new Set(rows.flatMap(r => r.verses));
    // Por pregunta: ¿alguna fuente tiene en el corpus una hoja que la nombre?
    const cubierta = new Set<number>();
    let algunaFuenteJuzgada = false;

    for (const source of input.sources) {
        if (source.printedPages === 'unresolved') {
            warnings.push({ kind: 'no-printed-pages', sourceId: source.sourceId });
        }
        const esLexica = LEMMA_ENTRY_SOURCE_TYPES.has(source.sourceType);
        if (source.verseHits === null || (esLexica && source.lemmaEntries === null)) {
            pending.push(source.sourceId);
            continue;
        }
        algunaFuenteJuzgada = true;

        const estado = (sheet: number): QuestionSheet['state'] =>
            inRanges(sheet, source.pinned) ? 'pinned'
                : source.selected === null || inRanges(sheet, source.selected) ? 'in-corpus'
                    : 'outside';

        let tocaAlguna = false;

        for (const row of rows) {
            // En un léxico manda la entrada del lema: con la de αἰτέω en el
            // corpus, la hoja de otra palabra que cita 4:3 (Tuggy 209,
            // δαπανάω) no es material que falte para esa pregunta.
            const entradaEnElCorpus = esLexica && (source.lemmaEntries ?? []).some(l =>
                l.question === row.number && l.entry && sheetsOf(l.entry).some(sheet => estado(sheet) !== 'outside'));
            const queNombran = source.verseHits
                .filter(h => h.verses.some(v => row.verses.includes(v)))
                .map(h => ({ sheet: h.sheet, count: h.count, state: estado(h.sheet), ...(h.snippet ? { snippet: h.snippet } : {}) }));
            if (queNombran.length > 0) {
                tocaAlguna = true;
                const dentro = queNombran.filter(h => h.state !== 'outside');
                if (dentro.length > 0) cubierta.add(row.number);
                const fuera = queNombran.filter(h => h.state === 'outside').sort((a, b) => b.count - a.count || a.sheet - b.sheet);
                const porMenciones = (a: { sheet: number; count: number }, b: { sheet: number; count: number }) => b.count - a.count || a.sheet - b.sheet;
                const mostradas = [...dentro.sort(porMenciones), ...fuera].slice(0, MAX_SHEETS_PER_QUESTION);
                row.sources.push({
                    sourceId: source.sourceId,
                    via: 'verse',
                    sheets: mostradas.map(({ sheet, state, snippet }) => ({ sheet, state, ...(snippet ? { snippet } : {}) })),
                });
                // Dos casos, y no cada mención de afuera: un comentario nombra
                // el versículo en la introducción y en el índice, y avisar por
                // cada una sería ruido.
                // - la fuente no trae NADA de la pregunta: se sugiere la nota
                //   principal;
                // - una hoja que la nombra quedó en un hueco de la sección
                //   elegida (Mayor 411 entre 410 y 413).
                const huecos = source.selected === null ? [] : fuera
                    .map(h => h.sheet)
                    .filter(sheet => isSectionGap(sheet, source.selected!))
                    .sort((a, b) => a - b)
                    .slice(0, MAX_SHEETS_PER_QUESTION);
                const sugeridas = entradaEnElCorpus ? []
                    : dentro.length === 0 && fuera.length > 0
                        ? notaPrincipal(fuera.map(h => h.sheet), fuera[0]!.sheet)
                        : huecos;
                if (sugeridas.length > 0) {
                    const mismo = warnings.find((w): w is Extract<CorpusReviewWarning, { kind: 'missing-sheets' }> =>
                        w.kind === 'missing-sheets' && w.sourceId === source.sourceId && w.sheets.join() === sugeridas.join());
                    if (mismo) mismo.questions.push(row.number);
                    else warnings.push({ kind: 'missing-sheets', sourceId: source.sourceId, questions: [row.number], sheets: sugeridas });
                }
            }

            const lemasDeLaPregunta = (esLexica ? source.lemmaEntries ?? [] : []).filter(l => l.question === row.number);
            if (lemasDeLaPregunta.some(l => l.entry || l.appears)) tocaAlguna = true;
            for (const lema of lemasDeLaPregunta.filter(l => l.entry)) {
                const hojas = sheetsOf(lema.entry!).map(sheet => ({ sheet, state: estado(sheet) }));
                row.sources.push({ sourceId: source.sourceId, via: 'lemma', term: lema.term, sheets: hojas });
                const faltan = hojas.filter(h => h.state === 'outside').map(h => h.sheet);
                if (faltan.length > 0) {
                    warnings.push({
                        kind: 'missing-entry',
                        sourceId: source.sourceId,
                        question: row.number,
                        term: lema.term,
                        sheets: faltan,
                        whole: faltan.length === hojas.length,
                    });
                }
            }
        }

        // «No sirve para ninguna pregunta» sólo cuando hay con qué juzgar. Un
        // léxico sin lemas en la consigna no nombra versículos y no por eso
        // sobra: se juzga sólo si se buscó algún lema y no tuvo entrada.
        const juzgable = !SIN_JUICIO_POR_VERSICULO.has(source.sourceType)
            && versiculosConPregunta.size > 0
            && (!esLexica || (source.lemmaEntries ?? []).length > 0);
        if (juzgable && !tocaAlguna) warnings.push({ kind: 'unrelated', sourceId: source.sourceId });
    }

    // Sin ninguna fuente con datos no se puede afirmar que una pregunta quedó sin cubrir.
    if (algunaFuenteJuzgada) {
        for (const row of rows) {
            const porLema = row.sources.some(s => s.via === 'lemma' && s.sheets.some(h => h.state !== 'outside'));
            if (!cubierta.has(row.number) && !porLema) warnings.push({ kind: 'question-uncovered', question: row.number });
        }
    }

    return { rows, warnings, pending };
}

/**
 * Lo que el corpus YA trae para cada pregunta, por fuente: la evidencia con
 * que el plan de uso reparte (TP #8, fase 8a, B1–B2).
 *
 * El planificador recibía de cada fuente `id · tipo · título · clave` y nunca
 * veía una hoja: dejó a Tuggy en un solo paso y a Kittel en otro, aunque los
 * dos tenían hojas para tres preguntas. Esto es lo que muestra la tarjeta
 * «¿Qué responde cada pregunta?», sin las hojas de afuera: lo que no está en
 * el corpus no llega al prompt, así que no puede justificar una asignación.
 */
export interface QuestionSourceEvidence {
    question: number;
    sourceId: string;
    via: 'verse' | 'lemma';
    /** Con `via: 'lemma'`, la palabra de la consigna. */
    term?: string;
    /** Las hojas del corpus, en el orden de la revisión (más menciones primero). */
    sheets: number[];
    /** Renglones de contexto de esas hojas, cuando la búsqueda los trajo. */
    snippets: string[];
}

export function evidenceFromReview(review: CorpusQuestionReview | null): QuestionSourceEvidence[] {
    if (!review) return [];
    const out: QuestionSourceEvidence[] = [];
    for (const row of review.rows) {
        for (const cov of row.sources) {
            const dentro = cov.sheets.filter(h => h.state !== 'outside');
            if (dentro.length === 0) continue;
            out.push({
                question: row.number,
                sourceId: cov.sourceId,
                via: cov.via,
                ...(cov.term ? { term: cov.term } : {}),
                sheets: dentro.map(h => h.sheet),
                snippets: dentro.flatMap(h => (h.snippet ? [h.snippet] : [])),
            });
        }
    }
    return out;
}

/**
 * Lo que hay que guardar para agregar y fijar unas hojas: los tramos de la
 * fuente con las hojas sumadas, y lo fijado con las hojas sumadas.
 */
export function addAndPinSheets(
    selected: ReadonlyArray<SheetRange>,
    pinned: ReadonlyArray<SheetRange>,
    sheets: ReadonlyArray<number>,
): { sheetRanges: SheetRange[]; pinnedRanges: SheetRange[] } {
    const nuevas = sheets.map(s => ({ start: s, end: s }));
    return {
        sheetRanges: normalizeSheetRanges([...selected, ...nuevas]),
        pinnedRanges: normalizeSheetRanges([...pinned, ...nuevas]),
    };
}

/**
 * La hoja con más menciones y las contiguas que también nombran el versículo:
 * una nota corre varias páginas (Mayor sobre 4:5, 415–417). La introducción
 * que lo nombra al pasar (h. 30) queda en la lista, pero no se sugiere.
 */
function notaPrincipal(hojas: ReadonlyArray<number>, mejor: number): number[] {
    const todas = new Set(hojas);
    let desde = mejor;
    let hasta = mejor;
    while (todas.has(desde - 1) && hasta - desde + 1 < MAX_SHEETS_PER_QUESTION) desde--;
    while (todas.has(hasta + 1) && hasta - desde + 1 < MAX_SHEETS_PER_QUESTION) hasta++;
    return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
}

/** ¿La hoja cae entre dos hojas elegidas, a no más de `MAX_SECTION_GAP` de cada una? */
function isSectionGap(sheet: number, selected: ReadonlyArray<SheetRange>): boolean {
    const antes = selected.some(r => r.end < sheet && sheet - r.end <= MAX_SECTION_GAP);
    const despues = selected.some(r => r.start > sheet && r.start - sheet <= MAX_SECTION_GAP);
    return antes && despues;
}

function inRanges(sheet: number, ranges: ReadonlyArray<SheetRange>): boolean {
    return ranges.some(r => sheet >= r.start && sheet <= r.end);
}

function sheetsOf(range: SheetRange): number[] {
    const out: number[] = [];
    for (let s = range.start; s <= range.end; s++) out.push(s);
    return out;
}
