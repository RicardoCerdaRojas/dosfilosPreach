import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Binyan, MorphemeRole, RESOLVED_RELATIONS } from '@dosfilos/domain';
import { hebrewAnalysisResponseSchema } from '../analysisResponseSchema';

/**
 * G0 (banco fuera de muestra, 2026-11-11): con JSON libre, gpt-6-luna repetía
 * el objeto hasta el tope en 7 de 22 llamadas y omitía el valor de la waw
 * disyuntiva (Gn 18:27). El análisis viaja con esquema → modo estricto.
 */
const runLlmPrompt = vi.fn();
vi.mock('../../llm/callableLlm', () => ({ runLlmPrompt: (...a: unknown[]) => runLlmPrompt(...a) }));
const { HebrewAnalysisService } = await import('../gemini-hebrew-service');

type Nodo = { type?: string; properties?: Record<string, Nodo>; required?: string[]; propertyOrdering?: string[]; items?: Nodo; enum?: string[]; nullable?: boolean };

function objetos(n: Nodo, ruta = '$', out: Array<[string, Nodo]> = []): Array<[string, Nodo]> {
    if (n.type === 'object') {
        out.push([ruta, n]);
        for (const [k, v] of Object.entries(n.properties ?? {})) objetos(v, `${ruta}.${k}`, out);
    }
    if (n.type === 'array' && n.items) objetos(n.items, `${ruta}[]`, out);
    return out;
}

describe('el esquema de la respuesta del análisis hebreo', () => {
    const conFilas = hebrewAnalysisResponseSchema(true) as Nodo;
    const sinFilas = hebrewAnalysisResponseSchema(false) as Nodo;

    it('todo campo es obligatorio y va en el orden de la plantilla (Gemini ordena alfabéticamente sin propertyOrdering)', () => {
        for (const [ruta, o] of objetos(conFilas)) {
            const claves = Object.keys(o.properties ?? {});
            expect(o.required, ruta).toEqual(claves);
            expect(o.propertyOrdering, ruta).toEqual(claves);
        }
        const palabra = conFilas.properties!.words!.items!;
        expect(Object.keys(palabra.properties!).slice(0, 3)).toEqual(['hebrewText', 'transliteration', 'root']);
    });

    it('con filas pide "clauseReadings"; sin filas, "clauses" (el prompt v2 parte el versículo)', () => {
        expect(conFilas.properties).toHaveProperty('clauseReadings');
        expect(conFilas.properties).not.toHaveProperty('clauses');
        expect(sinFilas.properties).toHaveProperty('clauses');
        expect(sinFilas.properties).not.toHaveProperty('clauseReadings');
    });

    it('"resolved" ofrece todos los valores de la waw disyuntiva y puede ir en null donde la fila no pide elegir', () => {
        const r = conFilas.properties!.clauseReadings!.items!.properties!.resolved!;
        expect(r.enum).toEqual([...RESOLVED_RELATIONS]);
        expect(r.enum).toEqual(expect.arrayContaining(['concessive', 'contrast', 'closing']));
        expect(r.nullable).toBe(true);
    });

    it('los enums salen del dominio y lo condicional es anulable (medido: el modelo ya lo mandaba en null)', () => {
        const p = conFilas.properties!.words!.items!.properties!;
        expect(p.verbMorphology!.properties!.binyan!.enum).toEqual(Object.values(Binyan));
        expect(p.morphemes!.items!.properties!.role!.enum).toEqual(Object.values(MorphemeRole));
        for (const k of ['root', 'rootTransliteration', 'rootMeaning', 'infinitiveFunction', 'verbMorphology', 'nominalMorphology', 'clauseTag']) {
            expect(p[k]!.nullable, k).toBe(true);
        }
        // `clauseTag` llegaba como el texto "null" (10 de 273): el enum no lo admite.
        expect(p.clauseTag!.enum).not.toContain('null');
        expect(p.hebrewText!.nullable).toBeUndefined();
        // Sólo «anulable» dejó sin raíz a 19 de 37 nombres propios y a אִישׁ (banco v6); la descripción acota el null.
        expect((p.root as { description?: string }).description).toMatch(/null SÓLO en palabras sin raíz: preposiciones/);
        expect((p.root as { description?: string }).description).toMatch(/nombre propio/);
    });
});

describe('el servicio manda el esquema', () => {
    const verse = { reference: 'Ruth.1.17', displayReference: 'Rut 1:17', hebrewText: 'x', words: [] };
    const fila = { index: 0, depth: 0, words: [{ r: '17!1', t: 'x', role: '' as const }], connector: null, relation: 'main' as const, isApodosis: false, verbless: true, fronted: [] };
    beforeEach(() => runLlmPrompt.mockReset().mockResolvedValue(JSON.stringify({ words: [], verbTable: [], clauseReadings: [] })));

    it('con filas, el de "clauseReadings"; sin filas, el de "clauses"', async () => {
        await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', [], [fila]);
        expect(runLlmPrompt.mock.calls[0]![0].responseSchema).toEqual(hebrewAnalysisResponseSchema(true));
        await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', []);
        expect(runLlmPrompt.mock.calls[1]![0].responseSchema).toEqual(hebrewAnalysisResponseSchema(false));
    });

    it('los versículos vecinos llegan al prompt (banco: Gn 18:18 se entiende por 18:17)', async () => {
        const neighbors = { previous: { reference: 'Rut 1:16', hebrewText: 'אַל־תִּפְגְּעִי' } };
        await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', [], [fila], [], [], [], [], neighbors);
        expect(runLlmPrompt.mock.calls[0]![0].prompt).toContain('Anterior (Rut 1:16): אַל־תִּפְגְּעִי');
    });

    it('lee "n" numérico y "resolved"/"fronting" en null sin inventar valores', async () => {
        runLlmPrompt.mockResolvedValue(JSON.stringify({
            words: [], verbTable: [],
            clauseReadings: [{ n: 1, value: 'principal', explanation: 'e', resolved: null, fronting: null }],
        }));
        const a = await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', [], [fila]);
        expect(a.clauseReadings).toEqual([{ index: 0, anchor: '17!1', value: 'principal', explanation: 'e' }]);
    });
});
