import { GoogleGenerativeAI } from '@google/generative-ai';
import { recordLlmUsage } from '../llm/llmUsageRecorder';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pagesToMarkedText, pagesToMarkdown } from './llamaParseClient';
import { MODEL_FAST } from '../llm/modelCatalog';
import { rescatarPaginas } from './rescatarPaginas';

// ── Batched Gemini extraction tuning ────────────────────────────────────
//
// Single-pass Gemini caps at ~65K output tokens, which translates to
// ~50-150 pages depending on density (dense commentaries get squeezed,
// narrative books fit more). Above this threshold we split the PDF
// into smaller per-call chunks via pdf-lib, run extraction on each,
// then concatenate the per-page results. The overall output is identical
// in shape to a single-pass result so the downstream chunker doesn't
// need to know.
//
// `BATCH_THRESHOLD_PAGES` is conservative — well below the safe single-
// pass ceiling so we don't get unlucky with dense books. `CHUNK_SIZE`
// keeps each call well under the token cap. `OVERLAP_PAGES` covers
// the case where Gemini truncates the last page or two of a chunk
// (rare but observed); the next chunk re-processes those pages and
// the dedup keeps the second (fresher) version.
export const BATCH_THRESHOLD_PAGES = 80;

/**
 * Proporción mínima de páginas que debe volver para dar la extracción por
 * buena.
 *
 * Estaba en 0,80 y dejó pasar un caso real: la gramática hebrea de Barrick, de
 * 170 páginas, volvió con 138 —81%, cortada en la 138 y sin las últimas 32— y
 * el libro entró al corpus como completo. Se citó 32 veces en un trabajo
 * entregado. Nadie se enteró, porque un 81% supera un piso de 80.
 *
 * Perder una de cada cinco páginas no es una extracción aceptable con un
 * defecto menor: es un libro distinto. El piso sube a 0,95 y, sobre todo, ya no
 * es lo único que se mira —ver `verificarCobertura`, que detecta el corte al
 * final aunque el total alcance—.
 */
export const MIN_PAGE_COVERAGE = 0.95;

/**
 * Verifica que las páginas devueltas cubran el documento, no sólo que sean
 * suficientes.
 *
 * La proporción sola no distingue dos cosas muy distintas: un libro al que le
 * faltan páginas sueltas —recuperable, y el resto sirve— de uno CORTADO, al que
 * le falta todo un final. Barrick fue lo segundo: 138 páginas seguidas y nada
 * después de la 138, con cero huecos internos. Una gramática sin su último
 * quinto es una gramática a la que le faltan los capítulos avanzados, que son
 * justamente los que se citan.
 */
export function verificarCobertura(
    paginas: ReadonlyArray<{ page: number }>,
    esperadas: number,
): { ok: true } | { ok: false; motivo: string } {
    if (esperadas <= 0) return { ok: true };
    if (paginas.length === 0) return { ok: false, motivo: 'no volvió ninguna página' };

    const cobertura = paginas.length / esperadas;
    if (cobertura < MIN_PAGE_COVERAGE) {
        return {
            ok: false,
            motivo: `volvieron ${paginas.length} de ${esperadas} páginas (${Math.round(cobertura * 100)}%)`,
        };
    }

    // Corte al final: la última página con texto queda lejos del final del
    // documento. Se mira aunque la proporción alcance, porque un libro largo
    // puede perder su cierre y seguir pasando el porcentaje.
    const ultima = Math.max(...paginas.map(p => p.page));
    if (esperadas - ultima > Math.max(2, Math.ceil(esperadas * 0.02))) {
        return {
            ok: false,
            motivo: `cortada en la página ${ultima} de ${esperadas}: faltan las últimas ${esperadas - ultima}`,
        };
    }
    return { ok: true };
}
export const CHUNK_SIZE_PAGES = 60;
export const OVERLAP_PAGES = 3;

/**
 * Single PDF page as Gemini returned it. Same shape as `LlamaParsePage`
 * so the formatters downstream work without branching by engine.
 */
interface GeminiPage {
    page: number;
    text: string;
    md?: string;
}

/**
 * Public entry point for Gemini extraction. Routes between single-pass
 * and batched based on `expectedPageCount`. Callers (storage trigger
 * and admin callable) don't need to know which strategy was used; the
 * output shape is identical either way.
 */
export async function extractWithGemini(
    tempFilePath: string,
    resourceId: string,
    apiKey: string,
    expectedPageCount?: number,
    /** Dueño del recurso. Sin él el gasto queda sin atribuir en el panel. */
    userId?: string,
): Promise<{ text: string; markdown: string; pageCount: number }> {
    const useBatched = !!expectedPageCount && expectedPageCount > BATCH_THRESHOLD_PAGES;
    if (useBatched) {
        console.log(
            `🤖 [Gemini] expected ${expectedPageCount} pages > ${BATCH_THRESHOLD_PAGES} — using batched extraction`,
        );
        return extractWithGeminiBatched(tempFilePath, resourceId, apiKey, expectedPageCount!, userId);
    }

    const { pages } = await extractGeminiPagesSinglePass(tempFilePath, resourceId, apiKey, expectedPageCount, userId);
    return {
        text: pagesToMarkedText(pages),
        markdown: pagesToMarkdown(pages),
        pageCount: pages.length,
    };
}

/**
 * Single-pass Gemini extraction. Sends the WHOLE PDF in one
 * `generateContent` call. Bound by Gemini's 65K-token output cap which
 * translates to ~50-150 pages depending on density. The router calls
 * this directly for short PDFs and once per chunk for long ones.
 *
 * Truncation safeguards:
 *   1. `finishReason !== 'STOP'` → hard fail (cascade falls back).
 *   2. Cobertura insuficiente → fallo duro. No es sólo un porcentaje: también
 *      detecta el corte al final, que la proporción sola deja pasar. Ver
 *      `verificarCobertura`. El llamador la desactiva pasando `undefined`
 *      cuando no sabe cuántas páginas esperar (llamadas por tanda).
 *
 * Returns structured pages so the batched wrapper can remap page
 * numbers before formatting.
 */
async function extractGeminiPagesSinglePass(
    tempFilePath: string,
    resourceId: string,
    apiKey: string,
    expectedPageCount?: number,
    userId?: string,
): Promise<{ pages: GeminiPage[] }> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    console.log(`⬆️ [Gemini] Uploading to Gemini Files API...`);
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: 'application/pdf',
        displayName: `${resourceId}.pdf`,
    });

    // Wait for file to be processed (Gemini converts the PDF before
    // the model can read it — non-trivial for big files).
    let geminiFile = await fileManager.getFile(uploadResult.file.name);
    const fileReadyDeadline = Date.now() + 5 * 60 * 1000;
    while (geminiFile.state === FileState.PROCESSING) {
        if (Date.now() > fileReadyDeadline) {
            throw new Error('Gemini file processing exceeded 5 minutes');
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        geminiFile = await fileManager.getFile(uploadResult.file.name);
    }
    if (geminiFile.state === FileState.FAILED) {
        throw new Error('Gemini file processing failed');
    }
    console.log(`✅ [Gemini] File ready: ${geminiFile.displayName}`);

    // Was 'gemini-2.0-flash' until Google deprecated it for new users
    // (404 Not Found, May 2026). Bumped to the live successor.
    const model = genAI.getGenerativeModel({
        model: MODEL_FAST,
        generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 65536,
        },
    });

    const prompt = `Extrae el texto completo de este PDF página por página.

Reglas:
1. Una entrada por página física. Conserva los números de página reales del PDF.
2. Preserva la estructura: encabezados con # / ## (markdown), párrafos separados, listas con -.
3. Preserva con precisión caracteres griegos (α-ω) y hebreos (א-ת).
4. No traduzcas términos teológicos ni citas bíblicas.
5. Mantén tablas en formato markdown cuando aparezcan.
6. NO incluyas el número de página en el contenido (lo capturamos en el campo aparte).

Devuelve JSON con esta estructura exacta:
{
  "pages": [
    { "page": 1, "text": "texto plano", "md": "texto en markdown" }
  ]
}

Si una página está vacía, devuelve string vacío en text/md pero conserva la entrada para no romper la numeración.`;

    const result = await model.generateContent([
        prompt,
        {
            fileData: {
                mimeType: geminiFile.mimeType!,
                fileUri: geminiFile.uri,
            },
        },
    ]);

    // Truncation guard #1 — Gemini sets `finishReason = 'MAX_TOKENS'`
    // when it stopped because the output budget ran out. The JSON
    // returned in that case may be syntactically valid but
    // semantically incomplete (e.g. a 378-page commentary returning
    // only the first 40 pages). Treat this as a hard failure so the
    // cascade falls to pdf-parse, which produces auto-indexable
    // output covering the FULL document.
    // Se mide ANTES del guard de truncado: una respuesta truncada igual se
    // cobra, y si no se registrara acá, los reintentos por MAX_TOKENS —que son
    // justo los caros— quedarían fuera de la contabilidad.
    const usage = result.response.usageMetadata;
    void recordLlmUsage({
        model: MODEL_FAST,
        feature: 'library.pdfExtraction',
        userId,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
    });

    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        throw new Error(`Gemini stopped early (finishReason=${finishReason}); response truncated`);
    }

    const responseText = result.response.text();

    let parsed: { pages?: Array<{ page: number; text?: string; md?: string }> };
    try {
        parsed = JSON.parse(responseText);
    } catch {
        // NO es truncamiento: `finishReason` ya se verificó arriba y la
        // respuesta llegó entera. El aparato crítico mezcla paréntesis
        // desbalanceados, comillas y tres alfabetos en un renglón, y algo de
        // eso escapa mal aunque se pida `responseMimeType: application/json`.
        // Medido sobre la BHS: pasa en 1 de cada 12 llamadas.
        //
        // Antes se descartaba la llamada entera y el libro perdía sus páginas.
        // Rescatar las entradas bien formadas convierte «perdí las ocho» en
        // «perdí la que venía rota», y lo que falte lo ve el guard de cobertura.
        const rescatadas = rescatarPaginas(responseText);
        if (rescatadas.length === 0) {
            console.error('❌ [Gemini] JSON inválido y nada rescatable:', responseText.substring(0, 500));
            throw new Error('Failed to parse Gemini response as JSON');
        }
        console.warn(
            `⚠️ [Gemini] JSON inválido; rescatadas ${rescatadas.length} página(s) de la respuesta`,
        );
        parsed = { pages: rescatadas };
    }

    if (!parsed.pages || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
        throw new Error('Gemini returned no pages');
    }

    // Best-effort cleanup of the Gemini file to avoid quota waste.
    try { await fileManager.deleteFile(geminiFile.name); } catch { /* ignore */ }

    const pages = parsed.pages.map((p, idx) => ({
        page: typeof p.page === 'number' ? p.page : idx + 1,
        text: p.text ?? '',
        md: p.md,
    }));

    // Truncation guard #2 — even when finishReason is STOP, Gemini
    // sometimes silently returns fewer pages than the source PDF
    // contains (especially for very long documents where the model
    // hits an internal soft cap). When the caller passes an
    // `expectedPageCount` from a cheap pdf-parse pre-read, we
    // compare. A returned count below 80% of expected almost
    // certainly means partial extraction → fall back to pdf-parse
    // for the full document.
    //
    // For chunked calls the wrapper passes undefined here (each chunk
    // doesn't independently know its expected size — the wrapper's
    // own completeness check handles that at the end).
    if (expectedPageCount && expectedPageCount > 0) {
        const cobertura = verificarCobertura(pages, expectedPageCount);
        if (!cobertura.ok) {
            throw new Error(`Extracción incompleta: ${cobertura.motivo}`);
        }
    }

    return { pages };
}

/**
 * Mínimo de páginas por tanda al subdividir.
 *
 * Por debajo de esto ya no es un problema de tamaño: si tres páginas de un
 * libro no entran en una respuesta, el problema es otro y seguir partiendo sólo
 * gasta llamadas.
 */
export const MIN_PAGINAS_POR_TANDA = 4;

/**
 * Si un fallo de lectura se arregla partiendo la tanda al medio.
 *
 * Sólo cuando la respuesta NO ENTRÓ. Otros fallos —un PDF corrupto, la API
 * caída, el JSON irrecuperable— no mejoran con tandas más chicas, y reintentar
 * con la mitad gasta páginas del usuario para volver a fallar.
 *
 * Y sólo mientras quede algo que partir: si cuatro páginas no entran, el
 * problema es otro.
 */
export function convieneParir(err: unknown, paginasEnLaTanda: number): boolean {
    const msg = String((err as Error)?.message ?? err);
    const noEntro = /MAX_TOKENS|truncated/i.test(msg);
    return noEntro && paginasEnLaTanda >= MIN_PAGINAS_POR_TANDA * 2;
}

/**
 * Lee un rango de páginas, partiéndolo si la respuesta no entra.
 *
 * Caso real: una gramática hebrea de 170 páginas se parte en tandas de 60 y la
 * primera falla con `finishReason=MAX_TOKENS`. No es un archivo malo ni un
 * modelo malo: sesenta páginas de hebreo vocalizado con su aparato NO CABEN en
 * una respuesta, y el razonamiento del modelo sale del mismo presupuesto. La
 * extracción entera fallaba por eso.
 *
 * El tamaño fijo no puede servir para los dos extremos: una novela entra de a
 * sesenta páginas y una gramática hebrea no. En vez de bajar el tope para todos
 * —más llamadas y más lento en el caso corriente— la tanda que no entra se
 * parte al medio y se reintenta. Los libros normales no pagan nada; los densos
 * se acomodan solos.
 */
async function leerRangoPartiendoSiNoEntra(
    sourceDoc: PDFDocument,
    desde: number,
    hasta: number,
    resourceId: string,
    apiKey: string,
    userId: string | undefined,
    etiqueta: string,
): Promise<GeminiPage[]> {
    const total = hasta - desde + 1;
    const doc = await PDFDocument.create();
    const copiadas = await doc.copyPages(sourceDoc, Array.from({ length: total }, (_, i) => desde - 1 + i));
    copiadas.forEach(pg => doc.addPage(pg));
    const ruta = path.join(os.tmpdir(), `${resourceId}-${desde}-${hasta}-${Date.now()}.pdf`);
    fs.writeFileSync(ruta, await doc.save());

    try {
        const paginas = await leerTandaConReintento(
            ruta, `${resourceId}-${etiqueta}`, apiKey, userId, total, etiqueta,
        );
        // Renumerar: el modelo ve la tanda como un documento de 1..N.
        return paginas.map(pg => ({ ...pg, page: desde + (pg.page - 1) }));
    } catch (err) {
        if (!convieneParir(err, total)) throw err;

        const medio = desde + Math.floor(total / 2) - 1;
        console.warn(
            `✂️ [Gemini Batched] ${etiqueta} (${desde}-${hasta}) no entra en una respuesta; se parte en ${desde}-${medio} y ${medio + 1}-${hasta}`,
        );
        return [
            ...await leerRangoPartiendoSiNoEntra(sourceDoc, desde, medio, resourceId, apiKey, userId, `${etiqueta}a`),
            ...await leerRangoPartiendoSiNoEntra(sourceDoc, medio + 1, hasta, resourceId, apiKey, userId, `${etiqueta}b`),
        ];
    } finally {
        try { fs.unlinkSync(ruta); } catch { /* el temporal ya no importa */ }
    }
}

/**
 * Lee una tanda y, si vuelve corta, la reintenta una vez.
 *
 * El reintento se queda con la mejor de las dos lecturas, no con la última: un
 * segundo intento puede salir peor, y quedarse con lo último medido sería
 * cambiar una lectura buena por una mala.
 */
async function leerTandaConReintento(
    ruta: string,
    etiquetaRecurso: string,
    apiKey: string,
    userId: string | undefined,
    esperadas: number,
    etiqueta: string,
): Promise<Array<{ page: number; text: string; md?: string }>> {
    const primera = (await extractGeminiPagesSinglePass(ruta, etiquetaRecurso, apiKey, undefined, userId)).pages;
    if (primera.length >= esperadas) return primera;

    console.warn(
        `⚠️ [Gemini Batched] Chunk ${etiqueta} devolvió ${primera.length}/${esperadas} páginas; reintentando una vez`,
    );
    try {
        const segunda = (await extractGeminiPagesSinglePass(ruta, etiquetaRecurso, apiKey, undefined, userId)).pages;
        return segunda.length > primera.length ? segunda : primera;
    } catch (err) {
        // El reintento es una mejora oportunista: si falla, vale lo que ya se
        // había leído. Tirarlo dejaría la tanda peor que sin reintentar.
        console.warn(`⚠️ [Gemini Batched] El reintento de ${etiqueta} falló; se conserva la primera lectura:`, err);
        return primera;
    }
}

/**
 * Batched Gemini extraction. For PDFs above `BATCH_THRESHOLD_PAGES`,
 * splits the source into per-call chunks of `CHUNK_SIZE_PAGES` (with
 * `OVERLAP_PAGES` overlap between consecutive chunks), runs single-pass
 * extraction on each, remaps the per-chunk page numbers to absolute
 * positions in the original PDF, and merges the results.
 *
 * Why split with `pdf-lib` (real PDF surgery) instead of asking Gemini
 * "process pages X-Y": the prompt-based approach is documented as
 * unreliable — Gemini still loads the whole doc and may respond about
 * pages it shouldn't. Splitting guarantees per-call work matches per-call
 * input.
 *
 * Failure modes:
 *   - One chunk fails → throw with chunk context. The cascade then falls
 *     back to pdf-parse for the WHOLE document. We don't try to mix tiers
 *     in a single doc — partial Standard + partial Básico would confuse
 *     the citation pipeline downstream.
 *
 * Time budget: ~25s per chunk (upload + processing wait + JSON parse).
 * A 600-page book in 60-page chunks = 10 chunks ≈ 250s, comfortably
 * within the 540s storage-trigger cap.
 */
async function extractWithGeminiBatched(
    tempFilePath: string,
    resourceId: string,
    apiKey: string,
    totalPageCount: number,
    userId?: string,
): Promise<{ text: string; markdown: string; pageCount: number }> {
    const sourceBytes = fs.readFileSync(tempFilePath);
    const sourceDoc = await PDFDocument.load(sourceBytes);
    const actualPages = sourceDoc.getPageCount();

    // Compute per-chunk page ranges (1-indexed, inclusive on both ends).
    // Overlap protects against last-page truncation on a chunk; dedup
    // below keeps the second chunk's version of overlap pages because
    // those pages sit at the START of their window (where Gemini is most
    // reliable) rather than the END (where it's most likely to truncate).
    const chunks: Array<{ start: number; end: number }> = [];
    let cursor = 1;
    while (cursor <= actualPages) {
        const start = cursor;
        const end = Math.min(cursor + CHUNK_SIZE_PAGES - 1, actualPages);
        chunks.push({ start, end });
        if (end >= actualPages) break;
        cursor = end - OVERLAP_PAGES + 1;
    }

    console.log(
        `🪓 [Gemini Batched] Splitting ${actualPages} pages into ${chunks.length} chunks (size=${CHUNK_SIZE_PAGES}, overlap=${OVERLAP_PAGES})`,
    );

    const allPages: GeminiPage[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const { start, end } = chunks[i]!;
        const chunkLabel = `${i + 1}/${chunks.length}`;
        console.log(`📦 [Gemini Batched] Chunk ${chunkLabel}: pages ${start}-${end}`);

        // La lectura arma su propio recorte y se PARTE SOLA si la respuesta no
        // entra. Antes, una tanda que volvía con MAX_TOKENS tumbaba la
        // extracción entera: pasó con una gramática hebrea de 170 páginas,
        // donde sesenta páginas de hebreo vocalizado no caben en una respuesta.
        // Las páginas vuelven ya renumeradas a su posición en el original.
        const chunkPages = await leerRangoPartiendoSiNoEntra(
            sourceDoc, start, end, resourceId, apiKey, userId, chunkLabel,
        );
        allPages.push(...chunkPages);
        console.log(`✅ [Gemini Batched] Chunk ${chunkLabel} returned ${chunkPages.length} pages`);
    }

    // Dedup overlap pages: when chunks overlap, the same page appears
    // twice. Keep the LATER occurrence — for any overlap page, the
    // second chunk's copy was processed at the BEGINNING of that
    // chunk's window (Gemini is most reliable there), while the first
    // chunk's copy was at the END (most likely to be truncated).
    const byPage = new Map<number, GeminiPage>();
    for (const p of allPages) byPage.set(p.page, p);
    const merged = Array.from(byPage.values()).sort((a, b) => a.page - b.page);

    // Cobertura del documento entero, con el mismo criterio que la ruta de
    // una sola pasada: proporción Y corte al final.
    const cobertura = verificarCobertura(merged, actualPages);
    if (!cobertura.ok) {
        throw new Error(
            `Extracción batcheada incompleta: ${cobertura.motivo}`,
        );
    }

    console.log(
        `🧩 [Gemini Batched] Merged ${merged.length} pages from ${chunks.length} chunks (totalPageCount hint=${totalPageCount})`,
    );

    return {
        text: pagesToMarkedText(merged),
        markdown: pagesToMarkdown(merged),
        pageCount: merged.length,
    };
}
