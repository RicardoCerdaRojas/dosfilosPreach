/**
 * Banco de las funciones REALES de exégesis: los mismos prompts, esquemas y
 * parámetros que usa producción, con cada modelo candidato.
 *
 * El banco de `run.mjs` usa tareas escritas para la prueba. Éste arma el pedido
 * con los constructores de producción (`buildAnalyzerPrompt`,
 * `buildPanoramaUserMessage`, `buildVerseProsePrompt`) y valida la respuesta
 * con el mapeador de producción (`mapToCanonicalVerseAnalysis`): si un modelo
 * devuelve algo que la app no sabe leer, falla acá y no en un trabajo real.
 *
 * Para OpenAI usa el adaptador real con el traductor de esquemas, así que esta
 * corrida es también la prueba de punta a punta de `esquemaEstricto`.
 *
 * Uso (desde la raíz):
 *   source ~/.bakeoff.env
 *   npx tsx scripts/llm-bakeoff/funciones.ts [--out dir]
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { AnalyzeVerseInput, CanonicalVerseAnalysis, PanoramaInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../../packages/infrastructure/src/exegesis/canonicalAnalyzer/analyzerPrompts';
import { canonicalVerseAnalysisSchema } from '../../packages/infrastructure/src/exegesis/canonicalAnalyzer/responseSchema';
import { mapToCanonicalVerseAnalysis } from '../../packages/infrastructure/src/exegesis/canonicalAnalyzer/mapAnalyzerResponse';
import { voiceFor } from '../../packages/infrastructure/src/exegesis/testamentVoice';
import { buildPanoramaSystemInstruction, buildPanoramaUserMessage, PANORAMA_RESPONSE_SCHEMA } from '../../packages/infrastructure/src/exegesis/expository-prompts/panorama';
import { buildVerseProsePrompt } from '../../packages/infrastructure/src/exegesis/sectionComposers/verseProsePrompt';
import { OpenAiLlmClient } from '../../packages/functions/src/llm/OpenAiLlmClient';

type Pedido = {
    system: string;
    prompt: string;
    schema?: object;
    temperature: number;
    topP?: number;
    maxOutputTokens: number;
};

const MODELOS = {
    'gemini-2.5-pro': { proveedor: 'gemini', precio: [1.25, 10] },
    'gemini-3.8-flash': { proveedor: 'gemini', precio: [0.75, 3.75], thinkingLevel: ThinkingLevel.LOW },
    'gpt-6-luna': { proveedor: 'openai', precio: [0.1, 0.5], razonamiento: 'none' },
    'gpt-6.1-sol': { proveedor: 'openai', precio: [2, 10], razonamiento: 'low' },
} as const;
type Modelo = keyof typeof MODELOS;

interface Respuesta { texto: string; entrada: number; salida: number; usd: number; ms: number }

async function llamar(modelo: Modelo, p: Pedido): Promise<Respuesta> {
    const cfg = MODELOS[modelo];
    const t0 = Date.now();
    if (cfg.proveedor === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const r = await ai.models.generateContent({
            model: modelo,
            contents: p.prompt,
            config: {
                systemInstruction: p.system,
                temperature: p.temperature,
                ...(p.topP !== undefined ? { topP: p.topP } : {}),
                maxOutputTokens: p.maxOutputTokens,
                ...(p.schema ? { responseMimeType: 'application/json', responseSchema: p.schema } : {}),
                ...('thinkingLevel' in cfg ? { thinkingConfig: { thinkingLevel: cfg.thinkingLevel } } : {}),
            },
        });
        const u = r.usageMetadata ?? {};
        const entrada = u.promptTokenCount ?? 0;
        const salida = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
        return { texto: r.text ?? '', entrada, salida, usd: (entrada * cfg.precio[0] + salida * cfg.precio[1]) / 1e6, ms: Date.now() - t0 };
    }
    // El adaptador de producción: con esquema usa `esquemaEstricto`.
    const cliente = new OpenAiLlmClient(process.env.OPENAI_API_KEY!, modelo, undefined, cfg.razonamiento);
    const texto = await cliente.generate({
        system: p.system,
        prompt: p.prompt,
        temperature: p.temperature,
        maxOutputTokens: p.maxOutputTokens,
        ...(p.schema ? { responseMimeType: 'application/json' as const, responseSchema: p.schema } : {}),
    });
    const { input: entrada, output: salida } = cliente.lastUsage ?? { input: 0, output: 0 };
    return { texto, entrada, salida, usd: (entrada * cfg.precio[0] + salida * cfg.precio[1]) / 1e6, ms: Date.now() - t0 };
}

// ── Entradas ─────────────────────────────────────────────────────────────

const santiago: AnalyzeVerseInput = {
    paperPassage: { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 5 },
    verseRef: { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 5, verseEnd: 5 },
    language: 'es',
    originalLanguageText: '1:5 Εἰ δέ τις ὑμῶν λείπεται σοφίας, αἰτείτω παρὰ τοῦ διδόντος θεοῦ πᾶσιν ἁπλῶς καὶ μὴ ὀνειδίζοντος, καὶ δοθήσεται αὐτῷ.',
    pericopeContext:
        '  1:4 ἡ δὲ ὑπομονὴ ἔργον τέλειον ἐχέτω, ἵνα ἦτε τέλειοι καὶ ὁλόκληροι ἐν μηδενὶ λειπόμενοι.\n'
        + '► 1:5 Εἰ δέ τις ὑμῶν λείπεται σοφίας, αἰτείτω παρὰ τοῦ διδόντος θεοῦ πᾶσιν ἁπλῶς καὶ μὴ ὀνειδίζοντος, καὶ δοθήσεται αὐτῷ.\n'
        + '  1:6 αἰτείτω δὲ ἐν πίστει, μηδὲν διακρινόμενος· ὁ γὰρ διακρινόμενος ἔοικεν κλύδωνι θαλάσσης ἀνεμιζομένῳ καὶ ῥιπιζομένῳ.',
    assignmentBrief: 'Trabajo exegético de seminario sobre Santiago 1:1-5: la sabiduría en medio de las pruebas.',
    sources: [],
    styleGuideContent: '',
    missingSourceTypes: [],
    priorAcceptedAnalyses: [],
    regenerationHint: null,
    stepEmphasis: null,
} as unknown as AnalyzeVerseInput;

const salmo: AnalyzeVerseInput = {
    ...santiago,
    paperPassage: { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 3 },
    verseRef: { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 1 },
    originalLanguageText: '23:1 מִזְמוֹר לְדָוִד יְהוָה רֹעִי לֹא אֶחְסָר׃',
    pericopeContext:
        '► 23:1 מִזְמוֹר לְדָוִד יְהוָה רֹעִי לֹא אֶחְסָר׃\n'
        + '  23:2 בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי עַל־מֵי מְנֻחוֹת יְנַהֲלֵנִי׃',
    assignmentBrief: 'Trabajo exegético de seminario sobre Salmo 23:1-3.',
} as unknown as AnalyzeVerseInput;

async function jonas(): Promise<PanoramaInput> {
    const biblia = JSON.parse(await fs.readFile(path.join(process.cwd(), 'rvr1960.json'), 'utf8')) as Array<{ id: string; chapters: string[][] }>;
    const libro = biblia.find(b => b.id === 'jn' && b.chapters[0]?.[0]?.startsWith('Vino palabra'))!;
    return {
        book: 'Jonás',
        displayLanguage: 'es',
        verses: libro.chapters.flatMap((c, i) => c.map((text, j) => ({ chapter: i + 1, verse: j + 1, text }))),
        sourceLanguage: 'translation',
    } as PanoramaInput;
}

// ── Corrida ──────────────────────────────────────────────────────────────

async function main() {
    const i = process.argv.indexOf('--out');
    const out = path.resolve(i >= 0 ? process.argv[i + 1]! : 'bakeoff-out/funciones-2026-09-30');
    await fs.mkdir(out, { recursive: true });
    const panorama = await jonas();
    const filas: Array<Record<string, unknown>> = [];

    // 1) analyzeVerse con cada modelo, validado con el mapeador de producción.
    const analisis: Partial<Record<Modelo, CanonicalVerseAnalysis>> = {};
    await Promise.all((Object.keys(MODELOS) as Modelo[]).flatMap(modelo => [['santiago', santiago], ['salmo', salmo]].map(async ([id, entrada]) => {
        const e = entrada as AnalyzeVerseInput;
        const { systemInstruction, userMessage } = buildAnalyzerPrompt(e);
        try {
            const r = await llamar(modelo, {
                system: systemInstruction, prompt: userMessage,
                schema: canonicalVerseAnalysisSchema(voiceFor(e.verseRef.bookId)),
                temperature: 0.3, topP: 0.9, maxOutputTokens: 32768,
            });
            await fs.writeFile(path.join(out, `analyzeVerse-${id}--${modelo}.json`), r.texto, 'utf8');
            const mapeado = mapToCanonicalVerseAnalysis(JSON.parse(r.texto), e);
            if (id === 'santiago') analisis[modelo] = mapeado;
            filas.push({ funcion: `analyzeVerse ${id}`, modelo, ok: true, usd: r.usd, s: Math.round(r.ms / 1000) });
        } catch (err) {
            filas.push({ funcion: `analyzeVerse ${id}`, modelo, ok: false, error: (err as Error).message.slice(0, 200) });
        }
    })));

    // 2) panorama de Jonás.
    await Promise.all((Object.keys(MODELOS) as Modelo[]).map(async modelo => {
        try {
            const r = await llamar(modelo, {
                system: buildPanoramaSystemInstruction('es'), prompt: buildPanoramaUserMessage(panorama),
                schema: PANORAMA_RESPONSE_SCHEMA, temperature: 0.4, topP: 0.9, maxOutputTokens: 4096,
            });
            await fs.writeFile(path.join(out, `panorama-jonas--${modelo}.json`), r.texto, 'utf8');
            JSON.parse(r.texto);
            filas.push({ funcion: 'panorama Jonás', modelo, ok: true, usd: r.usd, s: Math.round(r.ms / 1000) });
        } catch (err) {
            filas.push({ funcion: 'panorama Jonás', modelo, ok: false, error: (err as Error).message.slice(0, 200) });
        }
    }));

    // 3) Redacción: todos escriben a partir del MISMO análisis (el de 3.8, o
    //    el primero que haya), para que la diferencia sea sólo de redacción.
    const base = analisis['gemini-3.8-flash'] ?? Object.values(analisis)[0];
    if (base) {
        const { systemInstruction, userMessage } = buildVerseProsePrompt({
            verseAnalysis: base, paperPassage: santiago.paperPassage, language: 'es',
            assignmentBrief: santiago.assignmentBrief, styleGuideContent: '', sources: [],
        } as never);
        await Promise.all((Object.keys(MODELOS) as Modelo[]).map(async modelo => {
            try {
                const r = await llamar(modelo, { system: systemInstruction, prompt: userMessage, temperature: 0.4, topP: 0.9, maxOutputTokens: 8192 });
                await fs.writeFile(path.join(out, `composeVerse-santiago--${modelo}.md`), r.texto, 'utf8');
                filas.push({ funcion: 'composeVerse Santiago', modelo, ok: r.texto.trim().length > 0, usd: r.usd, s: Math.round(r.ms / 1000) });
            } catch (err) {
                filas.push({ funcion: 'composeVerse Santiago', modelo, ok: false, error: (err as Error).message.slice(0, 200) });
            }
        }));
    }

    await fs.writeFile(path.join(out, 'resultados.json'), JSON.stringify(filas, null, 2), 'utf8');
    for (const f of filas.sort((a, b) => String(a.funcion).localeCompare(String(b.funcion)) || String(a.modelo).localeCompare(String(b.modelo)))) {
        console.log(`${String(f.funcion).padEnd(24)} ${String(f.modelo).padEnd(18)} ${f.ok ? 'OK ' : 'FALLA'} ${f.usd !== undefined ? '$' + (f.usd as number).toFixed(4) : ''} ${f.s ?? ''}s ${f.error ?? ''}`);
    }
    console.log(`→ ${out}`);
}

main();
