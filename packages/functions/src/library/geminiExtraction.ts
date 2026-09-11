import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { recordLlmUsage } from '../llm/llmUsageRecorder';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pagesToMarkedText, pagesToMarkdown } from './llamaParseClient';
import { MODEL_FAST } from '../llm/modelCatalog';
import { rescatarPaginas, conMarkdown } from './rescatarPaginas';
import { verificarCobertura, convieneReintentarTanda } from './coberturaDePaginas';
import { convieneParir } from './partirTanda';
import {
    PRESUPUESTO_SALIDA,
    TANDA_INICIAL,
    OVERLAP_PAGES,
    calibrarPaginasPorTanda,
} from './calibrarTanda';

// ── Batched Gemini extraction ───────────────────────────────────────────
//
// Una sola llamada tiene un tope de salida de 65 536 tokens. Por encima de
// `BATCH_THRESHOLD_PAGES` el PDF se parte con pdf-lib en recortes reales —no
// pidiéndole al modelo «procesá las páginas X a Y», que está documentado como
// poco fiable— y los resultados se concatenan. La forma de la salida es la
// misma que la de una pasada única, así que el chunker de más abajo no necesita
// saber por cuál camino vino.
//
// El TAMAÑO de cada recorte ya no es una constante: sale medido del propio
// documento, ver `calibrarTanda`. La constante anterior —60 páginas— excedía el
// techo de las tres obras medidas, y en treinta días de registros ninguna
// extracción batcheada terminó un libro: once arrancadas, una llegó a su
// segundo bloque, cero completadas.
export const BATCH_THRESHOLD_PAGES = 80;

/**
 * `GenerationConfig` más el campo que el SDK 0.21 no declara.
 *
 * `@google/generative-ai` es el SDK legado y quedó congelado antes de que
 * existiera el razonamiento configurable. `generationConfig` se serializa tal
 * cual al cuerpo REST, que es donde la API espera `thinkingConfig`, así que el
 * campo viaja bien; lo único que falta es el tipo. Verificado con 14 llamadas
 * medidas: con el campo puesto, `thoughtsTokenCount` deja de venir.
 */
interface ConfigDeGeneracion extends GenerationConfig {
    thinkingConfig?: { thinkingBudget: number };
}

/**
 * `usageMetadata` más el contador que el SDK 0.21 tampoco declara.
 *
 * El razonamiento se factura como salida y NO aparece en `candidatesTokenCount`.
 * Sin este campo el panel de costos venía subcontando: en una de las llamadas
 * medidas fueron 32 584 tokens que nadie vio.
 */
interface UsoConRazonamiento {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
}

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
 * Lo que una lectura limpia deja para calibrar el resto del libro: cuántos
 * tokens produjo y sobre cuántas páginas.
 */
interface MuestraDeDensidad {
    tokensDeSalida: number;
    paginas: number;
}

export interface ResultadoDeExtraccion {
    text: string;
    markdown: string;
    pageCount: number;
    /**
     * Tamaño de tanda con el que este libro terminó leyéndose. El llamador lo
     * guarda en el recurso para que una reextracción arranque calibrada en vez
     * de volver a medir desde cero.
     */
    paginasPorTanda?: number;
}

export interface OpcionesDeExtraccion {
    /** Dueño del recurso. Sin él el gasto queda sin atribuir en el panel. */
    userId?: string;
    /** Tamaño ya medido en una extracción anterior de este mismo archivo. */
    paginasPorTanda?: number;
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
    opciones: OpcionesDeExtraccion = {},
): Promise<ResultadoDeExtraccion> {
    const { userId } = opciones;
    const useBatched = !!expectedPageCount && expectedPageCount > BATCH_THRESHOLD_PAGES;
    if (useBatched) {
        console.log(
            `🤖 [Gemini] expected ${expectedPageCount} pages > ${BATCH_THRESHOLD_PAGES} — using batched extraction`,
        );
        return extractWithGeminiBatched(tempFilePath, resourceId, apiKey, expectedPageCount!, opciones);
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
 * `generateContent` call. El router la llama directo para PDFs cortos y una vez
 * por tanda para los largos.
 *
 * Truncation safeguards:
 *   1. `finishReason !== 'STOP'` → hard fail (cascade falls back).
 *   2. Cobertura insuficiente → fallo duro. No es sólo un porcentaje: también
 *      detecta el corte al final, que la proporción sola deja pasar. El
 *      llamador la desactiva pasando `undefined` cuando no sabe cuántas
 *      páginas esperar (llamadas por tanda).
 *
 * Devuelve además los tokens que produjo, que es lo que permite calibrar el
 * tamaño de las tandas siguientes sin adivinarlo.
 */
async function extractGeminiPagesSinglePass(
    tempFilePath: string,
    resourceId: string,
    apiKey: string,
    expectedPageCount?: number,
    userId?: string,
): Promise<{ pages: GeminiPage[]; tokensDeSalida: number }> {
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

    // El razonamiento sale del MISMO presupuesto que el contenido, y transcribir
    // un PDF no lo necesita. Medido sobre la gramática de Barrick: encendido se
    // llevó entre el 3% y el 50% del tope según la corrida, y con 30 páginas
    // empujó la respuesta contra el techo por 16 tokens (32 936 de contenido +
    // 32 584 de razonamiento = 65 520 de 65 536). Apagado, esas mismas 30
    // páginas volvieron completas y en la mitad del tiempo: 274 s con fallo →
    // 135 s con 30/30.
    //
    // Y sobre todo: apagado, el presupuesto se vuelve DETERMINISTA. Ésa es la
    // condición para que calibrar el tamaño de tanda signifique algo — contra un
    // presupuesto que se comparte con una variable aleatoria capaz de llevarse
    // la mitad, la misma tanda del mismo libro entra o no entra según cuánto
    // decida pensar el modelo.
    const generationConfig: ConfigDeGeneracion = {
        responseMimeType: 'application/json',
        maxOutputTokens: PRESUPUESTO_SALIDA,
        thinkingConfig: { thinkingBudget: 0 },
    };
    const model = genAI.getGenerativeModel({ model: MODEL_FAST, generationConfig });

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

    // Se mide ANTES del guard de truncado: una respuesta truncada igual se
    // cobra, y si no se registrara aquí, los reintentos por MAX_TOKENS —que son
    // justo los caros— quedarían fuera de la contabilidad.
    const usage = result.response.usageMetadata as UsoConRazonamiento | undefined;
    const tokensDeSalida = usage?.candidatesTokenCount ?? 0;
    void recordLlmUsage({
        model: MODEL_FAST,
        feature: 'library.pdfExtraction',
        userId,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: tokensDeSalida,
        thinkingTokens: usage?.thoughtsTokenCount ?? 0,
    });

    // Truncation guard #1 — Gemini sets `finishReason = 'MAX_TOKENS'`
    // when it stopped because the output budget ran out. The JSON
    // returned in that case may be syntactically valid but
    // semantically incomplete. Treat this as a hard failure so the
    // cascade falls to pdf-parse, which produces auto-indexable
    // output covering the FULL document.
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
        //
        // Antes se descartaba la llamada entera y el libro perdía sus páginas.
        // Rescatar las entradas bien formadas convierte «perdí las ocho» en
        // «perdí la que venía rota», y lo que falte lo ve el guard de cobertura.
        const rescatadas = rescatarPaginas(responseText);
        if (rescatadas.length === 0) {
            console.error('❌ [Gemini] JSON inválido y nada rescatable:', responseText.substring(0, 500));
            throw new Error('Failed to parse Gemini response as JSON');
        }
        // Se dice cuántas conservaron su markdown, no sólo cuántas se
        // rescataron. Un rescate que salva el texto y se come la estructura no
        // falla: devuelve páginas, pasa el guard de cobertura y entra al corpus
        // como buena. Así se perdieron las tablas de 63 páginas de una gramática
        // hebrea sin que ningún registro lo dijera.
        console.warn(
            `⚠️ [Gemini] JSON inválido; rescatadas ${rescatadas.length} página(s), ` +
            `${conMarkdown(rescatadas)} con su markdown`,
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

    // Truncation guard #2 — aun con `finishReason = STOP`, Gemini a veces
    // devuelve menos páginas que el PDF. Cuando el llamador sabe cuántas
    // esperar, se compara. Las llamadas por tanda pasan `undefined`: una tanda
    // no conoce su propio total esperado, y la cobertura del libro entero la
    // verifica el envoltorio al final.
    if (expectedPageCount && expectedPageCount > 0) {
        const cobertura = verificarCobertura(pages, expectedPageCount);
        if (!cobertura.ok) {
            throw new Error(`Extracción incompleta: ${cobertura.motivo}`);
        }
    }

    return { pages, tokensDeSalida };
}

/**
 * Lee un rango de páginas, partiéndolo si la respuesta no entra.
 *
 * Con la calibración andando esto es una RED, no el mecanismo principal: el
 * tamaño ya viene medido del documento y partir queda para el tramo atípico que
 * la muestra no representó. Antes era al revés, y se veía — la gramática de
 * Barrick redescubría en cada bloque que 60 páginas no entraban, a 274 s el
 * primero y 352 s el segundo, sin recordar nada entre uno y otro.
 */
async function leerRangoPartiendoSiNoEntra(
    sourceDoc: PDFDocument,
    desde: number,
    hasta: number,
    resourceId: string,
    apiKey: string,
    userId: string | undefined,
    etiqueta: string,
    laSiguienteRelee: boolean,
): Promise<{ paginas: GeminiPage[]; muestra: MuestraDeDensidad | null }> {
    const total = hasta - desde + 1;
    const doc = await PDFDocument.create();
    const copiadas = await doc.copyPages(sourceDoc, Array.from({ length: total }, (_, i) => desde - 1 + i));
    copiadas.forEach(pg => doc.addPage(pg));
    const ruta = path.join(os.tmpdir(), `${resourceId}-${desde}-${hasta}-${Date.now()}.pdf`);
    fs.writeFileSync(ruta, await doc.save());

    try {
        const leida = await leerTandaConReintento(
            ruta, `${resourceId}-${etiqueta}`, apiKey, userId, total, etiqueta, laSiguienteRelee,
        );
        return {
            // Renumerar: el modelo ve la tanda como un documento de 1..N.
            paginas: leida.paginas.map(pg => ({ ...pg, page: desde + (pg.page - 1) })),
            muestra: leida.paginas.length > 0
                ? { tokensDeSalida: leida.tokensDeSalida, paginas: leida.paginas.length }
                : null,
        };
    } catch (err) {
        if (!convieneParir(err, total)) throw err;

        const medio = desde + Math.floor(total / 2) - 1;
        console.warn(
            `✂️ [Gemini Batched] ${etiqueta} (${desde}-${hasta}) no entra en una respuesta; se parte en ${desde}-${medio} y ${medio + 1}-${hasta}`,
        );
        // Las dos mitades de un partido NO se solapan entre sí: la segunda
        // arranca donde termina la primera. Así que a la primera mitad nadie le
        // relee el final —va con `false`— mientras que la segunda hereda lo que
        // valía para la tanda entera, porque termina donde ésta terminaba.
        const primera = await leerRangoPartiendoSiNoEntra(sourceDoc, desde, medio, resourceId, apiKey, userId, `${etiqueta}a`, false);
        const segunda = await leerRangoPartiendoSiNoEntra(sourceDoc, medio + 1, hasta, resourceId, apiKey, userId, `${etiqueta}b`, laSiguienteRelee);
        return {
            paginas: [...primera.paginas, ...segunda.paginas],
            // La muestra sale de la mitad que SÍ entró. Un rango que hubo que
            // partir no describe la densidad del libro: describe el accidente.
            muestra: primera.muestra ?? segunda.muestra,
        };
    } finally {
        try { fs.unlinkSync(ruta); } catch { /* el temporal ya no importa */ }
    }
}

/**
 * Lee una tanda y, si le falta algo que de verdad se va a perder, la relee una
 * vez.
 *
 * «Que de verdad se va a perder» es la parte que faltaba: releer cuesta lo
 * mismo que leer —181 s para una tanda de 43 páginas, medido— y antes se
 * disparaba ante cualquier página faltante. Una tanda de 43 a la que le faltaba
 * UNA pagaba ese precio completo por una página que la tanda siguiente iba a
 * releer igual por el solapamiento. El criterio vive junto al piso de cobertura
 * para que las dos tolerancias no puedan volver a contradecirse.
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
    laSiguienteRelee: boolean,
): Promise<{ paginas: GeminiPage[]; tokensDeSalida: number }> {
    const primera = await extractGeminiPagesSinglePass(ruta, etiquetaRecurso, apiKey, undefined, userId);
    if (!convieneReintentarTanda(primera.pages.map(p => p.page), esperadas, laSiguienteRelee)) {
        if (primera.pages.length < esperadas) {
            console.log(
                `ℹ️ [Gemini Batched] Tanda ${etiqueta} devolvió ${primera.pages.length}/${esperadas}; ` +
                `dentro de lo que cubren el solapamiento y el piso de cobertura, sigue sin releer`,
            );
        }
        return { paginas: primera.pages, tokensDeSalida: primera.tokensDeSalida };
    }

    console.warn(
        `⚠️ [Gemini Batched] Tanda ${etiqueta} devolvió ${primera.pages.length}/${esperadas} páginas; releyendo una vez`,
    );
    try {
        const segunda = await extractGeminiPagesSinglePass(ruta, etiquetaRecurso, apiKey, undefined, userId);
        return segunda.pages.length > primera.pages.length
            ? { paginas: segunda.pages, tokensDeSalida: segunda.tokensDeSalida }
            : { paginas: primera.pages, tokensDeSalida: primera.tokensDeSalida };
    } catch (err) {
        // El reintento es una mejora oportunista: si falla, vale lo que ya se
        // había leído. Tirarlo dejaría la tanda peor que sin reintentar.
        console.warn(`⚠️ [Gemini Batched] El reintento de ${etiqueta} falló; se conserva la primera lectura:`, err);
        return { paginas: primera.pages, tokensDeSalida: primera.tokensDeSalida };
    }
}

/**
 * Batched Gemini extraction.
 *
 * La primera tanda es conservadora (`TANDA_INICIAL`) porque todavía no se sabe
 * cuánto pesa una página de ESTE libro. Con lo que produce se calibra el tamaño
 * del resto —ver `calibrarTanda`—, así que un libro liviano acelera y uno denso
 * se achica solo, sin que nadie elija un número.
 *
 * Los rangos se calculan sobre la marcha y no todos por adelantado, justamente
 * porque el tamaño cambia después de la primera lectura.
 *
 * Failure modes:
 *   - Una tanda que falla del todo → throw con su contexto. La cascada cae
 *     entonces a pdf-parse para el documento ENTERO. No se mezclan calidades
 *     dentro de un mismo libro: media extracción por visión y media por capa de
 *     texto confundiría al canalizador de citas aguas abajo.
 */
async function extractWithGeminiBatched(
    tempFilePath: string,
    resourceId: string,
    apiKey: string,
    totalPageCount: number,
    opciones: OpcionesDeExtraccion,
): Promise<ResultadoDeExtraccion> {
    const { userId } = opciones;
    const sourceBytes = fs.readFileSync(tempFilePath);
    const sourceDoc = await PDFDocument.load(sourceBytes);
    const actualPages = sourceDoc.getPageCount();

    let tamano = opciones.paginasPorTanda ?? TANDA_INICIAL;
    let faltaCalibrar = opciones.paginasPorTanda === undefined;

    console.log(
        `🪓 [Gemini Batched] ${actualPages} páginas; primera tanda de ${tamano}` +
        `${faltaCalibrar ? ' (a calibrar con lo que devuelva)' : ' (tamaño ya medido antes)'}`,
    );

    const allPages: GeminiPage[] = [];
    let cursor = 1;
    let numero = 0;

    while (cursor <= actualPages) {
        const desde = cursor;
        const hasta = Math.min(cursor + tamano - 1, actualPages);
        numero++;
        const etiqueta = `${numero}`;
        console.log(`📦 [Gemini Batched] Tanda ${etiqueta}: páginas ${desde}-${hasta} (de ${actualPages})`);

        const esLaUltima = hasta >= actualPages;
        const { paginas, muestra } = await leerRangoPartiendoSiNoEntra(
            sourceDoc, desde, hasta, resourceId, apiKey, userId, etiqueta,
            // Detrás de la última tanda no hay ninguna que relea su final, y
            // perder ese final es perder el final del libro.
            !esLaUltima,
        );
        allPages.push(...paginas);
        console.log(`✅ [Gemini Batched] Tanda ${etiqueta} devolvió ${paginas.length} páginas`);

        if (faltaCalibrar && muestra) {
            const calibrado = calibrarPaginasPorTanda(muestra.tokensDeSalida, muestra.paginas);
            if (calibrado !== null) {
                const porPagina = Math.round(muestra.tokensDeSalida / muestra.paginas);
                console.log(
                    `📐 [Gemini Batched] ${porPagina} tokens/página medidos; el resto va de a ${calibrado} páginas`,
                );
                tamano = calibrado;
            }
            faltaCalibrar = false;
        }

        if (esLaUltima) break;
        cursor = hasta - OVERLAP_PAGES + 1;
    }

    // Dedup del solapamiento: se conserva la ÚLTIMA aparición de cada página,
    // que es la que vino al principio de su ventana (donde el modelo es más
    // fiable) y no al final (donde trunca).
    const byPage = new Map<number, GeminiPage>();
    for (const p of allPages) byPage.set(p.page, p);
    const merged = Array.from(byPage.values()).sort((a, b) => a.page - b.page);

    // Cobertura del documento entero, con el mismo criterio que la ruta de
    // una sola pasada: proporción Y corte al final.
    const cobertura = verificarCobertura(merged, actualPages);
    if (!cobertura.ok) {
        throw new Error(`Extracción batcheada incompleta: ${cobertura.motivo}`);
    }

    console.log(
        `🧩 [Gemini Batched] ${merged.length} páginas de ${numero} tandas (esperadas ${totalPageCount})`,
    );

    return {
        text: pagesToMarkedText(merged),
        markdown: pagesToMarkdown(merged),
        pageCount: merged.length,
        paginasPorTanda: tamano,
    };
}
