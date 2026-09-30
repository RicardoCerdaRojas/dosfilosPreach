/**
 * Engine adapters.
 *
 * Every engine returns the SAME shape so the metrics can compare them:
 *
 *   { markdown, pageCount, costUnits, costNote, elapsedMs, raw }
 *
 * `markdown` MUST use the production page contract — `<!-- page: N -->`
 * separated by `\n\n---\n\n` — because the whole point is to measure what
 * the real chunker would receive. See `pagesToMarkdown` in
 * `packages/functions/src/library/llamaParseClient.ts`.
 *
 * An engine that cannot run (missing key, missing binary) returns
 * `{ skipped: true, reason }` rather than throwing. A bake-off that dies
 * because one of five engines lacks a key is a bake-off nobody runs.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const PARSING_INSTRUCTION =
    'Preserva con precisión los caracteres griegos politónicos (espíritus, acentos, '
    + 'iota suscrita) y hebreos (niqqud y acentos de cantilación). Mantén la estructura '
    + 'de capítulos, secciones, tablas y notas al pie. No traduzcas ni normalices '
    + 'términos teológicos, lemas ni citas bíblicas.';

function joinPages(pages) {
    return pages
        .map(p => `<!-- page: ${p.page} -->\n${(p.content ?? '').trim()}`)
        .join('\n\n---\n\n');
}

// ── Baseline: poppler pdftotext ────────────────────────────────────────────

/**
 * Neutral reference. Not an LLM, no reconstruction, no opinions — it reports
 * the text actually embedded in the PDF.
 *
 * Two jobs in this harness:
 *   1. tells us whether the document HAS embedded text at all, which decides
 *      whether the novelty metric means anything (on a scan it does not);
 *   2. gives a floor for script fidelity — if poppler recovers polytonic
 *      Greek and a paid engine does not, that engine is destroying data that
 *      was sitting right there.
 */
export async function runPdfToText(pdfPath) {
    const started = Date.now();
    try {
        // -layout keeps columns from interleaving; -enc UTF-8 is essential or
        // the Greek and Hebrew come back mangled and we would blame the PDF.
        const { stdout } = await execFileAsync(
            'pdftotext',
            ['-layout', '-enc', 'UTF-8', pdfPath, '-'],
            { maxBuffer: 200 * 1024 * 1024 },
        );
        // pdftotext separates pages with form feed (U+000C).
        const pages = stdout.split('\f').map((content, i) => ({ page: i + 1, content }));
        while (pages.length && !pages[pages.length - 1].content.trim()) pages.pop();
        return {
            markdown: joinPages(pages),
            pageCount: pages.length,
            costUnits: 0,
            costUnit: '—',
            costNote: 'gratis (local)',
            billing: { cacheHit: false },
            elapsedMs: Date.now() - started,
        };
    } catch (err) {
        return { skipped: true, reason: `pdftotext falló: ${err.message}` };
    }
}

// ── LlamaParse ─────────────────────────────────────────────────────────────

const LLAMAPARSE_BASE = 'https://api.cloud.llamaindex.ai/api/v1/parsing';

/**
 * @param mode 'fast' | 'balanced' | 'premium'
 *
 * `fast` is what production uses today for the tier sold as Premium. It is
 * included here precisely so the report can put a number on that decision
 * instead of an argument.
 */
export async function runLlamaParse(pdfPath, { mode, apiKey, maxPollSeconds = 900, invalidateCache = false }) {
    if (!apiKey) return { skipped: true, reason: 'falta LLAMAPARSE_API_KEY' };
    const started = Date.now();

    try {
        const buffer = await fs.readFile(pdfPath);
        const form = new FormData();
        form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'bakeoff.pdf');
        form.append('language', 'es');
        form.append('parsing_instruction', PARSING_INSTRUCTION);
        if (mode === 'fast') form.append('fast_mode', 'true');
        else if (mode === 'premium') form.append('premium_mode', 'true');
        // 'balanced' = neither flag: the default LLM-based parse.
        // LlamaParse cachea por hash de archivo. Re-medir el mismo recorte
        // devuelve el resultado guardado y factura 0 créditos, lo que hace
        // que una comparación de costos mienta sin avisar. Con esto se fuerza
        // trabajo real; `job_is_cache_hit` en la respuesta confirma si surtió
        // efecto, así que la instrumentación se verifica a sí misma.
        if (invalidateCache) form.append('invalidate_cache', 'true');

        const upRes = await fetch(`${LLAMAPARSE_BASE}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
            body: form,
        });
        if (!upRes.ok) {
            return { skipped: true, reason: `upload ${upRes.status}: ${(await upRes.text()).slice(0, 200)}` };
        }
        const { id: jobId } = await upRes.json();

        const deadline = Date.now() + maxPollSeconds * 1000;
        let status = 'PENDING';
        while (Date.now() < deadline) {
            await sleep(3000);
            const st = await fetch(`${LLAMAPARSE_BASE}/job/${jobId}`, {
                headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
            });
            if (!st.ok) continue;
            const body = await st.json();
            status = body.status;
            if (status === 'SUCCESS') break;
            if (status === 'ERROR' || status === 'CANCELED') {
                return { skipped: true, reason: `job ${status}: ${body.error ?? ''}` };
            }
        }
        if (status !== 'SUCCESS') return { skipped: true, reason: `timeout tras ${maxPollSeconds}s` };

        const resRes = await fetch(`${LLAMAPARSE_BASE}/job/${jobId}/result/json`, {
            headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
        });
        if (!resRes.ok) {
            return { skipped: true, reason: `result ${resRes.status}` };
        }
        const result = await resRes.json();
        const rawPages = result.pages ?? [];
        const pages = rawPages.map(p => ({
            page: p.page,
            // Same `||` fallback as production: fast mode can return md = ''.
            content: (p.md && p.md.trim()) || (p.text && p.text.trim()) || '',
        }));

        // Metadata de facturación COMPLETA. Antes sólo se guardaba el número
        // de créditos, y una lectura de 0 no se podía distinguir de un cache
        // hit — se reportó 0 como si fuera el costo real. Guardar la bandera
        // hace que el informe pueda decir "0 porque vino de caché" en vez de
        // "0 porque es gratis".
        const meta = result.job_metadata ?? {};
        return {
            markdown: joinPages(pages),
            pageCount: pages.length,
            costUnits: meta.job_credits_usage ?? null,
            costUnit: 'créditos',
            costNote: 'créditos LlamaParse (reportados por la API)',
            billing: {
                credits: meta.job_credits_usage ?? null,
                pagesBilled: meta.job_pages ?? null,
                cacheHit: meta.job_is_cache_hit ?? null,
                creditsUsedAccount: meta.credits_used ?? null,
            },
            elapsedMs: Date.now() - started,
        };
    } catch (err) {
        return { skipped: true, reason: `excepción: ${err.message}` };
    }
}

// ── Mistral OCR ────────────────────────────────────────────────────────────

/**
 * ⚠️ ADAPTADOR NO EJECUTADO. Escrito contra la forma documentada de la API
 * pero nunca corrido contra el servicio real — no había clave disponible al
 * construir el banco. Si la respuesta no trae `pages`, este adaptador
 * imprime las claves de nivel superior que SÍ vinieron, para que ajustar el
 * mapeo tome un minuto en vez de una tarde de adivinanzas.
 *
 * Mistral OCR devuelve markdown por página de forma nativa, que encaja
 * mejor con nuestro contrato `<!-- page: N -->` que el array de páginas de
 * LlamaParse. `index` viene basado en 0; lo pasamos a 1 para que las páginas
 * coincidan con las del PDF y con las citas.
 */
export async function runMistralOcr(pdfPath, { apiKey, model = 'mistral-ocr-latest' }) {
    if (!apiKey) return { skipped: true, reason: 'falta MISTRAL_API_KEY' };
    const started = Date.now();

    try {
        const buffer = await fs.readFile(pdfPath);
        const dataUri = `data:application/pdf;base64,${buffer.toString('base64')}`;

        const res = await fetch('https://api.mistral.ai/v1/ocr', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                document: { type: 'document_url', document_url: dataUri },
                include_image_base64: false,
            }),
        });

        if (!res.ok) {
            return { skipped: true, reason: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
        }

        const body = await res.json();
        if (!Array.isArray(body.pages)) {
            return {
                skipped: true,
                reason: `respuesta sin campo "pages". Claves recibidas: ${Object.keys(body).join(', ')}. `
                    + 'Ajusta el mapeo en runMistralOcr().',
            };
        }

        const pages = body.pages.map((p, i) => ({
            page: typeof p.index === 'number' ? p.index + 1 : i + 1,
            content: p.markdown ?? p.text ?? '',
        }));

        const pagesProcessed = body.usage_info?.pages_processed ?? pages.length;
        return {
            markdown: joinPages(pages),
            pageCount: pages.length,
            costUnits: pagesProcessed,
            costUnit: 'páginas',
            costNote: 'páginas procesadas',
            billing: { pagesBilled: pagesProcessed, cacheHit: false },
            elapsedMs: Date.now() - started,
        };
    } catch (err) {
        return { skipped: true, reason: `excepción: ${err.message}` };
    }
}

// ── Gemini ─────────────────────────────────────────────────────────────────

/**
 * The current Standard tier. Included so the report answers a question the
 * founder will ask immediately: is the cheap tier already good enough for
 * Greek, making the premium tier's price hard to justify?
 *
 * El id del modelo se retira cada tanto y la API responde 404 con el nombre
 * del reemplazo. `BAKEOFF_GEMINI_MODEL` permite fijarlo sin editar código
 * cuando eso vuelva a pasar; el mensaje de error del 404 dice cuál poner.
 *
 * Asks for the same page-marker contract in the prompt. An LLM asked to
 * transcribe will sometimes renumber or merge pages — the page-integrity
 * metric is what catches that, and it is the reason that metric exists.
 */
export async function runGemini(pdfPath, {
    apiKey,
    model = process.env.BAKEOFF_GEMINI_MODEL || 'gemini-3.6-flash',
    // Número de la primera página del recorte DENTRO del documento completo.
    // En un fan-out cada worker ve sólo su trozo y numeraría desde 1, así que
    // al coser todas las páginas se llamarían igual. Decirle el desplazamiento
    // es lo que hace que los números sean globales — y si obedece, es lo que
    // hace viable trocear. Medido antes: sin esto, Gemini numeró 615-625
    // leyendo los números IMPRESOS del libro, que es otra convención más y no
    // sirve en un libro sin foliar.
    pageOffset = null,
    // Los Gemini 3.x no permiten apagar el razonamiento: sólo elegir cuánto
    // (`minimal`, `low`…). Lo que piensan se cobra como salida y además se come
    // el tope de 65 536 — por eso cada motor fija el suyo en el registro.
    thinkingLevel = null,
    // El 2.5 sí se apaga con presupuesto 0, que es lo que hace producción.
    thinkingBudget = null,
    // Cuántos tokens cuesta cada página del PDF en 3.x (low 280, medium 560,
    // high 1 120). Google dice que el OCR se satura en medium; el griego con
    // espíritus es exactamente el caso donde eso puede no valer.
    mediaResolution = null,
} = {}) {
    if (!apiKey) return { skipped: true, reason: 'falta GEMINI_API_KEY' };
    const generationConfig = { temperature: 0, maxOutputTokens: 65536 };
    if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };
    else if (thinkingBudget !== null) generationConfig.thinkingConfig = { thinkingBudget };
    if (mediaResolution) generationConfig.mediaResolution = mediaResolution;
    const started = Date.now();

    try {
        const buffer = await fs.readFile(pdfPath);
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `Transcribe este PDF a Markdown, íntegro y sin resumir.\n\n`
                                    + `REGLAS ESTRICTAS:\n`
                                    + (pageOffset
                                        ? `1. Antes de cada página emite exactamente: <!-- page: N -->\n`
                                          + `   Este archivo es un FRAGMENTO de un documento mayor: su primera\n`
                                          + `   página es la número ${pageOffset} del documento completo. Numera\n`
                                          + `   desde ${pageOffset} en adelante, consecutivamente, IGNORANDO\n`
                                          + `   cualquier número impreso en la página.\n`
                                        : `1. Antes de cada página emite exactamente: <!-- page: N -->\n`
                                          + `   donde N es la posición de la página en este archivo, empezando en 1.\n`
                                          + `   IGNORA cualquier número impreso en la página.\n`)
                                    + `2. ${PARSING_INSTRUCTION}\n`
                                    + `3. No agregues comentarios, encabezados ni notas propias.\n`
                                    + `4. Si una página está en blanco, emite igualmente su marcador.`,
                            },
                            { inline_data: { mime_type: 'application/pdf', data: buffer.toString('base64') } },
                        ],
                    }],
                    generationConfig,
                }),
            },
        );

        if (!res.ok) {
            // 503 UNAVAILABLE ("high demand") y 429 son transitorios: el
            // servicio pide que se vuelva a intentar, no que se rinda. Medido:
            // a concurrencia 4 sobre gemini-3.6-flash, 2 de 4 trozos murieron
            // con 503. Sin reintento, el fan-out pierde el 50% del libro.
            const retryable = res.status === 503 || res.status === 429 || res.status >= 500;
            return { skipped: true, retryable, reason: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
        }

        const body = await res.json();
        const markdown = body.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
        if (!markdown.trim()) {
            // `finishReason: STOP` con cuerpo vacío es un fallo SILENCIOSO: el
            // modelo dice haber terminado bien y no devuelve nada. Medido en el
            // spike de fan-out. Se trata como reintentable porque en producción
            // sería una página que desaparece del libro sin que nada avise.
            const finish = body.candidates?.[0]?.finishReason ?? 'desconocido';
            return { skipped: true, retryable: true, reason: `respuesta vacía (finishReason=${finish})` };
        }

        const usage = body.usageMetadata ?? {};
        return {
            model,
            markdown,
            pageCount: new Set([...markdown.matchAll(/<!--\s*page:\s*(\d+)\s*-->/g)].map(m => m[1])).size,
            costUnits: usage.totalTokenCount ?? null,
            costUnit: 'tokens',
            costNote: 'tokens totales',
            // Entrada y salida se tarifan distinto —la salida cuesta bastante
            // más—, así que sumarlas y multiplicar por una sola tarifa da un
            // número equivocado. Se guardan separadas.
            billing: {
                inputTokens: usage.promptTokenCount ?? null,
                outputTokens: usage.candidatesTokenCount ?? null,
                totalTokens: usage.totalTokenCount ?? null,
                cacheHit: false,
            },
            elapsedMs: Date.now() - started,
            truncated: body.candidates?.[0]?.finishReason === 'MAX_TOKENS',
        };
    } catch (err) {
        // Los fallos de red (`fetch failed`, ECONNRESET, timeouts) son
        // transitorios igual que un 503, pero salían sin marcar y por eso no
        // se reintentaban: en el spike un trozo murió así y se dio por perdido
        // al primer intento.
        return { skipped: true, retryable: true, reason: `excepción: ${err.message}` };
    }
}

// ── OpenAI ─────────────────────────────────────────────────────────────────

/**
 * Visión de OpenAI, UNA PÁGINA POR LLAMADA, a partir de imágenes que
 * renderizamos nosotros.
 *
 * Por qué imágenes y no el PDF: con un PDF, OpenAI le pasa al modelo la capa de
 * texto JUNTO a la imagen de cada página, y no hay forma de apagarlo. En los
 * libros que importan esa capa es justamente lo roto —hebreo invertido, griego
 * en códigos latinos— y tenerla delante puede sesgar la transcripción. Con la
 * imagen sola, el modelo sólo puede leer lo que se ve.
 *
 * Por qué una página por llamada: el corte por MAX_TOKENS que motivó esta
 * comparación sale de pedir muchas páginas en una respuesta. Así no hay tope
 * que alcanzar, y el número de página lo pone el banco, no el modelo — la
 * métrica de integridad de páginas no mide nada en este motor, y el informe no
 * debería leerlo como mérito.
 */
export async function runOpenAiVision(pdfPath, {
    apiKey,
    model,
    reasoning = 'none',
    detail = 'high',
    dpi = 200,
    concurrency = 4,
} = {}) {
    if (!apiKey) return { skipped: true, reason: 'falta OPENAI_API_KEY' };
    const started = Date.now();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bakeoff-openai-'));

    try {
        await execFileAsync('pdftoppm', ['-r', String(dpi), '-png', pdfPath, path.join(dir, 'p')]);
        const imagenes = (await fs.readdir(dir)).filter(f => f.endsWith('.png')).sort();
        if (imagenes.length === 0) return { skipped: true, reason: 'pdftoppm no produjo imágenes' };

        const paginas = new Array(imagenes.length);
        const uso = { input: 0, output: 0, reasoning: 0 };
        const fallos = [];
        let siguiente = 0;

        const trabajador = async () => {
            while (siguiente < imagenes.length) {
                const i = siguiente++;
                const png = await fs.readFile(path.join(dir, imagenes[i]));
                const r = await leerPaginaOpenAi({ apiKey, model, reasoning, detail, png });
                if (r.error) {
                    fallos.push(`pág ${i + 1}: ${r.error}`);
                    // Sin saldo, las páginas que faltan fallarían igual: se corta
                    // la corrida en vez de gastar tiempo en confirmarlo.
                    if (r.fatal) siguiente = imagenes.length;
                    continue;
                }
                paginas[i] = { page: i + 1, content: r.text };
                uso.input += r.usage.input;
                uso.output += r.usage.output;
                uso.reasoning += r.usage.reasoning;
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, imagenes.length) }, trabajador));

        const hechas = paginas.filter(Boolean);
        if (hechas.length === 0) return { skipped: true, reason: `ninguna página: ${fallos.slice(0, 2).join(' | ')}` };

        return {
            model,
            markdown: joinPages(hechas),
            pageCount: hechas.length,
            costUnits: uso.input + uso.output,
            costUnit: 'tokens',
            costNote: 'tokens totales',
            // Mismo desglose que Gemini: `totalTokens - inputTokens` es todo lo
            // que se factura como salida, razonamiento incluido.
            billing: {
                inputTokens: uso.input,
                outputTokens: uso.output - uso.reasoning,
                totalTokens: uso.input + uso.output,
                cacheHit: false,
            },
            elapsedMs: Date.now() - started,
            ...(fallos.length ? { warnings: fallos } : {}),
        };
    } catch (err) {
        return { skipped: true, reason: `excepción: ${err.message}` };
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
}

/** Una página. Reintenta lo transitorio; lo demás lo devuelve como error. */
async function leerPaginaOpenAi({ apiKey, model, reasoning, detail, png }) {
    const cuerpo = {
        model,
        reasoning: { effort: reasoning },
        max_output_tokens: 16000,
        input: [{
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: 'Transcribe esta página a Markdown, íntegra y sin resumir.\n\n'
                        + `REGLAS ESTRICTAS:\n1. ${PARSING_INSTRUCTION}\n`
                        + '2. No agregues comentarios, encabezados ni notas propias.\n'
                        + '3. No incluyas el número de página impreso.\n'
                        + '4. Si la página está en blanco, no devuelvas nada.',
                },
                { type: 'input_image', image_url: `data:image/png;base64,${png.toString('base64')}`, detail },
            ],
        }],
    };

    for (let intento = 1; intento <= 4; intento++) {
        let res;
        try {
            res = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(cuerpo),
            });
        } catch (err) {
            if (intento < 4) { await sleep(2000 * intento); continue; }
            return { error: `red: ${err.message}` };
        }
        if (!res.ok) {
            const cuerpoError = await res.text();
            // Un 429 puede ser límite de velocidad —se arregla esperando— o
            // falta de saldo —no se arregla nunca—. OpenAI usa el mismo código
            // para los dos; lo que los separa es el `code` del cuerpo.
            const sinSaldo = /billing_not_active|insufficient_quota/.test(cuerpoError);
            if (!sinSaldo && (res.status === 429 || res.status >= 500) && intento < 4) {
                await sleep(3000 * intento);
                continue;
            }
            return { error: `HTTP ${res.status}: ${cuerpoError.slice(0, 300)}`, fatal: sinSaldo };
        }

        const body = await res.json();
        const text = body.output_text
            ?? (body.output ?? [])
                .flatMap(o => o.content ?? [])
                .filter(c => c.type === 'output_text')
                .map(c => c.text)
                .join('');
        // `incomplete` es el MAX_TOKENS de OpenAI: si el razonamiento se comió
        // el tope, la respuesta puede venir vacía. Se dice, no se disimula.
        if (body.status === 'incomplete') {
            return { error: `incompleta (${body.incomplete_details?.reason ?? 'sin motivo'})` };
        }
        const u = body.usage ?? {};
        return {
            text: text ?? '',
            usage: {
                input: u.input_tokens ?? 0,
                output: u.output_tokens ?? 0,
                reasoning: u.output_tokens_details?.reasoning_tokens ?? 0,
            },
        };
    }
    return { error: 'agotó los reintentos' };
}

/**
 * Cuántas páginas emitió realmente una salida.
 *
 * Existe porque el modelo MIENTE sobre haber terminado. Medido: se le dieron
 * 40 páginas, devolvió 4 completas —4.419 chars cada una, no cortadas—, gastó
 * 8.884 tokens de un tope de 65.536, y reportó `finishReason: STOP`. Ni
 * truncamiento declarado, ni error, ni tope alcanzado. Simplemente dejó de
 * escribir en la página 4 y dijo que había terminado. El mismo tamaño de
 * trozo, en otra corrida, devolvió las 40 completas: no es determinista.
 *
 * Ninguna señal del proveedor delata esto. La única defensa es contar las
 * páginas pedidas contra las devueltas.
 */
export function countEmittedPages(markdown) {
    return new Set([...markdown.matchAll(/<!--\s*page:\s*(\d+)\s*-->/g)].map(m => m[1])).size;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Registry consumed by run.mjs. Order here is the order in the report. */
export const ENGINES = [
    { id: 'pdftotext', label: 'pdftotext (referencia)', run: (p, env) => runPdfToText(p, env) },
    { id: 'llamaparse-fast', label: 'LlamaParse fast (PRODUCCIÓN HOY)', run: (p, env, o) => runLlamaParse(p, { mode: 'fast', apiKey: env.LLAMAPARSE_API_KEY, invalidateCache: o?.invalidateCache }) },
    { id: 'llamaparse-balanced', label: 'LlamaParse balanced', run: (p, env, o) => runLlamaParse(p, { mode: 'balanced', apiKey: env.LLAMAPARSE_API_KEY, invalidateCache: o?.invalidateCache }) },
    { id: 'llamaparse-premium', label: 'LlamaParse premium', run: (p, env, o) => runLlamaParse(p, { mode: 'premium', apiKey: env.LLAMAPARSE_API_KEY, invalidateCache: o?.invalidateCache }) },
    { id: 'mistral-ocr', label: 'Mistral OCR', run: (p, env) => runMistralOcr(p, { apiKey: env.MISTRAL_API_KEY }) },
    { id: 'gemini', label: 'Gemini Flash (tier Estándar)', run: (p, env) => runGemini(p, { apiKey: env.GEMINI_API_KEY }) },
    // ── Comparación de modelos, 2026-09-30 ─────────────────────────────────
    // Lo que corre en producción hoy, con su misma configuración: sin razonar.
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (PRODUCCIÓN HOY)', run: (p, env) => runGemini(p, { apiKey: env.GEMINI_API_KEY, model: 'gemini-2.5-flash', thinkingBudget: 0 }) },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite · resolución media', run: (p, env) => runGemini(p, { apiKey: env.GEMINI_API_KEY, model: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal', mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' }) },
    { id: 'gemini-3.5-flash-lite-high', label: 'Gemini 3.5 Flash-Lite · resolución alta', run: (p, env) => runGemini(p, { apiKey: env.GEMINI_API_KEY, model: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal', mediaResolution: 'MEDIA_RESOLUTION_HIGH' }) },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (techo de calidad)', run: (p, env) => runGemini(p, { apiKey: env.GEMINI_API_KEY, model: 'gemini-3.8-flash', thinkingLevel: 'low', mediaResolution: 'MEDIA_RESOLUTION_HIGH' }) },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna · imagen por página', run: (p, env) => runOpenAiVision(p, { apiKey: env.OPENAI_API_KEY, model: 'gpt-6-luna', reasoning: 'none', detail: 'high' }) },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol (techo de calidad)', run: (p, env) => runOpenAiVision(p, { apiKey: env.OPENAI_API_KEY, model: 'gpt-6.1-sol', reasoning: 'low', detail: 'high' }) },
];
