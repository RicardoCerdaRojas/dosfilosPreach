import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    briefForQuery,
    normalizeSheetRanges,
    formatPassageReference,
    isPickedByPages,
    passageReferenceQuery,
    proposePassageSheets,
    outlineStructureQuality,
    resolveOutlineReferences,
    selectChunksForPassage,
    sheetsForChunkRanges,
    type DocumentOutlineEntry,
    type PageIndexEntry,
    type PassageReference,
    type SheetRange,
    type SourceType,
} from '@dosfilos/domain';
import { searchDocumentByReference } from './DocumentPageIndexClient';

/**
 * Con qué hojas arranca el carrito del selector.
 *
 * Tres proponentes, en orden de confianza:
 *
 *   1. El índice del propio comentario, cuando el documento trae encabezados
 *      por referencia. Da la sección que trata el pasaje, corrida y completa.
 *   2. Las hojas que NOMBRAN los versículos con pregunta (la forma «Libro c:v»
 *      del texto y el índice de pasajes `refs` de cada fragmento). Para un libro
 *      que se elige por páginas —gramática, léxico, diccionario, aparato— va
 *      PRIMERO: no se organiza por pasaje, y la sección o el parecido no lo
 *      encuentran. TP #8 (2026-10-21, fase 8a, A1): la propuesta de Wallace
 *      eran 14 tramos por parecido y ninguno contenía las tres hojas que
 *      nombran Stg 4.
 *   3. Coincidencia semántica contra el pasaje, para todo lo demás.
 *
 * Si ninguno encuentra nada, el carrito arranca vacío y la interfaz lo dice. No
 * se inventa un tramo: proponer las primeras hojas «por si acaso» sería repetir
 * en versión nueva el error que originó todo esto.
 */

export type ProposalKind = 'structural' | 'passage' | 'semantic' | 'none';

export interface SheetRangeProposal {
    ranges: SheetRange[];
    kind: ProposalKind;
}

interface OutlineSection {
    startChunk: number;
    endChunk: number;
    page: number;
    section: string | null;
    sectionPath: string[];
}

interface RetrievedChunk {
    resourceId: string;
    chunkIndex: number;
    metadata: { page?: number };
}

const TIMEOUT_MS = 30_000;

/**
 * Hojas de contexto alrededor de un acierto semántico. Un acierto suelto en la
 * hoja 84 casi nunca es una hoja suelta de contenido: es el medio de una
 * discusión que arranca antes y sigue después.
 */
const SEMANTIC_CONTEXT_SHEETS = 1;

/**
 * Hasta qué hueco se funden dos bloques semánticos. Sin esto, una propuesta
 * típica llega como quince tramos de una hoja y el carrito se vuelve ilegible.
 */
const SEMANTIC_GAP_TOLERANCE = 2;

/** Aciertos por documento que se le piden al camino semántico. */
const SEMANTIC_TOP_K = 20;

export interface ProposeSheetRangesInput {
    resourceId: string;
    userId: string;
    passage: PassageReference;
    assignmentBrief: string | null;
    language: 'es' | 'en';
    /** Índice de hojas, ya cargado por la interfaz. */
    pageIndex: ReadonlyArray<PageIndexEntry>;
    /** El tipo de la fuente: decide el orden de los proponentes. */
    sourceType?: SourceType;
    /**
     * Los versículos con pregunta del encuadre (`questionVerseNumbers`), o
     * `null`/ausente para usar cualquier versículo del pasaje.
     */
    questionVerses?: ReadonlyArray<number> | null;
}

/**
 * En un léxico o un diccionario, la hoja que nombra el versículo suele ser la
 * lista de citas al FINAL de la entrada, y la definición empieza antes: Tuggy
 * nombra Stg 4:1 en la h. 585 y define μέλος en la 584 (TP #8, #29). Se suma
 * la hoja anterior hasta que exista la entrada completa por lema (A2).
 */
const HOJAS_ANTES_POR_TIPO: Partial<Record<SourceType, number>> = {
    'lexicon-technical': 1,
    'theological-dictionary': 1,
};

export async function proposeSheetRanges(
    input: ProposeSheetRangesInput,
): Promise<SheetRangeProposal> {
    const porPaginas = input.sourceType ? isPickedByPages({ sourceType: input.sourceType }) : false;
    if (porPaginas) {
        const passage = await proposePassage(input);
        if (passage.ranges.length > 0) return passage;
    }

    const structural = await proposeStructural(input);
    if (structural.ranges.length > 0) return structural;

    if (!porPaginas) {
        const passage = await proposePassage(input);
        if (passage.ranges.length > 0) return passage;
    }

    const semantic = await proposeSemantic(input);
    if (semantic.ranges.length > 0) return semantic;

    return { ranges: [], kind: 'none' };
}

/**
 * Las hojas que nombran los versículos con pregunta.
 *
 * Un fallo de la callable no rompe nada, igual que los otros proponentes: se
 * devuelve vacío y se pasa al siguiente.
 */
async function proposePassage(input: ProposeSheetRangesInput): Promise<SheetRangeProposal> {
    const query = passageReferenceQuery(input.passage);
    if (!query) return { ranges: [], kind: 'none' };
    try {
        const { hits } = await searchDocumentByReference(input.resourceId, query);
        const elegidas = proposePassageSheets(
            hits.map(h => ({ sheet: h.sheet, count: h.count, verses: h.verses ?? [], snippet: h.snippet, section: h.section })),
            input.questionVerses ?? null,
        );
        const antes = (input.sourceType && HOJAS_ANTES_POR_TIPO[input.sourceType]) ?? 0;
        const existentes = new Set(input.pageIndex.map(e => e.sheet));
        const ranges = normalizeSheetRanges(elegidas.map(r => ({ start: Math.max(1, r.start - antes), end: r.end })))
            .map(r => ({ start: primeraExistente(r.start, r.end, existentes), end: r.end }))
            .filter(r => r.start <= r.end);
        return ranges.length > 0 ? { ranges, kind: 'passage' } : { ranges: [], kind: 'none' };
    } catch (err) {
        console.warn('[SheetRangeProposer] propuesta por pasaje no disponible', {
            resourceId: input.resourceId,
            error: (err as Error).message,
        });
        return { ranges: [], kind: 'none' };
    }
}

/** La primera hoja del tramo que existe en el índice (la anterior puede no existir). */
function primeraExistente(start: number, end: number, existentes: ReadonlySet<number>): number {
    if (existentes.size === 0) return start;
    for (let s = start; s <= end; s++) if (existentes.has(s)) return s;
    return end + 1;
}

/**
 * Lee el índice del comentario y busca la sección del pasaje.
 *
 * Un fallo de la callable no rompe nada: se devuelve vacío y el llamador pasa
 * al camino semántico. La propuesta es una comodidad; el selector funciona
 * igual sin ella.
 */
async function proposeStructural(input: ProposeSheetRangesInput): Promise<SheetRangeProposal> {
    try {
        const callable = httpsCallable<
            { resourceId: string },
            { sections: OutlineSection[] }
        >(getFunctions(), 'getDocumentOutline', { timeout: TIMEOUT_MS });
        const response = await callable({ resourceId: input.resourceId });

        const entries: DocumentOutlineEntry[] = [];
        for (const section of response.data?.sections ?? []) {
            for (let i = section.startChunk; i <= section.endChunk; i++) {
                entries.push({
                    chunkIndex: i,
                    page: section.page,
                    section: section.section,
                    sectionPath: section.sectionPath,
                });
            }
        }
        if (entries.length === 0) return { ranges: [], kind: 'none' };

        const resolved = resolveOutlineReferences(entries, input.passage.bookId);
        if (!outlineStructureQuality(resolved).usable) return { ranges: [], kind: 'none' };

        const selection = selectChunksForPassage(resolved, input.passage, {
            contextChunks: 1,
            maxChunks: 60,
        });
        if (selection.chunkCount === 0) return { ranges: [], kind: 'none' };

        return {
            ranges: sheetsForChunkRanges(input.pageIndex, selection.ranges),
            kind: 'structural',
        };
    } catch (err) {
        console.warn('[SheetRangeProposer] propuesta estructural no disponible', {
            resourceId: input.resourceId,
            error: (err as Error).message,
        });
        return { ranges: [], kind: 'none' };
    }
}

/**
 * Busca el pasaje por cercanía y devuelve las hojas donde cayeron los aciertos.
 *
 * Se le pide la hoja al propio chunk en vez de resolverla contra el índice: es
 * el dato que `retrieveChunks` ya devuelve, y evita depender de que el índice
 * conozca cada fragmento.
 */
async function proposeSemantic(input: ProposeSheetRangesInput): Promise<SheetRangeProposal> {
    try {
        const query = buildQuery(input);
        const callable = httpsCallable<unknown, { chunks: RetrievedChunk[] }>(
            getFunctions(),
            'retrieveChunks',
            { timeout: TIMEOUT_MS },
        );
        const response = await callable({
            query,
            userId: input.userId,
            resourceIds: [input.resourceId],
            perResourceTopK: SEMANTIC_TOP_K,
        });

        const sheets = new Set<number>();
        for (const chunk of response.data?.chunks ?? []) {
            const page = chunk.metadata?.page;
            if (typeof page !== 'number' || page < 1) continue;
            for (let s = page - SEMANTIC_CONTEXT_SHEETS; s <= page + SEMANTIC_CONTEXT_SHEETS; s++) {
                if (s >= 1) sheets.add(s);
            }
        }
        if (sheets.size === 0) return { ranges: [], kind: 'none' };

        // Se pasa por el índice de hojas para descartar las que no existen y
        // para fundir con la misma regla que usa el resto del selector.
        const asChunkRanges = input.pageIndex
            .filter(entry => sheets.has(entry.sheet))
            .flatMap(entry => entry.chunkIndices.map(i => ({ start: i, end: i })));

        return {
            ranges: sheetsForChunkRanges(input.pageIndex, asChunkRanges, SEMANTIC_GAP_TOLERANCE),
            kind: 'semantic',
        };
    } catch (err) {
        console.warn('[SheetRangeProposer] propuesta semántica no disponible', {
            resourceId: input.resourceId,
            error: (err as Error).message,
        });
        return { ranges: [], kind: 'none' };
    }
}

/**
 * La referencia va primero porque domina la relevancia en los fragmentos de un
 * comentario, que ya traen anclas tipo `[1:1]` en su texto. El encuadre del
 * trabajo sesga hacia el ángulo que el alumno quiere, recortado porque un brief
 * largo colapsa el embedding hacia su término dominante.
 */
function buildQuery(input: ProposeSheetRangesInput): string {
    const label = formatPassageReference(input.passage, input.language);
    const brief = briefForQuery(input.assignmentBrief);
    return brief ? `${label} — ${brief}` : label;
}
