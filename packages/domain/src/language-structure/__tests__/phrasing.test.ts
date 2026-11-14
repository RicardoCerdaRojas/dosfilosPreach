import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { versePhrases, type ChapterStructure } from '../chapterStructure';
import { verseStructure } from '../verseStructure';
import { diagramLines } from '../phrasing';

/** U11c (revisión del profesor, p. 15): el diagrama de Stg 2:18 con las frases en su línea (Fee). */
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const santiago2 = cargar('gr/JAS/2.json');
const diagrama = (ch: ChapterStructure, v: number) => {
    const ns = verseStructure(ch, v);
    const base = Math.min(...ns.map(n => n.depth));
    return diagramLines(ns, versePhrases(ch, v)).map(l => [l.depth - base, l.kind, l.words.map(w => w.t).join(' ')]);
};

describe('diagrama por frases (U11c)', () => {
    it('Stg 2:18: «χωρὶς τῶν ἔργων» y «ἐκ τῶν ἔργων μου» bajan un nivel; «τὴν πίστιν» vuelve a su cláusula; «κἀγώ σοι δείξω» al margen, como el profesor', () => {
        expect(diagrama(santiago2, 18).slice(3)).toEqual([
            [0, 'clause', 'δεῖξόν μοι τὴν πίστιν σου'],
            [1, 'phrase', 'χωρὶς τῶν ἔργων,'],
            [0, 'clause', 'κἀγώ σοι δείξω'],
            [1, 'phrase', 'ἐκ τῶν ἔργων μου'],
            [0, 'continuation', 'τὴν πίστιν.'],
        ]);
    });

    it('quedan en la línea: la que va con un nombre (Stg 2:16 «τις … ἐξ ὑμῶν») y la antepuesta (Stg 2:21 «ἐξ ἔργων ἐδικαιώθη»)', () => {
        expect(diagrama(santiago2, 16)[0]![2]).toContain('ἐξ ὑμῶν');
        expect(diagrama(santiago2, 21).map(l => l[2])).toContain('ἐξ ἔργων ἐδικαιώθη,');
    });

    it('Stg 2:14: sin frases, una línea por fila (la estructura del profesor)', () => {
        expect(diagrama(santiago2, 14).map(l => l.slice(0, 2))).toEqual([[0, 'clause'], [1, 'clause'], [1, 'clause'], [0, 'clause'], [1, 'clause']]);
    });

    it('cada palabra del versículo, una vez, en el orden de las filas', () => {
        for (const v of [14, 16, 18, 21]) {
            const ns = verseStructure(santiago2, v);
            expect(diagramLines(ns, versePhrases(santiago2, v)).flatMap(l => l.words.map(w => w.r))).toEqual(ns.flatMap(n => n.words.map(w => w.r)));
        }
    });
});
