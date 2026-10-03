import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    chunkRangesForSheets,
    isWholeDocumentScope,
    selectForPrompt,
    WHOLE_DOCUMENT_RANGE,
    wholeDocumentTravelsEntire,
    type CorpusChunk,
    type CuratedCorpusResult,
    type ICuratedCorpusRetriever,
    type RetrieveCuratedCorpusInput,
    type SheetRange,
} from '@dosfilos/domain';
import { fetchDocumentPageIndex } from './DocumentPageIndexClient';
import { CallableDocumentChunkReader } from './CallableDocumentChunkReader';

/**
 * Arma el material de un paso: lo fijado, más lo que el ranking traiga.
 *
 * Dos caminos distintos porque son dos políticas distintas:
 *
 *   - **Fijado** — se lee entero, por rango de hojas, con `getDocumentChunks`.
 *     No se consulta ni se puntúa: el usuario ya decidió que va.
 *   - **Rankeado** — `retrieveCuratedCorpus` embebe la consulta, usa el índice
 *     vectorial y descarta lo que cae fuera de las hojas admitidas.
 *
 * Los dos se juntan en `selectForPrompt`, que resuelve el presupuesto y el
 * orden. Esa decisión vive en dominio a propósito: es la regla del producto —
 * lo fijado manda— y no un detalle de cómo se leen los datos.
 */

interface RankedChunkPayload {
    resourceId: string;
    chunkIndex: number;
    text: string;
    sheet: number | null;
    section: string | null;
    score: number;
}

interface RankedResponse {
    chunks: RankedChunkPayload[];
    sourcesQueried: number;
    failedSources: string[];
    emptySources: string[];
}

const TIMEOUT_MS = 60_000;

/**
 * Fuentes por llamada a `retrieveCuratedCorpus`. Es el `MAX_SOURCES` de la
 * callable (functions no importa nada de aquí: si cambia allá, cambia acá).
 */
export const MAX_SOURCES_PER_CALL = 25;

export class CallableCuratedCorpusRetriever implements ICuratedCorpusRetriever {
    private chunkReader = new CallableDocumentChunkReader();

    async retrieve(input: RetrieveCuratedCorpusInput): Promise<CuratedCorpusResult> {
        const scopes = await Promise.all(
            input.sources.filter(s => s.sheetRanges.length > 0).map(s => this.smallDocumentAsPinned(s)),
        );
        if (scopes.length === 0) return empty();

        // Lo que ya viaja entero no compite en el ranking.
        const aRankear = scopes.filter(s => !(s.pinnedRanges.length > 0 && isWholeDocumentScope(s.pinnedRanges)));
        const [ranked, pinned] = await Promise.all([
            aRankear.length > 0 ? this.rank(input, aRankear) : Promise.resolve({ chunks: [], failed: [], empty: [] }),
            this.readPinned(scopes),
        ]);

        const selection = selectForPrompt({
            ranked: ranked.chunks,
            pinned,
            budgetChars: input.budgetChars,
        });

        const byResource: Record<string, CorpusChunk[]> = {};
        for (const scope of scopes) byResource[scope.resourceId] = [];
        for (const chunk of selection.chunks) {
            (byResource[chunk.resourceId] ??= []).push(chunk);
        }

        // Flat, and PER SOURCE. The aggregate totals said the corpus
        // had answered while individual sources came back empty, which
        // is the difference between "retrieval works" and "retrieval
        // works for the source you happen to be asking about".
        const perSource = scopes
            .map(sc => {
                const chunks = byResource[sc.resourceId] ?? [];
                const chars = chunks.reduce((n, c) => n + c.text.length, 0);
                const sheets = chunks.map(c => c.sheet ?? '?').join('/');
                return `${sc.resourceId.slice(0, 8)}: ${chunks.length} frag, ${chars} chars, hojas ${sheets || '—'}`;
            })
            .join(' | ');
        console.log(
            `[CuratedCorpus] material del paso — fuentes=${scopes.length} `
            + `pinnedChars=${selection.pinnedChars} rankedChars=${selection.rankedChars} `
            + `descartados=${selection.droppedRanked} presupuesto=${input.budgetChars}\n  ${perSource}`,
        );

        return {
            byResource,
            pinnedChars: selection.pinnedChars,
            rankedChars: selection.rankedChars,
            droppedRanked: selection.droppedRanked,
            pinnedExhaustedBudget: selection.pinnedExhaustedBudget,
            failedSources: ranked.failed,
            emptySources: ranked.empty,
        };
    }

    /**
     * Un documento completo chico (`wholeDocumentTravelsEntire`) va fijado:
     * entero, sin competir. Sin índice se queda como estaba —consultado—.
     */
    private async smallDocumentAsPinned(
        s: RetrieveCuratedCorpusInput['sources'][number],
    ): Promise<RetrieveCuratedCorpusInput['sources'][number]> {
        if (!isWholeDocumentScope(s.sheetRanges) || s.pinnedRanges.length > 0) return s;
        try {
            const index = await fetchDocumentPageIndex(s.resourceId);
            return wholeDocumentTravelsEntire(index.pages) ? { ...s, pinnedRanges: [WHOLE_DOCUMENT_RANGE] } : s;
        } catch {
            return s;
        }
    }

    /**
     * El ranking. Un fallo NO tumba el paso: se devuelve vacío y el material se
     * arma solo con lo fijado, informando qué fuentes quedaron afuera. Un paso
     * con menos material es peor que uno completo; un paso que no se genera es
     * peor que los dos.
     */
    private async rank(
        input: RetrieveCuratedCorpusInput,
        scopes: ReadonlyArray<RetrieveCuratedCorpusInput['sources'][number]>,
    ): Promise<{ chunks: CorpusChunk[]; failed: string[]; empty: string[] }> {
        try {
            const callable = httpsCallable<unknown, RankedResponse>(
                getFunctions(),
                'retrieveCuratedCorpus',
                { timeout: TIMEOUT_MS },
            );
            // Las hojas admitidas, traducidas a índices de fragmento.
            //
            // Sin esto la callable busca en el libro entero y recorta después,
            // y la selección de una fuente es el 5-10% de sus fragmentos —en
            // los peores casos medidos, el 0,3%—. Con los índices resueltos la
            // búsqueda entra en lo curado.
            //
            // El índice de hojas está cacheado por recurso desde que el
            // usuario abrió el selector, igual que para los tramos fijados.
            // Si no se puede resolver se manda sin él y la callable vuelve al
            // camino anterior: menos fiable, nunca incorrecto.
            const conIndices = await Promise.all(scopes.map(async s => {
                const sheetRanges = s.sheetRanges.map(r => ({ start: r.start, end: r.end }));
                try {
                    const index = await fetchDocumentPageIndex(s.resourceId);
                    const chunkRanges = chunkRangesForSheets(index.pages, s.sheetRanges as SheetRange[]);
                    return { resourceId: s.resourceId, sheetRanges, chunkRanges };
                } catch (err) {
                    console.warn('[CuratedCorpus] sin índice de hojas; se busca en el libro entero', {
                        resourceId: s.resourceId,
                        error: (err as Error).message,
                    });
                    return { resourceId: s.resourceId, sheetRanges };
                }
            }));
            // En tandas: la callable rechaza más de `MAX_SOURCES_PER_CALL`
            // fuentes, y un rechazo dejaba en silencio a TODAS. Desde que el
            // documento completo y los fragmentos también se consultan, un
            // corpus grande pasa ese número. Una tanda caída sólo apaga sus
            // fuentes.
            const tandas: typeof conIndices[] = [];
            for (let i = 0; i < conIndices.length; i += MAX_SOURCES_PER_CALL) {
                tandas.push(conIndices.slice(i, i + MAX_SOURCES_PER_CALL));
            }
            const respuestas = await Promise.all(tandas.map(async tanda => {
                try {
                    const response = await callable({ userId: input.userId, query: input.query, sources: tanda });
                    return {
                        chunks: response.data?.chunks ?? [],
                        failed: response.data?.failedSources ?? [],
                        empty: response.data?.emptySources ?? [],
                    };
                } catch (err) {
                    console.warn('[CuratedCorpus] una tanda del ranking no respondió; se sigue con lo fijado', {
                        error: (err as Error).message,
                    });
                    return { chunks: [], failed: tanda.map(s => s.resourceId), empty: [] };
                }
            }));
            return {
                chunks: respuestas.flatMap(r => r.chunks),
                failed: respuestas.flatMap(r => r.failed),
                empty: respuestas.flatMap(r => r.empty),
            };
        } catch (err) {
            console.warn('[CuratedCorpus] el ranking no respondió; se sigue con lo fijado', {
                error: (err as Error).message,
            });
            return { chunks: [], failed: scopes.map(s => s.resourceId), empty: [] };
        }
    }

    /**
     * Los tramos fijados, completos.
     *
     * Hace falta el índice de hojas para traducir hojas a fragmentos, pero está
     * cacheado por recurso desde que el usuario abrió el selector, así que en la
     * práctica no cuesta un viaje extra.
     */
    private async readPinned(
        scopes: ReadonlyArray<RetrieveCuratedCorpusInput['sources'][number]>,
    ): Promise<CorpusChunk[]> {
        const withPinned = scopes.filter(s => s.pinnedRanges.length > 0);
        if (withPinned.length === 0) return [];

        const perSource = await Promise.all(
            withPinned.map(async scope => {
                try {
                    const index = await fetchDocumentPageIndex(scope.resourceId);
                    const chunkRanges = chunkRangesForSheets(
                        index.pages,
                        scope.pinnedRanges as SheetRange[],
                    );
                    const chunks = await this.chunkReader.readChunks(scope.resourceId, chunkRanges);
                    return chunks.map<CorpusChunk>(c => ({
                        resourceId: scope.resourceId,
                        chunkIndex: c.chunkIndex,
                        text: c.text,
                        sheet: c.page,
                        section: c.section,
                        // Lo fijado no compite, así que su puntaje no se usa. Va
                        // en 1 para que cualquier orden por relevancia lo ponga
                        // adelante en vez de al final.
                        score: 1,
                    }));
                } catch (err) {
                    console.warn('[CuratedCorpus] no se pudieron leer los tramos fijados', {
                        resourceId: scope.resourceId,
                        error: (err as Error).message,
                    });
                    return [];
                }
            }),
        );
        return perSource.flat();
    }
}

function empty(): CuratedCorpusResult {
    return {
        byResource: {},
        pinnedChars: 0,
        rankedChars: 0,
        droppedRanked: 0,
        pinnedExhaustedBudget: false,
        failedSources: [],
        emptySources: [],
    };
}
