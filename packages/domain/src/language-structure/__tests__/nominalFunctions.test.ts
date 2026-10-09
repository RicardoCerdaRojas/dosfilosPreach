import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { applyNominalRules, buildNominalFactsTask, greekAgency, greekAnaphora, greekAutos } from '../nominalFunctions';
import { greekDiscourseCandidates } from '../discourseFunctions';

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
    it('διά + genitivo es agente sólo con una persona (Jn 1:17 «διὰ Μωϋσέως»); con una cosa es medio, tiempo o lugar', () => {
        expect(greekAgency(cargar('JHN/1.json'), 17)).toMatchObject([{ kind: 'intermediate' }]);
        expect(greekAgency(cargar('1PE/1.json'), 5)).toEqual([]);   // διὰ πίστεως
        expect(greekAgency(cargar('ACT/16.json'), 9)).toEqual([]);  // διὰ νυκτός
    });
    it('el pasivo tiene que estar cerca, en la misma cláusula (1 P 2:5), y no ser un deponente (Mt 12:1 ἐπορεύθη)', () => {
        expect(greekAgency(cargar('1PE/2.json'), 5)).toEqual([]);
        expect(greekAgency(cargar('MAT/12.json'), 1)).toEqual([]);
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

describe('G3 — αὐτός intensivo o identificador, por su posición (Wallace)', () => {
    /** [uso, lo que realza] de cada αὐτός del versículo que la regla decide. */
    const usos = (rel: string, v: number) => {
        const ch = cargar(rel);
        return greekAutos(ch, v).map(a => [texto(ch, v, a.ordinal), a.use, a.headOrdinal !== undefined ? texto(ch, v, a.headOrdinal) : undefined, ...(a.together ? ['juntos'] : [])]);
    };
    it('intensivo: «αὐτὸς ὁ κύριος» (1 Ts 4:16, prueba del fundador), «ἡ φύσις αὐτή», «αὐτὸς ἐγώ», «αὐτὸς Δαυίδ», «ἐν αὐτῇ τῇ ὥρᾳ»', () => {
        expect(usos('1TH/4.json', 16)).toEqual([['αὐτὸς', 'intensive', 'κύριος']]);
        expect(usos('1CO/11.json', 14)).toEqual([['αὐτὴ', 'intensive', 'φύσις']]);
        expect(usos('ROM/7.json', 25)).toEqual([['αὐτὸς', 'intensive', 'ἐγὼ']]);
        expect(usos('MRK/12.json', 36)).toEqual([['αὐτὸς', 'intensive', 'Δαυὶδ']]);
        expect(usos('LUK/10.json', 21)).toEqual([['αὐτῇ', 'intensive', 'ὥρᾳ']]);
    });
    it('identificador: «ὁ αὐτὸς κύριος» (1 Co 12:5), «τὸ αὐτό» sin sustantivo (Mt 5:46), «ἐπὶ τὸ αὐτό» = juntos (Hch 2:1)', () => {
        expect(usos('1CO/12.json', 5)).toEqual([['αὐτὸς', 'identical', 'κύριος']]);
        expect(usos('MAT/5.json', 46)).toEqual([['αὐτὸ', 'identical', undefined]]);
        expect(usos('ACT/2.json', 1)).toEqual([['αὐτό', 'identical', undefined, 'juntos']]);
    });
    it('con una pospositiva en medio (revisión de #757): «Αὐτὸς δὲ ὁ θεός», «αὐτὸς γὰρ ὁ πατήρ», «Αὐτὸς δὲ ἐγώ», «ὁ γὰρ αὐτὸς κύριος»', () => {
        expect(usos('1TH/5.json', 23)).toEqual([['Αὐτὸς', 'intensive', 'θεὸς']]);
        expect(usos('JHN/16.json', 27)).toEqual([['αὐτὸς', 'intensive', 'πατὴρ']]);
        expect(usos('2CO/10.json', 1)).toEqual([['Αὐτὸς', 'intensive', 'ἐγὼ']]);
        expect(usos('ROM/10.json', 12)).toEqual([['αὐτὸς', 'identical', 'κύριος']]);
        expect(usos('1CO/12.json', 4)).toEqual([['αὐτὸ', 'identical', 'πνεῦμα']]);
        expect(usos('HEB/9.json', 19)).toEqual([['αὐτό', 'intensive', 'βιβλίον']]);
        expect(usos('2CO/11.json', 14)).toEqual([['αὐτὸς', 'intensive', 'Σατανᾶς']]);
        // Tras puntuación, el pronombre anterior no lo bloquea: «τελειώσω αὐτά, αὐτὰ τὰ ἔργα» (Jn 5:36).
        expect(usos('JHN/5.json', 36).filter(u => u[1] === 'intensive')).toEqual([['αὐτὰ', 'intensive', 'ἔργα']]);
    });
    it('«αὐτῇ τῇ ὥρᾳ» tras un verbo (Lc 24:33); «κατὰ τὸ αὐτό» = juntos (Hch 14:1), pero «κατὰ τὰ αὐτά» no (Lc 6:23)', () => {
        expect(usos('LUK/24.json', 33)).toEqual([['αὐτῇ', 'intensive', 'ὥρᾳ']]);
        expect(usos('ACT/14.json', 1)).toEqual([['αὐτὸ', 'identical', undefined, 'juntos']]);
        expect(usos('LUK/6.json', 23)).toEqual([['αὐτὰ', 'identical', undefined]]);
    });
    it('NO: pronombre con aposición de un adjetivo («αὐτοῖς δὲ τοῖς κλητοῖς», 1 Co 1:24)', () => {
        expect(usos('1CO/1.json', 24)).toEqual([]);
    });
    it('NO (medido): posesivo + aposición (Jn 9:18), objeto de un verbo (Jn 18:2), artículo + participio (Lc 1:36), tras puntuación (Mt 14:2), predicado (1 Jn 2:2)', () => {
        expect(usos('JHN/9.json', 18)).toEqual([]);
        expect(usos('JHN/18.json', 2)).toEqual([]);
        expect(usos('LUK/1.json', 36)).toEqual([]);
        expect(usos('MAT/14.json', 2)).toEqual([]);
        expect(usos('1JN/2.json', 2)).toEqual([]);
    });
    it('el pronombre explícito (G4) usa la misma regla: el intensivo no lo es; el sujeto con predicado sí (1 Jn 2:2)', () => {
        const pronombres = (rel: string, v: number) => greekDiscourseCandidates(cargar(rel), v).filter(c => c.rule === 'overtPronoun').map(c => texto(cargar(rel), v, c.ordinal));
        expect(pronombres('MRK/12.json', 36)).toEqual([]);
        expect(pronombres('JHN/16.json', 27)).toEqual(['ὑμεῖς', 'ἐγὼ']); // «αὐτὸς γὰρ ὁ πατὴρ φιλεῖ»: αὐτός no (el sujeto es πατήρ)
        expect(pronombres('1JN/2.json', 2)).toEqual(['αὐτὸς']);
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
        expect(t).toMatch(/2\. ὑπὸ νόμου: AGENTE ÚLTIMO .* de la pasiva ἐλεγχόμενοι.*PERSONIFICACIÓN/);
        expect(t).toMatch(/3\. τοῦ: artículo ANAFÓRICO — retoma νόμον \(v\. 8\)/);
        expect(buildNominalFactsTask([], [], [])).toBe('');
    });
    it('αὐτός: la ficha lleva el uso y lo que realza (sin puntuación); el prompt pide traducirlo así', () => {
        const autos = [{ ordinal: 1, use: 'intensive' as const, rule: 'autosIntensive' as const, headOrdinal: 3 }];
        const out = applyNominalRules([{ text: 'ὅτι' }, { text: 'αὐτὸς', autosUse: 'identical' as const }, { text: 'ὁ' }, { text: 'κύριος,', translation: ' el Señor ' }], [], [], autos);
        expect(out[1]).toEqual({ text: 'αὐτὸς', autosUse: 'intensive', nominalRule: 'autosIntensive', autosHeadText: 'κύριος', autosHeadTranslation: 'el Señor' });
        expect(applyNominalRules([{ text: 'αὐτὸς', autosUse: 'intensive' as const, nominalRule: 'autosIntensive' as const }], [], [])[0]).toEqual({ text: 'αὐτὸς' });
        expect(buildNominalFactsTask([], [], ['ὅτι', 'αὐτὸς', 'ὁ', 'κύριος,'], autos)).toMatch(/2\. αὐτὸς: αὐτός INTENSIVO \(fuera del artículo, junto a κύριος\): «él mismo», realza a κύριος.*concordando con la palabra ESPAÑOLA que traduce κύριος/);
        expect(buildNominalFactsTask([], [], ['ἐπὶ', 'τὸ', 'αὐτό'], [{ ordinal: 2, use: 'identical', rule: 'autosIdentical', together: true }])).toMatch(/MODISMO: «juntos/);
    });
});
