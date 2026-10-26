import { describe, it, expect } from 'vitest';
import { DESK_TEXT_KEYS } from '@dosfilos/domain';
import es from '@/i18n/locales/es/projects.json';
import en from '@/i18n/locales/en/projects.json';

/**
 * Los textos del escritorio (W2-A): cada clave `desk.*` que produce el
 * dominio existe en es y en (o sus formas de plural), lo mismo las del
 * recorrido, el andamiaje y las herramientas; las dos lenguas tienen las
 * mismas claves y ningún texto nombra la tecnología.
 */
type Arbol = Record<string, unknown>;
const leer = (json: Arbol, clave: string): unknown =>
    clave.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Arbol)[k] : undefined), json);
const conTexto = (v: unknown) => typeof v === 'string' && v.trim() !== '';
/** La clave o, si lleva `count`, sus plurales. */
const existe = (json: Arbol, clave: string) => conTexto(leer(json, clave)) || (conTexto(leer(json, `${clave}_one`)) && conTexto(leer(json, `${clave}_other`)));

const hojas = (n: unknown, pre = ''): string[] =>
    n && typeof n === 'object' ? Object.entries(n as Arbol).flatMap(([k, v]) => hojas(v, pre ? `${pre}.${k}` : k)) : [pre];

const FASES = {
    exegetical: ['passage', 'sources', 'division', 'pericopes', 'synthesis'],
    course: ['charge', 'sources', 'calendar', 'works', 'feedback'],
};
const PROPIAS = [
    'desk.journey.label', 'desk.journey.nowOnlyLabel', 'desk.journey.phaseLabel', 'desk.journey.goToPhase',
    'desk.journey.status.todo', 'desk.journey.status.doing', 'desk.journey.status.ready',
    'desk.journey.nowLabel', 'desk.journey.due', 'desk.journey.allReady', 'desk.journey.notesLabel',
    ...['deadline', 'continuity', 'upcoming', 'scheduled', 'phase', 'recent'].map(k => `desk.journey.kind.${k}`),
    // Un verbo por cada destino del modelo (`DeskTargetType`) más los dos especiales.
    ...['study', 'scheduleEntry', 'createScheduled', 'phase', 'framing', 'stateOfArt', 'planSeries', 'reviseIdea', 'recordFeedback', 'output', 'review', 'oldNote']
        .map(k => `desk.journey.action.${k}`),
    'desk.journey.scaffold.title', 'desk.journey.scaffold.purpose', 'desk.journey.scaffold.wellDone', 'desk.journey.scaffold.commonError',
    ...Object.entries(FASES).flatMap(([tipo, ids]) => ids.flatMap(id => ['name', 'purpose', 'wellDone', 'commonError'].map(p => `desk.journey.phases.${tipo}.${id}.${p}`))),
    'desk.tools.eyebrow', 'desk.tools.title', 'desk.tools.description', 'desk.tools.hebrewAramaic', 'desk.tools.sourcesEyebrow',
    'material.seeAll', 'material.seeLess', 'material.chars', 'roadmap.label',
];

describe('las claves que produce el dominio (DESK_TEXT_KEYS)', () => {
    it.each([...DESK_TEXT_KEYS])('%s existe en es y en', (clave) => {
        expect(existe(es as Arbol, clave), `es: ${clave}`).toBe(true);
        expect(existe(en as Arbol, clave), `en: ${clave}`).toBe(true);
    });
});

describe('las claves propias del escritorio', () => {
    it.each(PROPIAS)('%s existe en es y en', (clave) => {
        expect(existe(es as Arbol, clave), `es: ${clave}`).toBe(true);
        expect(existe(en as Arbol, clave), `en: ${clave}`).toBe(true);
    });
});

describe('paridad y vocabulario', () => {
    it('el árbol `desk` tiene las mismas claves en es y en', () => {
        expect(hojas((es as Arbol).desk).sort()).toEqual(hojas((en as Arbol).desk).sort());
    });

    it('ningún texto del escritorio nombra la tecnología, y el recorrido ya no se llama «Roadmap»', () => {
        for (const json of [es, en] as Arbol[]) {
            for (const h of hojas(json.desk)) {
                const v = leer(json.desk as Arbol, h) as string;
                expect(/\b(IA|AI|modelo|model|Gemini|LLM|GPT)\b/i.test(v), h).toBe(false);
            }
            expect(leer(json, 'roadmap.label')).not.toMatch(/roadmap/i);
        }
    });

    it('los parámetros de cada texto del dominio son los mismos en es y en', () => {
        const params = (s: unknown) => [...String(s ?? '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();
        for (const h of hojas((es as Arbol).desk)) {
            expect(params(leer((en as Arbol).desk as Arbol, h)), h).toEqual(params(leer((es as Arbol).desk as Arbol, h)));
        }
    });

    it('«perícopa» y «estado del arte» se glosan en el andamiaje', () => {
        expect(leer(es as Arbol, 'desk.journey.phases.exegetical.division.purpose')).toContain('cada unidad del texto que se predica entera');
        expect(leer(es as Arbol, 'desk.journey.phases.exegetical.sources.purpose')).toContain('la lista razonada de obras con que vas a trabajar');
    });
});
