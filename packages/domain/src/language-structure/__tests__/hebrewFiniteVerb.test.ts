import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { verseWords } from '../chapterStructure';
import {
    applyHebrewFiniteVerb, buildHebrewFiniteVerbTask, hebrewFiniteVerbCandidates, HEBREW_VERB_FUNCTIONS, isCohortativeByFunction,
} from '../hebrewFiniteVerb';
import { formatCitation, hebrewVerbSources } from '../ruleSources';

const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const consonantes = (s: string) => s.normalize('NFD').replace(/[^א-ת]/g, '');
function candidato(rel: string, verse: number, cons: string) {
    const ch = cargar(rel);
    const i = verseWords(ch, verse).findIndex(w => consonantes(w.t) === cons);
    expect(i, `${cons} en ${rel} ${verse}`).toBeGreaterThanOrEqual(0);
    return hebrewFiniteVerbCandidates(ch, verse).find(c => c.ordinal === i);
}

describe('la función del verbo finito hebreo (U5, revisión del profesor)', () => {
    it('Rut 3:5 אֶעֱשֶׂה (OSHB Vqi1cs): yiqtol de 1.ª persona, con las funciones del cohortativo sumadas', () => {
        const c = candidato('he/Ruth/3.json', 5, 'אעשה')!;
        expect(c.form).toBe('imperfect');
        expect(c.rule).toBe('vfYiqtolPrimera');
        expect(c.allowed).toEqual([...HEBREW_VERB_FUNCTIONS.imperfect, 'resolve', 'wish', 'exhortation']);
    });

    it('elegida «resolve», es cohortativo por función; «future» no lo es', () => {
        const c = candidato('he/Ruth/3.json', 5, 'אעשה')!;
        const v = applyHebrewFiniteVerb(c, 'resolve');
        expect(v).toMatchObject({ fn: 'resolve', by: 'assistant' });
        expect(isCohortativeByFunction(v)).toBe(true);
        expect(isCohortativeByFunction(applyHebrewFiniteVerb(c, 'future'))).toBe(false);
    });

    it('un yiqtol de 3.ª persona NO suma el cohortativo (Rut 3:4 יַגִּיד «él te dirá»)', () => {
        const c = candidato('he/Ruth/3.json', 4, 'יגיד')!;
        expect(c.rule).toBe('vfImperfecto');
        expect(c.allowed).not.toContain('resolve');
    });

    it('אַל + yusivo: prohibición, la única regla que decide sola (Rut 1:16 אַל־תִּפְגְּעִי, A&C §3.3.1 d)', () => {
        const c = candidato('he/Ruth/1.json', 16, 'תפגעי')!;
        expect(c.rule).toBe('vfProhibicion');
        expect(applyHebrewFiniteVerb(c, undefined)).toMatchObject({ fn: 'prohibition', by: 'rule' });
    });

    it('cada forma con su lista: wayyiqtol (Rut 3:6 וַתֵּרֶד), perfecto (Rut 3:6 צִוַּתָּה)', () => {
        expect(candidato('he/Ruth/3.json', 6, 'ותרד')).toMatchObject({ form: 'wayyiqtol', allowed: HEBREW_VERB_FUNCTIONS.wayyiqtol });
        expect(candidato('he/Ruth/3.json', 6, 'צותה')).toMatchObject({ form: 'perfect', allowed: HEBREW_VERB_FUNCTIONS.perfect });
    });

    it('los no finitos (infinitivo, participio) y el arameo quedan fuera', () => {
        // Rut 3:3: כַּלֹּתוֹ es infinitivo constructo.
        expect(candidato('he/Ruth/3.json', 3, 'כלתו')).toBeUndefined();
        expect(hebrewFiniteVerbCandidates(cargar('he/Dan/2.json'), 8)).toEqual([]);
        expect(hebrewFiniteVerbCandidates(cargar('gr/JAS/2.json'), 10)).toEqual([]);
    });

    it('la tarea del prompt pide "verbFunction" y explica el cohortativo por función', () => {
        const c = candidato('he/Ruth/3.json', 5, 'אעשה')!;
        const t = buildHebrewFiniteVerbTask([c]);
        expect(t).toContain('## VERBOS FINITOS: SU FUNCIÓN (campo "verbFunction"');
        expect(t).toMatch(/en un verbo III-he la ה- del cohortativo no se ve/);
        expect(t).toContain(`- ${c.text}: imperfecto (yiqtol), elige "verbFunction" de: "future"`);
        // Con la definición de A&C (§3.3.3 a, b), no un rótulo: el banco confundía resolución, deseo y promesa.
        expect(t).toContain('"resolve" (resolución: el hablante se decide o se compromete a hacer algo que está a su alcance');
        expect(t).toContain('"wish" (deseo: se pide algo que requiere el consentimiento de otro');
        // Sólo la lista de la forma: fuera de ella es un error de categoría, no otra lectura.
        expect(t).toContain('Elige SÓLO de esta lista: son todas las funciones de esa forma.');
        expect(t).not.toMatch(/si ninguna encaja/);
        expect(buildHebrewFiniteVerbTask([])).toBe('');
    });

    it('las fuentes: la sección de A&C de la forma; la resolución sobre un yiqtol cita el cohortativo y Putnam', () => {
        expect(hebrewVerbSources('sequential', 'wayyiqtol').map(s => formatCitation(s))).toEqual(['Arnold y Choi, «3.5.1 Imperfect plus waw Consecutive», p. 84']);
        const r = hebrewVerbSources('resolve', 'imperfect').map(s => formatCitation(s));
        expect(r[0]).toBe('Arnold y Choi, «3.3.3 Cohortative», p. 65');
        expect(r[1]).toBe('Putnam, sobre el cohortativo');
    });
});
