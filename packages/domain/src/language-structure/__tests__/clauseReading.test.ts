import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { verseStructure } from '../verseStructure';
import { buildClauseReadingTask, parseClauseReadings, readingFor } from '../clauseReading';

const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const jn316 = verseStructure(cargar('gr/JHN/3.json'), 16);
const stg29 = verseStructure(cargar('gr/JAS/2.json'), 9);

describe('lectura de cláusulas — la tarea', () => {
    it('numera las filas y pide ELEGIR sólo donde el dato deja abierto (ἵνα) o hay algo antepuesto', () => {
        const tarea = buildClauseReadingTask(jn316);
        expect(tarea).toContain('1. [nivel 0] Οὕτως γὰρ');
        const ina = jn316.findIndex(n => n.relation === 'purposeOrResult') + 1;
        expect(tarea).toMatch(new RegExp(`${ina}\\. .*ἵνα.*ELEGIR "resolved": "purpose" o "result"`));
        expect(tarea.split('\n').filter(l => /^\d+\. /.test(l) && l.includes('ELEGIR "resolved"'))).toHaveLength(1);
        expect(buildClauseReadingTask(stg29)).toMatch(/ἁμαρτίαν ἐργάζεσθε.*APÓDOSIS.*antepuesto al verbo: objeto \(ἁμαρτίαν\).*ELEGIR "fronting"/);
    });

    it('sin filas no pide nada', () => {
        expect(buildClauseReadingTask([])).toBe('');
    });
});

describe('lectura de cláusulas — validación', () => {
    const ina = jn316.findIndex(n => n.relation === 'purposeOrResult') + 1;
    const primera = 1;

    it('acepta la elección donde la relación es ambigua y la ancla a la fila', () => {
        const [l] = parseClauseReadings([{ n: ina, value: 'propósito del don', explanation: 'ἵνα + subjuntivo.', resolved: 'purpose' }], jn316);
        expect(l).toMatchObject({ index: jn316[ina - 1]!.index, anchor: jn316[ina - 1]!.words[0]!.r, resolved: 'purpose' });
        expect(readingFor(jn316[ina - 1]!, [l!])?.value).toBe('propósito del don');
    });

    it('descarta lo que no calza: número inexistente, repetido, elección donde no hay ambigüedad, foco sin antepuesto', () => {
        const out = parseClauseReadings([
            { n: 99, value: 'x', explanation: 'y' },
            { n: primera, value: 'fundamento', explanation: 'γάρ.', resolved: 'result', fronting: 'focus' },
            { n: primera, value: 'otra vez', explanation: '' },
            { n: ina, value: 'v', explanation: 'e', resolved: 'ground' },
            { n: '2', value: '', explanation: '' },
        ], jn316);
        expect(out).toHaveLength(2);
        expect(out[0]).not.toHaveProperty('resolved');
        // La primera fila de Jn 3:16 sí tiene antepuesto (Οὕτως): el foco vale.
        expect(out[0]!.fronting).toBe('focus');
        expect(out[1]).not.toHaveProperty('resolved');
    });

    it('«fronting» donde nada va antepuesto se descarta (Stg 2:9, la fila de δέ)', () => {
        const n = stg29.findIndex(f => f.fronted.length === 0) + 1;
        const [l] = parseClauseReadings([{ n, value: 'desarrollo', explanation: 'δέ.', fronting: 'focus' }], stg29);
        expect(l).toBeDefined();
        expect(l).not.toHaveProperty('fronting');
    });

    it('una lectura no se pega a otra fila si cambió su primera palabra', () => {
        const [l] = parseClauseReadings([{ n: 1, value: 'v', explanation: 'e' }], stg29);
        expect(readingFor(stg29[0]!, [{ ...l!, anchor: 'otra' }])).toBeUndefined();
    });

    it('no es una lista: nada', () => {
        expect(parseClauseReadings('basura', jn316)).toEqual([]);
    });
});

describe('fuentes según la forma', () => {
    it('«propósito» cita la sección del infinitivo o la del participio, no las dos (Lc 5:17 εἰς τὸ ἰᾶσθαι)', async () => {
        const { verbFunctionSources } = await import('../ruleSources');
        expect(verbFunctionSources('purpose', 'infinitive').map(s => s.section)).toEqual(['Adverbial Uses › Purpose']);
        expect(verbFunctionSources('purpose', 'participle').map(s => s.section)).toEqual(['Adverbial (or Circumstantial) › Purpose (Telic)']);
        expect(verbFunctionSources('purpose').length).toBe(2);
    });
});

describe('el uso del tiempo se cita según el tiempo', () => {
    it('«habitual» del presente ≠ del imperfecto; la nota del profesor sólo en el presente (Stg 2:7)', async () => {
        const { tenseUseSources } = await import('../ruleSources');
        expect(tenseUseSources('customary', 'P').map(s => s.section)).toEqual(['Customary (Habitual or General) Present', 'Indicación del profesor']);
        expect(tenseUseSources('customary', 'P')[0]!.verified?.page).toBe('521');
        expect(tenseUseSources('customary', 'I').map(s => s.section)).toEqual(['Customary (Habitual or General) Imperfect']);
        expect(tenseUseSources('gnomic', 'A').map(s => s.section)).toEqual(['Gnomic Aorist']);
        expect(tenseUseSources('customary', undefined)).toEqual([]);
    });
});
