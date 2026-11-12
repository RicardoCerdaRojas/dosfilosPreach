import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { greekConditionals } from '../greekConditionals';

/** La condicional en la ficha de εἰ/ἐάν (revisión del profesor, 2026-11, Stg 2:14; Wallace p. 696). */
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/gr/${rel}`, import.meta.url)), 'utf8'));
const en = (rel: string, v: number) => {
    const ch = cargar(rel);
    const ws = verseWords(ch, v);
    return greekConditionals(ch, v).map(c => ({ ...c, palabra: ws[c.ordinal]!.t.replace(/[,.;·]/g, '') }));
};

describe('la condicional en la ficha de su partícula', () => {
    it('Stg 2:14 ἐάν: 3.ª clase, presente general (la apódosis «Τί τὸ ὄφελος» no tiene verbo)', () => {
        expect(en('JAS/2.json', 14)).toEqual([{ ordinal: 4, conditionalClass: 3, use: 'presentGeneral', palabra: 'ἐὰν' }]);
    });
    it('futuro más probable con futuro o imperativo en la apódosis (Lc 19:31 ἐρεῖτε, Ro 13:4 φοβοῦ)', () => {
        expect(en('LUK/19.json', 31)[0]).toMatchObject({ conditionalClass: 3, use: 'moreProbableFuture' });
        expect(en('ROM/13.json', 4)[0]).toMatchObject({ conditionalClass: 3, use: 'moreProbableFuture' });
    });
    it('presente general también con presente indicativo (Lc 5:12, que Wallace rotula así)', () => {
        expect(en('LUK/5.json', 12)[0]).toMatchObject({ conditionalClass: 3, use: 'presentGeneral' });
    });
    it('otras clases: la clase sola, sin valor (Stg 2:9 εἰ, 1.ª clase)', () => {
        expect(en('JAS/2.json', 9)).toEqual([{ ordinal: 0, conditionalClass: 1, palabra: 'εἰ' }]);
    });
});
