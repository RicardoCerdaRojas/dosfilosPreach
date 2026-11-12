import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { verseWords } from '../chapterStructure';
import { buildSameLemmaTask, greekSameLemma } from '../greekSameLemma';
import { buildGreekInsightPrompt } from '../../greek-analyzer/buildGreekInsightPrompt';
import type { GreekWordToken } from '../../greek-analyzer/morphGntToken';

const RAIZ = fileURLToPath(new URL('../../../../web/public/language-data/v1/gr/', import.meta.url));
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${RAIZ}${rel}`, 'utf8'));
const textos = (ch: ChapterStructure, v: number) => verseWords(ch, v).map(w => w.t);

describe('el mismo lema con otra glosa en contexto (U10, revisión del profesor)', () => {
    it('Stg 3:5: ἡλίκον «small» / ἡλίκην «how great» — la glosa de MACULA las distingue', () => {
        const [f, ...resto] = greekSameLemma(cargar('JAS/3.json'), 5);
        expect(resto).toEqual([]);
        expect(f!.lemma).toBe('ἡλίκος');
        expect(f!.words).toEqual([{ ordinal: 11, gloss: 'small' }, { ordinal: 13, gloss: 'how great' }]);
    });

    it('Lc 12:42: κύριος «Lord» (quien habla) / «master» (el amo de la parábola)', () => {
        const fs = greekSameLemma(cargar('LUK/12.json'), 42);
        expect(fs.map(f => [f.lemma, f.words.map(w => w.gloss)])).toEqual([['κύριος', ['Lord', 'master']]]);
    });

    it('NO: el lema repetido con la MISMA glosa (Stg 3:5 no marca μικρὸν/μεγάλα; Mt 15:14 τυφλός siempre «blind»)', () => {
        expect(greekSameLemma(cargar('MAT/15.json'), 14)).toEqual([]);
        expect(greekSameLemma(cargar('JAS/3.json'), 4)).toEqual([]);
        expect(greekSameLemma(cargar('../he/Ruth/1.json'), 1)).toEqual([]);
    });

    it('INVARIANTE del corpus: cada palabra con glosa (`g`) tiene otra con su mismo lema en el versículo; son 157 versículos', () => {
        let versiculos = 0;
        for (const libro of readdirSync(RAIZ)) {
            for (const cap of readdirSync(`${RAIZ}${libro}`)) {
                const ch = cargar(`${libro}/${cap}`);
                const vs = new Set(ch.words.filter(w => w.g).map(w => Number(w.r.split('!')[0])));
                for (const v of vs) {
                    const fs = greekSameLemma(ch, v);
                    const conG = verseWords(ch, v).filter(w => w.g).length;
                    expect(fs.reduce((n, f) => n + f.words.length, 0), `${libro} ${cap} ${v}`).toBe(conG);
                    versiculos++;
                }
            }
        }
        expect(versiculos).toBe(157);
    });

    it('la pista del prompt: cada aparición con su número, su texto y su glosa; y pide la literal también', () => {
        const ch = cargar('JAS/3.json');
        const t = buildSameLemmaTask(greekSameLemma(ch, 5), textos(ch, 5));
        expect(t).toContain('- ἡλίκος: 12. ἡλίκον «small»; 14. ἡλίκην «how great»');
        expect(t).toMatch(/TAMBIÉN en la literal/);
        expect(buildSameLemmaTask([], textos(ch, 5))).toBe('');
    });

    it('el prompt griego la lleva sólo si hay hechos', () => {
        const ch = cargar('JAS/3.json');
        const tokens = verseWords(ch, 5).map(w => ({ text: w.t, lemma: w.l, pos: 'N', tag: {} }) as unknown as GreekWordToken);
        const con = buildGreekInsightPrompt({ reference: 'JAS 3:5', tokens, sameLemma: greekSameLemma(ch, 5) });
        const sin = buildGreekInsightPrompt({ reference: 'JAS 3:5', tokens });
        expect(con).toContain('MISMO LEMA, GLOSAS DISTINTAS EN CONTEXTO');
        expect(con.indexOf('MISMO LEMA')).toBeLessThan(con.indexOf('REGLAS:'));
        expect(sin).not.toContain('MISMO LEMA');
    });
});
