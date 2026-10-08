import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clausesOfVerse, verseWords, type ChapterStructure } from '../chapterStructure';

/**
 * Banco de regresión con los casos del profesor del fundador (2026-10-07),
 * sobre los datos GENERADOS (`scripts/language-structure/build.mjs`). Fija lo
 * que el dato dice; si una versión nueva de MACULA / OSHB / MorphGNT lo cambia,
 * esto falla y se revisa antes de publicar.
 */
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const santiago2 = cargar('gr/JAS/2.json');
const rut1 = cargar('he/Ruth/1.json');
const texto = (ch: ChapterStructure, rs: readonly string[]) => rs.map(r => ch.words.find(w => w.r === r)!.t.replace(/[,.;·]/g, '')).join(' ');

describe('banco del profesor — griego (Santiago 2)', () => {
    it('2:9: la prótasis es subordinada adverbial dentro de la apódosis, que tiene el objeto antes del verbo', () => {
        const cl = clausesOfVerse(santiago2, 9);
        const protasis = cl.find(c => texto(santiago2, c.words) === 'εἰ προσωπολημπτεῖτε')!;
        expect(protasis.clause).toMatchObject({ rule: 'sub-CL', role: 'adv' });
        const apodosis = santiago2.clauses[protasis.clause.p!]!;
        expect(texto(santiago2, apodosis.w)).toBe('ἁμαρτίαν ἐργάζεσθε');
        const roles = apodosis.w.map(r => santiago2.words.find(w => w.r === r)!.role);
        expect(roles).toEqual(['o', 'v']);
    });

    it('2:9: εἰ + presente indicativo (condicional de 1.ª clase) y ἐλεγχόμενοι pasivo (agencia con ὑπό)', () => {
        const ws = verseWords(santiago2, 9);
        expect(ws[0]!.t).toBe('εἰ');
        expect(ws.find(w => w.t.startsWith('προσωπολημπτεῖτε'))!.parse).toBe('2PAI-P--');
        expect(ws.find(w => w.t === 'ἐλεγχόμενοι')!.parse).toBe('-PPPNPM-');
        expect(ws.find(w => w.t === 'ὑπὸ')!.l).toBe('ὑπό');
    });

    it('2:7: αὐτοί es sujeto explícito de un verbo que ya marca 3.ª plural (pronombre enfático)', () => {
        const ws = verseWords(santiago2, 7);
        expect(ws.find(w => w.t === 'αὐτοὶ')).toMatchObject({ role: 's', parse: '----NPM-' });
        expect(ws.find(w => w.t === 'βλασφημοῦσιν')).toMatchObject({ role: 'v', parse: '3PAI-P--' });
    });

    it('2:8 → 2:9: νόμος aparece en el versículo anterior (artículo anafórico)', () => {
        expect(verseWords(santiago2, 8).some(w => w.l === 'νόμος')).toBe(true);
        expect(verseWords(santiago2, 9).some(w => w.l === 'νόμος')).toBe(true);
    });
});

describe('banco del profesor — hebreo (Rut 1)', () => {
    it('1:13 תֵּעָגֵנָה es 2FP y 1:16 תִּפְגְּעִי es yusivo, según OSHB', () => {
        expect(verseWords(rut1, 13).find(w => w.m === 'HVNi2fp')).toBeDefined();
        expect(verseWords(rut1, 16).find(w => w.m === 'HVqj2fs')).toBeDefined();
    });

    it('1:14 וְרוּת דָּבְקָה בָּהּ: sujeto antes del verbo (S-V-PP), la cláusula disyuntiva', () => {
        const c = clausesOfVerse(rut1, 14).find(x => x.clause.rule === 'S-V-PP')!;
        expect(c).toBeDefined();
        expect(rut1.words.find(w => w.r === c.words[0])!.role).toBe('s');
    });

    it('1:16 עַמֵּךְ עַמִּי: cláusula nominal (S-P) que entra sin conjunción; la siguiente, con waw', () => {
        const nominales = clausesOfVerse(rut1, 16).filter(x => x.clause.rule === 'S-P');
        expect(nominales).toHaveLength(2);
        const primera = rut1.words.find(w => w.r === nominales[0]!.words[0])!;
        const segunda = rut1.words.find(w => w.r === nominales[1]!.words[0])!;
        expect(primera.parts?.[0]?.m).not.toBe('C');
        expect(segunda.parts?.[0]?.m).toBe('C');
    });

    it('1:17 la fórmula de juramento: OSHB marca imperfecto aquí (la excepción a sus 11 yusivos)', () => {
        const ws = verseWords(rut1, 17);
        expect(ws.find(w => w.l.startsWith('6213'))!.m).toBe('HVqi3ms');
        expect(ws.find(w => w.l === '3254')!.m).toBe('HVhi3ms');
    });

    it('el ketiv queda marcado y fuera de las palabras del versículo (1:8)', () => {
        expect(rut1.words.some(w => w.r.startsWith('8!') && w.ketiv)).toBe(true);
        expect(verseWords(rut1, 8).some(w => w.ketiv)).toBe(false);
    });
});
