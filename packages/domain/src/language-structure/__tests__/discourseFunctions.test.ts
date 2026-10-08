import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { applyDiscourseRules, buildDiscourseTask, DISCOURSE_RULES, discourseRuleDecides, greekDiscourseCandidates } from '../discourseFunctions';

/** G4 — partículas (Runge) y el pronombre explícito (profesor #G1). */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/gr/', import.meta.url));
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${BASE}${rel}`, 'utf8'));
const de = (rel: string, v: number, t: string) => {
    const ch = cargar(rel);
    const ws = verseWords(ch, v);
    return { ws, c: greekDiscourseCandidates(ch, v).find(x => ws[x.ordinal]!.t.replace(/[,.;·’]/g, '') === t) };
};

describe('G4 — pronombre explícito (#G1)', () => {
    it('Stg 2:7 «οὐκ αὐτοὶ βλασφημοῦσιν»: αὐτοί sobra porque -ουσιν ya dice «ellos»', () => {
        const { ws, c } = de('JAS/2.json', 7, 'αὐτοὶ');
        expect(c).toMatchObject({ rule: 'overtPronoun', allowed: ['emphasis', 'contrast'] });
        expect(ws[c!.verbOrdinal!]!.t).toBe('βλασφημοῦσιν');
    });
    it('Stg 2:6 «ὑμεῖς δὲ ἠτιμάσατε»', () => {
        const { ws, c } = de('JAS/2.json', 6, 'ὑμεῖς');
        expect(ws[c!.verbOrdinal!]!.t).toBe('ἠτιμάσατε');
    });
    it('NO: un genitivo (1 Co 1:4 «τῷ θεῷ μου»), ni un sujeto compuesto que no repite la persona del verbo (Jn 10:30 «ἐγὼ καὶ ὁ πατὴρ … ἐσμεν»)', () => {
        expect(de('1CO/1.json', 4, 'μου').c).toBeUndefined();
        expect(de('JHN/10.json', 30, 'ἐγὼ').c).toBeUndefined();
    });
});

describe('G4 — conectores y partículas (Runge)', () => {
    it('δέ = desarrollo y γάρ = apoyo, por regla; οὖν y ἀλλά, el asistente elige entre dos', () => {
        expect(de('JAS/2.json', 9, 'δὲ').c).toMatchObject({ decided: 'development', rule: 'deDevelopment' });
        expect(de('JHN/3.json', 16, 'γὰρ').c).toMatchObject({ decided: 'explanation' });
        // ἀλλά tras una negación = corrección, por regla (Jn 3:16 «μὴ ἀπόληται ἀλλ’ ἔχῃ», prueba del
        // fundador; Jn 3:17, con la negación lejos). Sin negación antes, elige el asistente (Mc 14:36, el primero).
        expect(de('JHN/3.json', 16, 'ἀλλὰ').c).toMatchObject({ rule: 'allaAfterNegation', decided: 'correction' });
        expect(de('JHN/3.json', 17, 'ἀλλ').c).toMatchObject({ rule: 'allaAfterNegation', decided: 'correction' });
        const mc = cargar('MRK/14.json');
        const allas = greekDiscourseCandidates(mc, 36).filter(c => verseWords(mc, 36)[c.ordinal]!.l === 'ἀλλά');
        expect(allas.map(c => c.rule)).toEqual(['allaCorrection', 'allaAfterNegation']);
        // 2 Co 4:16: el segundo ἀλλά («aun así», tras εἰ καί) NO corrige la negación del primero.
        const co = cargar('2CO/4.json');
        const allas416 = greekDiscourseCandidates(co, 16).filter(c => verseWords(co, 16)[c.ordinal]!.l === 'ἀλλά');
        expect(allas416.map(c => c.rule)).toEqual(['allaAfterNegation', 'allaCorrection']);
        expect(discourseRuleDecides('ounInference')).toBe(false);
        expect(discourseRuleDecides('deDevelopment')).toBe(true);
        expect(discourseRuleDecides('overtPronoun')).toBe(false);
    });
    it('καί adverbial (1 P 3:14 «εἰ καὶ πάσχοιτε», «aun») es aditivo, no continuidad; μόνον restringe (Stg 2:24)', () => {
        expect(de('1PE/3.json', 14, 'καὶ').c).toMatchObject({ rule: 'kaiAdditive' });
        expect(de('JAS/2.json', 24, 'μόνον').c).toMatchObject({ decided: 'restrictive' });
    });
    it('sobre todo el NT, cada regla se cumple alguna vez; δέ son las 2.766 del NT', () => {
        const usos = new Map<string, number>();
        for (const libro of readdirSync(BASE)) for (const f of readdirSync(`${BASE}${libro}`)) {
            const ch = cargar(`${libro}/${f}`);
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) for (const c of greekDiscourseCandidates(ch, v)) usos.set(c.rule, (usos.get(c.rule) ?? 0) + 1);
        }
        expect([...DISCOURSE_RULES.map(r => r.rule), 'overtPronoun'].filter(r => !usos.get(r))).toEqual([]);
        expect(usos.get('deDevelopment')).toBe(2766);
    }, 60_000);
});

describe('G4 — revisión adversarial (lo que la regla NO debe decidir)', () => {
    const reglaDe = (rel: string, v: number, t: string) => de(rel, v, t).c?.rule;
    it('καί coordinante con rol de frase NO es «también» (1 Co 1:3 «χάρις ὑμῖν καὶ εἰρήνη»)', () => {
        expect(reglaDe('1CO/1.json', 5, 'καὶ')).toBe('kaiContinuity');   // «λόγῳ καὶ πάσῃ γνώσει», rol adv
    });
    it('αὐτός intensivo y sujeto compuesto NO son pronombre explícito', () => {
        expect(de('1TH/4.json', 16, 'αὐτὸς').c).toBeUndefined();   // αὐτὸς ὁ κύριος
        expect(de('1CO/11.json', 14, 'αὐτὴ').c).toBeUndefined();   // ἡ φύσις αὐτή
        expect(de('JHN/18.json', 1, 'αὐτὸς').c).toBeUndefined();   // αὐτὸς καὶ οἱ μαθηταί
        expect(de('MRK/14.json', 44, 'αὐτός').c).toBeUndefined();  // predicado: «αὐτός ἐστιν»
        expect(de('1CO/14.json', 12, 'ὑμεῖς').c).toMatchObject({ rule: 'overtPronoun' }); // MACULA: aux, pero sí sujeto
    });
    it('«οὐ μόνον … ἀλλὰ καί» no corrige; la negación de otra oración tampoco; οὐχί sí', () => {
        expect(reglaDe('PHP/1.json', 29, 'ἀλλὰ')).toBe('allaCorrection');
        expect(reglaDe('ROM/7.json', 7, 'ἀλλὰ')).toBe('allaCorrection');   // μὴ γένοιτο· ἀλλά
        expect(reglaDe('LUK/21.json', 9, 'ἀλλ')).toBe('allaCorrection');  // μὴ πτοηθῆτε· … ἀλλ’ οὐκ
        expect(reglaDe('LUK/13.json', 3, 'ἀλλ')).toBe('allaAfterNegation'); // οὐχί, ἀλλά
    });
    it('μόνον tras negación restringe (1 Ts 2:8 «οὐ μόνον»)', () => {
        expect(reglaDe('1TH/2.json', 8, 'μόνον')).toBe('mononRestrictive');
    });
    it('excepciones por lema: «εἰ ἄρα», «μέν» sin δέ, «εἰ δὲ μή γε»', () => {
        expect(reglaDe('ACT/8.json', 22, 'ἄρα')).toBeUndefined();
        expect(reglaDe('ACT/1.json', 18, 'μὲν')).toBeUndefined();
        expect(reglaDe('2CO/11.json', 16, 'γε')).toBeUndefined();
        expect(reglaDe('ROM/1.json', 8, 'μὲν')).toBeUndefined();   // «Πρῶτον μέν», sin δέ
        expect(reglaDe('MAT/3.json', 11, 'μὲν')).toBe('menPoint');  // ἐγὼ μὲν … ὁ δέ
    });
});

describe('G4 — aplicado al mostrar', () => {
    const cands = [
        { ordinal: 1, allowed: ['development'] as const, decided: 'development' as const, rule: 'deDevelopment' as const },
        { ordinal: 0, allowed: ['emphasis', 'contrast'] as const, rule: 'overtPronoun' as const, verbOrdinal: 2 },
    ];
    it('lo decidido manda (y se quita lo que enlazaba otra elección); el pronombre lleva su verbo', () => {
        const out = applyDiscourseRules([{ text: 'αὐτοὶ', discourseFunction: 'contrast', connects: 'con los ricos' }, { text: 'δὲ', discourseFunction: 'contrast', connects: 'x' }, { text: 'βλασφημοῦσιν' }] as never[], cands as never);
        expect(out[1]).toEqual({ text: 'δὲ', discourseFunction: 'development', discourseRule: 'deDevelopment' });
        expect(out[0]).toMatchObject({ discourseFunction: 'contrast', connects: 'con los ricos', overtPronounVerb: 2, overtPronounVerbText: 'βλασφημοῦσιν' });
    });
    it('el prompt pide elegir donde hay opciones y explicar donde está decidido, con el número de la lista', () => {
        const t = buildDiscourseTask(cands as never, ['αὐτοὶ', 'δὲ', 'βλασφημοῦσιν']);
        expect(t).toMatch(/1\. αὐτοὶ — pronombre EXPLÍCITO: el verbo βλασφημοῦσιν ya marca/);
        expect(t).toMatch(/2\. δὲ — FUNCIÓN YA DECIDIDA: devuelve "discourseFunction": "development"/);
        expect(buildDiscourseTask([], [])).toBe('');
    });
});
