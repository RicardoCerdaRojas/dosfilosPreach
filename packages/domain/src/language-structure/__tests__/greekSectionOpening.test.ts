import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { verseWords } from '../chapterStructure';
import { greekSectionOpening } from '../greekSectionOpening';

const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/gr/${rel}`, import.meta.url)), 'utf8'));
const jas = (c: number) => cargar(`JAS/${c}.json`);

describe('la apertura de sección: vocativo + imperativo o pregunta (U9, revisión del profesor)', () => {
    it('Stg 3:1: el vocativo en la 5.ª palabra, tras el imperativo γίνεσθε', () => {
        const f = greekSectionOpening(jas(3), 1)!;
        const ws = verseWords(jas(3), 1);
        expect(ws[f.vocativeOrdinal]!.t).toMatch(/^ἀδελφοί/);
        expect(ws[f.imperativeOrdinal!]!.t).toMatch(/^γίνεσθε/);
    });

    it('con pregunta en vez de imperativo también (Stg 2:14 «Τί τὸ ὄφελος, ἀδελφοί μου»)', () => {
        expect(greekSectionOpening(jas(2), 14)).toMatchObject({ question: true });
        expect(greekSectionOpening(jas(2), 14)!.imperativeOrdinal).toBeUndefined();
    });

    it('las del bosquejo con vocativo: 1:2, 1:19, 2:1, 2:5, 2:20, 4:11, 5:7, 5:12', () => {
        for (const [c, v] of [[1, 2], [1, 19], [2, 1], [2, 5], [2, 20], [4, 11], [5, 7], [5, 12]] as const) {
            expect(greekSectionOpening(jas(c), v), `${c}:${v}`).toBeDefined();
        }
    });

    it('NO: vocativo tarde (Stg 3:10, 11.ª palabra); vocativo sin imperativo ni pregunta (Stg 5:19); sin vocativo (Stg 2:8)', () => {
        expect(greekSectionOpening(jas(3), 10)).toBeUndefined();
        expect(greekSectionOpening(jas(5), 19)).toBeUndefined();
        expect(greekSectionOpening(jas(2), 8)).toBeUndefined();
        expect(greekSectionOpening(cargar('../he/Ruth/1.json' as never), 1)).toBeUndefined();
    });

    it('ES SEÑAL, NO REGLA: Stg 3:12 (pregunta retórica en medio del argumento) también la da — por eso la ficha dice «suele»', () => {
        expect(greekSectionOpening(jas(3), 12)).toBeDefined();
    });
});
