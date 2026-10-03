/**
 * Banco de «Sugerir preguntas» (C4 del ejercicio de Jonás 4:5-11).
 *
 * Arma el pedido EXACTAMENTE como producción: morfología real del pasaje
 * (MorphGNT / morphhb, los mismos proveedores que `usePassageLemmas`), lemas
 * con `passageLemmas`, el prompt de producción (`briefQuestionPrompt`) y el filtro
 * `filterQuestionCandidates`, que descarta las preguntas que citan una forma
 * que el texto no tiene. Sólo cambia quién contesta.
 *
 * Se mide contra preguntas buenas CONOCIDAS:
 *   - Jonás 4:5-11 (predicación): las cuatro que se le dieron al fundador.
 *   - Santiago 2:14-26 (seminario): las cuatro del profesor en el TP #5.
 * Una referencia cuenta como «encontrada» si alguna pregunta que sobrevive al
 * filtro cita una de sus formas de superficie o su lema (comparados por
 * `lemmaKey`). Es una cota inferior: una pregunta puede tocar la cruz sin
 * citar la forma; las preguntas quedan guardadas para leerlas.
 *
 * Uso (desde la raíz; la clave sólo vive en el entorno de esta orden):
 *   OPENAI_API_KEY=… npx tsx scripts/llm-bakeoff/preguntas.ts [--out dir] [--vueltas 2]
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
    filterQuestionCandidates,
    lemmaKey,
    passageFormKeys,
    passageLemmas,
    type BibleBookId,
    type QuestionCandidate,
    type VerseMorphologyEntry,
} from '@dosfilos/domain';
import {
    buildSuggestBriefQuestionsPrompt,
    parseQuestionCandidates,
    SUGGEST_BRIEF_QUESTIONS_INSTRUCTION,
} from '../../packages/infrastructure/src/exegesis/briefQuestionPrompt';
import { MorphhbOriginalLanguageProvider } from '../../packages/infrastructure/src/bible/original-language/MorphhbOriginalLanguageProvider';
import { SBLGNTBibleProvider } from '../../packages/infrastructure/src/bible/original-language/SBLGNTBibleProvider';
import { TestamentDispatcherOriginalLanguageProvider } from '../../packages/infrastructure/src/bible/original-language/TestamentDispatcherOriginalLanguageProvider';
import { OpenAiLlmClient } from '../../packages/functions/src/llm/OpenAiLlmClient';

const MODELOS = {
    'gpt-6-luna': { precio: [0.1, 0.5], razonamiento: 'none' },
    'gpt-6.1-sol': { precio: [2, 10], razonamiento: 'low' },
} as const;
type Modelo = keyof typeof MODELOS;

interface Caso {
    nombre: string;
    etiqueta: string;
    genero: string;
    bookId: BibleBookId;
    capitulo: number;
    desde: number;
    hasta: number;
    /** Cada referencia: qué pregunta, y las formas que la delatan. */
    referencias: Array<{ tema: string; formas: string[] }>;
}

const CASOS: Caso[] = [
    {
        nombre: 'jonas-4-5-11',
        etiqueta: 'Jonás 4:5-11',
        genero: 'narrativa profética',
        bookId: 'JON' as BibleBookId,
        capitulo: 4,
        desde: 5,
        hasta: 11,
        referencias: [
            { tema: 'וַיְמַן ×4: Dios «prepara» planta, gusano y viento', formas: ['וַיְמַן', 'מָנָה'] },
            { tema: 'חוּס 4:10-11: la compasión de Jonás y la de Dios', formas: ['חַסְתָּ', 'אָחוּס', 'חוּס'] },
            { tema: 'הַהֵיטֵב חָרָה־לְךָ (4:9, eco de 4:4)', formas: ['הַהֵיטֵב', 'חָרָה', 'יָטַב', 'חָרָה'] },
            { tema: 'el final abierto: la pregunta de 4:11 sin respuesta', formas: ['נִינְוֵה', 'וּבְהֵמָה', 'בְּהֵמָה'] },
        ],
    },
    {
        nombre: 'santiago-2-14-26',
        etiqueta: 'Santiago 2:14-26',
        genero: 'epístola parenética',
        bookId: 'JAS' as BibleBookId,
        capitulo: 2,
        desde: 14,
        hasta: 26,
        referencias: [
            { tema: 'la partícula μή (2:14)', formas: ['μή', 'μὴ'] },
            { tema: 'los imperativos θερμαίνεσθε y χορτάζεσθε (2:16)', formas: ['θερμαίνεσθε', 'χορτάζεσθε', 'θερμαίνω', 'χορτάζω'] },
            { tema: 'ἐδικαιώθη (2:21)', formas: ['ἐδικαιώθη', 'δικαιόω'] },
            { tema: 'el participio ἀνενέγκας (2:21)', formas: ['ἀνενέγκας', 'ἀναφέρω'] },
        ],
    },
];

async function morfologia(c: Caso): Promise<{ entries: VerseMorphologyEntry[]; lemmas: ReturnType<typeof passageLemmas> }> {
    const p = new TestamentDispatcherOriginalLanguageProvider(new SBLGNTBibleProvider(), new MorphhbOriginalLanguageProvider());
    const entries: VerseMorphologyEntry[] = [];
    for (let v = c.desde; v <= c.hasta; v++) {
        const morphology = await p.getVerseMorphology!(c.bookId, c.capitulo, v);
        if (morphology) entries.push({ chapter: c.capitulo, verse: v, morphology });
    }
    const hebreo = entries.some(e => e.morphology.tokens.some(t => 'oshbMorphCode' in t));
    const tabla = hebreo
        ? JSON.parse(await fs.readFile('packages/web/src/data/hebrew/strongLemmas.json', 'utf8')) as Record<string, string>
        : null;
    return { entries, lemmas: passageLemmas(entries, n => tabla?.[String(n)]) };
}

interface Corrida {
    modelo: Modelo;
    caso: string;
    vuelta: number;
    propuestas: number;
    descartadas: Array<{ question: string; missing: string[] }>;
    sobreviven: QuestionCandidate[];
    encontradas: string[];
    usd: number;
    ms: number;
}

function encontradas(c: Caso, preguntas: QuestionCandidate[]): string[] {
    const claves = (q: QuestionCandidate) => new Set([
        ...q.forms.map(lemmaKey),
        ...(q.question.match(/[֐-׿Ͱ-Ͽἀ-῿]+/g) ?? []).map(lemmaKey),
    ]);
    const citadas = new Set(preguntas.flatMap(q => [...claves(q)]));
    return c.referencias
        // Forma de superficie o lema, comparados por clave (`lemmaKey`).
        .filter(r => r.formas.some(f => citadas.has(lemmaKey(f))))
        .map(r => r.tema);
}

async function main() {
    if (!process.env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY en el entorno de esta orden.');
    const args = process.argv.slice(2);
    const out = args.includes('--out') ? args[args.indexOf('--out') + 1]! : `bakeoff-out/preguntas-${new Date().toISOString().slice(0, 10)}`;
    const vueltas = args.includes('--vueltas') ? Number(args[args.indexOf('--vueltas') + 1]) : 2;
    await fs.mkdir(out, { recursive: true });

    const corridas: Corrida[] = [];
    for (const c of CASOS) {
        const { entries, lemmas } = await morfologia(c);
        const claves = passageFormKeys(entries, lemmas);
        const input = {
            passageLabel: c.etiqueta,
            genre: c.genero,
            verses: entries.map(e => ({
                ref: `${e.chapter}:${e.verse}`,
                text: e.morphology.tokens.map(t => t.text.replace(/\//g, '')).join(' '),
            })),
            lemmas: lemmas.map(l => l.lemma),
            existingQuestions: [],
            language: 'es' as const,
        };
        console.log(`${c.etiqueta}: ${entries.length} versículos, ${lemmas.length} lemas`);
        for (const modelo of Object.keys(MODELOS) as Modelo[]) {
            for (let vuelta = 1; vuelta <= vueltas; vuelta++) {
                const cfg = MODELOS[modelo];
                const cliente = new OpenAiLlmClient(process.env.OPENAI_API_KEY!, modelo, undefined, cfg.razonamiento);
                const t0 = Date.now();
                // Los mismos parámetros que `pedirleAlModelo` en producción.
                const candidatas = parseQuestionCandidates(await cliente.generate({
                    system: SUGGEST_BRIEF_QUESTIONS_INSTRUCTION,
                    prompt: buildSuggestBriefQuestionsPrompt(input),
                    temperature: 0.3,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json',
                }));
                const ms = Date.now() - t0;
                const { input: ent, output: sal } = cliente.lastUsage ?? { input: 0, output: 0 };
                const filtradas = filterQuestionCandidates(candidatas, claves);
                const r: Corrida = {
                    modelo, caso: c.nombre, vuelta,
                    propuestas: candidatas.length,
                    descartadas: filtradas.dropped,
                    sobreviven: filtradas.kept,
                    encontradas: encontradas(c, filtradas.kept),
                    usd: (ent * cfg.precio[0] + sal * cfg.precio[1]) / 1e6,
                    ms,
                };
                corridas.push(r);
                console.log(`  ${modelo} #${vuelta}: ${r.propuestas} propuestas, ${r.descartadas.length} descartadas, `
                    + `${r.encontradas.length}/${c.referencias.length} referencias, $${r.usd.toFixed(4)}, ${ms} ms`);
            }
        }
    }
    await fs.writeFile(path.join(out, 'corridas.json'), JSON.stringify(corridas, null, 2));
    console.log(`→ ${out}/corridas.json`);
}

main().catch(err => {
    // Nunca el entorno, y el mensaje sin la clave: un 401 de OpenAI la repite.
    console.error('falló el banco:', String((err as Error).message).replace(/sk-[A-Za-z0-9_\-]+/g, 'sk-[tachada]'));
    process.exit(1);
});
