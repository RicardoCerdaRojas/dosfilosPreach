import { describe, it, expect } from 'vitest';
import { clausesOfVerse } from '../chapterStructure';

const w = (r: string) => ({ r, t: r, l: '', role: '' });
const ch = {
    lang: 'gr' as const, book: 'X', chapter: 1,
    words: ['1!1', '1!2', '2!1', '2!2', '2!3', '2!4'].map(w),
    clauses: [
        { p: null, rule: 'Conj-CL', role: '', w: ['1!2', '2!1'] }, // empieza en el v. 1 y sigue en el 2
        { p: 0, rule: 'S-V', role: '', w: ['2!2', '2!3'] },
        { p: 1, rule: 'sub-CL', role: 'adv', w: ['2!4'] },
        { p: null, rule: 'V', role: '', w: ['1!1'] },
    ],
};

describe('las cláusulas de un versículo', () => {
    it('en el orden del texto, con su profundidad y sólo sus palabras de ese versículo', () => {
        const r = clausesOfVerse(ch, 2);
        expect(r.map(c => [c.index, c.depth, c.words])).toEqual([
            [0, 0, ['2!1']],
            [1, 1, ['2!2', '2!3']],
            [2, 2, ['2!4']],
        ]);
    });

    it('un ancestro que no toca el versículo no suma profundidad', () => {
        const r = clausesOfVerse({ ...ch, clauses: [ch.clauses[0]!, { ...ch.clauses[1]!, w: ['2!2'] }, { ...ch.clauses[2]!, p: 1 }].map((c, i) => (i === 0 ? { ...c, w: ['1!2'] } : c)) }, 2);
        expect(r.map(c => c.depth)).toEqual([0, 1]);
    });

    it('el orden es el del texto aunque el índice diga otra cosa (Stg 2:9: la prótasis va antes y tiene índice mayor)', () => {
        const c = {
            ...ch,
            words: ['9!1', '9!2', '9!3', '9!4'].map(w),
            clauses: [
                { p: null, rule: 'S-V', role: '', w: ['9!3', '9!4'] },
                { p: 0, rule: 'sub-CL', role: 'adv', w: ['9!1', '9!2'] },
            ],
        };
        expect(clausesOfVerse(c, 9).map(x => x.index)).toEqual([1, 0]);
    });
});

