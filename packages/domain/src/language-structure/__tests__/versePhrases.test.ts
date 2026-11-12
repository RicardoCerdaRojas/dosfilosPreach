import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, versePhrases, type ChapterStructure } from '../chapterStructure';

/** U11b (revisión del profesor, Stg 2:16 y 2:21: «¿un interruptor para marcarlas?»): las frases de MACULA. */
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const textos = (ch: ChapterStructure, v: number) => {
    const t = new Map(verseWords(ch, v).map(w => [w.r, w.t]));
    return versePhrases(ch, v).map(f => [f.rs.map(r => t.get(r)).join(' '), f.kind]);
};

describe('frases preposicionales del versículo (U11b)', () => {
    it('Stg 2:16: «ἐξ ὑμῶν» va con τις (adnominal); «ἐν εἰρήνῃ» con el verbo', () => {
        expect(textos(cargar('gr/JAS/2.json'), 16)).toEqual([['ἐξ ὑμῶν·', 'n'], ['ἐν εἰρήνῃ,', 'a']]);
    });

    it('Stg 2:18: «χωρὶς τῶν ἔργων» y «ἐκ τῶν ἔργων μου», con el verbo; Stg 2:21 «ἐξ ἔργων»', () => {
        expect(textos(cargar('gr/JAS/2.json'), 18)).toEqual([['χωρὶς τῶν ἔργων,', 'a'], ['ἐκ τῶν ἔργων μου', 'a']]);
        expect(textos(cargar('gr/JAS/2.json'), 21)[0]).toEqual(['ἐξ ἔργων', 'a']);
    });

    it('Rut 2:1: וּלְנָעֳמִי es el predicado; לְאִישָׁהּ y מִמִּשְׁפַּחַת אֱלִימֶלֶךְ van con un nombre', () => {
        expect(textos(cargar('he/Ruth/2.json'), 1).map(([, k]) => k)).toEqual(['p', 'n', 'n']);
    });

    it('sin frases en los datos (datos viejos), nada', () => {
        expect(versePhrases({ ...cargar('gr/JAS/2.json'), phrases: undefined }, 16)).toEqual([]);
    });
});
