import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { applyHebrewPreposition, buildHebrewPrepositionTask, hebrewPrepositionCandidates, HEBREW_PREPOSITIONS } from '../hebrewPreposition';
import { formatCitation, hebrewPrepositionSources } from '../ruleSources';

const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const cons = (s: string) => s.normalize('NFD').replace(/[^א-ת]/g, '');
const de = (rel: string, v: number) => hebrewPrepositionCandidates(cargar(rel), v).map(c => `${cons(c.text)}:${c.preposition}`);

describe('la función de la preposición hebrea (U3a, revisión del profesor)', () => {
    it('Rut 2:1: las dos לְ (posesión y genitival, A&C §4.1.10 f y g) y la מִן', () => {
        expect(de('he/Ruth/2.json', 1)).toEqual(['ולנעמי:l', 'לאישה:l', 'ממשפחת:min']);
        const l = hebrewPrepositionCandidates(cargar('he/Ruth/2.json'), 1)[0]!;
        expect(l.allowed).toEqual(expect.arrayContaining(['possession', 'genitival']));
    });

    it('Rut 2:7 בָעֳמָרִים: בְּ con su lista (espacial, temporal, instrumental…)', () => {
        const b = hebrewPrepositionCandidates(cargar('he/Ruth/2.json'), 7).find(c => cons(c.text) === 'בעמרים')!;
        expect(b.preposition).toBe('b');
        expect(b.allowed[0]).toBe('spatial');
    });

    it('fuera: la que rige un infinitivo (לֵאמֹר, lo cubre el infinitivo) y לִפְנֵי', () => {
        // Rut 2:4: «וַיֹּאמֶר לַקּוֹצְרִים» sí; Rut 4:4 «לֵאמֹר» no. Gn 23:17 «לִפְנֵי מַמְרֵא» no.
        expect(de('he/Ruth/4.json', 4)).not.toContain('לאמר:l');
        expect(de('he/Gen/23.json', 17).some(x => x.startsWith('לפני'))).toBe(false);
        expect(hebrewPrepositionCandidates(cargar('gr/JAS/2.json'), 16)).toEqual([]);
    });

    it('las preposiciones independientes por su lema: עַל, אֶל, עִם, עַד', () => {
        expect(de('he/Ruth/2.json', 7)).toContain('ועד:ad');
        expect(de('he/Gen/24.json', 12)).toContain('עם:im');
    });

    it('la tarea da las definiciones UNA vez por preposición y pide elegir sólo de su lista', () => {
        const t = buildHebrewPrepositionTask(hebrewPrepositionCandidates(cargar('he/Ruth/2.json'), 1));
        expect(t).toContain('## PREPOSICIONES: SU FUNCIÓN (campo "prepositionFunction"');
        expect(t.match(/- לְ \(sentido base/g)).toHaveLength(1);
        expect(t).toContain('"genitival" = en lugar del constructo');
        expect(t).toMatch(/elige "prepositionFunction" SÓLO de la lista de לְ/);
        expect(buildHebrewPrepositionTask([])).toBe('');
    });

    it('una elección fuera de la lista de su preposición no vale', () => {
        const c = hebrewPrepositionCandidates(cargar('he/Ruth/2.json'), 1)[0]!;
        expect(applyHebrewPreposition(c, 'possession').fn).toBe('possession');
        expect(applyHebrewPreposition(c, 'comparative').fn).toBeUndefined();
    });

    it('la fuente: la sección de A&C de la preposición, con su página', () => {
        expect(formatCitation(hebrewPrepositionSources('l', 'possession')[0]!)).toBe('Arnold y Choi, «4.1.10 לְ › (f) Possession», p. 112');
        // Cada función de cada preposición tiene su categoría del libro (cotejada en `cotejo-aprobado.json`).
        for (const [p, d] of Object.entries(HEBREW_PREPOSITIONS)) {
            for (const fn of Object.keys(d.funciones)) expect(hebrewPrepositionSources(p as never, fn as never), `${p}.${fn}`).toHaveLength(1);
        }
    });
});
