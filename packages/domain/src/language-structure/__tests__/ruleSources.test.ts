import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    DISCOURSE_RULE_SOURCES,
    formatCitation,
    isVerified,
    NOMINAL_RULE_SOURCES,
    STRUCTURE_RULE_SOURCES,
    TENSE_USE_SOURCES,
    VERB_FUNCTION_SOURCES,
    VERB_RULE_SOURCES,
    verbFunctionSources,
    WORKS,
    type RuleSource,
} from '../ruleSources';

/**
 * R0 — honestidad de las citas (`docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md`).
 * Las secciones se habían escrito de memoria: sólo 21 de 90 de Wallace eran
 * un encabezado del libro. Estas pruebas impiden volver a eso.
 */
const todas: RuleSource[] = [];
const juntar = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(juntar);
    else if (x && typeof x === 'object') {
        if ('work' in x && 'topic' in x) todas.push(x as RuleSource);
        else Object.values(x).forEach(juntar);
    }
};
[VERB_RULE_SOURCES, VERB_FUNCTION_SOURCES, TENSE_USE_SOURCES, DISCOURSE_RULE_SOURCES, NOMINAL_RULE_SOURCES, STRUCTURE_RULE_SOURCES].forEach(juntar);

describe('R0 — sólo se cita lo verificado', () => {
    it('sin verificar: obra y tema, nunca la sección ni una página', () => {
        const sin = todas.filter(s => !isVerified(s));
        expect(sin.length).toBeGreaterThan(0); // Runge: no hay ejemplar en la biblioteca
        for (const s of sin) {
            for (const forma of ['short', 'full'] as const) {
                const c = formatCitation(s, forma);
                expect(c, c).toContain(`sobre ${s.topic}`);
                expect(c, c).not.toContain(s.section);
                expect(c, c).not.toMatch(/\bp\. ?\d/);
            }
        }
    });

    it('verificada: página impresa, método y fecha; la cita lleva sección y página', () => {
        const ver = todas.filter(s => s.verified);
        expect(ver.length).toBeGreaterThan(0);
        for (const s of ver) {
            expect(s.verified!.page, s.section).toMatch(/^\d+$/);
            expect(['pdf', 'person']).toContain(s.verified!.method);
            expect(s.verified!.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(formatCitation(s)).toBe(`${formatCitation(s).split(',')[0]}, «${s.section}», p. ${s.verified!.page}`);
        }
    });

    it('sólo se verifica contra una edición fijada (año e ISBN de la obra)', () => {
        for (const s of todas.filter(x => x.verified)) {
            expect(WORKS[s.work].isbn, s.work).toMatch(/^978-/);
        }
        // Arnold y Choi: el ejemplar cotejado es la 1.ª edición (2003); la 2.ª pagina distinto.
        expect(WORKS.arnoldChoi.year).toBe(2003);
    });

    it('Wallace está cotejado entero: ninguna sección de memoria', () => {
        const sin = todas.filter(s => s.work === 'wallace' && !s.verified).map(s => s.section);
        expect(sin).toEqual([]);
    });

    it('toda fuente verificada pasó el cotejo con el ejemplar (lista que escribe `cotejar-citas.py --aprobar`)', () => {
        // Sin esto, una página escrita de memoria pasaría por verificada (revisión de R0).
        const aprobados = new Set<string>(JSON.parse(readFileSync(fileURLToPath(new URL('./cotejo-aprobado.json', import.meta.url)), 'utf8')));
        const fuera = todas.filter(s => s.verified?.method === 'pdf').map(s => `${s.work}|${s.section}|${s.verified!.page}`).filter(k => !aprobados.has(k));
        expect(fuera).toEqual([]);
    });

    it('la fuente es la del MODO del verbo: imperativo condicional ≠ subjuntivo en condicionales', () => {
        expect(verbFunctionSources('conditional', 'imperative').map(s => s.section)).toEqual(['The Imperative Mood › Conditional Imperative']);
        expect(verbFunctionSources('conditional', 'subjunctive').map(s => s.section)).toEqual(['Subjunctive in Conditional Sentences']);
        expect(verbFunctionSources('prohibition', 'subjunctive').map(s => s.section)).toEqual(['Prohibitive Subjunctive']);
        expect(verbFunctionSources('means', 'infinitive').map(s => s.verified?.page)).toEqual(['597']);
    });

    it('ἵνα cita la sección general (siete usos, p. 471); «lest» ya no cita el propósito', () => {
        expect(VERB_RULE_SOURCES.afterIna.map(s => s.verified?.page)).toEqual(['471']);
        expect(VERB_RULE_SOURCES.lest.map(s => s.section)).toEqual(['Subjunctive with Verbs of Fearing, Etc.']);
    });

    it('cada fuente tiene un tema en castellano para mostrar sin verificación', () => {
        for (const s of todas) expect(s.topic.trim().length, s.section).toBeGreaterThan(2);
    });

    it('la waw disyuntiva (waw + no verbo, «But Noah») NO cita «Disjunctive Clause» (esa es «o… o»)', () => {
        const d = STRUCTURE_RULE_SOURCES.disjunctive.map(s => s.section);
        expect(d.some(x => /Disjunctive Clause/.test(x))).toBe(false);
        expect(d).toContain('4.3.3 ו › (a) Adversative');
    });
});
