import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { applyNominalRules, buildNominalFactsTask, greekAgency, greekAnaphora } from '../nominalFunctions';

/** G3 — agencia (#G5) y artículo anafórico (#G6), los casos del profesor. */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/gr/', import.meta.url));
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${BASE}${rel}`, 'utf8'));
const texto = (ch: ChapterStructure, v: number, i: number) => verseWords(ch, v)[i]!.t.replace(/[,.;·’]/g, '');

describe('G3 — agencia con verbo pasivo (Wallace)', () => {
    it('Stg 2:9 «ἐλεγχόμενοι ὑπὸ τοῦ νόμου»: agente último (profesor #G5)', () => {
        const ch = cargar('JAS/2.json');
        const [a] = greekAgency(ch, 9);
        expect(a).toMatchObject({ kind: 'ultimate', rule: 'agentHypo' });
        expect(texto(ch, 9, a!.ordinal)).toBe('ὑπὸ');
        expect(texto(ch, 9, a!.termOrdinal)).toBe('νόμου');
        expect(texto(ch, 9, a!.verbOrdinal)).toBe('ἐλεγχόμενοι');
    });
    it('1 Co 1:9 «δι’ οὗ ἐκλήθητε»: agente intermedio', () => {
        expect(greekAgency(cargar('1CO/1.json'), 9)).toMatchObject([{ kind: 'intermediate', rule: 'agentDia' }]);
    });
    it('NO es agencia: ἐν + dativo (1 Co 1:2 «ἐν Χριστῷ», esfera) ni ἀπό de separación (1 Co 7:10)', () => {
        expect(greekAgency(cargar('1CO/1.json'), 2)).toEqual([]);
        expect(greekAgency(cargar('1CO/7.json'), 10)).toEqual([]);
    });
    it('sin verbo pasivo no hay agente (Stg 1:5 «αἰτείτω παρὰ τοῦ διδόντος»: «de parte de»)', () => {
        expect(greekAgency(cargar('JAS/1.json'), 5)).toEqual([]);
    });
    it('διά + acusativo es «por qué», no agente (Jn 12:5 «Διὰ τί ἐπράθη»)', () => {
        expect(greekAgency(cargar('JHN/12.json'), 5)).toEqual([]);
    });
});

describe('G3 — artículo anafórico', () => {
    it('Stg 2:9 τοῦ νόμου retoma νόμον del v. 8 (profesor #G6); Stg 1:4 ἡ ὑπομονή, la del v. 3', () => {
        const ch = cargar('JAS/2.json');
        const a = greekAnaphora(ch, 9);
        expect(a.map(x => [texto(ch, 9, x.headOrdinal), x.antecedent])).toEqual([['νόμου', { text: 'νόμον', verse: 8 }]]);
        expect(greekAnaphora(cargar('JAS/1.json'), 4)[0]?.antecedent).toEqual({ text: 'ὑπομονήν', verse: 3 });
    });
    it('NO es anáfora: θεός monádico (Stg 1:13 «ὁ θεός»), nombre propio (Jn 1:38 «ὁ Ἰησοῦς»), artículo de un adjetivo (Jn 10:11 «ὁ ποιμὴν ὁ καλός»)', () => {
        const stg = cargar('JAS/1.json');
        expect(greekAnaphora(stg, 13).map(x => texto(stg, 13, x.headOrdinal))).not.toContain('θεὸς');
        const jn1 = cargar('JHN/1.json');
        expect(greekAnaphora(jn1, 38).map(x => texto(jn1, 38, x.headOrdinal))).not.toContain('Ἰησοῦς');
        // En Jn 10:11 sólo el segundo «ὁ ποιμήν» retoma; el ὁ de «ὁ καλός» no se cuenta por ποιμήν.
        expect(greekAnaphora(cargar('JHN/10.json'), 11)).toHaveLength(1);
    });

    it('dentro del mismo versículo (Jn 1:1, los dos ὁ λόγος que siguen al primero); θεός es monádico, no anáfora', () => {
        const ch = cargar('JHN/1.json');
        const a = greekAnaphora(ch, 1);
        expect(a.map(x => texto(ch, 1, x.headOrdinal))).toEqual(['λόγος', 'λόγος']);
        expect(a.every(x => x.antecedent.verse === 1)).toBe(true);
    });
});

describe('G3 — aplicado al mostrar', () => {
    const agencia = [{ ordinal: 1, kind: 'ultimate' as const, rule: 'agentHypo' as const, verbOrdinal: 0, termOrdinal: 3 }];
    const anafora = [{ ordinal: 2, headOrdinal: 3, antecedent: { text: 'νόμον', verse: 8 } }];
    it('pone la agencia en la preposición y corrige «de lo conocido» por «anafórico», con lo que retoma', () => {
        const out = applyNominalRules([{}, {}, { articleUse: 'wellKnown' }, {}], agencia, anafora);
        expect(out[1]).toEqual({ agency: 'ultimate', nominalRule: 'agentHypo' });
        expect(out[2]).toEqual({ articleUse: 'anaphoric', antecedent: 'νόμον, v. 8', nominalRule: 'anaphoraLemma' });
    });
    it('respeta «monádico» o «por antonomasia» si el asistente lo eligió (lo dijo el profesor)', () => {
        expect(applyNominalRules([{}, {}, { articleUse: 'monadic' }], [], anafora)[2]).toEqual({ articleUse: 'monadic' });
    });
    it('el prompt da los hechos para explicarlos, no para decidirlos', () => {
        const t = buildNominalFactsTask(agencia, anafora, ['ἐλεγχόμενοι', 'ὑπὸ', 'τοῦ', 'νόμου']);
        expect(t).toMatch(/1\. ὑπὸ νόμου: AGENTE ÚLTIMO .* de la pasiva ἐλεγχόμενοι.*PERSONIFICACIÓN/);
        expect(t).toMatch(/2\. τοῦ: artículo ANAFÓRICO — retoma νόμον \(v\. 8\)/);
        expect(buildNominalFactsTask([], [], [])).toBe('');
    });
});
