/**
 * Banco de pruebas de TEXTO: qué modelo razona bien sobre griego, hebreo y
 * exégesis, y a qué costo. Hermano de `scripts/extraction-bakeoff/`, que mide
 * la lectura de páginas por imagen.
 *
 * Por qué existe: el resto del sitio usa Gemini 2.5 Flash y Pro, que son legado,
 * y la pregunta es a qué modelo mover cada función. El bakeoff de visión del
 * 2026-09-30 mostró que el precio no alcanza para decidir: el más barato leía
 * mal el hebreo. Acá se mide lo mismo sobre texto.
 *
 * Tres pruebas:
 *   - morfología griega y hebrea, puntuadas solas contra un análisis conocido;
 *   - tareas abiertas (exégesis, pregunta de Facultad), guardadas para leer a
 *     mano: los errores que importan acá —una forma inventada, una cita a una
 *     obra que no existe— no los encuentra ninguna métrica.
 *
 * Uso:
 *   source ~/.bakeoff.env
 *   node scripts/llm-bakeoff/run.mjs [--models a,b] [--out dir]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** USD por 1M de tokens; la salida incluye razonamiento. Fuentes en `packages/functions/src/llm/llmCost.ts`. */
export const MODELOS = {
    'gemini-2.5-flash': { proveedor: 'gemini', precio: [0.3, 2.5], nota: 'hoy: resto del sitio' },
    'gemini-2.5-pro': { proveedor: 'gemini', precio: [1.25, 10], nota: 'hoy: exégesis' },
    'gemini-3.8-flash': { proveedor: 'gemini', precio: [0.75, 3.75], thinkingLevel: 'LOW', nota: '2027: ×2' },
    'gemini-3.5-flash-lite': { proveedor: 'gemini', precio: [0.3, 2.5], thinkingLevel: 'MINIMAL' },
    'gpt-6-luna': { proveedor: 'openai', precio: [0.1, 0.5], razonamiento: 'none' },
    'gpt-6.1-sol': { proveedor: 'openai', precio: [2, 10], razonamiento: 'low' },
};

// ── Proveedores ──────────────────────────────────────────────────────────

async function conReintentos(fn) {
    for (let intento = 1; ; intento++) {
        try {
            return await fn();
        } catch (err) {
            if (intento >= 3 || !err.transitorio) throw err;
            await new Promise(r => setTimeout(r, 2000 * intento));
        }
    }
}

async function llamarGemini(modelo, cfg, { system, prompt, json }) {
    const generationConfig = { temperature: 0.2, maxOutputTokens: 16384 };
    if (json) generationConfig.responseMimeType = 'application/json';
    if (cfg.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: cfg.thinkingLevel };
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig,
            }),
        },
    );
    if (!res.ok) {
        const e = new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        e.transitorio = res.status === 429 || res.status >= 500;
        throw e;
    }
    const body = await res.json();
    const u = body.usageMetadata ?? {};
    return {
        texto: (body.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join(''),
        entrada: u.promptTokenCount ?? 0,
        // Lo que se factura como salida: contenido más razonamiento.
        salida: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
        razonamiento: u.thoughtsTokenCount ?? 0,
    };
}

async function llamarOpenAi(modelo, cfg, { system, prompt, json }) {
    const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelo,
            input: json && !/json/i.test(prompt) ? `${prompt}\n\nResponde únicamente con JSON válido.` : prompt,
            ...(system ? { instructions: system } : {}),
            reasoning: { effort: cfg.razonamiento },
            ...(cfg.razonamiento === 'none' ? { temperature: 0.2 } : {}),
            max_output_tokens: 16384,
            ...(json ? { text: { format: { type: 'json_object' } } } : {}),
        }),
    });
    if (!res.ok) {
        const detalle = await res.text();
        const e = new Error(`OpenAI HTTP ${res.status}: ${detalle.slice(0, 200)}`);
        e.transitorio = (res.status === 429 && !/billing|quota/.test(detalle)) || res.status >= 500;
        throw e;
    }
    const body = await res.json();
    const u = body.usage ?? {};
    const texto = body.output_text
        ?? (body.output ?? []).flatMap(o => o.content ?? []).filter(c => c.type === 'output_text').map(c => c.text).join('');
    return {
        texto,
        entrada: u.input_tokens ?? 0,
        salida: u.output_tokens ?? 0,
        razonamiento: u.output_tokens_details?.reasoning_tokens ?? 0,
    };
}

export async function llamar(modelo, pedido) {
    const cfg = MODELOS[modelo];
    const t0 = Date.now();
    const r = await conReintentos(() =>
        cfg.proveedor === 'gemini' ? llamarGemini(modelo, cfg, pedido) : llamarOpenAi(modelo, cfg, pedido));
    const usd = (r.entrada / 1e6) * cfg.precio[0] + (r.salida / 1e6) * cfg.precio[1];
    return { ...r, usd, ms: Date.now() - t0 };
}

// ── Puntuación ───────────────────────────────────────────────────────────

const sinMarcas = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Lema griego comparable: sin acentos, sigma final unificada, contractos a su forma en -ω. */
function lemaGriego(s) {
    return sinMarcas(s).replace(/ς/g, 'σ').replace(/[^\p{Script=Greek}]/gu, '').replace(/[αεο]ω$/, 'ω');
}

/** Raíz hebrea: sólo consonantes, finales unificadas. */
function raizHebrea(s) {
    const finales = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
    return sinMarcas(s).replace(/[א-ת]/g, c => finales[c] ?? c).replace(/[^א-ת]/g, '');
}

const SINONIMOS = {
    aoristo: ['aorist'], perfecto: ['perfect'], futuro: ['future'], presente: ['present'],
    activa: ['active', 'activo'], pasiva: ['passive', 'pasivo'], media: ['middle', 'medio'], deponente: ['deponent'],
    indicativo: ['indicative'], subjuntivo: ['subjunctive'], imperativo: ['imperative'], participio: ['participle'],
    nominativo: ['nominative'], singular: [], plural: [], masculino: ['masculine'],
};

function contiene(respuesta, esperado) {
    const r = sinMarcas(respuesta);
    return [esperado, ...(SINONIMOS[esperado] ?? [])].some(x => r.includes(sinMarcas(x)));
}

function personaDe(v) {
    const r = sinMarcas(v);
    if (/(^|\D)1|primera|first/.test(r)) return '1';
    if (/(^|\D)2|segunda|second/.test(r)) return '2';
    if (/(^|\D)3|tercera|third/.test(r)) return '3';
    return '';
}

export function puntuarGriego(esperado, dado) {
    const campos = { lema: false, tiempo: false, voz: false, modo: false, persona_o_caso: false, numero: false };
    if (!dado) return campos;
    campos.lema = lemaGriego(dado.lema) === lemaGriego(esperado.lema);
    campos.tiempo = contiene(dado.tiempo, esperado.tiempo);
    campos.voz = esperado.voz.some(v => contiene(dado.voz, v));
    campos.modo = contiene(dado.modo, esperado.modo);
    campos.persona_o_caso = esperado.persona
        ? personaDe(dado.persona) === esperado.persona
        : contiene(dado.caso, esperado.caso) && contiene(dado.genero, esperado.genero);
    campos.numero = contiene(dado.numero, esperado.numero);
    return campos;
}

const CONJUGACIONES = {
    qal: ['qal', 'kal'], nifal: ['nifal', 'niphal', "nif'al"], piel: ['piel', "pi'el"], pual: ['pual'],
    hifil: ['hifil', 'hiphil', "hif'il"], hofal: ['hofal', 'hophal', "hof'al"], hitpael: ['hitpael', 'hithpael', "hitpa'el"],
    polel: ['polel', 'poel', "po'el"],
};
const FORMAS = {
    wayyiqtol: ['wayyiqtol', 'consecutiv', 'narrativ', 'vav convers', 'waw convers'],
    weqatal: ['weqatal', 'perfecto consecutivo', 'perfect consecutive', 'consecutiv'],
    perfecto: ['perfecto', 'qatal', 'perfect'],
    imperfecto: ['imperfecto', 'yiqtol', 'imperfect'],
    imperativo: ['imperativo', 'imperative'],
    yusivo: ['yusivo', 'jussive', 'jusivo'],
    participio: ['participio', 'participle'],
};

function pgnNormal(s) {
    return sinMarcas(s).replace(/[^0-9a-z]/g, '').replace(/^([123])?(m|f|c)?(s|p)?.*$/, '$1$2$3');
}

export function puntuarHebreo(esperado, dado) {
    const campos = { raiz: false, conjugacion: false, forma_verbal: false, pgn: false };
    if (!dado) return campos;
    campos.raiz = raizHebrea(dado.raiz) === raizHebrea(esperado.raiz);
    campos.conjugacion = (CONJUGACIONES[esperado.conjugacion] ?? [esperado.conjugacion]).some(x => sinMarcas(dado.conjugacion).includes(x));
    // «wayyiqtol» y «weqatal» también contienen «imperfecto»/«perfecto» en la
    // respuesta del modelo; se exige la marca de consecutivo sólo cuando se espera.
    const fv = sinMarcas(dado.forma_verbal);
    campos.forma_verbal = (FORMAS[esperado.forma_verbal] ?? [esperado.forma_verbal]).some(x => fv.includes(x))
        && !(esperado.forma_verbal === 'perfecto' && /consecutiv|weqatal/.test(fv))
        && !(esperado.forma_verbal === 'imperfecto' && /consecutiv|wayyiqtol/.test(fv));
    campos.pgn = esperado.pgn.split('|').includes(pgnNormal(dado.pgn));
    return campos;
}

// ── Pedidos ──────────────────────────────────────────────────────────────

function pedidoGriego(formas) {
    return {
        json: true,
        system: 'Eres un profesor de griego del Nuevo Testamento. Analizas morfología con precisión académica.',
        prompt: `Analiza morfológicamente cada forma griega. Responde en JSON con esta forma exacta:
{"analisis":[{"forma":"...","lema":"forma de diccionario en griego","tiempo":"presente|imperfecto|futuro|aoristo|perfecto|pluscuamperfecto","voz":"activa|media|pasiva|medio-pasiva|deponente","modo":"indicativo|subjuntivo|optativo|imperativo|infinitivo|participio","persona":"1|2|3 (sólo formas finitas)","caso":"(sólo participios)","numero":"singular|plural","genero":"(sólo participios)"}]}

Formas: ${formas.map(f => f.forma).join(', ')}`,
    };
}

function pedidoHebreo(formas) {
    return {
        json: true,
        system: 'Eres un profesor de hebreo bíblico. Analizas morfología verbal con precisión académica.',
        prompt: `Analiza cada forma verbal hebrea. Responde en JSON con esta forma exacta:
{"analisis":[{"forma":"...","raiz":"tres consonantes en hebreo","conjugacion":"qal|nifal|piel|pual|hifil|hofal|hitpael|polel","forma_verbal":"perfecto|imperfecto|wayyiqtol|weqatal|imperativo|yusivo|participio","pgn":"código como 3ms, 2fp, 1cs; en participios sólo género y número, como ms"}]}

Formas: ${formas.map(f => f.forma).join(', ')}`,
    };
}

function emparejar(formas, analisis) {
    const lista = Array.isArray(analisis) ? analisis : [];
    return formas.map((f, i) => lista.find(a => sinMarcas(a?.forma) === sinMarcas(f.forma)) ?? lista[i] ?? null);
}

function parsearJson(texto) {
    try {
        return JSON.parse(texto);
    } catch {
        const m = texto.match(/\{[\s\S]*\}/);
        try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
    }
}

// ── Corrida ──────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
    const modelos = (val('--models')?.split(',') ?? Object.keys(MODELOS)).filter(m => MODELOS[m]);
    const out = path.resolve(val('--out') ?? `bakeoff-out/llm-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`);
    await fs.mkdir(out, { recursive: true });

    // `--dificil` usa la tanda de verbos débiles e irregulares y salta las
    // tareas abiertas, que no cambian entre tandas.
    const dificil = args.includes('--dificil');
    const sufijo = dificil ? '-dificil' : '';
    const griego = JSON.parse(await fs.readFile(path.join(AQUI, `casos/griego${sufijo}.json`), 'utf8')).formas;
    const hebreo = JSON.parse(await fs.readFile(path.join(AQUI, `casos/hebreo${sufijo}.json`), 'utf8')).formas;
    const abiertos = dificil ? [] : JSON.parse(await fs.readFile(path.join(AQUI, 'casos/abiertos.json'), 'utf8')).tareas;

    const resultados = [];
    await Promise.all(modelos.map(async (modelo) => {
        const fila = { modelo, usd: 0, ms: 0, razonamiento: 0, errores: [] };
        const acumular = r => { fila.usd += r.usd; fila.ms += r.ms; fila.razonamiento += r.razonamiento; };
        try {
            const rg = await llamar(modelo, pedidoGriego(griego));
            acumular(rg);
            // Crudo, para poder ver QUÉ devolvió un modelo que puntúa cero.
            await fs.writeFile(path.join(out, `griego--${modelo}.json`), rg.texto, 'utf8');
            const dados = emparejar(griego, parsearJson(rg.texto)?.analisis);
            fila.griego = griego.map((f, i) => ({ forma: f.forma, campos: puntuarGriego(f, dados[i]), dado: dados[i] }));
        } catch (e) { fila.errores.push(`griego: ${e.message}`); }
        try {
            const rh = await llamar(modelo, pedidoHebreo(hebreo));
            acumular(rh);
            await fs.writeFile(path.join(out, `hebreo--${modelo}.json`), rh.texto, 'utf8');
            const dados = emparejar(hebreo, parsearJson(rh.texto)?.analisis);
            fila.hebreo = hebreo.map((f, i) => ({ forma: f.forma, campos: puntuarHebreo(f, dados[i]), dado: dados[i] }));
        } catch (e) { fila.errores.push(`hebreo: ${e.message}`); }
        for (const t of abiertos) {
            try {
                const r = await llamar(modelo, { system: t.system, prompt: t.prompt, json: false });
                acumular(r);
                await fs.writeFile(path.join(out, `${t.id}--${modelo}.md`), r.texto, 'utf8');
            } catch (e) { fila.errores.push(`${t.id}: ${e.message}`); }
        }
        resultados.push(fila);
        console.log(`✓ ${modelo}`);
    }));

    await fs.writeFile(path.join(out, 'resultados.json'), JSON.stringify(resultados, null, 2), 'utf8');
    console.log(`\n${'modelo'.padEnd(24)} griego  hebreo  USD      s    razon.`);
    for (const f of resultados.sort((a, b) => Object.keys(MODELOS).indexOf(a.modelo) - Object.keys(MODELOS).indexOf(b.modelo))) {
        const pct = filas => {
            if (!filas) return '  —  ';
            const campos = filas.flatMap(x => Object.values(x.campos));
            return `${Math.round((campos.filter(Boolean).length / campos.length) * 100)}%`.padStart(5);
        };
        console.log(`${f.modelo.padEnd(24)} ${pct(f.griego)}   ${pct(f.hebreo)}   $${f.usd.toFixed(4)}  ${Math.round(f.ms / 1000)}  ${f.razonamiento}${f.errores.length ? '  ⚠ ' + f.errores.join(' | ') : ''}`);
    }
    console.log(`\n→ ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
