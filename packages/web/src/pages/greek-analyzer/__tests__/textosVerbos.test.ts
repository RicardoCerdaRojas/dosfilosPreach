import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    IMPERATIVE_FUNCTIONS, INFINITIVE_FUNCTIONS, OPTATIVE_FUNCTIONS, PARTICIPLE_FUNCTIONS, SUBJUNCTIVE_FUNCTIONS,
    TENSE_USES, VERB_RULE_SOURCES, CASE_FUNCTIONS, DISCOURSE_FUNCTIONS,
} from '@dosfilos/domain';

/** Toda función, uso y regla de G2 tiene su texto en español y en inglés: una nueva sin texto falla aquí. */
const analizador = (l: string) => JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'i18n', 'locales', l, 'greekTutor.json'), 'utf8')).analyzer;
const leer = (l: string) => analizador(l).verbFn;
const CASOS = Object.entries(CASE_FUNCTIONS).flatMap(([c, fs]) => fs.map(f => [c, f] as const));
const FUNCIONES = [...new Set([...PARTICIPLE_FUNCTIONS, ...INFINITIVE_FUNCTIONS, ...SUBJUNCTIVE_FUNCTIONS, ...IMPERATIVE_FUNCTIONS, ...OPTATIVE_FUNCTIONS])];
const USOS = [...new Set(Object.values(TENSE_USES).flat())];
const REGLAS = Object.keys(VERB_RULE_SOURCES);

describe.each(['es', 'en'])('textos de G2 (%s)', l => {
    const t = leer(l);
    it.each(FUNCIONES)('función %s', f => expect(t.functions[f]).toBeTruthy());
    it.each(USOS)('uso del tiempo %s', u => expect(t.tenseUses[u]).toBeTruthy());
    it.each(REGLAS)('regla %s', r => expect(t.rules[r]).toBeTruthy());
    // G4: toda función discursiva con nombre y explicación.
    it.each([...DISCOURSE_FUNCTIONS])('función discursiva %s', f => {
        expect(analizador(l).discourse[f]).toBeTruthy();
        expect(analizador(l).discourseHint[f]).toBeTruthy();
    });
    // G3: toda función de caso con nombre y explicación.
    it.each(CASOS)('caso %s, función %s', (c, f) => {
        expect(analizador(l).caseFn[c][f]).toBeTruthy();
        expect(analizador(l).caseFnHint[f]).toBeTruthy();
    });
});
