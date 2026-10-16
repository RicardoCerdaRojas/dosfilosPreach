/**
 * Banco de evaluación del buscador de la biblioteca (fase «buscador de la
 * biblioteca», 2026-10-16).
 *
 * Mide, sobre búsquedas reales, qué proporción de los primeros resultados
 * TRATA el tema, con un juez automático (Luna, `reasoning: low`) que
 * califica 2 (lo trata), 1 (de paso) o 0 (no). Los juicios se guardan en
 * `juicios.json` (sólo ids de fragmentos y notas, sin texto), así repetir
 * cuesta sólo lo nuevo. Todo cambio del buscador se mide acá antes de entrar.
 *
 * Uso (lee producción; sólo escribe el registro de consumo, atribuido a
 * `library.rerank.eval` para que no se confunda con el de los usuarios):
 *   GEMINI_API_KEY=… OPENAI_API_KEY=… npx tsx scripts/rag-eval/evaluar.ts --uid <uid>
 *
 * Límite: 10 búsquedas y un juez automático. Sirve para COMPARAR métodos, no
 * es la precisión absoluta.
 */
import admin from 'firebase-admin';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OpenAiLlmClient } from '../../packages/functions/src/llm/OpenAiLlmClient';
import { recuperarCandidatos } from '../../packages/functions/src/library/consulta/recuperarFragmentos';
import { armarPedidoDeReorden, ESQUEMA_DE_PUNTAJES, leerPuntajes, TOPE_DE_SALIDA } from '../../packages/functions/src/library/consulta/reordenar';
import type { FragmentoRecuperado } from '../../packages/functions/src/library/consulta/armarConsulta';

export const CONSULTAS = [
    'la oración por los enfermos',
    'la sabiduría que viene de lo alto',
    'el juramento: que su sí sea sí y su no sea no',
    'la fe sin obras está muerta',
    'la lengua es un fuego',
    'los ricos que oprimen a los trabajadores',
    'Jonás huye a Tarsis',
    'cómo usar ilustraciones en el sermón',
    'el waw consecutivo en el verbo hebreo',
    'Elías oró para que no lloviera',
];

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const UID: string = arg('--uid') ?? '';
if (!UID) throw new Error('Falta --uid <uid>');
const GEMINI = process.env.GEMINI_API_KEY!;
const OPENAI = process.env.OPENAI_API_KEY!;
const ARCHIVO = join(__dirname, 'juicios.json');
const juicios: Record<string, number> = existsSync(ARCHIVO) ? JSON.parse(readFileSync(ARCHIVO, 'utf8')) : {};
const clave = (consulta: string, id: string) => `${consulta}|${id}`;

if (!admin.apps.length) admin.initializeApp({ projectId: 'dosfilosapp' });

/** Con espera ante un 429: las claves son las de producción y no se pueden saturar. */
async function conEspera<T>(f: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
        try { return await f(); } catch (e) {
            if (i >= 5 || !/429|RESOURCE_EXHAUSTED|rate/i.test(String((e as Error)?.message ?? e))) throw e;
            await new Promise(r => setTimeout(r, 20_000 * (i + 1)));
        }
    }
}

const juez = new OpenAiLlmClient(OPENAI, 'gpt-6-luna', { feature: 'library.rerank.eval' }, 'low');
async function juzgar(consulta: string, frs: Array<FragmentoRecuperado & { id: string }>): Promise<void> {
    const faltan = frs.filter(f => juicios[clave(consulta, f.id)] === undefined);
    for (let i = 0; i < faltan.length; i += 8) {
        const lote = faltan.slice(i, i + 8);
        const prompt = `Un pastor buscó en su biblioteca el tema: «${consulta}».\nCalifica cada fragmento: 2 = trata DIRECTAMENTE ese tema (lo explica o comenta); 1 = lo toca de paso o trata sólo una parte del tema; 0 = no trata ese tema (aunque comparta palabras sueltas).\nResponde sólo JSON: {"r":[{"n":1,"r":0}]}\n\n` +
            lote.map((f, k) => `### n: ${k + 1}\n${f.autor}, «${f.titulo}» § ${f.seccion}\n${f.texto.slice(0, 1600)}`).join('\n\n');
        const r = JSON.parse(await conEspera(() => juez.generate({ prompt, responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 12000 }))) as { r: { n: number; r: number }[] };
        for (const x of r.r) { const f = lote[x.n - 1]; if (f) juicios[clave(consulta, f.id)] = x.r; }
        writeFileSync(ARCHIVO, JSON.stringify(juicios, null, 0));
    }
}

const reordenador = new OpenAiLlmClient(OPENAI, 'gpt-6-luna', { feature: 'library.rerank.eval' }, 'none');
const UMBRALES = [4, 5, 6, 7, 8];
const filas: Array<{ base: number; reord: number; porUmbral: Record<number, { prec: number; mostrados: number; perdidos: number }> }> = [];

async function main(): Promise<void> {
    for (const consulta of CONSULTAS) {
        const candidatos = (await recuperarCandidatos(consulta, UID, { tipo: 'todo' }, GEMINI, 40)).map(f => ({ ...f, id: f.id! }));
        await juzgar(consulta, candidatos);
        const { system, prompt } = armarPedidoDeReorden(consulta, candidatos);
        const t = Date.now();
        const puntajes = leerPuntajes(await conEspera(() => reordenador.generate({ system, prompt, responseMimeType: 'application/json', responseSchema: ESQUEMA_DE_PUNTAJES, temperature: 0, maxOutputTokens: TOPE_DE_SALIDA })), candidatos.length);
        const ms = Date.now() - t;
        const nota = (f: { id: string }) => juicios[clave(consulta, f.id)] ?? 0;
        const reord = candidatos.map((f, i) => ({ f, s: puntajes[i] ?? -1, i })).sort((a, b) => b.s - a.s || a.i - b.i);
        const p10 = (lista: Array<{ id: string }>) => lista.slice(0, 10).filter(f => nota(f) === 2).length / 10;
        const pertinentes = candidatos.filter(f => nota(f) === 2).length;
        const porUmbral: Record<number, { prec: number; mostrados: number; perdidos: number }> = {};
        for (const u of UMBRALES) {
            const mostrados = reord.filter(x => x.s >= u);
            const buenos = mostrados.filter(x => nota(x.f) === 2).length;
            porUmbral[u] = { prec: mostrados.length ? buenos / mostrados.length : 1, mostrados: mostrados.length, perdidos: pertinentes - buenos };
        }
        filas.push({ base: p10(candidatos), reord: p10(reord.map(x => x.f)), porUmbral });
        console.log(`«${consulta}» vectores ${p10(candidatos).toFixed(1)} → reordenado ${p10(reord.map(x => x.f)).toFixed(1)} (${ms} ms) · pertinentes en los 40: ${pertinentes} · ` +
            UMBRALES.map(u => `≥${u}: ${porUmbral[u]!.mostrados} (${(porUmbral[u]!.prec * 100).toFixed(0)} %)`).join(' '));
    }

    const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`\nP@10 (trata el tema): vectores ${prom(filas.map(f => f.base)).toFixed(2)} → reordenado ${prom(filas.map(f => f.reord)).toFixed(2)}`);
    for (const u of UMBRALES) {
        console.log(`  umbral ≥${u}: muestra ${prom(filas.map(f => f.porUmbral[u]!.mostrados)).toFixed(1)} por búsqueda, ${(prom(filas.map(f => f.porUmbral[u]!.prec)) * 100).toFixed(0)} % trata el tema, deja afuera ${prom(filas.map(f => f.porUmbral[u]!.perdidos)).toFixed(1)} pertinentes`);
    }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
