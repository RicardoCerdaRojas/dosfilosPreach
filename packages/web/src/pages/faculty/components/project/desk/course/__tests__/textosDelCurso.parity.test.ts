import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import es from '@/i18n/locales/es/projectDeskCourse.json';
import en from '@/i18n/locales/en/projectDeskCourse.json';

/**
 * PARIDAD de los textos del escritorio del Curso. i18next no falla si falta
 * una clave: pinta «works.markDelivered» crudo en la mesa. Tampoco si un
 * valor difiere entre idiomas: uno de los dos muestra «{{label}}» sin
 * rellenar. Y toda clave que piden los componentes tiene que existir.
 */

function hojas(obj: unknown, prefijo = ''): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const clave = prefijo ? `${prefijo}.${k}` : k;
        if (v && typeof v === 'object') Object.assign(out, hojas(v, clave));
        else out[clave] = String(v);
    }
    return out;
}
const valores = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map(m => m[1]).sort();

const ES = hojas(es);
const EN = hojas(en);

/** Las claves que se arman en tiempo de ejecución, con todos sus valores posibles. */
const DINAMICAS = [
    ...['charge', 'calendar', 'works', 'feedback'].flatMap(f => [`phase.${f}.title`, `phase.${f}.description`]),
    'phase.sources.title',
    ...['calendar', 'free'].flatMap(m => [`calendar.mode.${m}`, `calendar.mode.${m}Hint`]),
    ...['mixed', 'exegetical', 'research'].map(m => `charge.method.${m}`),
    ...['notDelivered', 'delivered', 'returned', 'noFeedback'].map(d => `works.delivery.${d}`),
    ...['empty-rule', 'rule-too-long', 'project-unavailable', 'pattern-not-found', 'guide-not-found', 'guide-without-manifest', 'guide-full'].map(c => `guideRule.errors.${c}`),
];

const PATRON = /'((?:calendar|charge|works|feedback|feedbackDialog|guideRule|import|sources|common|toast)\.[\w.-]+)'/g;

/** Las claves literales que piden los archivos del escritorio del Curso y la página de creación. */
function clavesUsadas(): string[] {
    const dir = join(__dirname, '..');
    const archivos = [
        ...readdirSync(dir).filter(f => /\.tsx?$/.test(f)).map(f => join(dir, f)),
        join(dir, '..', 'CourseDeskSections.tsx'),
    ];
    const out = new Set<string>();
    for (const a of archivos) {
        const src = readFileSync(a, 'utf8');
        // Todo literal con forma de clave de este espacio (también los de una condición o un `successKey`).
        for (const m of src.matchAll(PATRON)) out.add(m[1]!);
    }
    const crear = readFileSync(join(dir, '..', '..', '..', '..', '..', 'exegesis', 'ExegesisCreatePage.tsx'), 'utf8');
    for (const m of crear.matchAll(/\btc\(\s*'([^']+)'/g)) out.add(m[1]!);
    return [...out];
}
const existe = (dic: Record<string, string>, k: string) => k in dic || `${k}_one` in dic || `${k}_other` in dic;

describe('projectDeskCourse: textos del escritorio del Curso', () => {
    it('es y en tienen las mismas claves', () => {
        expect(Object.keys(EN).sort()).toEqual(Object.keys(ES).sort());
    });

    it('cada texto usa los mismos valores en los dos idiomas', () => {
        const distintos = Object.keys(ES).filter(k => JSON.stringify(valores(ES[k]!)) !== JSON.stringify(valores(EN[k] ?? '')));
        expect(distintos).toEqual([]);
    });

    it('toda clave que piden los componentes existe', () => {
        const usadas = [...clavesUsadas(), ...DINAMICAS];
        expect(usadas.length).toBeGreaterThan(100);
        expect(usadas.filter(k => !existe(ES, k))).toEqual([]);
    });

    it('sin palabras del asistente por dentro (IA, modelo…)', () => {
        const prohibidas = /\b(IA|AI|GPT|Gemini|LLM|modelo|model)\b/;
        expect(Object.entries({ ...ES, ...EN }).filter(([, v]) => prohibidas.test(v)).map(([k]) => k)).toEqual([]);
    });
});
