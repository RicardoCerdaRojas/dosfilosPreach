import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, type Tool } from '@google/generative-ai';
import { GeminiLlmClient } from './GeminiLlmClient';
import { recordLlmUsage } from './llmUsageRecorder';
import { LLM_PRICING } from './llmCost';
import { consumeRateLimitToken } from '../shared/rateLimit';
import { readBudgetConfig } from './llmBudget';
import { MODEL_FAST } from './modelCatalog';
import { withGeminiRetry } from './geminiRetry';

/**
 * Proxy de LLM para las superficies que hoy llaman al modelo DESDE EL NAVEGADOR
 * con la clave de Gemini del bundle — una credencial que gasta dinero y que cualquiera
 * puede leer del bundle.
 *
 * QUÉ CAMBIA, exactamente:
 *
 *   ANTES  navegador → [clave pública] → Gemini
 *          cualquiera en internet · sin límite · sin atribución · sin medición
 *
 *   AHORA  navegador → callable (auth + App Check) → Gemini
 *          solo usuarios de la app · rate-limit por uid · medido por usuario
 *
 * LO QUE ESTE PROXY **NO** RESUELVE, dicho en voz alta: el prompt lo sigue
 * armando el cliente, así que un usuario autenticado puede pedirle al modelo lo
 * que quiera con la cuota del proyecto. Es un techo mucho más bajo que el de hoy
 * (autenticado, atribuido, limitado y revocable), pero no es el diseño final: ese
 * es un callable por feature con el prompt en el servidor, que se hará cuando
 * cada superficie se toque. Esto cierra la hemorragia primero.
 *
 * Guardas: allowlist de features y de modelos, tope de tamaño de prompt y de
 * salida, y rate-limit por usuario.
 */

/**
 * Features autorizadas. Es allowlist y no texto libre para que el panel de costos
 * tenga cortes estables y para que un cliente manipulado no invente etiquetas que
 * ensucien la contabilidad.
 */
/**
 * Umbrales de seguridad explícitos que la ruta directa del generador de sermones
 * traía escritos. Se preservan tal cual: cambiar el filtrado del modelo de
 * refilón, dentro de una migración de infraestructura, sería un cambio de
 * comportamiento que nadie vería en el diff.
 */
const STANDARD_SAFETY = [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));

export const PROXY_FEATURES = [
    'hebrewTutor.analyzeVerse',
    'greekTutor.identifyForms',
    'greekTutor.createTrainingUnit',
    'greekTutor.evaluateResponse',
    'greekTutor.explainMorphology',
    'greekTutor.answerFreeQuestion',
    'greekTutor.analyzeSyntax',
    // Analizador griego (fase 2): rango semántico + sintaxis + traducciones.
    'greekTutor.analyzeVerse',
    'greekTutor.quiz',
    // Tanda 2 — generación y refinamiento del sermón (GeminiAIService).
    'sermon.generateSermon',
    'sermon.generateOutline',
    'sermon.expandSection',
    'sermon.suggestReferences',
    'sermon.refineContent',
    'sermon.titleSuggestions',
    'sermon.validateContext',
    // El refinamiento real del wizard (GeminiSermonGenerator), distinto del
    // validador: es el que reescribe el texto cuando el pastor pide un cambio.
    'sermon.refineContent',
    // Redacción v2 §8.5 — el juez de fidelidad homilética, en SOMBRA. La vara la
    // compone el cliente (los catálogos viven en dominio y `functions` no
    // depende de dominio); acá solo se presta el modelo para adjudicar contra
    // ella. Corte propio en el panel de costos: es caro y muestreado, y hay que
    // poder verlo separado del resto del sermón.
    'sermon.judgeCompliance',
    // Las llamadas GRANDES del wizard: generan documentos completos, así que son
    // las que más pesan por llamada.
    'sermon.generateExegesis',
    'sermon.generateHomiletics',
    'sermon.generateDraft',
    'sermon.regeneratePoint',
    // Traducir una cita de la biblioteca al idioma del pastor, BAJO DEMANDA.
    // Llamada corta y esporádica: se dispara sólo cuando él pulsa "Ver en
    // español" sobre un excerpt en otro idioma, no al generar el borrador.
    // Corte propio en el panel de costos para poder distinguirla de las
    // llamadas grandes del wizard, con las que no tiene nada que ver.
    'sermon.translateCitation',
    // ADR-037 — el acompañante socrático propone ELEMENTOS (ideas decidibles)
    // para una sección, no prosa. Llamada corta y MUY frecuente: se dispara una
    // vez por sección y por "propóneme más", así que su costo escala con las
    // secciones del sermón, no con el sermón. Corte propio para poder medir
    // exactamente eso antes de extender el flujo a las 26 secciones.
    'sermon.proposeElements',
    // ADR-037 — escribe la prosa de UNA sección a partir de lo que el pastor
    // decidió. Corte propio: es la llamada que convierte decisiones en sermón, y
    // su costo escala con las secciones escritas, no con el sermón. Separarla de
    // `generateDraft` permite comparar las dos rutas de generación con datos.
    'sermon.writeSection',
    'sermon.homileticsPreview',
    'sermon.developApproach',
    // Tanda 3 (exégesis), parte 1 — compositores de sección y de artefactos
    // ministeriales.
    // Todos corren en `gemini-2.5-pro` por defecto y traen `topP` explícito, así
    // que caen en la rama de config completa.
    'exegesis.composeVerse',
    'exegesis.composeIntroduction',
    'exegesis.composeConclusion',
    'exegesis.composeSermon',
    'exegesis.composeDevotional',
    'exegesis.composeStudyGuide',
    // Tanda 3 (exégesis), parte 2 — el paper académico, el análisis canónico y
    // los tres pasos verificadores. Todos traen `responseSchema` inline salvo
    // el compositor y el orquestador.
    'exegesis.composeAcademicPaper',
    'exegesis.analyzeVerse',
    'exegesis.reviewCoherence',
    'exegesis.classifySourceType',
    'exegesis.verifyCitation',
    'exegesis.generateStep',
    // Tanda 3 (exégesis), parte 3 — detección, extractores, planificador,
    // transformador y los seis pases del asistente expositivo.
    'exegesis.detectPericopes',
    'exegesis.extractRubric',
    'exegesis.extractStyleManifest',
    // Leer la ficha bibliográfica de la página de créditos del propio libro.
    // Llamada corta, una por libro y a pedido: el usuario pulsa «leer del
    // libro» en la ficha. Lo que el modelo devuelve se filtra en el cliente
    // contra el texto que se le dio, así que no puede colar un dato de
    // memoria.
    'exegesis.readBibliography',
    'exegesis.planStepCorpus',
    'exegesis.paperToSermon',
    'exegesis.expository.panorama',
    'exegesis.expository.superMacro',
    'exegesis.expository.macro',
    'exegesis.expository.micro',
    'exegesis.expository.preachable',
    'exegesis.expository.fidelityReview',
    // Barrido final — generador de planes de serie y repurposer del sermón.
    // Las dos del repurposer se enumeran porque la feature se arma con el
    // `kind`, y la allowlist no admite texto libre.
    'series.generateObjective',
    'series.generateStructure',
    'sermon.repurpose.devotional',
    'sermon.repurpose.study-guide',
] as const;

/**
 * Consumo total a devolver al llamador.
 *
 * `totalTokenCount` es lo que informa el modelo, pero no siempre viene. El
 * orquestador de exégesis ya traía esta defensa escrita a mano — sumar entrada
 * y salida cuando falta el total — y se sube acá para que la hereden los 18
 * adapters en vez de repetirla en cada uno.
 */
function finishReasonOf(response: { candidates?: ReadonlyArray<{ finishReason?: string }> }): string | null {
    return response.candidates?.[0]?.finishReason ?? null;
}

function totalTokensOf(meta?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }): number | null {
    if (typeof meta?.totalTokenCount === 'number') return meta.totalTokenCount;
    const summed = (meta?.promptTokenCount ?? 0) + (meta?.candidatesTokenCount ?? 0);
    return summed > 0 ? summed : null;
}

/**
 * Tope del adjunto en base64 (~7,5 MB de bytes reales). El transporte de
 * callables admite hasta 10 MB de petición; se corta antes para que un adjunto
 * grande dé un error claro acá y no un 400 opaco del transporte.
 */
const MAX_INLINE_IMAGE_B64_CHARS = 10_000_000;

const MAX_PROMPT_CHARS = 200_000;
const MAX_SYSTEM_CHARS = 40_000;
// 65.536 es el techo real de salida de gemini-2.5-flash y lo usa el compositor
// académico para papers completos. Un cap menor le habría recortado el
// documento a la mitad sin error visible.
const MAX_OUTPUT_TOKENS_CAP = 65_536;
const DEFAULT_MAX_CALLS_PER_HOUR = 120;
const WINDOW_MS = 3_600_000;

/**
 * La herramienta `fileSearch` del tutor de griego.
 *
 * Los tipos del SDK `@google/generative-ai@0.21` declaran `Tool` como la unión
 * de tres herramientas y `fileSearch` no está entre ellas, aunque la API sí la
 * acepta. Se declara acá la forma que la API espera para no perder el chequeo
 * de tipos sobre el objeto que se le manda.
 */
interface FileSearchTool {
    fileSearch: { fileSearchStoreNames: string[] };
}



export const runLlmPrompt = onCall(
    // 120 s alcanzaban mientras el proxy servía respuestas cortas. El compositor
    // académico pide 65.536 tokens de salida en `gemini-2.5-pro`: un paper
    // completo tarda varios minutos y el tope viejo lo habría cortado a la
    // mitad. Es un techo, no una espera: las llamadas cortas siguen volviendo
    // igual de rápido.
    { ...appCheckCallableOptions(), secrets: ['GEMINI_API_KEY'], timeoutSeconds: 540 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret not configured');
        }

        const uid = request.auth.uid;
        const data = (request.data ?? {}) as Record<string, unknown>;
        const feature = String(data.feature ?? '');
        if (!(PROXY_FEATURES as readonly string[]).includes(feature)) {
            throw new HttpsError('invalid-argument', `Feature no autorizada: ${feature}`);
        }

        const prompt = String(data.prompt ?? '');
        if (!prompt.trim()) throw new HttpsError('invalid-argument', 'prompt is required');
        if (prompt.length > MAX_PROMPT_CHARS) {
            throw new HttpsError('invalid-argument', `prompt excede ${MAX_PROMPT_CHARS} caracteres`);
        }
        const system = data.system ? String(data.system).slice(0, MAX_SYSTEM_CHARS) : undefined;

        // Solo modelos con precio conocido: si no sabemos cuánto cuesta, no lo
        // corremos. Evita que un cliente pida un modelo caro fuera de la tabla.
        const model = String(data.model ?? MODEL_FAST);
        if (!(model in LLM_PRICING)) {
            throw new HttpsError('invalid-argument', `Modelo no autorizado: ${model}`);
        }

        const cfg = await readBudgetConfig();
        const maxPerHour = Number.isFinite(cfg.proxyMaxCallsPerHourPerUser)
            ? cfg.proxyMaxCallsPerHourPerUser
            : DEFAULT_MAX_CALLS_PER_HOUR;
        const allowed = await consumeRateLimitToken(admin.firestore(), {
            bucket: 'llm_proxy',
            key: uid,
            windowMs: WINDOW_MS,
            max: maxPerHour,
        });
        if (!allowed) {
            throw new HttpsError(
                'resource-exhausted',
                'Demasiadas consultas seguidas. Espera unos minutos antes de continuar.',
            );
        }

        // Camino con TOOLS (fileSearch del tutor de griego): el port es
        // texto→texto y no las cubre, así que acá se usa el SDK directo y se
        // llama al medidor A MANO. El port es una comodidad, no un requisito: lo
        // que no es negociable es que la llamada salga del servidor y quede medida.
        const storeId = data.fileSearchStoreId ? String(data.fileSearchStoreId) : '';
        if (storeId) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                // EL CONTRATO SE DECLARA, NO SE SILENCIA. Acá había un
                // `@ts-ignore`, que apaga TODOS los errores de su línea —
                // incluido un typo en `fileSearchStoreNames`, que el modelo
                // ignoraría en silencio dejando al tutor sin su corpus. Con el
                // tipo declarado, la forma se sigue verificando; el cast queda
                // acotado al único punto donde el SDK 0.21 se queda corto.
                const fileSearchTool: FileSearchTool = {
                    fileSearch: { fileSearchStoreNames: [storeId] },
                };
                const toolModel = genAI.getGenerativeModel({
                    model,
                    tools: [fileSearchTool as unknown as Tool],
                    // NOTA: `responseMimeType: application/json` NO es compatible
                    // con tools — el llamador limpia el JSON del texto.
                });
                const result = await withGeminiRetry(feature, () => toolModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    ...(system ? { systemInstruction: system } : {}),
                    generationConfig: {
                        ...(typeof data.temperature === 'number' ? { temperature: data.temperature } : {}),
                        ...(typeof data.maxOutputTokens === 'number'
                            ? { maxOutputTokens: Math.min(data.maxOutputTokens, MAX_OUTPUT_TOKENS_CAP) }
                            : {}),
                    },
                }));
                const meta = result.response.usageMetadata;
                void recordLlmUsage({
                    model,
                    feature,
                    userId: uid,
                    inputTokens: meta?.promptTokenCount ?? 0,
                    outputTokens: meta?.candidatesTokenCount ?? 0,
                });
                return { text: result.response.text(), tokens: totalTokensOf(meta), finishReason: finishReasonOf(result.response) };
            } catch (err) {
                console.error(`[runLlmPrompt] ${feature} (fileSearch) falló`, err);
                throw new HttpsError('internal', err instanceof Error ? err.message : 'runLlmPrompt failed');
            }
        }

        // Camino MULTIMODAL (extracción de rúbricas desde imagen): la petición
        // deja de ser un string y pasa a ser `parts`. Se separa de las otras
        // ramas porque lo que cambia es la FORMA del pedido, no su config.
        const inlineImage = data.inlineImage as { mimeType?: unknown; base64?: unknown } | undefined;
        if (inlineImage) {
            const mimeType = String(inlineImage.mimeType ?? '');
            const base64 = String(inlineImage.base64 ?? '');
            if (!mimeType.startsWith('image/')) {
                throw new HttpsError('invalid-argument', `inlineImage.mimeType no soportado: ${mimeType}`);
            }
            if (!base64 || base64.length > MAX_INLINE_IMAGE_B64_CHARS) {
                throw new HttpsError('invalid-argument', 'inlineImage.base64 vacío o demasiado grande');
            }
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const visionModel = genAI.getGenerativeModel({
                    model,
                    ...(system ? { systemInstruction: system } : {}),
                    ...(data.safety === 'standard' ? { safetySettings: STANDARD_SAFETY } : {}),
                    generationConfig: {
                        ...(typeof data.temperature === 'number' ? { temperature: data.temperature } : {}),
                        ...(typeof data.topP === 'number' ? { topP: data.topP } : {}),
                        ...(typeof data.maxOutputTokens === 'number'
                            ? { maxOutputTokens: Math.min(data.maxOutputTokens, MAX_OUTPUT_TOKENS_CAP) }
                            : {}),
                        ...(data.responseMimeType === 'application/json'
                            ? { responseMimeType: 'application/json' }
                            : {}),
                        ...(data.responseSchema ? { responseSchema: data.responseSchema as object } : {}),
                    },
                });
                const result = await visionModel.generateContent([
                    { text: prompt },
                    { inlineData: { mimeType, data: base64 } },
                ]);
                const meta = result.response.usageMetadata;
                void recordLlmUsage({
                    model,
                    feature,
                    userId: uid,
                    inputTokens: meta?.promptTokenCount ?? 0,
                    outputTokens: meta?.candidatesTokenCount ?? 0,
                });
                return { text: result.response.text(), tokens: totalTokensOf(meta), finishReason: finishReasonOf(result.response) };
            } catch (err) {
                console.error(`[runLlmPrompt] ${feature} (inlineImage) falló`, err);
                throw new HttpsError('internal', err instanceof Error ? err.message : 'runLlmPrompt failed');
            }
        }

        // Camino con CONFIG COMPLETA: `topP` y sobre todo `responseSchema`
        // (salida estructurada) no están en el port. Perderlos no da error —
        // da respuestas peor formadas, que es mucho peor de detectar.
        if (data.topP !== undefined || data.responseSchema) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const cfgModel = genAI.getGenerativeModel({
                    model,
                    ...(system ? { systemInstruction: system } : {}),
                    // `safety` es un MODIFICADOR, no una rama propia: esta rama
                    // se evalúa antes que la de safety, así que sin esto un
                    // llamador que pida umbrales explícitos JUNTO con `topP` o
                    // `responseSchema` los perdería en silencio.
                    ...(data.safety === 'standard' ? { safetySettings: STANDARD_SAFETY } : {}),
                    generationConfig: {
                        ...(typeof data.temperature === 'number' ? { temperature: data.temperature } : {}),
                        ...(typeof data.topP === 'number' ? { topP: data.topP } : {}),
                        ...(typeof data.maxOutputTokens === 'number'
                            ? { maxOutputTokens: Math.min(data.maxOutputTokens, MAX_OUTPUT_TOKENS_CAP) }
                            : {}),
                        ...(data.responseMimeType === 'application/json'
                            ? { responseMimeType: 'application/json' }
                            : {}),
                        ...(data.responseSchema ? { responseSchema: data.responseSchema as object } : {}),
                    },
                });
                const result = await withGeminiRetry(feature, () => cfgModel.generateContent(prompt));
                const meta = result.response.usageMetadata;
                void recordLlmUsage({
                    model,
                    feature,
                    userId: uid,
                    inputTokens: meta?.promptTokenCount ?? 0,
                    outputTokens: meta?.candidatesTokenCount ?? 0,
                });
                return { text: result.response.text(), tokens: totalTokensOf(meta), finishReason: finishReasonOf(result.response) };
            } catch (err) {
                console.error(`[runLlmPrompt] ${feature} (config) falló`, err);
                throw new HttpsError('internal', err instanceof Error ? err.message : 'runLlmPrompt failed');
            }
        }

        // Camino normal, vía el port: el adapter mide tokens → USD y los atribuye
        // a esta feature y a este usuario.
        // Camino con SAFETY explícito: el port no expone safetySettings, así que
        // acá se usa el SDK y se mide a mano (mismo trato que fileSearch).
        if (data.safety === 'standard') {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                // La configuración de generación DEBE viajar acá también. La
                // primera versión de esta rama solo pasaba `safetySettings`, así
                // que el borrador del sermón perdía su `maxOutputTokens: 24576`
                // y el modo JSON — y fallaba justo en el reintento, que es el
                // camino que cae en esta rama.
                const safeModel = genAI.getGenerativeModel({
                    model,
                    safetySettings: STANDARD_SAFETY,
                    generationConfig: {
                        ...(typeof data.temperature === 'number' ? { temperature: data.temperature } : {}),
                        ...(typeof data.maxOutputTokens === 'number'
                            ? { maxOutputTokens: Math.min(data.maxOutputTokens, MAX_OUTPUT_TOKENS_CAP) }
                            : {}),
                        ...(data.responseMimeType === 'application/json'
                            ? { responseMimeType: 'application/json' }
                            : {}),
                    },
                });
                const result = await withGeminiRetry(feature, () => safeModel.generateContent(prompt));
                const meta = result.response.usageMetadata;
                void recordLlmUsage({
                    model,
                    feature,
                    userId: uid,
                    inputTokens: meta?.promptTokenCount ?? 0,
                    outputTokens: meta?.candidatesTokenCount ?? 0,
                });
                return { text: result.response.text(), tokens: totalTokensOf(meta), finishReason: finishReasonOf(result.response) };
            } catch (err) {
                console.error(`[runLlmPrompt] ${feature} (safety) falló`, err);
                throw new HttpsError('internal', err instanceof Error ? err.message : 'runLlmPrompt failed');
            }
        }

        const llm = new GeminiLlmClient(apiKey, model, { feature, userId: uid });
        try {
            const text = await llm.generate({
                ...(system ? { system } : {}),
                prompt,
                responseMimeType: data.responseMimeType === 'application/json' ? 'application/json' : 'text/plain',
                ...(typeof data.temperature === 'number' ? { temperature: data.temperature } : {}),
                ...(typeof data.maxOutputTokens === 'number'
                    ? { maxOutputTokens: Math.min(data.maxOutputTokens, MAX_OUTPUT_TOKENS_CAP) }
                    : {}),
            });
            return { text, tokens: llm.lastTotalTokens, finishReason: null };
        } catch (err) {
            console.error(`[runLlmPrompt] ${feature} falló`, err);
            throw new HttpsError('internal', err instanceof Error ? err.message : 'runLlmPrompt failed');
        }
    },
);
