import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verseWords, type ChapterStructure } from '@dosfilos/domain';
import { alinearConAnalisis } from '../alinearHebreo';

const rut1 = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'public', 'language-data', 'v1', 'he', 'Ruth', '1.json'), 'utf8')) as ChapterStructure;
const palabras = verseWords(rut1, 16);

describe('estructura hebrea → palabras del análisis', () => {
    it('con las mismas palabras, una a una', () => {
        const analisis = palabras.map(w => ({ hebrewText: w.t }));
        expect(alinearConAnalisis(analisis, palabras)).toEqual(palabras.map((_, i) => i));
    });

    it('si el análisis junta «אֶל־אֲשֶׁר» (maqaf), las dos palabras de la estructura apuntan a la misma tarjeta', () => {
        const i = palabras.findIndex(w => w.t.startsWith('אֶל'));
        expect(i).toBeGreaterThan(0);
        const analisis = [
            ...palabras.slice(0, i).map(w => ({ hebrewText: w.t })),
            { hebrewText: `${palabras[i]!.t}־${palabras[i + 1]!.t}` },
            ...palabras.slice(i + 2).map(w => ({ hebrewText: w.t })),
        ];
        const out = alinearConAnalisis(analisis, palabras);
        expect(out[i]).toBe(i);
        expect(out[i + 1]).toBe(i);
        expect(out[i + 2]).toBe(i + 1);
        expect(out[out.length - 1]).toBe(analisis.length - 1);
    });
});
