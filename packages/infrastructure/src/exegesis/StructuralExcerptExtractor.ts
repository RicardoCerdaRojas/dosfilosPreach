import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    outlineStructureQuality,
    resolveOutlineReferences,
    selectChunksForPassage,
    type ChunkRange,
    type DocumentOutlineEntry,
    type ExtractExcerptsInput,
    type ExcerptSelectionMode,
    type ExtractExcerptsResult,
    type IExcerptExtractor,
    type IResourceIndexProbe,
    type ProjectSourceExcerpt,
    ResourcesNotIndexedError,
    formatPassageReference,
} from '@dosfilos/domain';

/**
 * Extractor que elige la sección del comentario que trata el pasaje, en vez
 * de los fragmentos que más se le parecen.
 *
 * Envuelve al extractor semántico y decide por RECURSO cuál de los dos usar:
 *
 *   1. Pide la tabla de contenidos del documento (`getDocumentOutline`).
 *   2. La convierte en un índice por referencia bíblica (`documentOutline`
 *      en domain) y busca los tramos que solapan el pasaje del trabajo.
 *   3. Si los encuentra, baja el texto de esos tramos (`getDocumentChunks`)
 *      y los devuelve EN ORDEN — el comentario se lee corrido.
 *   4. Si el documento no tiene encabezados utilizables, o los tiene pero
 *      ninguno cubre el pasaje, ese recurso cae al camino semántico.
 *
 * El punto 4 no es un detalle: un libro que se extrajo sin estructura
 * (`section: null` en todos sus chunks) es indistinguible por fuera de uno
 * bien extraído, y son varios. Degradar por recurso —y no por extracción
 * entera— hace que un comentario mal extraído no arrastre a los otros tres.
 *
 * La mezcla se informa hacia arriba en `modeByResource` para que la UI pueda
 * decir cuál fuente entró por sección exacta y cuál por coincidencia
 * semántica: son dos niveles de confianza distintos y el usuario decide qué
 * hacer con cada uno.
 */

interface OutlineSection {
    startChunk: number;
    endChunk: number;
    page: number;
    section: string | null;
    sectionPath: string[];
}

interface OutlineResponse {
    sections: OutlineSection[];
    chunkCount: number;
}

interface DocumentChunkPayload {
    chunkIndex: number;
    text: string;
    page: number | null;
    section: string | null;
}

interface ChunksResponse {
    chunks: DocumentChunkPayload[];
}

/**
 * Chunks de contexto a cada lado del tramo. El corte de un chunk cae en
 * mitad de una oración; el vecino inmediato la completa.
 */
const CONTEXT_CHUNKS = 1;

/**
 * Tope de chunks por recurso en el camino estructural. Está por encima del
 * `maxExcerptsPerResource` del camino semántico (30) a propósito: un tramo
 * estructural son páginas consecutivas del comentario sobre el pasaje, y
 * cortarlo a 30 lo dejaría por la mitad. El presupuesto del prompt lo
 * administra después `fitPromptToCap`.
 */
const MAX_STRUCTURAL_CHUNKS = 60;

const OUTLINE_TIMEOUT_MS = 30_000;

export class StructuralExcerptExtractor implements IExcerptExtractor {
    constructor(
        private indexProbe: IResourceIndexProbe,
        private semanticFallback: IExcerptExtractor,
    ) { }

    async extract(input: ExtractExcerptsInput): Promise<ExtractExcerptsResult> {
        if (input.libraryResourceIds.length === 0) {
            return { excerptsByResource: {}, queryUsed: '', modeByResource: {} };
        }

        // Misma verificación de indexado que el camino semántico, y por el
        // mismo motivo: la UI arma un panel de "prepará estos primero" con
        // los ids que fallan, y necesita el error antes de cualquier consulta.
        const readiness = await Promise.all(
            input.libraryResourceIds.map(id => this.indexProbe.isReady(id)),
        );
        const notIndexed = input.libraryResourceIds.filter((_, i) => !readiness[i]);
        if (notIndexed.length > 0) {
            throw new ResourcesNotIndexedError(notIndexed);
        }

        const excerptsByResource: Record<string, ProjectSourceExcerpt[]> = {};
        const modeByResource: Record<string, ExcerptSelectionMode> = {};
        const needsSemantic: string[] = [];

        // Secuencial y no en paralelo: son dos llamadas por recurso y la
        // selección de un corpus típico son 4-7 documentos. Paralelizar
        // ahorraría segundos a cambio de multiplicar por siete el pico de
        // lecturas de un usuario contra el rate-limit compartido.
        for (const resourceId of input.libraryResourceIds) {
            const ranges = await this.selectRanges(resourceId, input);
            if (!ranges || ranges.length === 0) {
                needsSemantic.push(resourceId);
                continue;
            }

            const chunks = await this.fetchChunks(resourceId, ranges);
            if (chunks.length === 0) {
                needsSemantic.push(resourceId);
                continue;
            }

            excerptsByResource[resourceId] = chunks.map(toStructuralExcerpt);
            modeByResource[resourceId] = 'structural';
        }

        const passageLabel = formatPassageReference(input.passage, input.language ?? 'es');
        let queryUsed = `${passageLabel} (selección por sección)`;

        if (needsSemantic.length > 0) {
            const fallback = await this.semanticFallback.extract({
                ...input,
                libraryResourceIds: needsSemantic,
            });
            for (const id of needsSemantic) {
                excerptsByResource[id] = [...(fallback.excerptsByResource[id] ?? [])];
                modeByResource[id] = 'semantic';
            }
            queryUsed = fallback.queryUsed;
        }

        console.log('[StructuralExcerptExtractor] extracción resuelta', {
            passage: passageLabel,
            structural: Object.values(modeByResource).filter(m => m === 'structural').length,
            semantic: needsSemantic.length,
        });

        return { excerptsByResource, queryUsed, modeByResource };
    }

    /**
     * Devuelve los tramos del documento que cubren el pasaje, o `null`
     * cuando el documento no sirve para selección estructural.
     *
     * Un fallo de la callable NO tumba la extracción: se degrada a semántico
     * para ese recurso. El camino estructural es una mejora sobre algo que ya
     * funcionaba, y no vale la pena que su indisponibilidad deje al usuario
     * sin fragmentos.
     */
    private async selectRanges(
        resourceId: string,
        input: ExtractExcerptsInput,
    ): Promise<ReadonlyArray<ChunkRange> | null> {
        let outline: OutlineResponse;
        try {
            const callable = httpsCallable<{ resourceId: string }, OutlineResponse>(
                getFunctions(),
                'getDocumentOutline',
                { timeout: OUTLINE_TIMEOUT_MS },
            );
            const response = await callable({ resourceId });
            outline = response.data;
        } catch (err) {
            console.warn('[StructuralExcerptExtractor] outline no disponible, cae a semántico', {
                resourceId,
                error: (err as Error).message,
            });
            return null;
        }

        const entries = expandSections(outline.sections);
        if (entries.length === 0) return null;

        const resolved = resolveOutlineReferences(entries);
        const quality = outlineStructureQuality(resolved);
        if (!quality.usable) {
            console.log('[StructuralExcerptExtractor] documento sin encabezados de referencia', {
                resourceId,
                totalCount: quality.totalCount,
            });
            return null;
        }

        const selection = selectChunksForPassage(resolved, input.passage, {
            contextChunks: CONTEXT_CHUNKS,
            maxChunks: MAX_STRUCTURAL_CHUNKS,
        });

        if (selection.chunkCount === 0) {
            console.log('[StructuralExcerptExtractor] el pasaje no aparece en el esquema', {
                resourceId,
                headingCount: quality.headingCount,
            });
            return null;
        }

        return selection.ranges;
    }

    private async fetchChunks(
        resourceId: string,
        ranges: ReadonlyArray<ChunkRange>,
    ): Promise<DocumentChunkPayload[]> {
        try {
            const callable = httpsCallable<
                { resourceId: string; ranges: ChunkRange[] },
                ChunksResponse
            >(getFunctions(), 'getDocumentChunks', { timeout: OUTLINE_TIMEOUT_MS });
            const response = await callable({ resourceId, ranges: [...ranges] });
            return response.data?.chunks ?? [];
        } catch (err) {
            console.warn('[StructuralExcerptExtractor] no se pudo bajar el tramo', {
                resourceId,
                error: (err as Error).message,
            });
            return [];
        }
    }
}

/**
 * Expande los tramos que devuelve el servidor a una entrada por chunk.
 *
 * El servidor agrupa para no mandar seis veces el mismo encabezado; el
 * módulo de dominio razona por chunk porque la selección y la herencia
 * trabajan a ese grano.
 */
function expandSections(sections: ReadonlyArray<OutlineSection>): DocumentOutlineEntry[] {
    const entries: DocumentOutlineEntry[] = [];
    for (const section of sections) {
        for (let i = section.startChunk; i <= section.endChunk; i++) {
            entries.push({
                chunkIndex: i,
                page: section.page,
                section: section.section,
                sectionPath: section.sectionPath,
            });
        }
    }
    return entries;
}

/**
 * El ancla de citación sigue la misma convención que el camino semántico
 * (`p. N, § Sección`) para que el prompt y la UI no tengan que distinguir
 * de dónde salió el fragmento.
 *
 * `relevanceScore` va en 1: la selección estructural no puntúa por cercanía,
 * afirma que el fragmento ES la sección del pasaje. Dejarlo en 0 haría que
 * la UI ordenara al final justo los fragmentos más confiables.
 */
function toStructuralExcerpt(chunk: DocumentChunkPayload): ProjectSourceExcerpt {
    const { page, section } = chunk;
    let sourceLocation = '';
    if (page && section) sourceLocation = `p. ${page}, § ${section}`;
    else if (page) sourceLocation = `p. ${page}`;
    else if (section) sourceLocation = `§ ${section}`;

    return {
        text: chunk.text,
        sourceLocation,
        // Aparte del rótulo: quien cite necesita el número, no la cadena.
        ...(typeof page === 'number' ? { sheet: page } : {}),
        ...(section ? { section } : {}),
        relevanceScore: 1,
        userEdited: false,
        editedAt: null,
    };
}
