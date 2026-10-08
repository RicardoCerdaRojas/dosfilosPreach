import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { verseStructure } from '../verseStructure';

/**
 * Sobre TODO el corpus generado: la vista «Estructura» muestra cada palabra del
 * versículo exactamente una vez (ni perdidas, ni repetidas, ni de otro
 * versículo) y sin errores. La revisión adversarial de G1 + G5 encontró 213
 * palabras griegas y 740 hebreas que no salían en ninguna fila, 15 versículos
 * con palabras repetidas y 4 con palabras del versículo anterior.
 */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/', import.meta.url));

describe('estructura — invariante sobre todo el corpus', () => {
    it.each(['gr', 'he'])('%s: cada palabra del versículo, una sola vez', lang => {
        const malos: string[] = [];
        let versos = 0;
        for (const libro of readdirSync(`${BASE}${lang}`)) {
            for (const archivo of readdirSync(`${BASE}${lang}/${libro}`)) {
                const ch = JSON.parse(readFileSync(`${BASE}${lang}/${libro}/${archivo}`, 'utf8')) as ChapterStructure;
                for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) {
                    versos++;
                    const vista = verseStructure(ch, v).flatMap(n => n.words.map(w => w.r)).sort();
                    const esperadas = verseWords(ch, v).map(w => w.r).sort();
                    if (vista.join() !== esperadas.join()) malos.push(`${libro} ${archivo} ${v}`);
                }
            }
        }
        expect(versos).toBeGreaterThan(lang === 'gr' ? 7900 : 23000);
        expect(malos.slice(0, 10)).toEqual([]);
    }, 120_000);
});
