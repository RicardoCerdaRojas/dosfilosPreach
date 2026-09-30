/**
 * Banco de REDACCIÓN del sermón: la misma sección, con las mismas decisiones del
 * pastor, escrita por cada modelo candidato — para leerla a ciegas.
 *
 * La voz del predicador no la mide ninguna métrica; la juzga él. Este banco no
 * puntúa: arma los textos con el constructor real (`buildSectionProsePrompt`,
 * sobre el recorrido real de `deriveSectionWalk`) y los publica rotulados A, B,
 * C, D, con los modelos revelados al final.
 *
 * Uso (desde la raíz):
 *   source ~/.bakeoff.env
 *   npx tsx scripts/llm-bakeoff/redaccion.ts [--out dir]
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { buildSectionProsePrompt, type SectionProseInput } from '../../packages/domain/src/drafting/buildSectionProsePrompt';
import { deriveSectionWalk } from '../../packages/domain/src/drafting/deriveSectionWalk';
import type { SermonElement } from '../../packages/domain/src/drafting/SermonElement';
import { OpenAiLlmClient } from '../../packages/functions/src/llm/OpenAiLlmClient';

const MODELOS = {
    'gemini-2.5-flash': { proveedor: 'gemini', precio: [0.3, 2.5] },
    'gemini-3.8-flash': { proveedor: 'gemini', precio: [0.75, 3.75], thinkingLevel: ThinkingLevel.LOW },
    'gpt-6-luna': { proveedor: 'openai', precio: [0.1, 0.5], razonamiento: 'none' },
    'gpt-6.1-sol': { proveedor: 'openai', precio: [2, 10], razonamiento: 'low' },
} as const;
type Modelo = keyof typeof MODELOS;

/** Como en producción: sólo el prompt, temperatura 0,5, sin instrucción de sistema. */
async function escribir(modelo: Modelo, prompt: string): Promise<{ texto: string; usd: number; ms: number }> {
    const cfg = MODELOS[modelo];
    const t0 = Date.now();
    if (cfg.proveedor === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const r = await ai.models.generateContent({
            model: modelo,
            contents: prompt,
            config: {
                temperature: 0.5,
                ...('thinkingLevel' in cfg ? { thinkingConfig: { thinkingLevel: cfg.thinkingLevel } } : {}),
            },
        });
        const u = r.usageMetadata ?? {};
        const salida = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
        return { texto: r.text ?? '', usd: ((u.promptTokenCount ?? 0) * cfg.precio[0] + salida * cfg.precio[1]) / 1e6, ms: Date.now() - t0 };
    }
    const c = new OpenAiLlmClient(process.env.OPENAI_API_KEY!, modelo, undefined, cfg.razonamiento);
    const texto = await c.generate({ prompt, temperature: 0.5 });
    const u = c.lastUsage ?? { input: 0, output: 0 };
    return { texto, usd: (u.input * cfg.precio[0] + u.output * cfg.precio[1]) / 1e6, ms: Date.now() - t0 };
}

// ── El sermón de prueba: Santiago 1:2-5, dos puntos ─────────────────────

const PASAJE = 'Santiago 1:2-5';
const WALK = deriveSectionWalk({
    points: [{ title: 'I. Las pruebas tienen un propósito (vv. 2-4)' }, { title: 'II. Dios da sabiduría sin reproche (v. 5)' }],
    sermonPassage: PASAJE,
});
const seccion = (id: string) => {
    const s = WALK.find((x) => x.id === id);
    if (!s) throw new Error(`No hay sección ${id}`);
    return s;
};

let n = 0;
const el = (sectionId: string, text: string, kind: SermonElement['kind'] = 'elemento'): SermonElement => ({
    id: `e${n++}`, sectionId, text, kind, provenance: 'pastor', decidedAt: new Date('2026-09-30'),
} as SermonElement);

const PROPOSICION = 'En Santiago 1:2-5 veremos cómo Dios usa las pruebas para madurarnos y nos da la sabiduría para atravesarlas.';

const CASOS: Array<{ id: string; titulo: string; input: SectionProseInput }> = [
    {
        id: 'conexion',
        titulo: 'Introducción — conexión actual',
        input: {
            section: seccion('introduction.currentConnection'),
            sectionLabel: 'Introducción — conexión actual',
            sectionJob: 'Tender el puente entre el mundo del texto y el de tu congregación, sin todavía predicar el punto.',
            passage: PASAJE,
            proposition: PROPOSICION,
            audienceRigor: 'beginner',
            elements: [
                el('introduction.currentConnection', 'Todos conocemos a alguien que después de una crisis dijo: «No entiendo qué quiere Dios de mí».'),
                el('introduction.currentConnection', 'El problema no es que falten respuestas; es que en la prueba se nos nubla el juicio.'),
                el('introduction.currentConnection', 'Conectar con la experiencia de perder el trabajo o de una enfermedad en la familia.', 'directiva'),
            ],
        },
    },
    {
        id: 'exposicion',
        titulo: 'Punto 2 — exposición',
        input: {
            section: seccion('point.2.exposition'),
            sectionLabel: 'Punto 2 — exposición',
            sectionJob: 'Decir lo que el texto dice y por qué importa. Es el contenido del punto.',
            passage: PASAJE,
            proposition: PROPOSICION,
            pointTitle: 'II. Dios da sabiduría sin reproche (v. 5)',
            pointProposition: 'Dios responde a nuestra falta de sabiduría con generosidad, no con reproche.',
            scriptureText: 'Y si alguno de vosotros tiene falta de sabiduría, pídala a Dios, el cual da a todos abundantemente y sin reproche, y le será dada.',
            audienceRigor: 'beginner',
            elements: [
                el('point.2.exposition', '«Si alguno tiene falta» retoma el «sin que os falte cosa alguna» del v. 4: Santiago encadena la palabra a propósito.'),
                el('point.2.exposition', 'La sabiduría aquí no es información sino saber vivir la prueba como Dios quiere.'),
                el('point.2.exposition', '«Abundantemente» habla de un dar sin doblez ni cálculo; «sin reproche» dice que Dios no nos echa en cara pedir.'),
                el('point.2.exposition', 'Explicar que «le será dada» es una promesa, no una posibilidad.', 'directiva'),
            ],
        },
    },
    {
        id: 'aplicacion',
        titulo: 'Punto 2 — aplicación',
        input: {
            section: seccion('point.2.application'),
            sectionLabel: 'Punto 2 — aplicación',
            sectionJob: 'Qué cambia el lunes por la mañana si esto es verdad.',
            passage: PASAJE,
            proposition: PROPOSICION,
            pointTitle: 'II. Dios da sabiduría sin reproche (v. 5)',
            pointProposition: 'Dios responde a nuestra falta de sabiduría con generosidad, no con reproche.',
            audienceRigor: 'beginner',
            elements: [
                el('point.2.application', 'Pedir sabiduría antes de pedir que la prueba termine.'),
                el('point.2.application', 'Dejar de esconderle a Dios que no sabemos qué hacer: Él no se burla.'),
                el('point.2.application', 'Buscar consejo en la iglesia es parte de cómo Dios responde.'),
                el('point.2.application', 'Una aplicación concreta para esta semana.', 'directiva'),
            ],
        },
    },
];

async function main() {
    const i = process.argv.indexOf('--out');
    const out = path.resolve(i >= 0 ? process.argv[i + 1]! : 'bakeoff-out/redaccion-2026-09-30');
    await fs.mkdir(out, { recursive: true });
    const resultados: Record<string, Record<string, { texto: string; usd: number; ms: number }>> = {};
    await Promise.all(CASOS.flatMap((caso) => (Object.keys(MODELOS) as Modelo[]).map(async (modelo) => {
        const prompt = buildSectionProsePrompt(caso.input);
        const r = await escribir(modelo, prompt);
        (resultados[caso.id] ??= {})[modelo] = r;
        await fs.writeFile(path.join(out, `${caso.id}--${modelo}.md`), r.texto, 'utf8');
    })));
    await fs.writeFile(path.join(out, 'resultados.json'), JSON.stringify({ casos: CASOS.map(c => ({ id: c.id, titulo: c.titulo, elementos: c.input.elements.map(e => ({ texto: e.text, tipo: e.kind })) })), resultados }, null, 2), 'utf8');
    for (const [caso, porModelo] of Object.entries(resultados)) {
        for (const [m, r] of Object.entries(porModelo)) {
            console.log(`${caso.padEnd(11)} ${m.padEnd(18)} ${r.texto.split(/\s+/).length} palabras  $${r.usd.toFixed(5)}  ${Math.round(r.ms / 1000)}s`);
        }
    }
    console.log(`→ ${out}`);
}

main();
