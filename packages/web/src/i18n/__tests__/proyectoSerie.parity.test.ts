import { describe, expect, it } from 'vitest';
import esProjects from '../locales/es/projects.json';
import enProjects from '../locales/en/projects.json';
import esSeries from '../locales/es/series.json';
import enSeries from '../locales/en/series.json';
import esExegesis from '../locales/es/exegesis.json';
import enExegesis from '../locales/en/exegesis.json';

/**
 * PARIDAD de los textos de la fase «Proyecto → Serie» (ADR-046, etapa 3).
 *
 * Los componentes de la fase piden estas claves por nombre. Si falta una en
 * un idioma, i18next no falla: pinta la clave cruda y el pastor lee
 * «seriesSection.row.noStudy» en el panel del proyecto. Si el placeholder
 * difiere entre idiomas, uno de los dos muestra «{{studies}}» sin rellenar.
 *
 * Mismo patrón que la paridad de los campos de la portada.
 */

const NUEVAS_PROJECTS = [
    ...['passage', 'sources', 'division', 'pericopes', 'synthesis'].flatMap((fase) =>
        ['title', 'description', 'cta'].map((campo) => `roadmap.phases.exegetical.${fase}.${campo}`),
    ),
    'seriesSection.title',
    'seriesSection.plan',
    'seriesSection.planAnother',
    'seriesSection.empty',
    'seriesSection.progress',
    'seriesSection.nextDate',
    'seriesSection.open',
    'seriesSection.row.noStudy',
    'seriesSection.row.openStudy',
    'seriesSection.row.noSermon',
    'seriesSection.row.sermonDraft',
    'seriesSection.row.sermonPublished',
    'studies.otherTitle',
    'seriesSection.loading',
    'seriesSection.loadError',
    'seriesSection.retry',
    'roadmap.loading',
    'roadmap.loadError',
];

const NUEVAS_SERIES = [
    ...['banner', 'hint', 'back', 'bookOutside', 'chooseBook', 'unavailable', 'libraryLoading',
        'overlapTitle', 'overlapHint', 'createdInProject', 'noSources', 'openStateOfArt', 'sourcesHint'].map((k) => `expository.project.${k}`),
    'expository.setup.bookChanged',
    'expository.toast.titleTooShort',
    'detail.project.linkedOnly',
    ...['linkedMoved', 'linkedLinked', 'linkedSources'].flatMap((k) => [`detail.project.${k}_one`, `detail.project.${k}_other`]),
    ...['chip', 'unavailable', 'link', 'linkTitle', 'pickProject', 'movePapers_one', 'movePapers_other',
        'addSources', 'confirm', 'unlink', 'linked', 'unlinked', 'failed', 'sourcesFromProject']
        .map((k) => `detail.project.${k}`),
];

/** Claves que ya existían y cambiaron de valor («paper» pasa a «estudio»). */
const UNIFICADAS_SERIES = [
    'pericope.panel.subtitle',
    'pericope.panel.createPaper',
    'pericope.panel.openPaper',
    'pericope.panel.paperBadge',
    'pericope.panel.toast.paperCreated',
    'pericope.panel.toast.paperFailed',
    'detail.table.paperReady',
    'detail.table.createPaper',
    'detail.table.openPaper',
    'detail.table.startStudyFromPaper',
    'detail.table.toast.studyStarted',
    'detail.table.toast.studyStartFailed',
    'detail.table.startDraftWarning.title',
    'detail.table.startDraftWarning.description',
    'expository.toast.seriesCreatedWithPapers_one',
    'expository.toast.seriesCreatedWithPapers_other',
    'expository.toast.seriesCreatedWithPapersAndDrafts',
    'pericope.toast.seriesCreatedWithPapers_one',
    'pericope.toast.seriesCreatedWithPapers_other',
    'pericope.toast.seriesCreatedWithPapersAndDrafts',
];

function leer(json: unknown, ruta: string): unknown {
    return ruta.split('.').reduce<unknown>(
        (nodo, parte) => (nodo && typeof nodo === 'object' ? (nodo as Record<string, unknown>)[parte] : undefined),
        json,
    );
}

function placeholders(texto: string): string[] {
    return [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] ?? '').sort();
}

function* valores(value: unknown, path: string): Generator<[string, string]> {
    if (typeof value === 'string') yield [path, value];
    else if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) yield* valores(v, path ? `${path}.${k}` : k);
}

// Palabras prohibidas en la interfaz (regla del producto: «el asistente», nunca la tecnología).
const PALABRAS_PROHIBIDAS = /\b(IA|AI|modelo|Gemini|LLM)\b/i;

const GRUPOS = [
    { nombre: 'projects', claves: NUEVAS_PROJECTS, es: esProjects, en: enProjects },
    { nombre: 'series', claves: [...NUEVAS_SERIES, ...UNIFICADAS_SERIES], es: esSeries, en: enSeries },
];

describe('textos de la fase Proyecto → Serie en los dos idiomas', () => {
    for (const { nombre, claves, es, en } of GRUPOS) {
        describe(nombre, () => {
            it.each(claves)('%s existe en es y en, con los mismos placeholders', (clave) => {
                const valorEs = leer(es, clave);
                const valorEn = leer(en, clave);
                expect(typeof valorEs, `es: ${clave}`).toBe('string');
                expect(typeof valorEn, `en: ${clave}`).toBe('string');
                expect((valorEs as string).trim(), `es vacío: ${clave}`).not.toBe('');
                expect((valorEn as string).trim(), `en vacío: ${clave}`).not.toBe('');
                expect(placeholders(valorEn as string)).toEqual(placeholders(valorEs as string));
            });

            it('ningún valor nuevo nombra la tecnología', () => {
                const hallazgos = claves.flatMap((clave) =>
                    [['es', leer(es, clave)], ['en', leer(en, clave)]]
                        .filter(([, v]) => typeof v === 'string' && PALABRAS_PROHIBIDAS.test(v))
                        .map(([idioma, v]) => `${idioma} ${clave}: ${v as string}`),
                );
                expect(hallazgos).toEqual([]);
            });
        });
    }

    it('la regex de palabras prohibidas sí atrapa los casos que debe', () => {
        // Guarda contra una regex rota que deje pasar todo.
        expect(PALABRAS_PROHIBIDAS.test('Lo genera la IA')).toBe(true);
        expect(PALABRAS_PROHIBIDAS.test('powered by AI')).toBe(true);
        expect(PALABRAS_PROHIBIDAS.test('el modelo propone')).toBe(true);
        expect(PALABRAS_PROHIBIDAS.test('Gemini')).toBe(true);
        expect(PALABRAS_PROHIBIDAS.test('un LLM')).toBe(true);
        // «Libro», «aire» o «planificador» no son la tecnología.
        expect(PALABRAS_PROHIBIDAS.test('Divide el libro con el planificador')).toBe(false);
        expect(PALABRAS_PROHIBIDAS.test('Agregarles las obras')).toBe(false);
    });

    it('«Comenzar el sermón» dice lo mismo en la serie que en la página del estudio', () => {
        expect(leer(esSeries, 'detail.table.startStudyFromPaper')).toBe(leer(esExegesis, 'detail.startStudy.cta'));
        expect(leer(enSeries, 'detail.table.startStudyFromPaper')).toBe(leer(enExegesis, 'detail.startStudy.cta'));
    });

    it('lo que ve el pastor en series.json ya no dice «paper»', () => {
        // Las claves conservan su nombre (paperReady, createPaper…) y los
        // placeholders también ({{paperCount}}): solo se miran los valores sin
        // placeholders.
        for (const [idioma, json] of [['es', esSeries], ['en', enSeries]] as const) {
            const hallazgos = [...valores(json, '')]
                .filter(([, v]) => /\bpapers?\b/i.test(v.replace(/\{\{\s*\w+\s*\}\}/g, '')))
                .map(([k, v]) => `${idioma} ${k}: ${v.slice(0, 80)}`);
            expect(hallazgos).toEqual([]);
        }
    });
});
