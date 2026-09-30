import { FileState, GoogleGenAI, MediaResolution, ThinkingLevel } from '@google/genai';
import { recordLlmUsage } from '../llm/llmUsageRecorder';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pagesToMarkedText, pagesToMarkdown } from './llamaParseClient';
import { MODEL_VISION } from '../llm/modelCatalog';
import { markdownAPlano } from './markdownAPlano';
import { permitirEsperasLargas } from '../llm/esperaLargaHttp';
import { rescatarPaginas, conMarkdown } from './rescatarPaginas';
import { verificarCobertura, convieneReintentarTanda } from './coberturaDePaginas';
import { convieneParir } from './partirTanda';
import {
    PRESUPUESTO_SALIDA,
    TANDA_INICIAL,
    OVERLAP_PAGES,
    densidadDe,
    densidadDeReferencia,
    tamanoParaDensidad,
} from './calibrarTanda';

/**
 * POR QUÉ NO SE ABRE UN PDF CIFRADO CON `ignoreEncryption`.
 *
 * Se probó, se desplegó, y salió peor que el problema. `pdf-lib` acepta la
 * bandera pero NO DESCIFRA: copia los flujos de contenido tal cual a un
 * contenedor sin cifrar, y el recorte resultante es ilegible. Medido sobre
 * el léxico de Ortiz: el original da 1.258.947 caracteres leído por pdfjs;
 * el recorte de cuatro páginas dio OCHO, con «Unknown compression method in
 * flate stream» en cada página.
 *
 * El daño no fue perder el libro: fue que el modelo recibió páginas en
 * blanco, devolvió nada, y la extracción terminó «lista» con 10 KB para 807
 * páginas —cobradas— pisando el texto anterior. Un fallo ruidoso se
 * convirtió en uno silencioso que además cobra.
 *
 * Un PDF con cifrado de permisos se rechaza al entrar, con un mensaje que
 * dice qué hacer. Descifrarlo de verdad necesita otra biblioteca (qpdf o
 * mupdf), y eso es una decisión aparte, no una bandera.
 */

// ── Batched Gemini extraction ───────────────────────────────────────────
//
// Una sola llamada tiene un tope de salida de 65 536 tokens. Por encima de
// `PAGINAS_EN_UNA_PASADA` el PDF se parte con pdf-lib en recortes reales —no
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
/**
 * Desde cuántas páginas el libro deja de leerse dentro del disparador y pasa a
 * la cola. Es un límite de TIEMPO, no de tokens (ver `PAGINAS_PARA_LA_COLA` en
 * domain, que lo duplica): 3.8 Flash lee ~9 s por página en la obra más densa.
 */
export const BATCH_THRESHOLD_PAGES = 40;

/**
 * Hasta cuántas páginas se lee en UNA llamada. Por encima, tandas calibradas.
 *
 * Es la primera tanda conservadora, por la misma razón: con una sola copia por
 * página, la BHS midió 2 244 tokens/página en 3.8 Flash, y 24 páginas son
 * ~54 000 — cerca del tope de 65 536. Un libro más largo se mide en su primera
 * tanda y el resto se lee al tamaño que esa medida autoriza.
 */
export const PAGINAS_EN_UNA_PASADA = TANDA_INICIAL;

// El `fetch` de Node aborta a los 300 s, y una lectura densa tarda más. Se
// levanta al cargar el módulo, antes de cualquier llamada.
permitirEsperasLargas();

/**
 * Single PDF page as Gemini returned it. Same shape as `LlamaParsePage`
 * so the formatters downstream work without branching by engine.
 */
export interface GeminiPage {
    page: number;
    text: string;
    md?: string;
}

/**
 * Lo que una lectura limpia deja para calibrar el resto del libro: cuántos
 * tokens produjo y sobre cuántas páginas.
 */
export interface MuestraDeDensidad {
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
    const useBatched = !!expectedPageCount && expectedPageCount > PAGINAS_EN_UNA_PASADA;
    if (useBatched) {
        console.log(
            `🤖 [Gemini] ${expectedPageCount} páginas > ${PAGINAS_EN_UNA_PASADA} — lectura por tandas`,
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
    const ai = new GoogleGenAI({ apiKey });

    console.log(`⬆️ [Gemini] Uploading to Gemini Files API...`);
    const subido = await ai.files.upload({
        file: tempFilePath,
        config: { mimeType: 'application/pdf', displayName: `${resourceId}.pdf` },
    });
    if (!subido.name) throw new Error('Gemini Files API no devolvió nombre de archivo');

    // Wait for file to be processed (Gemini converts the PDF before
    // the model can read it — non-trivial for big files).
    let geminiFile = await ai.files.get({ name: subido.name });
    const fileReadyDeadline = Date.now() + 5 * 60 * 1000;
    while (geminiFile.state === FileState.PROCESSING) {
        if (Date.now() > fileReadyDeadline) {
            throw new Error('Gemini file processing exceeded 5 minutes');
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        geminiFile = await ai.files.get({ name: subido.name });
    }
    if (geminiFile.state === FileState.FAILED || !geminiFile.uri) {
        throw new Error('Gemini file processing failed');
    }
    console.log(`✅ [Gemini] File ready: ${geminiFile.displayName}`);

    // UNA SOLA COPIA por página. Antes se pedía `text` y `md` de cada página,
    // que es el mismo contenido dos veces: duplicaba la salida —la parte cara—
    // y dejaba el tope de 65 536 tokens en ~42 páginas densas. Así se cortó una
    // gramática hebrea de 78 páginas el 2026-09-29. El texto plano se deriva del
    // markdown (`markdownAPlano`), que no cuesta nada.
    //
    // Razonamiento en `LOW`: los 3.x no permiten apagarlo, y lo que piensan sale
    // del mismo tope que el contenido. En el bakeoff, en `LOW`, no gastó un solo
    // token en pensar sobre tres libros. Se sigue midiendo en cada llamada
    // (`thoughtsTokenCount`) y se suma a la densidad que calibra las tandas.
    //
    // Resolución ALTA: es con la que el bakeoff leyó la cantilación de la BHS.
    const prompt = `Extrae el texto completo de este PDF página por página.

Reglas:
1. Una entrada por página física, en orden, numeradas desde 1 según su posición en el archivo.
2. Preserva la estructura en markdown: encabezados con # / ##, párrafos separados, listas con -, tablas en formato markdown.
3. Transcribe el griego y el hebreo EXACTAMENTE como aparecen: griego politónico con espíritus, acentos e iota suscrita; hebreo con niqqud y acentos de cantilación. No normalices ni corrijas ninguna forma.
4. No traduzcas términos teológicos ni citas bíblicas.
5. No uses LaTeX ni notación matemática: nada de $...$, \\text ni ^{...}. Escribe los superíndices y las letras de nota del aparato como caracteres Unicode (ᵃ ᵇ ᶜ ¹ ²) pegados donde aparecen.
6. NO incluyas el número de página impreso en el contenido.

Devuelve JSON con esta estructura exacta:
{
  "pages": [
    { "page": 1, "md": "contenido de la página en markdown" }
  ]
}

Si una página está vacía, devuelve "md": "" pero conserva la entrada para no romper la numeración.`;

    const result = await ai.models.generateContent({
        model: MODEL_VISION,
        contents: [{
            role: 'user',
            parts: [
                { text: prompt },
                { fileData: { mimeType: geminiFile.mimeType ?? 'application/pdf', fileUri: geminiFile.uri } },
            ],
        }],
        config: {
            responseMimeType: 'application/json',
            maxOutputTokens: PRESUPUESTO_SALIDA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
        },
    });

    // Se mide ANTES del guard de truncado: una respuesta truncada igual se
    // cobra, y si no se registrara aquí, los reintentos por MAX_TOKENS —que son
    // justo los caros— quedarían fuera de la contabilidad.
    const usage = result.usageMetadata;
    const razonamiento = usage?.thoughtsTokenCount ?? 0;
    // El razonamiento consume el MISMO tope: para calibrar cuántas páginas
    // entran en una llamada, cuenta como salida.
    const tokensDeSalida = (usage?.candidatesTokenCount ?? 0) + razonamiento;
    void recordLlmUsage({
        model: MODEL_VISION,
        feature: 'library.pdfExtraction',
        userId,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        thinkingTokens: razonamiento,
    });

    // Truncation guard #1 — Gemini sets `finishReason = 'MAX_TOKENS'`
    // when it stopped because the output budget ran out. The JSON
    // returned in that case may be syntactically valid but
    // semantically incomplete. Treat this as a hard failure so the
    // cascade falls to pdf-parse, which produces auto-indexable
    // output covering the FULL document.
    const finishReason = result.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        throw new Error(`Gemini stopped early (finishReason=${finishReason}); response truncated`);
    }

    const responseText = result.text ?? '';

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
    try { await ai.files.delete({ name: subido.name }); } catch { /* ignore */ }

    // El texto plano sale del markdown. Una respuesta vieja o rescatada puede
    // traer `text` sin `md`, y se respeta.
    const pages = parsed.pages.map((p, idx) => ({
        page: typeof p.page === 'number' ? p.page : idx + 1,
        text: typeof p.md === 'string' ? markdownAPlano(p.md) : (p.text ?? ''),
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
 * Lee UN rango de páginas de un PDF ya descargado, para la extracción en cola.
 *
 * `extractWithGemini` recorre el libro entero dentro de una invocación. Eso
 * funciona hasta las ~170 páginas y después choca con el tope de la función: un
 * diccionario de 1 006 páginas necesita ~25 rangos y ninguna invocación dura
 * tanto. La cola parte ese recorrido en tareas de una tarea por rango, y cada
 * una entra acá con lo suyo.
 *
 * Devuelve también los tokens que produjo, que es lo que permite a la PRIMERA
 * tarea calibrar el tamaño del resto (ver `calibrarTanda`) y pasárselo a la
 * siguiente por la carga de la tarea.
 */
export async function extraerRangoDelPdf(
    rutaDelPdf: string,
    resourceId: string,
    apiKey: string,
    desde: number,
    hasta: number,
    opciones: { userId?: string; laSiguienteRelee: boolean },
): Promise<{ paginas: GeminiPage[]; muestra: MuestraDeDensidad | null }> {
    const sourceDoc = await PDFDocument.load(fs.readFileSync(rutaDelPdf));
    // La muestra viaja entera —tokens Y páginas— porque calibrar necesita las
    // dos: el tamaño sale de los tokens POR PÁGINA, y devolver sólo el total
    // obligaría al llamador a suponer sobre cuántas se midió.
    return leerRangoPartiendoSiNoEntra(
        sourceDoc, desde, hasta, resourceId, apiKey, opciones.userId,
        `${desde}-${hasta}`, opciones.laSiguienteRelee,
    );
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
    // La densidad se remide en CADA tanda, no sólo en la primera. El principio
    // de un libro son portadilla, créditos e índice: medido sobre el comentario
    // de Sasson, sus primeras 24 páginas dieron 611 tokens/página y su cuerpo
    // mide 1 555. Calibrar una sola vez con ese arranque fijaba un tamaño que
    // el libro no sostenía, y la tercera tanda se estrellaba.
    let densidadMaxima: number | null = null;

    console.log(
        `🪓 [Gemini Batched] ${actualPages} páginas; primera tanda de ${tamano}` +
        `${opciones.paginasPorTanda ? ' (tamaño ya medido antes)' : ' (se remide en cada tanda)'}`,
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

        const referencia = densidadDeReferencia(
            densidadMaxima,
            muestra ? densidadDe(muestra.tokensDeSalida, muestra.paginas) : null,
        );
        if (referencia !== null && referencia !== densidadMaxima) {
            densidadMaxima = referencia;
            const nuevo = tamanoParaDensidad(referencia);
            if (nuevo !== tamano) {
                console.log(
                    `📐 [Gemini Batched] ${Math.round(referencia)} tokens/página (el tramo más denso visto); ` +
                    `el resto va de a ${nuevo} páginas`,
                );
                tamano = nuevo;
            }
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
